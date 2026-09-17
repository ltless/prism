package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/vault"
	"golang.org/x/crypto/bcrypt"
)

func setupAuthHandler(t *testing.T) (*echo.Echo, *Handler) {
	t.Helper()
	db := setupTestDB(t)
	h, _ := bcrypt.GenerateFromPassword([]byte("testpass"), bcrypt.MinCost)
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"user-1", "testuser", string(h), "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt, "", false)
	handler := NewHandler(svc, vault.NewManager("test-secret"))

	e := echo.New()
	return e, handler
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func TestHandler_Login_Valid(t *testing.T) {
	e, h := setupAuthHandler(t)
	body := mustJSON(LoginRequest{Username: "testuser", Password: "testpass"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Login(c)
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp AuthResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if resp.Username != "testuser" {
		t.Fatalf("expected 'testuser', got '%s'", resp.Username)
	}
}

func TestHandler_Login_WrongPassword(t *testing.T) {
	e, h := setupAuthHandler(t)
	body := mustJSON(LoginRequest{Username: "testuser", Password: "wrongpass"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Login(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T: %v", err, err)
	}
	if he.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", he.Code)
	}
	// Must NOT leak whether user exists vs wrong password
	msg := he.Message.(string)
	if !strings.Contains(msg, "invalid credentials") {
		t.Fatalf("expected generic 'invalid credentials', got '%s'", msg)
	}
}

func TestHandler_Login_EmptyBody(t *testing.T) {
	e, h := setupAuthHandler(t)
	// nil body → empty LoginRequest → validation fails → 400
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Login(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T: %v", err, err)
	}
	if he.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty body, got %d", he.Code)
	}
}

func TestHandler_Login_InvalidJSON(t *testing.T) {
	e, h := setupAuthHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader([]byte(`not json`)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Login(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T: %v", err, err)
	}
	if he.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", he.Code)
	}
}

func TestHandler_Register_Valid(t *testing.T) {
	e, h := setupAuthHandler(t)
	body := mustJSON(RegisterRequest{Username: "newuser", Password: "newpass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Register(c)
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}

	var resp AuthResponse
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Username != "newuser" {
		t.Fatalf("expected 'newuser', got '%s'", resp.Username)
	}
	if resp.Token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestHandler_Register_Duplicate(t *testing.T) {
	e, h := setupAuthHandler(t)
	body := mustJSON(RegisterRequest{Username: "testuser", Password: "testpass"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Register(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T: %v", err, err)
	}
	if he.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate, got %d", he.Code)
	}
}

func TestHandler_Login_NoBody(t *testing.T) {
	e, h := setupAuthHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader([]byte(`{}`)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Login(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T", err)
	}
	if he.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty body, got %d", he.Code)
	}
}

func TestHandler_Register_WeakPassword(t *testing.T) {
	e, h := setupAuthHandler(t)
	body := mustJSON(RegisterRequest{Username: "newuser", Password: "abc"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.Register(c)
	he, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("expected echo.HTTPError, got %T: %v", err, err)
	}
	if he.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for weak password, got %d", he.Code)
	}
}
