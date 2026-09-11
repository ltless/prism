package media

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	_ "image/gif"
	_ "image/png"

	"golang.org/x/image/draw"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type Storage struct {
	basePath string
}

func NewStorage(basePath string) *Storage {
	return &Storage{basePath: basePath}
}

func (s *Storage) MediaDir(userID string) string {
	return s.mediaDir(userID)
}

func (s *Storage) ThumbDir(userID string) string {
	return s.thumbDir(userID)
}

func (s *Storage) mediaDir(userID string) string {
	base := filepath.Join(s.basePath, userID)
	clean := filepath.Clean(base)
	if !strings.HasPrefix(clean, filepath.Clean(s.basePath)) {
		return filepath.Join(s.basePath, sanitizePath(userID), "media")
	}
	return filepath.Join(clean, "media")
}

func (s *Storage) thumbDir(userID string) string {
	base := filepath.Join(s.basePath, userID)
	clean := filepath.Clean(base)
	if !strings.HasPrefix(clean, filepath.Clean(s.basePath)) {
		return filepath.Join(s.basePath, sanitizePath(userID), "media", "thumbnails")
	}
	return filepath.Join(clean, "media", "thumbnails")
}

func sanitizePath(p string) string {
	return strings.ReplaceAll(strings.ReplaceAll(p, "..", ""), "/", "")
}

func (s *Storage) SaveFileFromBytes(userID string, data []byte, filename string) (string, string, string, error) {
	return s.SaveFileFromReader(userID, bytes.NewReader(data), filename)
}

// SaveFileFromReader streams src to disk without loading the whole file into
// memory. Returns (filename, mediaPath, thumbPath, error).
func (s *Storage) SaveFileFromReader(userID string, src io.Reader, filename string) (string, string, string, error) {
	mediaDir := s.mediaDir(userID)
	if err := os.MkdirAll(mediaDir, 0755); err != nil {
		return "", "", "", fmt.Errorf("create media dir: %w", err)
	}

	tmpPath := filepath.Join(mediaDir, "."+uuid.New().String()+".tmp")
	f, err := os.Create(tmpPath)
	if err != nil {
		return "", "", "", fmt.Errorf("create tmp file: %w", err)
	}
	if _, err := io.Copy(f, src); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return "", "", "", fmt.Errorf("write file: %w", err)
	}
	if err := f.Close(); err != nil {
		os.Remove(tmpPath)
		return "", "", "", fmt.Errorf("close file: %w", err)
	}

	mediaPath := filepath.Join(mediaDir, filename)
	if err := os.Rename(tmpPath, mediaPath); err != nil {
		os.Remove(tmpPath)
		return "", "", "", fmt.Errorf("rename file: %w", err)
	}

	// Thumbnails are generated async by the upload handler (off the request
	// path) — see Handler.processImageMetadataAsync.
	return filename, mediaPath, "", nil
}

// SaveProfileImage stores a profile/cover picture under the user's
// .profile/ directory (outside the media library). ext must already be
// validated via ValidateUpload. Returns the media-relative path (e.g.
// ".profile/profile_ab12cd.jpg") suitable for users.image/cover_image.
func (s *Storage) SaveProfileImage(userID string, data []byte, ext string) (string, error) {
	mediaDir := s.mediaDir(userID)
	profileDir := filepath.Join(mediaDir, ".profile")
	if err := os.MkdirAll(profileDir, 0755); err != nil {
		return "", fmt.Errorf("create profile dir: %w", err)
	}
	filename := "profile_" + uuid.New().String()[:8] + ext
	relPath := filepath.Join(".profile", filename)

	// Path-traversal guard: same invariant as ServeFile (absPath under mediaDir).
	absPath, err := filepath.Abs(filepath.Join(mediaDir, relPath))
	if err != nil {
		return "", fmt.Errorf("resolve profile path: %w", err)
	}
	absDir, err := filepath.Abs(mediaDir)
	if err != nil || !strings.HasPrefix(absPath, absDir+string(filepath.Separator)) {
		return "", fmt.Errorf("invalid profile path")
	}
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return "", fmt.Errorf("write profile image: %w", err)
	}
	return relPath, nil
}

