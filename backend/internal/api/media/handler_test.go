package media

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
	svc := NewService(pool, stubActive{true})
	handler := NewHandler(svc, storage)

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

	svc := NewService(sharedPool, stubActive{true})
	h := NewHandler(svc, storage)
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

	svc := NewService(setupTenantDB(t), stubActive{true})
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
