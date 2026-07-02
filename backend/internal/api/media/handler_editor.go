package media

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
)

// editorUpload is the parsed/validated payload of a save-editor request.
type editorUpload struct {
	item     *MediaItem
	data     []byte
	mimeType string
	hash     string
	filename string
	width    int
	height   int
	palette  []string
}

// readEditorUpload validates the multipart body, the size cap, magic bytes,
// and extracts image geometry — everything shared by overwrite and copy paths.
func (h *Handler) readEditorUpload(c echo.Context, claims *auth.Claims, mediaID string) (*editorUpload, error) {
	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, "no file uploaded")
	}
	defer file.Close()

	// Belt-and-suspenders with the 70MB route BodyLimit: cap the read too so
	// bypassed/absent Content-Length can't balloon server memory.
	const maxEditorImageSize = 70 << 20
	data, err := io.ReadAll(io.LimitReader(file, maxEditorImageSize+1))
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "read failed")
	}
	if len(data) > maxEditorImageSize {
		return nil, echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 70MB)")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if err := h.storage.ValidateUpload(data, ext); err != nil {
		return nil, echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/" + strings.TrimPrefix(ext, ".")
	}

	item, err := h.svc.Get(claims.UserID, mediaID)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	up := &editorUpload{
		item:     item,
		data:     data,
		mimeType: mimeType,
		hash:     fmt.Sprintf("%x", sha256.Sum256(data)),
		filename: "",
	}
	up.filename = up.hash + ext

	if meta, err := mw.ExtractImageMetadata(data); err == nil {
		up.width, up.height, up.palette = meta.Width, meta.Height, meta.Palette
	}
	return up, nil
}

// saveEditorOverwrite rewrites the source media row in place, reusing the
// stored bytes when the edited output hash-matches another record.
func (h *Handler) saveEditorOverwrite(c echo.Context, claims *auth.Claims, up *editorUpload) error {
	item := up.item

	otherShared, err := h.svc.IsSharedPath(claims.UserID, item.FilePath, item.ID)
	if err != nil {
		log.Printf("IsSharedPath error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	newFilePath := up.filename
	if dup, err := h.svc.FindByHash(claims.UserID, up.hash); err != nil {
		log.Printf("FindByHash error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	} else if dup != nil && dup.ID != item.ID {
		newFilePath = dup.FilePath
	} else if _, _, _, err := h.storage.SaveFileFromBytes(claims.UserID, up.data, up.filename); err != nil {
		log.Printf("SaveFile error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}

	metaJSON, err := buildEditorMetadata(item.Metadata, up.palette)
	if err != nil {
		log.Printf("buildEditorMetadata error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "stored metadata unreadable")
	}
	if err := h.svc.SaveEditorOverwrite(claims.UserID, item.ID, newFilePath, up.hash, up.width, up.height, int64(len(up.data)), up.mimeType, metaJSON); err != nil {
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

// saveEditorAsCopy stores the edited output as a new media record, reusing
// existing bytes when the hash already exists.
func (h *Handler) saveEditorAsCopy(c echo.Context, claims *auth.Claims, up *editorUpload) error {
	// Reuse the existing file when the content already exists (same hash) —
	// Create would return a nil item for a duplicate and double-store bytes.
	dup, err := h.svc.FindByHash(claims.UserID, up.hash)
	if err != nil {
		log.Printf("FindByHash error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if dup != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":  true,
			"mediaId":  dup.ID,
			"filePath": dup.FilePath,
			"isNew":    false,
		})
	}

	if _, _, _, err := h.storage.SaveFileFromBytes(claims.UserID, up.data, up.filename); err != nil {
		log.Printf("SaveFile error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}

	metaJSON, err := buildEditorMetadata(nil, up.palette)
	if err != nil {
		log.Printf("buildEditorMetadata error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "metadata build failed")
	}
	var md *string
	if metaJSON != "" {
		md = &metaJSON
	}

	newItem, _, err := h.svc.Create(claims.UserID, "", up.filename, "Copy of "+up.item.Title, up.mimeType, up.hash, int64(len(up.data)), &up.width, &up.height, nil, md, nil, nil)
	if err != nil {
		log.Printf("Create error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "create failed")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"mediaId":  newItem.ID,
		"filePath": up.filename,
		"isNew":    true,
	})
}

func (h *Handler) SaveEditor(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	up, err := h.readEditorUpload(c, claims, c.Param("id"))
	if err != nil {
		return err
	}

	if c.FormValue("overwrite") == "true" {
		return h.saveEditorOverwrite(c, claims, up)
	}
	return h.saveEditorAsCopy(c, claims, up)
}

func buildEditorMetadata(existingMeta *string, palette []string) (string, error) {
	md := make(map[string]interface{})
	if existingMeta != nil && *existingMeta != "" {
		// Corrupt stored JSON must not silently erase the user's metadata —
		// fail the save instead of writing an empty object over it.
		if err := json.Unmarshal([]byte(*existingMeta), &md); err != nil {
			return "", fmt.Errorf("parse existing metadata: %w", err)
		}
	}
	if len(palette) > 0 {
		md["palette"] = palette
	}
	if len(md) == 0 {
		return "", nil
	}
	b, err := json.Marshal(md)
	if err != nil {
		return "", fmt.Errorf("marshal metadata: %w", err)
	}
	return string(b), nil
}
