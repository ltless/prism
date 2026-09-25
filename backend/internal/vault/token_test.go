package vault

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestSetCookie_SecureFromConfig(t *testing.T) {
	t.Cleanup(func() { SetCookieSecure(false) })
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "http://example.com/pin", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	SetCookieSecure(true)
	NewManager("test-secret").SetCookie(c, "tok")
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Secure") {
		t.Fatalf("COOKIE_SECURE should set Secure on plain http, got %q", rec.Header().Get("Set-Cookie"))
	}
}
