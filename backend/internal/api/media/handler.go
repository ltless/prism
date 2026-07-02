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
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
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
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	id := c.Param("id")
	item, err := h.svc.Get(claims.UserID, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Upload(c echo.Context) error {
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
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
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
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
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
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
	if isFavorite, ok := body["is_favorite"]; ok {
		if b, ok := isFavorite.(bool); ok {
			if b {
				updates["is_favorite"] = 1
			} else {
				updates["is_favorite"] = 0
			}
		}
	}
	if isTrash, ok := body["is_trash"]; ok {
		if b, ok := isTrash.(bool); ok {
			if b {
				updates["is_trash"] = 1
			} else {
				updates["is_trash"] = 0
			}
		}
	}
	if isVault, ok := body["is_vault"]; ok {
		if b, ok := isVault.(bool); ok {
			if b {
				updates["is_vault"] = 1
			} else {
				updates["is_vault"] = 0
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

func (h *Handler) BulkMove(c echo.Context) error {
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	var body struct {
		MediaIDs []string `json:"media_ids"`
		FolderID *string  `json:"folder_id"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.svc.BulkMove(claims.UserID, body.MediaIDs, body.FolderID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "move failed")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) ServeFile(c echo.Context) error {
	claims := auth.GetClaims(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}

	isThumb := c.QueryParam("thumb") == "1"
	filePath := c.Param("*")

	if isThumb {
		return h.storage.ServeThumbnail(c, claims.UserID, filePath)
	}
	return h.storage.ServeFile(c, claims.UserID, filePath)
}
