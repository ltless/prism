package media

import (
	"encoding/binary"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestValidateUpload_AllowedExtension(t *testing.T) {
	s := NewStorage(t.TempDir())
	// Minimal JPEG bytes: SOI + APP0 marker
	jpegData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 0}
	if err := s.ValidateUpload(jpegData, ".jpg"); err != nil {
		t.Fatalf("expected valid .jpg, got: %v", err)
	}
}

func TestValidateUpload_DisallowedExtension(t *testing.T) {
	s := NewStorage(t.TempDir())
	data := []byte("some content")
	if err := s.ValidateUpload(data, ".exe"); err == nil {
		t.Fatal("expected error for .exe extension")
	}
}

func TestValidateUpload_WrongMagicBytes(t *testing.T) {
	s := NewStorage(t.TempDir())
	// PNG extension but JPEG magic bytes
	data := []byte{0xFF, 0xD8, 0xFF, 0xE0}
	if err := s.ValidateUpload(data, ".png"); err == nil {
		t.Fatal("expected error for mismatched magic bytes")
	}
}

func TestValidateUpload_TooSmall(t *testing.T) {
	s := NewStorage(t.TempDir())
	// Only 2 bytes, need at least 3 for JPEG magic
	data := []byte{0xFF, 0xD8}
	if err := s.ValidateUpload(data, ".jpg"); err == nil {
		t.Fatal("expected error for too-small file")
	}
}

func TestValidateUpload_NoMagicCheck(t *testing.T) {
	s := NewStorage(t.TempDir())
	// .heic has no magic signature defined
	data := []byte("anything")
	if err := s.ValidateUpload(data, ".heic"); err != nil {
		t.Fatalf("expected no error for .heic (no magic check), got: %v", err)
	}
}

func TestValidateUpload_WebP(t *testing.T) {
	s := NewStorage(t.TempDir())
	// Minimal WebP: RIFF header + WEBP at offset 8
	data := []byte{
		0x52, 0x49, 0x46, 0x46, // RIFF
		0x00, 0x00, 0x00, 0x00, // file size placeholder
		0x57, 0x45, 0x42, 0x50, // WEBP
	}
	if err := s.ValidateUpload(data, ".webp"); err != nil {
		t.Fatalf("expected valid .webp, got: %v", err)
	}
}

func TestValidateUpload_WebP_Invalid(t *testing.T) {
	s := NewStorage(t.TempDir())
	// RIFF header but not WEBP at offset 8
	data := []byte{
		0x52, 0x49, 0x46, 0x46, // RIFF
		0x00, 0x00, 0x00, 0x00,
		0x57, 0x45, 0x42, 0x4E, // "WEBN" not "WEBP"
	}
	if err := s.ValidateUpload(data, ".webp"); err == nil {
		t.Fatal("expected error for invalid WebP")
	}
}

func TestValidateUpload_MP4(t *testing.T) {
	s := NewStorage(t.TempDir())
	// MP4s from real devices have varying ftyp box sizes — all valid.
	sizes := []uint32{0x14, 0x18, 0x1C, 0x20, 0x24}
	for _, size := range sizes {
		data := make([]byte, 8)
		binary.BigEndian.PutUint32(data[0:4], size)
		copy(data[4:8], "ftyp")
		if err := s.ValidateUpload(data, ".mp4"); err != nil {
			t.Fatalf("expected valid .mp4 with ftyp size 0x%X, got: %v", size, err)
		}
	}
}

func TestValidateUpload_MP4_Invalid(t *testing.T) {
	s := NewStorage(t.TempDir())
	// Correct box size but wrong type
	data := []byte{
		0x00, 0x00, 0x00, 0x18,
		0x66, 0x74, 0x79, 0x71, // "ftyq" not "ftyp"
	}
	if err := s.ValidateUpload(data, ".mp4"); err == nil {
		t.Fatal("expected error for invalid MP4")
	}
}

func TestValidateUpload_MP4_ImplausibleBoxSize(t *testing.T) {
	s := NewStorage(t.TempDir())
	for _, size := range []uint32{0, 4, 7, 65, 0xFFFFFFFF} {
		data := make([]byte, 8)
		binary.BigEndian.PutUint32(data[0:4], size)
		copy(data[4:8], "ftyp")
		if err := s.ValidateUpload(data, ".mp4"); err == nil {
			t.Fatalf("expected error for implausible ftyp box size %d", size)
		}
	}
}

