package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/metrics"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const maxUploadSize = 200 << 20 // 200MB

// streamedUpload is the result of streaming an upload body to a temp file:
// content hash, byte size, and the temp path (caller must remove it).
type streamedUpload struct {
	hash     string
	filename string
	size     int64
	tmpPath  string
}

// streamUploadToTemp validates magic bytes and streams the multipart file to
// a temp file while hashing it — bounded memory, single pass.
func (h *Handler) streamUploadToTemp(file multipart.File, header *multipart.FileHeader) (*streamedUpload, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))

	// Stream to temp file while hashing; only the first 512 bytes are kept
	// in memory for magic-byte validation.
	headBuf := make([]byte, 512)
	n, err := io.ReadFull(file, headBuf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "read file failed")
	}
	head := headBuf[:n]

	if err := h.storage.ValidateUpload(head, ext); err != nil {
		return nil, echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}

	tmp, err := os.CreateTemp("", "prism-upload-*")
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "temp file failed")
	}
	tmpPath := tmp.Name()

	hasher := sha256.New()
	size, err := io.Copy(tmp, io.TeeReader(io.MultiReader(bytes.NewReader(head), io.LimitReader(file, maxUploadSize+1-int64(n))), hasher))
	if err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}
	tmp.Close()
	if size > maxUploadSize {
		os.Remove(tmpPath)
		return nil, echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 200MB)")
	}

	hash := fmt.Sprintf("%x", hasher.Sum(nil))
	return &streamedUpload{hash: hash, filename: hash + ext, size: size, tmpPath: tmpPath}, nil
}

// duplicateUploadResponse builds the success response for an upload that
// resolved to an existing hash (nothing new was written).
func duplicateUploadResponse(up *streamedUpload, isVideo bool) map[string]interface{} {
	return map[string]interface{}{
		"success":         true,
		"isDuplicate":     true,
		"filename":        up.filename,
		"mediaId":         "",
		"isVideo":         isVideo,
		"transcodeStatus": "skipped",
	}
}

