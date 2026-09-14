package media

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
)

func setupMediaHandler(t *testing.T) (*echo.Echo, *Handler, string, *auth.JWTManager) {
	t.Helper()
	pool := setupTenantDB(t)

	jwt := auth.NewJWTManager("test-secret")
	token, err := jwt.Generate("test-user", "testuser", "admin")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	storage := mw.NewStorage(t.TempDir())
	svc := NewService(pool, nil)
	handler := NewHandler(svc, storage, "test-nuke-token")

	e := echo.New()
	e.Use(jwt.Middleware)
	return e, handler, token, jwt
}

func testRequest(e *echo.Echo, method, path, token, contentType, body string) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	if contentType != "" {
		req.Header.Set(echo.HeaderContentType, contentType)
	} else {
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestHandler_List_Empty(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.GET("/api/v1/media", h.List)
	rec := testRequest(e, "GET", "/api/v1/media", token, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) != 0 {
		t.Fatalf("expected empty items, got %d", len(items))
	}
}

func TestHandler_List_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.GET("/api/v1/media", h.List)
	rec := testRequest(e, "GET", "/api/v1/media", "", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.GET("/api/v1/media/:id", h.Get)
	rec := testRequest(e, "GET", "/api/v1/media/nonexistent", token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_CreateAndGet(t *testing.T) {
	sharedPool := setupTenantDB(t)
	storage := mw.NewStorage(t.TempDir())
	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("test-user", "testuser", "admin")

	svc := NewService(sharedPool, nil)
	h := NewHandler(svc, storage, "test-nuke-token")
	e := echo.New()
	e.Use(jwt.Middleware)
	e.POST("/api/v1/media", h.Upload)
	e.GET("/api/v1/media/:id", h.Get)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, _ := w.CreateFormFile("file", "test.jpg")
	// Minimal JPEG SOI+APP0 marker so magic-byte validation passes.
	part.Write([]byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 0})
	w.Close()

	req := httptest.NewRequest("POST", "/api/v1/media", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var uploadResp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &uploadResp); err != nil {
		t.Fatalf("unmarshal upload response: %v", err)
	}
	mediaID, _ := uploadResp["mediaId"].(string)
	if mediaID == "" {
		t.Fatal("expected non-empty mediaId")
	}

	// Get the created item using the SAME pool
	rec2 := testRequest(e, "GET", "/api/v1/media/"+mediaID, token, "", "")
	if rec2.Code != http.StatusOK {
		t.Fatalf("get expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestHandler_Update_Valid(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.PATCH("/api/v1/media/:id", h.Update)

	svc := NewService(setupTenantDB(t), nil)
	item, _, _ := svc.Create("test-user", "", "test.jpg", "Old", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)

	body := `{"title":"New Title"}`
	req := httptest.NewRequest("PATCH", "/api/v1/media/"+item.ID, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Update_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.PATCH("/api/v1/media/:id", h.Update)
	rec := testRequest(e, "PATCH", "/api/v1/media/some-id", "", "", `{"title":"x"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_Delete_NotFound(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.DELETE("/api/v1/media/:id", h.Delete)
	rec := testRequest(e, "DELETE", "/api/v1/media/nonexistent", token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Delete_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.DELETE("/api/v1/media/:id", h.Delete)
	rec := testRequest(e, "DELETE", "/api/v1/media/some-id", "", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_BulkMove_Valid(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.PUT("/api/v1/media/bulk/move", h.BulkMove)

	body := `{"media_ids":["id1","id2"],"folder_id":"f1"}`
	req := httptest.NewRequest("PUT", "/api/v1/media/bulk/move", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_BulkMove_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.PUT("/api/v1/media/bulk/move", h.BulkMove)
	rec := testRequest(e, "PUT", "/api/v1/media/bulk/move", "", "", `{"media_ids":["id1"]}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_Upload_NoFile(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media", h.Upload)
	rec := testRequest(e, "POST", "/api/v1/media", token, "", `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for no file, got %d", rec.Code)
	}
}

func TestHandler_Upload_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.POST("/api/v1/media", h.Upload)
	rec := testRequest(e, "POST", "/api/v1/media", "", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_ServeFile_Unauthorized(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	e.GET("/api/v1/media/files/*", h.ServeFile)
	rec := testRequest(e, "GET", "/api/v1/media/files/test.jpg", "", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_Nuke_WrongToken(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/nuke", h.Nuke)

	req := httptest.NewRequest("POST", "/api/v1/media/nuke", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Nuke-Token", "wrong-token")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestHandler_Nuke_MissingToken(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/nuke", h.Nuke)

	req := httptest.NewRequest("POST", "/api/v1/media/nuke", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestHandler_Nuke_Valid(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/nuke", h.Nuke)

	req := httptest.NewRequest("POST", "/api/v1/media/nuke", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Nuke-Token", "test-nuke-token")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Regression: PATCH body validation — non-boolean is_vault used to be silently
// dropped via map type assertions; typed binding must reject garbage.
func TestHandler_Update_RejectsGarbage(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.PATCH("/api/v1/media/:id", h.Update)
	rec := testRequest(e, "PATCH", "/api/v1/media/some-id", token, "", `{is_vault: not-json}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d", rec.Code)
	}
}

// Regression: HashExists DB failure used to be treated as "not duplicate".
// With a nil globalDB the query fails, so a duplicate-check upload must 500
// rather than fall through to a double write.
func TestHandler_Search_Paginated(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.GET("/api/v1/media/search", h.Search)
	rec := testRequest(e, "GET", "/api/v1/media/search?q=x&limit=2&page=1", token, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

// F2: post-upload processing must be bounded. The pool is acquired before any
// upload work and released by the background job, so concurrent processing can
// never exceed the configured size.
func TestProcessingPool_BoundsConcurrency(t *testing.T) {
	const size = 3
	const jobs = 20
	p := newProcessingPool(size, time.Second)

	var current, peak int32
	var wg sync.WaitGroup
	for i := 0; i < jobs; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if !p.acquire() {
				t.Error("acquire timed out")
				return
			}
			defer p.release()
			n := atomic.AddInt32(&current, 1)
			for {
				m := atomic.LoadInt32(&peak)
				if n <= m || atomic.CompareAndSwapInt32(&peak, m, n) {
					break
				}
			}
			time.Sleep(5 * time.Millisecond)
			atomic.AddInt32(&current, -1)
		}()
	}
	wg.Wait()

	if peak == 0 {
		t.Fatal("expected jobs to run")
	}
	if peak > size {
		t.Fatalf("peak concurrency %d exceeded pool size %d", peak, size)
	}
}

// F2: a saturated pool must shed rather than queue unboundedly.
func TestProcessingPool_AcquireShedsWhenSaturated(t *testing.T) {
	p := newProcessingPool(1, 20*time.Millisecond)
	if !p.acquire() {
		t.Fatal("first acquire should succeed")
	}
	defer p.release()

	start := time.Now()
	if p.acquire() {
		t.Fatal("expected acquire to fail while pool is saturated")
	}
	if elapsed := time.Since(start); elapsed < 20*time.Millisecond {
		t.Fatalf("expected acquire to wait for timeout, returned after %v", elapsed)
	}
}

// F5: EmptyTrash must return immediately and clean files up asynchronously
// with bounded concurrency — not walk the disk synchronously inside the request.
func TestHandler_EmptyTrash_ReturnsFastDeletesAsync(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/empty-trash", h.EmptyTrash)

	storage := h.storage
	const items = 50
	for i := 0; i < items; i++ {
		name := fmt.Sprintf("file%d.jpg", i)
		if _, _, _, err := storage.SaveFileFromBytes("test-user", []byte("x"), name); err != nil {
			t.Fatalf("save file %d: %v", i, err)
		}
	}

	// Seed DB rows pointing at the files above, all in trash.
	tdb, err := h.svc.pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	for i := 0; i < items; i++ {
		if _, err := tdb.Exec(
			`INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash, is_trash, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, 'image/jpeg', 1, $5, TRUE, 0, 0)`,
			fmt.Sprintf("id%d", i), "test-user", "T", fmt.Sprintf("file%d.jpg", i), fmt.Sprintf("hz%d", i)); err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
	}

	start := time.Now()
	rec := testRequest(e, "POST", "/api/v1/media/empty-trash", token, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("handler blocked %v on file cleanup; should return fast", elapsed)
	}

	// Files must eventually all disappear (async deletion completed).
	mediaDir := storage.MediaDir("test-user")
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		entries, _ := os.ReadDir(mediaDir)
		if len(entries) == 0 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	entries, _ := os.ReadDir(mediaDir)
	t.Fatalf("files not cleaned up asynchronously: %d remain (e.g. %s)", len(entries), firstEntry(entries))
}

func firstEntry(entries []os.DirEntry) string {
	for _, e := range entries {
		return e.Name()
	}
	return ""
}

// F7: a DeleteFile failure must be logged, not silently swallowed — otherwise
// the DB row is gone but the file orphans on disk with no trace.
func TestHandler_DeleteFileLogged_LogsFailure(t *testing.T) {
	e, h, _, _ := setupMediaHandler(t)
	_ = e
	storage := h.storage
	if _, _, _, err := storage.SaveFileFromBytes("test-user", []byte("x"), "victim.jpg"); err != nil {
		t.Fatalf("save file: %v", err)
	}
	mediaDir := storage.MediaDir("test-user")
	if err := os.Chmod(mediaDir, 0500); err != nil {
		t.Fatalf("chmod read-only: %v", err)
	}
	defer os.Chmod(mediaDir, 0755) //nolint:errcheck

	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	h.deleteFileLogged("test-user", "victim.jpg")

	if !strings.Contains(buf.String(), "DeleteFile failed") {
		t.Fatalf("expected failure logged, got: %q", buf.String())
	}
	if _, err := os.Stat(filepath.Join(mediaDir, "victim.jpg")); err != nil {
		t.Fatalf("file should still exist after failed delete: %v", err)
	}
}

// F8: empty media_ids on bulk endpoints must 400 (matching BulkMove's guard),
// not build 'IN ()' SQL and blow up as a 500.
func TestHandler_BulkEndpoints_RejectEmptyMediaIDs(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/bulk/favorite", h.BulkFavorite)
	e.POST("/api/v1/media/bulk/trash", h.BulkTrash)
	e.POST("/api/v1/media/bulk/restore", h.BulkRestore)
	e.POST("/api/v1/media/bulk/vault", h.BulkVault)

	paths := []string{
		"/api/v1/media/bulk/favorite",
		"/api/v1/media/bulk/trash",
		"/api/v1/media/bulk/restore",
		"/api/v1/media/bulk/vault",
	}
	for _, p := range paths {
		rec := testRequest(e, "POST", p, token, "", `{"media_ids":[]}`)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400 for empty media_ids, got %d: %s", p, rec.Code, rec.Body.String())
		}
	}
}