func TestValidateUpload_MOV_VaryingBoxSize(t *testing.T) {
	s := NewStorage(t.TempDir())
	// iPhone MOV files commonly use 0x14 or 0x18; other cameras differ.
	sizes := []uint32{0x14, 0x18, 0x1C, 0x20}
	for _, size := range sizes {
		data := make([]byte, 8)
		binary.BigEndian.PutUint32(data[0:4], size)
		copy(data[4:8], "ftyp")
		if err := s.ValidateUpload(data, ".mov"); err != nil {
			t.Fatalf("expected valid .mov with ftyp size 0x%X, got: %v", size, err)
		}
	}
}

func TestValidateUpload_MOV_Invalid(t *testing.T) {
	s := NewStorage(t.TempDir())
	// plausible size but not an ftyp box
	data := []byte{0x00, 0x00, 0x00, 0x14, 'f', 'r', 'e', 'e'}
	if err := s.ValidateUpload(data, ".mov"); err == nil {
		t.Fatal("expected error for invalid MOV")
	}
}

func newEchoContext() (echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func TestServeThumbnail_PathTraversal(t *testing.T) {
	s := NewStorage(t.TempDir())
	c, _ := newEchoContext()

	err := s.ServeThumbnail(c, "testuser", "../../../etc/passwd.jpg")
	if err == nil {
		t.Fatal("expected error for path traversal in thumbnail")
	}
	he, ok := err.(*echo.HTTPError)
	if !ok || he.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got: %v", err)
	}
}

func TestServeThumbnail_AbsolutePath(t *testing.T) {
	s := NewStorage(t.TempDir())
	c, _ := newEchoContext()

	err := s.ServeThumbnail(c, "testuser", "/etc/passwd.jpg")
	if err == nil {
		t.Fatal("expected error for absolute path in thumbnail")
	}
	he, ok := err.(*echo.HTTPError)
	if !ok || he.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got: %v", err)
	}
}

func TestServeThumbnail_NotFound(t *testing.T) {
	s := NewStorage(t.TempDir())
	c, _ := newEchoContext()

	err := s.ServeThumbnail(c, "testuser", "nonexistent.jpg")
	if err == nil {
		t.Fatal("expected error for missing thumbnail")
	}
	he, ok := err.(*echo.HTTPError)
	if !ok || he.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got: %v", err)
	}
}

func TestServeThumbnail_Valid(t *testing.T) {
	tmpDir := t.TempDir()
	s := NewStorage(tmpDir)
	c, rec := newEchoContext()

	// Create a thumbnail file
	userID := "testuser"
	thumbDir := s.thumbDir(userID)
	os.MkdirAll(thumbDir, 0755)
	thumbFile := filepath.Join(thumbDir, "abc123.jpg")
	os.WriteFile(thumbFile, []byte("fake jpg data"), 0644)

	err := s.ServeThumbnail(c, userID, "abc123.png")
	if err != nil {
		t.Fatalf("expected valid thumbnail serve, got: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
}

func TestResolveUserMediaPath_SymlinkEscape(t *testing.T) {
	tmpDir := t.TempDir()
	s := NewStorage(tmpDir)
	userID := "testuser"
	mediaDir := s.mediaDir(userID)
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		t.Fatal(err)
	}

	secret := filepath.Join(tmpDir, "..", fmt.Sprintf("prism-secret-%d", os.Getpid()))
	if err := os.WriteFile(secret, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(secret) })

	link := filepath.Join(mediaDir, "link.txt")
	if err := os.Symlink(secret, link); err != nil {
		t.Skipf("symlinks not supported: %v", err)
	}

	if _, err := s.ResolveUserMediaPath(userID, "link.txt"); err == nil {
		t.Fatal("expected error for symlink escaping the media dir")
	}
}

func TestResolveUserMediaPath_Valid(t *testing.T) {
	s := NewStorage(t.TempDir())
	resolved, err := s.ResolveUserMediaPath("testuser", "photo.jpg")
	if err != nil {
		t.Fatalf("expected valid path, got: %v", err)
	}
	mediaDir := s.mediaDir("testuser")
	absMediaDir, _ := filepath.Abs(mediaDir)
	if !filepath.HasPrefix(resolved, absMediaDir+string(filepath.Separator)) && resolved != absMediaDir {
		t.Fatalf("resolved path %s should be under %s", resolved, absMediaDir)
	}
}

