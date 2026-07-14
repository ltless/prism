package folders

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

func TestFolderHandler_List_Unauthorized(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)
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
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)
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
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)

	// Insert user for FK
	_, err := sqlDB.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"user-1", "testuser", "hash", "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

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
