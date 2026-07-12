package media

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/api/config"
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
	vault := c.QueryParam("vault") == "true"
	dedup := c.QueryParam("dedup") == "true"
	search := c.QueryParam("search")

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	resp, err := h.svc.List(claims.UserID, fID, favorites, trash, vault, dedup, search, page, limit)
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

	isVideo := len(mimeType) >= 5 && mimeType[:5] == "video"

	var width, height *int
	var capturedAt *int64
	var metadataJSON *string
	var duration *int
	var transcodeStatus *string

	if !isVideo {
		meta, err := mw.ExtractImageMetadata(data)
		if err == nil {
			width = &meta.Width
			height = &meta.Height
			capturedAt = meta.CapturedAt
			if len(meta.ExifData) > 0 || len(meta.Palette) > 0 {
				if len(meta.Palette) > 0 {
					if meta.ExifData == nil {
						meta.ExifData = make(map[string]interface{})
					}
					meta.ExifData["palette"] = meta.Palette
				}
				if b, err := json.Marshal(meta.ExifData); err == nil {
					s := string(b)
					metadataJSON = &s
				}
			}
		} else {
			log.Printf("Metadata extraction failed: %v", err)
		}
	} else {
		mediaPath := h.storage.MediaDir(claims.UserID) + "/" + filename
		meta, err := mw.ExtractVideoMetadata(mediaPath)
		if err == nil {
			width = &meta.Width
			height = &meta.Height
			duration = &meta.Duration
			if meta.Width > 0 && meta.Height > 0 {
				md := map[string]interface{}{
					"codec":  meta.Codec,
					"width":  meta.Width,
					"height": meta.Height,
				}
				if b, err := json.Marshal(md); err == nil {
					s := string(b)
					metadataJSON = &s
				}
			}
		} else {
			log.Printf("Video metadata extraction failed: %v", err)
		}
		pending := "pending"
		transcodeStatus = &pending
	}

	item, isDup, err := h.svc.Create(claims.UserID, "", filename, title, mimeType, hash, int64(len(data)), width, height, capturedAt, metadataJSON, duration, transcodeStatus)
	if err != nil {
		log.Printf("MediaCreate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if isDup {
		_ = h.storage.DeleteFile(claims.UserID, filename)
		ts := "skipped"
		if transcodeStatus != nil {
			ts = *transcodeStatus
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":         true,
			"isDuplicate":     true,
			"filename":        filename,
			"mediaId":         "",
			"isVideo":         isVideo,
			"aiStatus":        "skipped",
			"transcodeStatus": ts,
		})
	}

	ts := "skipped"
	if transcodeStatus != nil {
		ts = *transcodeStatus
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"isDuplicate":     false,
		"filename":        filename,
		"mediaId":         item.ID,
		"isVideo":         isVideo,
		"aiStatus":        "pending",
		"transcodeStatus": ts,
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
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	mediaDir := h.storage.MediaDir(claims.UserID)
	result, err := h.svc.BatchTag(claims.UserID, mediaDir)
	if err != nil {
		if errors.Is(err, config.ErrAIInactive) {
			return echo.NewHTTPError(http.StatusForbidden, "AI is not active")
		}
		log.Printf("BatchAITags error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if result.Error != "" {
		return c.JSON(http.StatusServiceUnavailable, result)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) BatchAestheticScore(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	mediaDir := h.storage.MediaDir(claims.UserID)
	result, err := h.svc.BatchScore(claims.UserID, mediaDir)
	if err != nil {
		if errors.Is(err, config.ErrAIInactive) {
			return echo.NewHTTPError(http.StatusForbidden, "AI is not active")
		}
		log.Printf("BatchAestheticScore error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if result.Error != "" {
		return c.JSON(http.StatusServiceUnavailable, result)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) BatchAIStatus(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	statuses, err := h.svc.BatchAIStatus(claims.UserID, body.IDs)
	if err != nil {
		log.Printf("BatchAIStatus error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"statuses": statuses,
	})
}

func (h *Handler) BatchTranscodeStatus(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	statuses, err := h.svc.BatchTranscodeStatus(claims.UserID, body.IDs)
	if err != nil {
		log.Printf("BatchTranscodeStatus error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"statuses": statuses,
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

func (h *Handler) UpdateByHash(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	hash := c.Param("hash")

	var body map[string]interface{}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.svc.UpdateByHash(claims.UserID, hash, body); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
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

func (h *Handler) Nuke(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
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
	for _, item := range items {
		_ = h.storage.DeleteFile(claims.UserID, item.FilePath)
	}

	return c.JSON(http.StatusOK, map[string]int{"deleted": len(items)})
}

func (h *Handler) CountTagged(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	res, err := h.svc.CountTagged(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) CountScored(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	res, err := h.svc.CountScored(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Dashboard(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	folderID := c.QueryParam("folder_id")
	favorites := c.QueryParam("is_favorite") == "true"

	var fID *string
	if folderID != "" {
		fID = &folderID
	}

	params := DashboardParams{
		FolderID:   fID,
		IsFavorite: favorites,
		Page:       page,
		Limit:      limit,
	}

	smart := c.QueryParam("smart") == "true"
	if smart {
		cats := c.QueryParam("categories")
		if cats != "" {
			params.Categories = strings.Split(cats, ",")
		}
		minScore, _ := strconv.ParseFloat(c.QueryParam("minScore"), 64)
		params.MinScore = minScore
	}

	resp, err := h.svc.GetDashboard(claims.UserID, params)
	if err != nil {
		log.Printf("Dashboard error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Duplicates(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	resp, err := h.svc.GetDuplicates(claims.UserID)
	if err != nil {
		log.Printf("Duplicates error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) SaveEditor(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	mediaID := c.Param("id")
	overwrite := c.FormValue("overwrite") == "true"

	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no file uploaded")
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "read failed")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/" + strings.TrimPrefix(ext, ".")
	}

	item, err := h.svc.Get(claims.UserID, mediaID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	hash := fmt.Sprintf("%x", sha256.Sum256(data))
	filename := hash + ext

	var width, height int
	var palette []string
	meta, err := mw.ExtractImageMetadata(data)
	if err == nil {
		width = meta.Width
		height = meta.Height
		palette = meta.Palette
	}

	if overwrite {
		otherShared, err := h.svc.IsSharedPath(claims.UserID, item.FilePath, item.ID)
		if err != nil {
			log.Printf("IsSharedPath error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}
		dup, err := h.svc.FindByHash(claims.UserID, hash)
		if err != nil {
			log.Printf("FindByHash error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}

		newFilePath := filename
		if dup != nil && dup.ID != item.ID {
			newFilePath = dup.FilePath
		} else {
			_, _, _, err := h.storage.SaveFileFromBytes(claims.UserID, data, filename)
			if err != nil {
				log.Printf("SaveFile error: %v", err)
				return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
			}
		}

		metaJSON := buildEditorMetadata(item.Metadata, palette)
		if err := h.svc.SaveEditorOverwrite(claims.UserID, item.ID, newFilePath, hash, width, height, int64(len(data)), mimeType, metaJSON); err != nil {
			log.Printf("SaveEditorOverwrite error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "update failed")
		}

		if newFilePath != item.FilePath && !otherShared {
			h.storage.DeleteFile(claims.UserID, item.FilePath)
		}

		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  true,
			"mediaId":  item.ID,
			"filePath": newFilePath,
			"isNew":    false,
		})
	}

	_, _, _, err = h.storage.SaveFileFromBytes(claims.UserID, data, filename)
	if err != nil {
		log.Printf("SaveFile error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}

	title := "Copy of " + item.Title
	metaJSON := buildEditorMetadata(nil, palette)
	var md *string
	if metaJSON != "" {
		md = &metaJSON
	}
	newItem, _, err := h.svc.Create(claims.UserID, "", filename, title, mimeType, hash, int64(len(data)), &width, &height, nil, md, nil, nil)
	if err != nil {
		log.Printf("Create error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "create failed")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"mediaId":  newItem.ID,
		"filePath": filename,
		"isNew":    true,
	})
}

func buildEditorMetadata(existingMeta *string, palette []string) string {
	md := make(map[string]interface{})
	if existingMeta != nil && *existingMeta != "" {
		json.Unmarshal([]byte(*existingMeta), &md)
	}
	if len(palette) > 0 {
		md["palette"] = palette
	}
	if len(md) == 0 {
		return ""
	}
	b, err := json.Marshal(md)
	if err != nil {
		return ""
	}
	return string(b)
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
