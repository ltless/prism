package media

import (
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"log"
	"net/http"
	"sync"
)

const maxBulkMoveIDs = 500

func (h *Handler) BulkMove(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		MediaIDs []string `json:"media_ids"`
		FolderID *string  `json:"folder_id"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if len(body.MediaIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "media_ids is required")
	}
	if len(body.MediaIDs) > maxBulkMoveIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkMoveIDs))
	}

	if err := h.svc.BulkMove(c.Request().Context(), claims.UserID, body.MediaIDs, body.FolderID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "move failed")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "bulk_move", fmt.Sprintf("ids=%d", len(body.MediaIDs)), true, c.RealIP(), "")

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

const maxBulkIDs = 500

func (h *Handler) BulkFavorite(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs   []string `json:"media_ids"`
		IsFavorite bool     `json:"is_favorite"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "media_ids is required")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	if err := h.svc.BulkSetField(c.Request().Context(), claims.UserID, body.MediaIDs, FieldFavorite, body.IsFavorite); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) BulkTrash(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs []string `json:"media_ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "media_ids is required")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	if err := h.svc.BulkSetField(c.Request().Context(), claims.UserID, body.MediaIDs, FieldTrash, true); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "bulk_trash", fmt.Sprintf("ids=%d", len(body.MediaIDs)), true, c.RealIP(), "")
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) BulkRestore(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs []string `json:"media_ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "media_ids is required")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	if err := h.svc.BulkSetField(c.Request().Context(), claims.UserID, body.MediaIDs, FieldTrash, false); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "bulk_restore", fmt.Sprintf("ids=%d", len(body.MediaIDs)), true, c.RealIP(), "")
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// deleteFileConcurrency bounds parallel disk deletions, mirroring the
// frontend zipHelper CONCURRENCY=4 chunking pattern.
const deleteFileConcurrency = 4

// deleteFilesAsync removes media/thumbnail files for already-deleted DB rows
// off the request path, with bounded concurrency (F5): empty-trash,
// auto-cleanup and friends used to loop DeleteFile synchronously inside the
// request, so a large library tied up the request goroutine for the whole
// disk walk. Failures are logged, not swallowed (F7).
// ponytail: one-shot goroutine, not a durable job queue — if the process dies
// mid-walk the files orphan (DB rows are already gone). Add a real cleanup
// job system when orphan reclamation matters.
func (h *Handler) deleteFilesAsync(userID string, items []TrashedItem) {
	if len(items) == 0 {
		return
	}
	go func() {
		jobs := make(chan TrashedItem)
		var wg sync.WaitGroup
		for w := 0; w < deleteFileConcurrency; w++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for it := range jobs {
					h.deleteFileLogged(userID, it.FilePath)
				}
			}()
		}
		for _, it := range items {
			jobs <- it
		}
		close(jobs)
		wg.Wait()
	}()
}

// deleteFileLogged removes a media file best-effort, logging failures (F7):
// a silently-swallowed delete error leaves an orphaned file with no trace.
func (h *Handler) deleteFileLogged(userID, filePath string) {
	if err := h.storage.DeleteFile(userID, filePath); err != nil {
		log.Printf("DeleteFile failed %s: %v", filePath, err)
	}
}

func (h *Handler) EmptyTrash(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	items, err := h.svc.EmptyTrash(c.Request().Context(), claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "empty_trash", fmt.Sprintf("items=%d", len(items)), true, c.RealIP(), "")
	// File cleanup runs off the request path with bounded concurrency — see
	// deleteFilesAsync.
	h.deleteFilesAsync(claims.UserID, items)
	return c.JSON(http.StatusOK, map[string]int{"deleted": len(items)})
}

func (h *Handler) BulkVault(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs []string `json:"media_ids"`
		IsVault  bool     `json:"is_vault"`
		Pin      string   `json:"pin"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "media_ids is required")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	// Moving media out of the vault is a protected operation: require the
	// vault PIN server-side (the UI lock alone is not a security boundary).
	if !body.IsVault {
		if err := h.checkVaultPin(c, claims, body.Pin); err != nil {
			return err
		}
	}
	if err := h.svc.BulkSetField(c.Request().Context(), claims.UserID, body.MediaIDs, FieldVault, body.IsVault); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "bulk_vault", fmt.Sprintf("ids=%d toVault=%v", len(body.MediaIDs), body.IsVault), true, c.RealIP(), "")
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
