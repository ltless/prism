package config

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/db"
)

func setupConfigHandler(t *testing.T) (*echo.Echo, *Handler, string) {
	t.Helper()
	gdb, err := db.NewGlobalDB(t.TempDir() + "/g.db")
	if err != nil {
		t.Fatalf("NewGlobalDB: %v", err)
	}
	svc := NewService(gdb)
	h := NewHandler(svc)

	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("test-user", "testuser", "admin")

	e := echo.New()
	e.Use(jwt.Middleware)
	return e, h, token
}

func cfgReq(e *echo.Echo, method, path, token, body string) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestConfigHandler_Get(t *testing.T) {
	e, h, token := setupConfigHandler(t)
	e.GET("/api/v1/config", h.Get)
	rec := cfgReq(e, "GET", "/api/v1/config", token, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestConfigHandler_Get_Unauthorized(t *testing.T) {
	e, h, _ := setupConfigHandler(t)
	e.GET("/api/v1/config", h.Get)
	rec := cfgReq(e, "GET", "/api/v1/config", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestConfigHandler_Update(t *testing.T) {
	e, h, token := setupConfigHandler(t)
	e.GET("/api/v1/config", h.Get)
	e.PUT("/api/v1/config", h.Update)

	rec := cfgReq(e, "PUT", "/api/v1/config", token, `{"ai":{"variant":"standard","enabled":true}}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	rec2 := cfgReq(e, "GET", "/api/v1/config", token, "")
	var resp map[string]interface{}
	json.Unmarshal(rec2.Body.Bytes(), &resp)
	if resp["ai"] == nil {
		t.Fatal("expected ai config after update")
	}
}

func TestConfigHandler_Update_Unauthorized(t *testing.T) {
	e, h, _ := setupConfigHandler(t)
	e.PUT("/api/v1/config", h.Update)
	rec := cfgReq(e, "PUT", "/api/v1/config", "", `{}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestConfigHandler_Update_RejectsNonObjectAI(t *testing.T) {
	e, h, token := setupConfigHandler(t)
	e.PUT("/api/v1/config", h.Update)
	rec := cfgReq(e, "PUT", "/api/v1/config", token, `{"ai":"not-an-object"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
