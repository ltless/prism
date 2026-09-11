package media

import (
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/vault"
)

// controlCharRe matches raw control bytes (0x00-0x1F, 0x7F) and their JSON
// unicode escape forms (\u0000-\u001f, \u007f). Go's json.Marshal encodes
// control chars as \u00XX escape sequences, so after marshaling the raw bytes
// are gone — only escapes remain. PostgreSQL JSONB rejects \u0000 with
// SQLSTATE 22P05. We strip all control char escapes to be safe.
var controlCharRe = regexp.MustCompile(`[\x00-\x1f\x7f]|\\u000[0-9a-fA-F]|\\u001[0-9a-fA-F]|\\u007[fF]`)

// sanitizeMetadata strips control characters from a JSON string so it can be
// safely stored in a PostgreSQL JSONB column.
func sanitizeMetadata(s string) string {
	return controlCharRe.ReplaceAllString(s, "")
}

const maxUploadSize = 200 << 20 // 200MB

type Handler struct {
	svc       *Service
	storage   *mw.Storage
	nukeToken string
}

func NewHandler(svc *Service, storage *mw.Storage, nukeToken string) *Handler {
	return &Handler{svc: svc, storage: storage, nukeToken: nukeToken}
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

	ext := strings.ToLower(filepath.Ext(header.Filename))

	// Stream to temp file while hashing; only the first 512 bytes are kept
	// in memory for magic-byte validation.
	headBuf := make([]byte, 512)
	n, err := io.ReadFull(file, headBuf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return echo.NewHTTPError(http.StatusInternalServerError, "read file failed")
	}
	head := headBuf[:n]

	if err := h.storage.ValidateUpload(head, ext); err != nil {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}

	tmp, err := os.CreateTemp("", "prism-upload-*")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "temp file failed")
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	hasher := sha256.New()
	size, err := io.Copy(tmp, io.TeeReader(io.MultiReader(bytes.NewReader(head), io.LimitReader(file, maxUploadSize+1-int64(n))), hasher))
	if err != nil {
		tmp.Close()
		return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}
	tmp.Close()
	if size > maxUploadSize {
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 200MB)")
	}

	hash := fmt.Sprintf("%x", hasher.Sum(nil))
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
			"transcodeStatus": "skipped",
		})
	}

	if err := h.svc.CheckStorageQuota(claims.UserID, size); err != nil {
		if errors.Is(err, ErrQuotaExceeded) {
			return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "storage quota exceeded")
		}
		log.Printf("CheckStorageQuota error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	tmpFile, err := os.Open(tmpPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "temp file failed")
	}
	defer tmpFile.Close()

	_, mediaPath, _, err := h.storage.SaveFileFromReader(claims.UserID, tmpFile, filename)
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

	// ponytail: EXIF + thumbnail generation moved off the request path — the
	// client already tolerates late metadata (UI polls / refreshes, thumbnail
	// 404s fall back to placeholder until it appears). If users need instant
	// thumbs, move only thumbnail generation back inline.
	item, isDup, err := h.svc.Create(claims.UserID, "", filename, title, mimeType, hash, size, nil, nil, nil, nil, nil, nil)
	if err != nil {
		log.Printf("MediaCreate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if isDup {
		_ = h.storage.DeleteFile(claims.UserID, filename)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":         true,
			"isDuplicate":     true,
			"filename":        filename,
			"mediaId":         "",
			"isVideo":         isVideo,
			"transcodeStatus": "skipped",
		})
	}

	ts := "pending"
	if isVideo {
		go h.processVideoMetadataAsync(claims.UserID, item.ID, mediaPath)
	} else {
		ts = "async"
		go h.processImageMetadataAsync(claims.UserID, item.ID, mediaPath)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"isDuplicate":     false,
		"filename":        filename,
		"mediaId":         item.ID,
		"isVideo":         isVideo,
		"transcodeStatus": ts,
	})
}

// processImageMetadataAsync generates the thumbnail and extracts EXIF off the
// request path. Failures are logged and skipped — the media row exists and the
// grid falls back to the placeholder until the thumbnail lands.
func (h *Handler) processImageMetadataAsync(userID, mediaID, mediaPath string) {
	if err := h.storage.GenerateThumbnailForFile(userID, mediaPath); err != nil {
		log.Printf("async thumbnail: %v", err)
	}

	data, err := os.ReadFile(mediaPath)
	if err != nil {
		log.Printf("async metadata read: %v", err)
		return
	}
	meta, err := mw.ExtractImageMetadata(data)
	if err != nil {
		log.Printf("async metadata extract: %v", err)
		return
	}

	updates := map[string]interface{}{}
	if meta.Width > 0 {
		updates["width"] = meta.Width
		updates["height"] = meta.Height
	}
	if meta.CapturedAt != nil {
		updates["captured_at"] = *meta.CapturedAt
	}
	if len(meta.ExifData) > 0 || len(meta.Palette) > 0 {
		if len(meta.Palette) > 0 {
			if meta.ExifData == nil {
				meta.ExifData = make(map[string]interface{})
			}
			meta.ExifData["palette"] = meta.Palette
		}
		if b, err := json.Marshal(meta.ExifData); err == nil {
			updates["metadata"] = sanitizeMetadata(string(b))
		}
	}
	if len(updates) > 0 {
		if err := h.svc.Update(userID, mediaID, updates); err != nil {
			log.Printf("async metadata update: %v", err)
		}
	}
}

