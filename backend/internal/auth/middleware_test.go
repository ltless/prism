package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestSetAuthCookie_SecureFromConfig(t *testing.T) {
	t.Cleanup(func() { SetCookieSecure(false) })
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "http://example.com/login", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	SetCookieSecure(true)
	SetAuthCookie(c, "tok", 60)
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Secure") {
		t.Fatalf("COOKIE_SECURE should set Secure on plain http, got %q", rec.Header().Get("Set-Cookie"))
	}
}

// Regression for stale-admin-token authorization: RequireAdmin must consult
// the current DB role, not the role claim frozen into the JWT at issue time.
func TestRequireAdmin_RevocationEffectiveOnOldToken(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	if _, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, 'admin')",
		"user-admin", "adminuser", pwh); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	token, err := jwt.Generate("user-admin", "adminuser", "admin", 0)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	svc := NewService(db, jwt, "", false)
	e := echo.New()
	e.Use(jwt.Middleware)

	calls := 0
	e.GET("/admin-only", func(c echo.Context) error { calls++; return c.NoContent(http.StatusOK) }, svc.RequireAdmin)

	req := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, r)
		return rec
	}

	if rec := req(); rec.Code != http.StatusOK {
		t.Fatalf("admin with fresh admin role: expected 200, got %d", rec.Code)
	}

	if _, err := db.Exec("UPDATE users SET role = 'user' WHERE id = 'user-admin'"); err != nil {
		t.Fatalf("revoke admin: %v", err)
	}

	// Same pre-revocation token must now be rejected.
	rec := req()
	if rec.Code != http.StatusForbidden {
		t.Fatalf("revoked admin with old token: expected 403, got %d", rec.Code)
	}
	if calls != 1 {
		t.Fatalf("handler must not run for revoked admin, ran %d times", calls)
	}

	// Reverse transition: promoting to admin is immediate too.
	if _, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = 'user-admin'"); err != nil {
		t.Fatalf("grant admin: %v", err)
	}
	if rec := req(); rec.Code != http.StatusOK {
		t.Fatalf("re-granted admin with old token: expected 200, got %d", rec.Code)
	}
}

func TestRequireAdmin_DeletedUserFailsClosed(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	if _, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, 'admin')",
		"user-gone", "goneuser", pwh); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	token, err := jwt.Generate("user-gone", "goneuser", "admin", 0)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	svc := NewService(db, jwt, "", false)
	e := echo.New()
	e.Use(jwt.Middleware)
	e.GET("/admin-only", func(c echo.Context) error { return c.NoContent(http.StatusOK) }, svc.RequireAdmin)

	if _, err := db.Exec("DELETE FROM users WHERE id = 'user-gone'"); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	r := httptest.NewRequest(http.MethodGet, "/admin-only", nil)
	r.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, r)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("deleted user: expected 403 (fail closed), got %d", rec.Code)
	}
}
