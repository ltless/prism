package folders

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/db"
	_ "modernc.org/sqlite"
)

func TestFolderHandler_List_Unauthorized(t *testing.T) {
	pool := db.NewTenantPool(t.TempDir())
	svc := NewService(pool)
	h := NewHandler(svc)

	e := echo.New()
	e.GET("/api/v1/folders", h.List)

	req := httptest.NewRequest("GET", "/api/v1/folders", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestFolderHandler_Create_Unauthorized(t *testing.T) {
	pool := db.NewTenantPool(t.TempDir())
	svc := NewService(pool)
	h := NewHandler(svc)

	e := echo.New()
	e.POST("/api/v1/folders", h.Create)

	req := httptest.NewRequest("POST", "/api/v1/folders", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestFolderHandler_List_WithAuth(t *testing.T) {
	base := t.TempDir()
	pool := db.NewTenantPool(base)

	// Manually create the tenant DB with correct schema
	os.MkdirAll(base+"/user-1", 0755)
	raw, err := sql.Open("sqlite", base+"/user-1/prism.db")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	raw.Exec(`CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT,
		parent_id TEXT, created_at INTEGER, updated_at INTEGER,
		folder_type TEXT NOT NULL DEFAULT 'manual', filter_query TEXT
	)`)
	raw.Close()

	svc := NewService(pool)
	h := NewHandler(svc)

	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("user-1", "testuser", "admin")

	e := echo.New()
	e.Use(jwt.Middleware)
	e.GET("/api/v1/folders", h.List)

	req := httptest.NewRequest("GET", "/api/v1/folders", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