// storeUploadFile persists the streamed temp file into the user's media dir.
func (h *Handler) storeUploadFile(userID string, up *streamedUpload) (string, error) {
	tmpFile, err := os.Open(up.tmpPath)
	if err != nil {
		return "", echo.NewHTTPError(http.StatusInternalServerError, "temp file failed")
	}
	defer tmpFile.Close()

	_, mediaPath, _, err := h.storage.SaveFileFromReader(userID, tmpFile, up.filename)
	if err != nil {
		log.Printf("SaveFile error: %v", err)
		return "", echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return mediaPath, nil
}

// uploadMeta derives the stored mimeType, display title and video flag from
// the multipart header.
func uploadMeta(header *multipart.FileHeader) (mimeType, title string, isVideo bool) {
	mimeType = header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	title = strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
	if title == "" {
		title = header.Filename
	}
	isVideo = len(mimeType) >= 5 && mimeType[:5] == "video"
	return mimeType, title, isVideo
}

// schedulePostProcessing hands the reserved pool slot to the background
// metadata/thumbnail job and starts it. The caller must have acquired the
// slot and must NOT release it afterward — the goroutine releases it.
func (h *Handler) schedulePostProcessing(userID, mediaID, mediaPath string, isVideo bool) {
	go func() {
		defer h.pool.release()
		if isVideo {
			h.processVideoMetadataAsync(userID, mediaID, mediaPath)
		} else {
			h.processImageMetadataAsync(userID, mediaID, mediaPath)
		}
	}()
}

func (h *Handler) Upload(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	if c.Request().ContentLength > maxUploadSize {
		metrics.Default.Inc("prism_uploads_failed_total")
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 200MB)")
	}

	// Reserve a post-processing slot before doing any work. If the pool is
	// saturated the request waits briefly, then sheds with 503 rather than
	// spawning unbounded background CPU (see F2). The slot is handed to the
	// background job on success and released here on every early return.
	if !h.pool.acquire() {
		metrics.Default.Inc("prism_processing_shed_total")
		return echo.NewHTTPError(http.StatusServiceUnavailable, "processing queue full, try again shortly")
	}
	slotReleased := false
	defer func() {
		if !slotReleased {
			h.pool.release()
		}
	}()

	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no file uploaded")
	}
	defer file.Close()

	up, err := h.streamUploadToTemp(file, header)
	if err != nil {
		return err
	}
	defer os.Remove(up.tmpPath)

	// Skip the write entirely if the hash is already in the DB. The UNIQUE
	// constraint on hash is the final authority; this is an optimisation that
	// avoids orphan files on disk. A HashExists failure must not be treated as
	// "not a duplicate" — fail the request instead of risking a double write.
	exists, err := h.svc.HashExists(c.Request().Context(), claims.UserID, up.hash)
	if err != nil {
		log.Printf("HashExists error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if exists {
		return c.JSON(http.StatusOK, duplicateUploadResponse(up, false))
	}

	mediaPath, err := h.storeUploadFile(claims.UserID, up)
	if err != nil {
		return err
	}

	mimeType, title, isVideo := uploadMeta(header)

	// ponytail: EXIF + thumbnail generation moved off the request path — the
	// client already tolerates late metadata (UI polls / refreshes, thumbnail
	// 404s fall back to placeholder until it appears). If users need instant
	// thumbs, move only thumbnail generation back inline.
	item, isDup, err := h.svc.CreateWithinQuota(c.Request().Context(), claims.UserID, "", up.filename, title, mimeType, up.hash, up.size, nil, nil, nil, nil, nil, nil)
	if err != nil {
		// The file is already on disk; remove it if the row didn't land.
		h.deleteFileLogged(claims.UserID, up.filename)
		metrics.Default.Inc("prism_uploads_failed_total")
		if errors.Is(err, ErrQuotaExceeded) {
			return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "storage quota exceeded")
		}
		log.Printf("MediaCreate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if isDup {
		h.deleteFileLogged(claims.UserID, up.filename)
		metrics.Default.Inc("prism_uploads_total")
		return c.JSON(http.StatusOK, duplicateUploadResponse(up, isVideo))
	}

	metrics.Default.Inc("prism_uploads_total")
	metrics.Default.Add("prism_upload_bytes_total", up.size)

	ts := "async"
	if isVideo {
		ts = "pending"
	}
	slotReleased = true
	h.schedulePostProcessing(claims.UserID, item.ID, mediaPath, isVideo)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"isDuplicate":     false,
		"filename":        up.filename,
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

	decrypted, err := h.storage.OpenDecryptedTemp(mediaPath)
	if err != nil {
		log.Printf("async metadata decrypt: %v", err)
		return
	}
	defer decrypted.Close()

	data, err := io.ReadAll(decrypted)
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
		if err := h.svc.Update(context.Background(), userID, mediaID, updates); err != nil {
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
	decrypted, err := h.storage.OpenDecryptedTemp(mediaPath)
	if err != nil {
		// Decrypt failure still settles the transcode queue status below —
		// same behaviour as an ffprobe failure on the plaintext path.
		log.Printf("async video metadata decrypt: %v", err)
	} else {
		meta, err := mw.ExtractVideoMetadata(decrypted.Name())
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
		decrypted.Close()
	}

	if len(updates) > 0 {
		if err := h.svc.Update(context.Background(), userID, mediaID, updates); err != nil {
			log.Printf("async video metadata update: %v", err)
		}
	}
	// Mark transcode done so BatchTranscodeStatus polling settles
	// (frontend polls while status = "pending").
	done := "done"
	if err := h.svc.Update(context.Background(), userID, mediaID, map[string]interface{}{"transcode_status": done}); err != nil {
		log.Printf("async transcode status update: %v", err)
	}
}
