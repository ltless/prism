package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

// F2: /api/v1/media must stay rate-limited for POST (upload) while GET (list)
// remains exempt as a high-frequency read.
func TestRateLimiter_SkipMethodPath(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	defer rl.Close()
	rl.SkipMethodPath(http.MethodGet, "/api/v1/media")

	e := echo.New()
	e.Use(rl.Middleware())
	e.GET("/api/v1/media", func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	e.POST("/api/v1/media", func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	for i := 0; i < 5; i++ {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/media", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("GET call %d: expected 200, got %d", i, rec.Code)
		}
	}

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/media", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("first POST expected 200, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/media", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second POST expected 429, got %d", rec.Code)
	}
}