// processVideoMetadataAsync extracts video metadata + thumbnail, then marks the
// transcode queue status via the existing Update path.
func (h *Handler) processVideoMetadataAsync(userID, mediaID, mediaPath string) {
	if err := h.storage.GenerateThumbnailForFile(userID, mediaPath); err != nil {
		log.Printf("async video thumbnail: %v", err)
	}

	updates := map[string]interface{}{}
	meta, err := mw.ExtractVideoMetadata(mediaPath)
	if err == nil && meta.Width > 0 && meta.Height > 0 {
		updates["width"] = meta.Width
		updates["height"] = meta.Height
		updates["duration"] = meta.Duration
		md := map[string]interface{}{
			"codec":  meta.Codec,
			"width":  meta.Width,
			"height": meta.Height,
		}
		if b, err := json.Marshal(md); err == nil {
			updates["metadata"] = sanitizeMetadata(string(b))
		}
	} else if err != nil {
		log.Printf("async video metadata extract: %v", err)
	}

	if len(updates) > 0 {
		if err := h.svc.Update(userID, mediaID, updates); err != nil {
			log.Printf("async video metadata update: %v", err)
		}
	}
	// Mark transcode done so BatchTranscodeStatus polling settles
	// (frontend polls while status = "pending").
	done := "done"
	if err := h.svc.Update(userID, mediaID, map[string]interface{}{"transcode_status": done}); err != nil {
		log.Printf("async transcode status update: %v", err)
	}
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

	if err := h.requireVaultUnlock(c, claims, body); err != nil {
		return err
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

// requireVaultUnlock enforces the vault PIN when a request tries to move
// media OUT of the vault (is_vault:false). It reads the pin field from the
// body map and removes it so it never reaches the SQL update.
func (h *Handler) requireVaultUnlock(c echo.Context, claims *auth.Claims, body map[string]interface{}) error {
	v, ok := body["is_vault"]
	if !ok {
		return nil
	}
	b, isBool := v.(bool)
	if !isBool || b {
		return nil
	}
	pin, _ := body["pin"].(string)
	delete(body, "pin")
	return h.checkVaultPin(c, claims, pin)
}

// checkVaultPin validates the vault PIN with shared lockout accounting.
func (h *Handler) checkVaultPin(c echo.Context, claims *auth.Claims, pin string) error {
	if locked, retry := vault.Locked(claims.UserID); locked {
		c.Response().Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many failed attempts, try again later")
	}
	allowed, err := h.svc.VaultUnlockAllowed(claims.UserID, pin)
	if err != nil {
		log.Printf("VaultUnlockAllowed error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if !allowed {
		return echo.NewHTTPError(http.StatusForbidden, "invalid vault pin")
	}
	return nil
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
		Pin      string   `json:"pin"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
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
	val := 0
	if body.IsVault {
		val = 1
	}
	if err := h.svc.BulkSetField(claims.UserID, body.MediaIDs, "is_vault", val); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
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

	if err := h.requireVaultUnlock(c, claims, body); err != nil {
		return err
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

	if mimeParam := c.QueryParam("mime_type"); mimeParam != "" {
		params.MimeType = &mimeParam
	}

	if df := c.QueryParam("date_from"); df != "" {
		if v, err := strconv.ParseInt(df, 10, 64); err == nil {
			params.DateFrom = &v
		}
	}
	if dt := c.QueryParam("date_to"); dt != "" {
		if v, err := strconv.ParseInt(dt, 10, 64); err == nil {
			params.DateTo = &v
		}
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

	// Server-side confirmation gate: the frontend validates the token too,
	// but it must never be the only line of defense for a destructive op.
	// No token configured = feature disabled.
	if h.nukeToken == "" {
		return echo.NewHTTPError(http.StatusNotFound, "not found")
	}
	provided := c.Request().Header.Get("X-Nuke-Token")
	if subtle.ConstantTimeCompare([]byte(provided), []byte(h.nukeToken)) != 1 {
		return echo.NewHTTPError(http.StatusForbidden, "invalid confirmation token")
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
	// Library (root) view shows only unfiled media. An absent folder_id param
	// means "no folder" — the service maps an empty-string FolderID to
	// folder_id IS NULL. Without this, filed photos leak into the library.
	folderID := c.QueryParam("folder_id")
	unfiled := ""
	var fID *string
	if folderID == "" {
		fID = &unfiled
	} else {
		fID = &folderID
	}
	favorites := c.QueryParam("is_favorite") == "true"

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
	if err := h.storage.ValidateUpload(data, ext); err != nil {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}
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

	// Reuse the existing file when the content already exists (same hash) —
	// Create would return a nil item for a duplicate and double-store bytes.
	dup, err := h.svc.FindByHash(claims.UserID, hash)
	if err != nil {
		log.Printf("FindByHash error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if dup != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  true,
			"mediaId":  dup.ID,
			"filePath": dup.FilePath,
			"isNew":   false,
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
