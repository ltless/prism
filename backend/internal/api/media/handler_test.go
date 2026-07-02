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

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/api/users"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/vault"
	"golang.org/x/crypto/bcrypt"
)

func setupMediaHandler(t *testing.T) (*echo.Echo, *Handler, string, *auth.JWTManager) {
	t.Helper()
	pool := setupTenantDB(t)

	jwt := auth.NewJWTManager("test-secret")
	token, err := jwt.Generate("test-user", "testuser", "admin")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	storage := newTestStorage(t.TempDir())
	svc := NewService(pool, nil)
	handler := NewHandler(svc, storage, "test-nuke-token", vault.NewManager("test-secret"))

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
	storage := newTestStorage(t.TempDir())
	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("test-user", "testuser", "admin")

	svc := NewService(sharedPool, nil)
	h := NewHandler(svc, storage, "test-nuke-token", vault.NewManager("test-secret"))
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

func TestHandler_Nuke_WrongUsername(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/nuke", h.Nuke)

	rec := testRequest(e, "POST", "/api/v1/media/nuke", token, "", `{"confirm_username":"someone-else"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestHandler_Nuke_MissingUsername(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.POST("/api/v1/media/nuke", h.Nuke)

	rec := testRequest(e, "POST", "/api/v1/media/nuke", token, "", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_Nuke_Valid(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	for _, u := range []struct{ id, username string }{
		{"test-user", "testuser"},
		{"other-user", "other"},
	} {
		if _, err := sqlDB.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
			u.id, u.username, "hash", "admin"); err != nil {
			t.Fatalf("insert user %s: %v", u.id, err)
		}
	}
	pool := db.NewTenantPool(sqlDB)
	svc := NewService(pool, nil)
	h := NewHandler(svc, newTestStorage(t.TempDir()), "test-nuke-token", vault.NewManager("test-secret"))

	jwt := auth.NewJWTManager("test-secret")
	token, err := jwt.Generate("test-user", "testuser", "admin")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	mine, _, err := svc.Create("test-user", "", "mine.jpg", "Mine", "image/jpeg", "h-nuke-mine", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create own item: %v", err)
	}
	theirs, _, err := svc.Create("other-user", "", "theirs.jpg", "Theirs", "image/jpeg", "h-nuke-theirs", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create other item: %v", err)
	}

	e := echo.New()
	e.Use(jwt.Middleware)
	e.POST("/api/v1/media/nuke", h.Nuke)

	rec := testRequest(e, "POST", "/api/v1/media/nuke", token, "", `{"confirm_username":"testuser"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if _, err := svc.Get("test-user", mine.ID); err == nil {
		t.Fatal("expected own media to be wiped")
	}
	if _, err := svc.Get("other-user", theirs.ID); err != nil {
		t.Fatal("expected other user's media to survive the wipe")
	}
}

func TestHandler_Nuke_DisabledWithoutToken(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
	h := NewHandler(svc, newTestStorage(t.TempDir()), "", vault.NewManager("test-secret"))

	jwt := auth.NewJWTManager("test-secret")
	token, err := jwt.Generate("test-user", "testuser", "admin")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	e := echo.New()
	e.Use(jwt.Middleware)
	e.POST("/api/v1/media/nuke", h.Nuke)

	rec := testRequest(e, "POST", "/api/v1/media/nuke", token, "", `{"confirm_username":"testuser"}`)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when NUKE_CONFIRMATION_TOKEN is unset, got %d", rec.Code)
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

// F10: the vault-PIN lockout must survive a backend restart (it lives in the
// users row, not in-memory) and be shared between the two protected routes.
// Five wrong PINs via the un-vault route lock the user; the users PIN-verify
// route then rejects the correct PIN with 429 too.
func TestHandler_VaultPin_LockoutPersistedAndShared(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash pin: %v", err)
	}
	_, err = sqlDB.Exec("INSERT INTO users (id, username, password_hash, role, vault_pin) VALUES ($1, $2, $3, $4, $5)",
		"test-user", "testuser", "hash", "admin", string(hash))
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}

	// Wire a media service with its global DB set, exactly as router.go does.
	mediaSvc := NewService(db.NewTenantPool(sqlDB), nil)
	mediaSvc.SetGlobalDB(&db.GlobalDB{DB: sqlDB})
	mediaH := NewHandler(mediaSvc, newTestStorage(t.TempDir()), "test-nuke-token", vault.NewManager("test-secret"))

	usersSvc := users.NewService(&db.GlobalDB{DB: sqlDB}, nil)
	usersH := users.NewHandler(usersSvc, nil, vault.NewManager("test-secret"))

	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("test-user", "testuser", "admin")

	e := echo.New()
	e.Use(jwt.Middleware)
	e.POST("/api/v1/media/bulk/vault", mediaH.BulkVault)
	e.POST("/api/v1/users/me/vault-pin/verify", usersH.VerifyVaultPin)

	// Five wrong PINs through the media un-vault route.
	for i := 0; i < 5; i++ {
		rec := testRequest(e, "POST", "/api/v1/media/bulk/vault", token, "",
			`{"media_ids":["m1"],"is_vault":false,"pin":"000000"}`)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("attempt %d: expected 403, got %d: %s", i+1, rec.Code, rec.Body.String())
		}
	}

	// Sixth attempt is rejected by the shared counter with a retry hint.
	rec := testRequest(e, "POST", "/api/v1/media/bulk/vault", token, "",
		`{"media_ids":["m1"],"is_vault":false,"pin":"000000"}`)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on 6th attempt, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on 429")
	}

	// The users PIN-verify route hits the same counter: even the correct PIN
	// is rejected while the lock is active.
	rec = testRequest(e, "POST", "/api/v1/users/me/vault-pin/verify", token, "", `{"pin":"123456"}`)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected users verify route to share the lockout (429), got %d: %s", rec.Code, rec.Body.String())
	}
}

