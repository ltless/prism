package media

import (
	"github.com/ltless/prism/internal/audit"
	"mime/multipart"
	"net/http"
	"os"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/vault"
)

// sparseMultipartFile writes a 16-byte JPEG head then truncates to size,
// giving a real multipart.File whose bytes are mostly sparse holes — the
// boundary cases below stream 200MB through streamUploadToTemp without
// materialising 200MB of source data on disk.
func sparseMultipartFile(t *testing.T, size int64) multipart.File {
	t.Helper()
	jpegHead := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 0}

	f, err := os.CreateTemp("", "prism-boundary-src-*")
	if err != nil {
		t.Fatalf("create source: %v", err)
	}
	t.Cleanup(func() { os.Remove(f.Name()) })
	if _, err := f.Write(jpegHead); err != nil {
		t.Fatalf("write head: %v", err)
	}
	if err := f.Truncate(size); err != nil {
		t.Fatalf("truncate to %d: %v", size, err)
	}
	if _, err := f.Seek(0, 0); err != nil {
		t.Fatalf("seek: %v", err)
	}
	return f
}

// H-07: the 200MB application limit must hold exactly at its boundary —
// limit-1 and limit pass, limit+1 fails with 413.
func TestStreamUploadToTemp_SizeBoundary(t *testing.T) {
	storage := newTestStorage(t.TempDir())
	h := NewHandler(nil, storage, "test-nuke-token", vault.NewManager("test-secret"), audit.NewRecorder(nil))
	header := &multipart.FileHeader{Filename: "test.jpg"}

	cases := []struct {
		name    string
		size    int64
		want413 bool
	}{
		{"one byte under limit", maxUploadSize - 1, false},
		{"exactly at limit", maxUploadSize, false},
		{"one byte over limit", maxUploadSize + 1, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			up, err := h.streamUploadToTemp(sparseMultipartFile(t, tc.size), header)
			if tc.want413 {
				if err == nil {
					os.Remove(up.tmpPath)
					t.Fatalf("size %d: expected 413, got success", tc.size)
				}
				he, ok := err.(*echo.HTTPError)
				if !ok || he.Code != http.StatusRequestEntityTooLarge {
					t.Fatalf("size %d: expected 413, got %v", tc.size, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("size %d: unexpected error: %v", tc.size, err)
			}
			defer os.Remove(up.tmpPath)
			if up.size != tc.size {
				t.Fatalf("size %d: stored %d", tc.size, up.size)
			}
		})
	}
}