// GenerateThumbnailForFile creates the thumbnail for a stored media file,
// dispatching by extension. Called off the request path.
func (s *Storage) GenerateThumbnailForFile(userID, mediaPath string) error {
	ext := strings.ToLower(filepath.Ext(mediaPath))
	hash := strings.TrimSuffix(filepath.Base(mediaPath), ext)
	tp := filepath.Join(s.thumbDir(userID), hash+".jpg")

	if err := os.MkdirAll(filepath.Dir(tp), 0755); err != nil {
		return fmt.Errorf("create thumb dir: %w", err)
	}

	imageExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	videoExts := map[string]bool{".mp4": true, ".mov": true, ".webm": true}
	if imageExts[ext] {
		return generateThumbnailFromFile(mediaPath, tp)
	} else if videoExts[ext] {
		return GenerateVideoThumbnail(mediaPath, tp)
	}
	return fmt.Errorf("unsupported thumbnail ext: %s", ext)
}

func generateThumbnailFromFile(path, outputPath string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open image: %w", err)
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		return fmt.Errorf("decode image: %w", err)
	}

	const maxWidth = 300
	bounds := src.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()

	newW := w
	newH := h
	if w > maxWidth {
		newW = maxWidth
		newH = h * maxWidth / w
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)

	out, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create thumbnail: %w", err)
	}
	defer out.Close()

	return jpeg.Encode(out, dst, &jpeg.Options{Quality: 80})
}

func (s *Storage) DeleteFile(userID, filename string) error {
	mediaPath := filepath.Join(s.mediaDir(userID), filename)
	if err := os.Remove(mediaPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete media: %w", err)
	}

	ext := filepath.Ext(filename)
	hash := strings.TrimSuffix(filename, ext)
	thumbPath := filepath.Join(s.thumbDir(userID), hash+".jpg")
	os.Remove(thumbPath)

	return nil
}

func (s *Storage) ServeFile(c echo.Context, userID, filePath string) error {
	mediaDir := s.mediaDir(userID)

	absPath, err := filepath.Abs(filepath.Join(mediaDir, filePath))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "resolve path")
	}
	mediaDir, err = filepath.Abs(mediaDir)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "resolve media dir")
	}
	if !strings.HasPrefix(absPath, mediaDir+string(filepath.Separator)) && absPath != mediaDir {
		return echo.NewHTTPError(403, "forbidden")
	}

	stat, err := os.Stat(absPath)
	if err != nil {
		return echo.NewHTTPError(404, "not found")
	}

	ext := strings.ToLower(filepath.Ext(absPath))
	contentType := mimeTypes[ext]
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	c.Response().Header().Set("Content-Type", contentType)
	c.Response().Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	c.Response().Header().Set("Accept-Ranges", "bytes")

	rangeHeader := c.Request().Header.Get("Range")
	if rangeHeader != "" && strings.HasPrefix(contentType, "video/") {
		return serveRange(c, absPath, stat, contentType)
	}

	c.Response().Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
	return c.File(absPath)
}

func serveRange(c echo.Context, path string, stat os.FileInfo, contentType string) error {
	rangeHeader := c.Request().Header.Get("Range")
	parts := strings.SplitN(strings.TrimPrefix(rangeHeader, "bytes="), "-", 2)
	if len(parts) != 2 {
		return echo.NewHTTPError(416, "invalid range")
	}

	start, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || start < 0 {
		return echo.NewHTTPError(416, "invalid range")
	}

	end := stat.Size() - 1
	if parts[1] != "" {
		end, err = strconv.ParseInt(parts[1], 10, 64)
		if err != nil || end >= stat.Size() {
			return echo.NewHTTPError(416, "invalid range")
		}
	}

	if start > end || start >= stat.Size() {
		return echo.NewHTTPError(416, "invalid range")
	}

	chunkSize := end - start + 1
	f, err := os.Open(path)
	if err != nil {
		return echo.NewHTTPError(404, "not found")
	}
	defer f.Close()

	if _, err := f.Seek(start, 0); err != nil {
		return fmt.Errorf("seek file: %w", err)
	}
	c.Response().Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, stat.Size()))
	c.Response().Header().Set("Content-Length", strconv.FormatInt(chunkSize, 10))
	c.Response().Header().Set("Content-Type", contentType)
	c.Response().WriteHeader(206)

	if _, err := io.CopyN(c.Response(), f, chunkSize); err != nil {
		return fmt.Errorf("write range body: %w", err)
	}
	return nil
}