// F1: the vault read path must be gated server-side by a short-lived unlock
// token. No token, another user's token, or an expired token → 403; a valid
// token → 200 and only vault items.
func TestHandler_VaultList_Gated(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)

	item, _, err := h.svc.Create("test-user", "", "vault.jpg", "Vault", "image/jpeg", "hash-vault-1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create vault item: %v", err)
	}
	if err := h.svc.Update("test-user", item.ID, map[string]interface{}{"is_vault": true}); err != nil {
		t.Fatalf("mark vault: %v", err)
	}

	e.GET("/api/v1/media", h.List)

	// (a) vault=true without unlock token → 403
	rec := testRequest(e, "GET", "/api/v1/media?vault=true", token, "", "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("locked list: expected 403, got %d: %s", rec.Code, rec.Body.String())
	}

	// (c) a valid token belonging to another user → 403
	otherTok, err := h.vaultMgr.Issue("other-user")
	if err != nil {
		t.Fatalf("issue other token: %v", err)
	}
	rec = testRequestWithVaultCookie(e, "GET", "/api/v1/media?vault=true", token, otherTok)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("other-user token: expected 403, got %d: %s", rec.Code, rec.Body.String())
	}

	// (d) an expired token → 403
	rec = testRequestWithVaultCookie(e, "GET", "/api/v1/media?vault=true", token, signVaultToken(t, "test-user", -2*time.Minute, "test-secret"))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expired token: expected 403, got %d: %s", rec.Code, rec.Body.String())
	}

	// (b) a valid token → 200, only the vault item
	goodTok, err := h.vaultMgr.Issue("test-user")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	rec = testRequestWithVaultCookie(e, "GET", "/api/v1/media?vault=true", token, goodTok)
	if rec.Code != http.StatusOK {
		t.Fatalf("unlocked list: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Items []struct {
			IsVault bool `json:"isVault"`
		} `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("parse list: %v", err)
	}
	if len(resp.Items) != 1 || !resp.Items[0].IsVault {
		t.Fatalf("expected exactly the 1 vault item, got %d items", len(resp.Items))
	}
}

// F1: a normal (non-vault) list must not require the vault token.
func TestHandler_VaultList_NonVaultUnaffected(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.GET("/api/v1/media", h.List)
	rec := testRequest(e, "GET", "/api/v1/media", token, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("normal list: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

// F1: ServeFile must return 404 for vault originals and thumbnails while
// locked (existence hidden), and serve them once unlocked.
func TestHandler_ServeFile_VaultGate(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)

	const hash = "ab12cd34ef56ab7890"
	if _, _, _, err := h.storage.SaveFileFromBytes("test-user", []byte("vault-bytes"), hash+".jpg"); err != nil {
		t.Fatalf("save file: %v", err)
	}

	item, _, err := h.svc.Create("test-user", "", hash+".jpg", "V", "image/jpeg", hash, 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create vault item: %v", err)
	}
	if err := h.svc.Update("test-user", item.ID, map[string]interface{}{"is_vault": true}); err != nil {
		t.Fatalf("mark vault: %v", err)
	}

	e.GET("/api/v1/media/files/*", h.ServeFile)

	// (e) original file, locked → 404 (not 403 — vault existence is hidden)
	rec := testRequest(e, "GET", "/api/v1/media/files/"+hash+".jpg", token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("locked original: expected 404, got %d", rec.Code)
	}

	// (f) thumbnail, locked → 404
	rec = testRequest(e, "GET", "/api/v1/media/files/"+hash+".thumb.jpg?thumb=1", token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("locked thumbnail: expected 404, got %d", rec.Code)
	}

	// unlocked → the file is served
	goodTok, err := h.vaultMgr.Issue("test-user")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	rec = testRequestWithVaultCookie(e, "GET", "/api/v1/media/files/"+hash+".jpg", token, goodTok)
	if rec.Code != http.StatusOK {
		t.Fatalf("unlocked serve: expected 200, got %d", rec.Code)
	}
}

// F1: a non-vault file must keep serving while the vault is locked.
func TestHandler_ServeFile_NonVaultUnaffected(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	if _, _, _, err := h.storage.SaveFileFromBytes("test-user", []byte("plain"), "plainhash.jpg"); err != nil {
		t.Fatalf("save file: %v", err)
	}
	e.GET("/api/v1/media/files/*", h.ServeFile)
	rec := testRequest(e, "GET", "/api/v1/media/files/plainhash.jpg", token, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("non-vault serve: expected 200, got %d", rec.Code)
	}
}

// F1: Get on a vault item returns 404 while locked, 200 while unlocked.
func TestHandler_Get_VaultGate(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	item, _, err := h.svc.Create("test-user", "", "v.jpg", "V", "image/jpeg", "getvault", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := h.svc.Update("test-user", item.ID, map[string]interface{}{"is_vault": true}); err != nil {
		t.Fatalf("mark vault: %v", err)
	}
	e.GET("/api/v1/media/:id", h.Get)

	rec := testRequest(e, "GET", "/api/v1/media/"+item.ID, token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("locked get: expected 404, got %d", rec.Code)
	}

	goodTok, err := h.vaultMgr.Issue("test-user")
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	rec = testRequestWithVaultCookie(e, "GET", "/api/v1/media/"+item.ID, token, goodTok)
	if rec.Code != http.StatusOK {
		t.Fatalf("unlocked get: expected 200, got %d", rec.Code)
	}
}

func testRequestWithVaultCookie(e *echo.Echo, method, path, token, vaultToken string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if vaultToken != "" {
		req.AddCookie(&http.Cookie{Name: vault.TokenCookieName, Value: vaultToken})
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// signVaultToken crafts a vault-unlock token with an arbitrary age, using the
// same domain-separated secret the Manager derives from the auth secret.
func signVaultToken(t *testing.T, userID string, age time.Duration, authSecret string) string {
	t.Helper()
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id": userID,
		"iss":     "prism-vault",
		"sub":     userID,
		"iat":     now.Add(age).Unix(),
		"exp":     now.Add(age).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := tok.SignedString([]byte(authSecret + "|vault-unlock-v1"))
	if err != nil {
		t.Fatalf("sign vault token: %v", err)
	}
	return s
}

func newTestStorage(dir string) *mw.Storage {
	mk, err := mw.LoadMasterKey(bytes.Repeat([]byte{0x42}, 32))
	if err != nil {
		panic(err)
	}
	return mw.NewStorage(dir, mk)
}
