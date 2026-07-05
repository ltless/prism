package media

import (
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
)

const maxUploadSize = 200 << 20 // 200MB

type Handler struct {
	svc     *Service
	storage *mw.Storage
}

func NewHandler(svc *Service, storage *mw.Storage) *Handler {
	return &Handler{svc: svc, storage: storage}
}

func (h *Handler) List(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	folderID := c.QueryParam("folder_id")
	var fID *string
	if folderID != "" {
		fID = &folderID
	}
	favorites := c.QueryParam("favorites") == "true"
	trash := c.QueryParam("trash") == "true"
	search := c.QueryParam("search")

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	// Vault items are never listable via the API — they require PIN-gated
	// access on the Next.js side. Any "vault=true" query is ignored.
	resp, err := h.svc.List(claims.UserID, fID, favorites, trash, search, page, limit)
	if err != nil {
		log.Printf("MediaList error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Get(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")
	item, err := h.svc.Get(claims.UserID, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Upload(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	if c.Request().ContentLength > maxUploadSize {
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 200MB)")
	}

	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no file uploaded")
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxUploadSize+1))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "read file failed")
	}
	if len(data) > maxUploadSize {
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 200MB)")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if err := h.storage.ValidateUpload(data, ext); err != nil {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}

	hash := fmt.Sprintf("%x", sha256.Sum256(data))
	filename := hash + ext

	// Skip the write entirely if the hash is already in the DB. The UNIQUE
	// constraint on hash is the final authority; this is an optimisation that
	// avoids orphan files on disk.
	if exists, err := h.svc.HashExists(claims.UserID, hash); err == nil && exists {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":         true,
			"isDuplicate":     true,
			"filename":        filename,
			"mediaId":         "",
			"isVideo":         false,
			"aiStatus":        "skipped",
			"transcodeStatus": "skipped",
		})
	}

	_, _, _, err = h.storage.SaveFileFromBytes(claims.UserID, data, filename)
	if err != nil {
		log.Printf("SaveFile error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	title := strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
	if title == "" {
		title = header.Filename
	}

	item, isDup, err := h.svc.Create(claims.UserID, "", filename, title, mimeType, hash, int64(len(data)), nil, nil)
	if err != nil {
		log.Printf("MediaCreate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if isDup {
		// Lost the race against a concurrent upload of the same hash — clean
		// up the file we just wrote so it doesn't orphan on disk.
		_ = h.storage.DeleteFile(claims.UserID, filename)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":         true,
			"isDuplicate":     true,
			"filename":        filename,
			"mediaId":         "",
			"isVideo":         false,
			"aiStatus":        "skipped",
			"transcodeStatus": "skipped",
		})
	}

	isVideo := len(mimeType) >= 5 && mimeType[:5] == "video"

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"isDuplicate":     false,
		"filename":        filename,
		"mediaId":         item.ID,
		"isVideo":         isVideo,
		"aiStatus":        "skipped",
		"transcodeStatus": "skipped",
	})
}

func (h *Handler) Delete(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")
	item, err := h.svc.Delete(claims.UserID, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	h.storage.DeleteFile(claims.UserID, item.FilePath)

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Update(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")

	var body map[string]interface{}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	updates := make(map[string]interface{})
	if title, ok := body["title"]; ok {
		if s, ok := title.(string); ok {
			updates["title"] = sanitizeTitle(s)
		}
	}
	if metadata, ok := body["metadata"]; ok {
		updates["metadata"] = metadata
	}
	if folderID, ok := body["folder_id"]; ok {
		updates["folder_id"] = folderID
	}
	for _, field := range []string{"is_favorite", "is_trash", "is_vault"} {
		if v, ok := body[field]; ok {
			if b, ok := v.(bool); ok {
				updates[field] = boolToInt(b)
			}
		}
	}

	if len(updates) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "no fields to update")
	}

	if err := h.svc.Update(claims.UserID, id, updates); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

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

	if err := h.svc.BulkMove(claims.UserID, body.MediaIDs, body.FolderID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "move failed")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) ServeFile(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	isThumb := c.QueryParam("thumb") == "1"
	filePath := c.Param("*")

	if isThumb {
		return h.storage.ServeThumbnail(c, claims.UserID, filePath)
	}
	return h.storage.ServeFile(c, claims.UserID, filePath)
}

const maxBulkIDs = 500

func (h *Handler) BulkFavorite(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs    []string `json:"media_ids"`
		IsFavorite  bool     `json:"is_favorite"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	val := 0
	if body.IsFavorite {
		val = 1
	}
	if err := h.svc.BulkSetField(claims.UserID, body.MediaIDs, "is_favorite", val); err != nil {
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
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	if err := h.svc.BulkSetField(claims.UserID, body.MediaIDs, "is_trash", 1); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
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
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	if err := h.svc.BulkSetField(claims.UserID, body.MediaIDs, "is_trash", 0); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) EmptyTrash(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	items, err := h.svc.EmptyTrash(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	for _, item := range items {
		_ = h.storage.DeleteFile(claims.UserID, item.FilePath)
	}
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
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.MediaIDs) > maxBulkIDs {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("too many items (max %d)", maxBulkIDs))
	}
	val := 0
	if body.IsVault {
		val = 1
	}
	if err := h.svc.BulkSetField(claims.UserID, body.MediaIDs, "is_vault", val); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) BatchAITags(c echo.Context) error {
	_, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs []string `json:"media_ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	// TODO: implement sidecar AI tagging in Part 5
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"note":    "async batch tagging queued (not yet implemented)",
	})
}

func (h *Handler) BatchAestheticScore(c echo.Context) error {
	_, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		MediaIDs []string `json:"media_ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	// TODO: implement sidecar aesthetic scoring in Part 5
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"note":    "async aesthetic scoring queued (not yet implemented)",
	})
}

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
			_ = h.storage.DeleteFile(claims.UserID, item.FilePath)
		}
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Search(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	params := SearchParams{
		Query:    c.QueryParam("q"),
		Page:     parseInt(c.QueryParam("page")),
		Limit:    parseInt(c.QueryParam("limit")),
	}

	folderID := c.QueryParam("folder_id")
	if folderID != "" {
		params.FolderID = &folderID
	}

	if tagsParam := c.QueryParam("tags"); tagsParam != "" {
		params.Tags = strings.Split(tagsParam, ",")
	}

	resp, err := h.svc.Search(claims.UserID, params)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func parseInt(s string) int {
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