func (s *Storage) ServeThumbnail(c echo.Context, userID, filename string) error {
	ext := filepath.Ext(filename)
	hash := strings.TrimSuffix(filename, ext)
	thumbFilename := hash + ".jpg"

	thumbDir, err := filepath.Abs(s.thumbDir(userID))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "resolve thumb dir")
	}

	cleanName := filepath.Clean(thumbFilename)
	// Reject absolute paths or traversal components in the filename.
	if filepath.IsAbs(cleanName) || strings.Contains(cleanName, "..") {
		return echo.NewHTTPError(http.StatusForbidden, "forbidden")
	}

	absPath := filepath.Join(thumbDir, cleanName)
	absPath, err = filepath.Abs(absPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "resolve path")
	}

	if absPath != thumbDir && !strings.HasPrefix(absPath, thumbDir+string(filepath.Separator)) {
		return echo.NewHTTPError(http.StatusForbidden, "forbidden")
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return echo.NewHTTPError(http.StatusNotFound, "thumbnail not found")
	}

	c.Response().Header().Set("Content-Type", "image/jpeg")
	c.Response().Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	return c.File(absPath)
}

// ResolveUserMediaPath joins filePath against the caller's media dir and
// rejects any path that escapes it. Returns an absolute, validated path.
func (s *Storage) ResolveUserMediaPath(userID, filePath string) (string, error) {
	mediaDir, err := filepath.Abs(s.mediaDir(userID))
	if err != nil {
		return "", fmt.Errorf("resolve media dir: %w", err)
	}

	cleanInput := filepath.Clean(filePath)
	// If the caller passes an absolute path, make it relative to mediaDir so
	// a path inside mediaDir still resolves, but an outside path is rejected.
	if filepath.IsAbs(cleanInput) {
		rel, err := filepath.Rel(mediaDir, cleanInput)
		if err != nil || strings.HasPrefix(rel, "..") {
			return "", fmt.Errorf("forbidden: path outside media dir")
		}
		cleanInput = rel
	}

	absPath, err := filepath.Abs(filepath.Join(mediaDir, cleanInput))
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}

	if absPath != mediaDir && !strings.HasPrefix(absPath, mediaDir+string(filepath.Separator)) {
		return "", fmt.Errorf("forbidden: path outside media dir")
	}
	return absPath, nil
}

// mimeTypes maps file extensions to content types for ServeFile.
// Defined at package level to avoid rebuilding on every request.
var mimeTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".heic": "image/heic",
	".heif": "image/heif",
	".mp4":  "video/mp4",
	".mov":  "video/quicktime",
	".webm": "video/webm",
}

// AllowedExtensions is the allowlist of accepted upload extensions.
var AllowedExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
	".webp": true, ".heic": true, ".heif": true,
	".mp4": true, ".mov": true, ".webm": true,
}

// magicSignatures maps extension → required leading bytes.
// Empty signature means "no magic check" (e.g. heic/heif are complex).
var magicSignatures = map[string][]byte{
	".jpg":  {0xFF, 0xD8, 0xFF},
	".jpeg": {0xFF, 0xD8, 0xFF},
	".png":  {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
	".gif":  {0x47, 0x49, 0x46, 0x38},
	".webp": {0x52, 0x49, 0x46, 0x46}, // "RIFF"; further check at offset 8 == "WEBP"
	".mp4":  {0x00, 0x00, 0x00, 0x18}, // ftyp box (size 0x18); check "ftyp" at offset 4
	".mov":  {0x00, 0x00, 0x00, 0x14}, // ftyp box; check "ftyp" at offset 4
	".webm": {0x1A, 0x45, 0xDF, 0xA3}, // EBML
}

// ValidateUpload checks the extension allowlist and verifies magic bytes for
// the given extension. Returns nil if valid.
func (s *Storage) ValidateUpload(data []byte, ext string) error {
	ext = strings.ToLower(ext)
	if !AllowedExtensions[ext] {
		return fmt.Errorf("file type %s not allowed", ext)
	}
	sig, ok := magicSignatures[ext]
	if !ok || len(sig) == 0 {
		return nil // no magic check defined
	}
	if len(data) < len(sig) {
		return fmt.Errorf("file too small to validate")
	}
	if !bytes.Equal(data[:len(sig)], sig) {
		return fmt.Errorf("file content does not match extension %s", ext)
	}
	// WebP: confirm "WEBP" at offset 8.
	if ext == ".webp" && len(data) >= 12 && !bytes.Equal(data[8:12], []byte("WEBP")) {
		return fmt.Errorf("invalid webp file")
	}
	// MP4/MOV: confirm "ftyp" at offset 4.
	if (ext == ".mp4" || ext == ".mov") && len(data) >= 8 && !bytes.Equal(data[4:8], []byte("ftyp")) {
		return fmt.Errorf("invalid %s file", ext)
	}
	return nil
}