func TestResolveUserMediaPath_Traversal(t *testing.T) {
	s := NewStorage(t.TempDir())
	_, err := s.ResolveUserMediaPath("testuser", "../../../etc/passwd")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestResolveUserMediaPath_AbsoluteOutside(t *testing.T) {
	s := NewStorage(t.TempDir())
	_, err := s.ResolveUserMediaPath("testuser", "/etc/passwd")
	if err == nil {
		t.Fatal("expected error for absolute path outside media dir")
	}
}

func TestMediaDir_TraversalUserID(t *testing.T) {
	s := NewStorage("/safe/base")
	dir := s.mediaDir("../../../etc")
	absDir, _ := filepath.Abs(dir)
	safeBase, _ := filepath.Abs("/safe/base")
	// Should not escape the base path
	if filepath.HasPrefix(absDir, safeBase+string(filepath.Separator)) || absDir == safeBase {
		// Acceptable — it was sanitized to stay inside base
	} else {
		t.Fatalf("mediaDir escaped base path: %s is not under %s", absDir, safeBase)
	}
}

func TestContainedIn(t *testing.T) {
	cases := []struct {
		name   string
		target string
		dir    string
		want   bool
	}{
		{"direct child", "/storage/users/alice/media/photo.jpg", "/storage/users/alice", true},
		{"equals dir", "/storage/users/alice", "/storage/users/alice", true},
		{"nested child", "/storage/users/alice/media/thumb/1.jpg", "/storage/users/alice/media", true},
		{"prefix sibling", "/storage/users-evil/photo.jpg", "/storage/users", false},
		{"overlapping name", "/storage/usersevil", "/storage/users", false},
		{"outside tree", "/etc/passwd", "/storage/users", false},
		{"traversal", "../../etc/passwd", "/storage/users", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := containedIn(tc.target, tc.dir); got != tc.want {
				t.Fatalf("containedIn(%q, %q) = %v, want %v", tc.target, tc.dir, got, tc.want)
			}
		})
	}
}

func TestServeFile_SymlinkEscape(t *testing.T) {
	tmpDir := t.TempDir()
	s := NewStorage(tmpDir)
	c, _ := newEchoContext()

	userID := "testuser"
	mediaDir := s.mediaDir(userID)
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		t.Fatal(err)
	}

	secret := filepath.Join(tmpDir, "secret.txt")
	if err := os.WriteFile(secret, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	link := filepath.Join(mediaDir, "evil.jpg")
	if err := os.Symlink(secret, link); err != nil {
		t.Skipf("symlinks not supported: %v", err)
	}

	err := s.ServeFile(c, userID, "evil.jpg")
	if err == nil {
		t.Fatal("expected error for symlink escaping the media dir")
	}
	he, ok := err.(*echo.HTTPError)
	if !ok || he.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden, got: %v", err)
	}
}

func TestServeFile_SymlinkInsideMediaDir(t *testing.T) {
	tmpDir := t.TempDir()
	s := NewStorage(tmpDir)
	c, rec := newEchoContext()

	userID := "testuser"
	mediaDir := s.mediaDir(userID)
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		t.Fatal(err)
	}

	real := filepath.Join(mediaDir, "real.jpg")
	if err := os.WriteFile(real, []byte("fake jpg data"), 0o644); err != nil {
		t.Fatal(err)
	}
	alias := filepath.Join(mediaDir, "alias.jpg")
	if err := os.Symlink(real, alias); err != nil {
		t.Skipf("symlinks not supported: %v", err)
	}

	err := s.ServeFile(c, userID, "alias.jpg")
	if err != nil {
		t.Fatalf("expected symlink inside media dir to serve, got: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
}

func TestThumbDir_TraversalUserID(t *testing.T) {
	s := NewStorage("/safe/base")
	dir := s.thumbDir("../../../etc")
	absDir, _ := filepath.Abs(dir)
	safeBase, _ := filepath.Abs("/safe/base")
	if filepath.HasPrefix(absDir, safeBase+string(filepath.Separator)) || absDir == safeBase {
		// Acceptable — it was sanitized to stay inside base
	} else {
		t.Fatalf("thumbDir escaped base path: %s is not under %s", absDir, safeBase)
	}
}
