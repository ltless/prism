package media

import (
	"crypto/subtle"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"log"
	"net/http"
	"os"
)

func (h *Handler) ResolveDuplicate(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		KeepID    string   `json:"keep_id"`
		DeleteIDs []string `json:"delete_ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.KeepID == "" || len(body.DeleteIDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "keep_id and delete_ids required")
	}
	if err := h.svc.ResolveDuplicate(claims.UserID, body.KeepID, body.DeleteIDs); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	// Clean up files for deleted duplicates (best-effort)
	for _, id := range body.DeleteIDs {
		item, err := h.svc.Get(claims.UserID, id)
		if err == nil {
			h.deleteFileLogged(claims.UserID, item.FilePath)
		}
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) UpdateByHash(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	hash := c.Param("hash")

	var body mediaUpdateBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.requireVaultUnlock(c, claims, body); err != nil {
		return err
	}

	if err := h.svc.UpdateByHash(claims.UserID, hash, updateMapFrom(body)); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Nuke(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	// Feature switch: no token configured = endpoint disabled. Fail closed.
	if h.nukeToken == "" {
		return echo.NewHTTPError(http.StatusNotFound, "not found")
	}

	// Identity confirmation: the body must echo the caller's own username,
	// compared constant-time against the JWT claims. Protects against
	// accidental clicks and CSRF without a shared secret that every user
	// would learn permanently.
	var body struct {
		ConfirmUsername string `json:"confirm_username"`
	}
	if err := c.Bind(&body); err != nil || body.ConfirmUsername == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "confirm_username is required")
	}
	if subtle.ConstantTimeCompare([]byte(body.ConfirmUsername), []byte(claims.Username)) != 1 {
		return echo.NewHTTPError(http.StatusForbidden, "username confirmation mismatch")
	}

	if _, err := h.svc.DeleteAll(claims.UserID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	// Wipe the entire media directory for the user and recreate it empty.
	mediaDir := h.storage.MediaDir(claims.UserID)
	thumbDir := h.storage.ThumbDir(claims.UserID)
	if err := os.RemoveAll(mediaDir); err != nil {
		log.Printf("Nuke RemoveAll error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to remove media directory")
	}
	if err := os.MkdirAll(mediaDir, 0755); err != nil {
		log.Printf("Nuke MkdirAll media error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create media directory")
	}
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		log.Printf("Nuke MkdirAll thumb error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create thumbnail directory")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) AutoCleanup(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		OlderThan *int64 `json:"olderThan"`
	}
	if err := c.Bind(&body); err != nil {
		body.OlderThan = nil
	}

	items, err := h.svc.AutoCleanup(claims.UserID, body.OlderThan)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	// File cleanup runs off the request path with bounded concurrency — see
	// deleteFilesAsync.
	h.deleteFilesAsync(claims.UserID, items)

	return c.JSON(http.StatusOK, map[string]int{"deleted": len(items)})
}
