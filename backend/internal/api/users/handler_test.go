package users

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
	"github.com/ltless/prism/internal/dbtest"
	"golang.org/x/crypto/bcrypt"
)

func setupUsersHandlerDB(t *testing.T) *db.GlobalDB {
	t.Helper()
	sqlDB := dbtest.NewDB(t)
	gdb := &db.GlobalDB{DB: sqlDB}
	h, _ := bcrypt.GenerateFromPassword([]byte("testpass"), bcrypt.MinCost)
	_, err := gdb.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"user-1", "testuser", string(h), "admin")
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	return gdb
}

func setupUsersHandler(t *testing.T) (*echo.Echo, *Handler, string) {
	t.Helper()
	gdb := setupUsersHandlerDB(t)
	svc := NewService(gdb, nil)
	h := NewHandler(svc, nil)

	jwt := auth.NewJWTManager("test-secret")
	token, _ := jwt.Generate("user-1", "testuser", "admin")

	e := echo.New()
	e.Use(jwt.Middleware)
	return e, h, token
}

func usrReq(e *echo.Echo, method, path, token, body string) *httptest.ResponseRecorder {
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

func TestUsersHandler_GetProfile(t *testing.T) {
	e, h, token := setupUsersHandler(t)
	e.GET("/api/v1/users/me", h.GetProfile)
	rec := usrReq(e, "GET", "/api/v1/users/me", token, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var u map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &u)
	if u["username"] != "testuser" {
		t.Fatalf("expected 'testuser', got '%v'", u["username"])
	}
}

func TestUsersHandler_GetProfile_Unauthorized(t *testing.T) {
	e, h, _ := setupUsersHandler(t)
	e.GET("/api/v1/users/me", h.GetProfile)
	rec := usrReq(e, "GET", "/api/v1/users/me", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestUsersHandler_UpdateProfile(t *testing.T) {
	e, h, token := setupUsersHandler(t)
	e.PUT("/api/v1/users/me", h.UpdateProfile)
	rec := usrReq(e, "PUT", "/api/v1/users/me", token, `{"image":"img.jpg"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUsersHandler_UpdateProfile_Unauthorized(t *testing.T) {
	e, h, _ := setupUsersHandler(t)
	e.PUT("/api/v1/users/me", h.UpdateProfile)
	rec := usrReq(e, "PUT", "/api/v1/users/me", "", `{}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestUsersHandler_UpdateStorageLimit(t *testing.T) {
	e, h, token := setupUsersHandler(t)
	e.PUT("/api/v1/users/me/storage-limit", h.UpdateStorageLimit)
	rec := usrReq(e, "PUT", "/api/v1/users/me/storage-limit", token, `{"storage_limit":1000000}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

// F6: storage_limit contract — 0 = zero bytes allowed, null = unlimited,
// negative or missing = 400. Never a silent "0 means unlimited".
func TestUsersHandler_UpdateStorageLimit_Semantics(t *testing.T) {
	e, h, token := setupUsersHandler(t)
	e.PUT("/api/v1/users/me/storage-limit", h.UpdateStorageLimit)

	cases := []struct {
		name string
		body string
		code int
	}{
		{"zero means zero bytes", `{"storage_limit":0}`, http.StatusOK},
		{"null means unlimited", `{"storage_limit":null}`, http.StatusOK},
		{"negative rejected", `{"storage_limit":-1}`, http.StatusBadRequest},
		{"missing field rejected", `{}`, http.StatusBadRequest},
	}
	for _, tc := range cases {
		rec := usrReq(e, "PUT", "/api/v1/users/me/storage-limit", token, tc.body)
		if rec.Code != tc.code {
			t.Errorf("%s: expected %d, got %d: %s", tc.name, tc.code, rec.Code, rec.Body.String())
		}
	}
}

func TestUsersHandler_SetupComplete(t *testing.T) {
	e, h, token := setupUsersHandler(t)
	e.POST("/api/v1/users/me/setup-complete", h.SetupComplete)
	rec := usrReq(e, "POST", "/api/v1/users/me/setup-complete", token, `{}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
