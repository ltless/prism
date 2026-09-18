package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
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
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("429 response must carry a Retry-After header")
	}
}

// When the limiter rejects an upload POST, it must drain the request body
// first — otherwise Go RSTs the connection mid-upload and the proxy surfaces
// a network error instead of the 429 the client needs to retry on.
func TestRateLimiter_429DrainsBodyAndSetsRetryAfter(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	defer rl.Close()

	e := echo.New()
	e.Use(rl.Middleware())
	e.POST("/api/v1/media", func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	post := func() *httptest.ResponseRecorder {
		body := make([]byte, 1<<20)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/media", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/octet-stream")
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}

	if rec := post(); rec.Code != http.StatusOK {
		t.Fatalf("first POST expected 200, got %d", rec.Code)
	}
	rec := post()
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second POST expected 429, got %d", rec.Code)
	}
	ra := rec.Header().Get("Retry-After")
	if ra == "" {
		t.Fatal("expected Retry-After header on 429")
	}
	if n, err := strconv.Atoi(ra); err != nil || n < 1 || n > 61 {
		t.Fatalf("Retry-After should be within the 1-minute window, got %q", ra)
	}
}

// F11: at key capacity the limiter must evict the OLDEST-seen key, not a
// random map-order one — random eviction can reset a currently-limited
// attacker's counter mid-attack.
func TestRateLimiter_EvictsOldestKey(t *testing.T) {
	rl := NewRateLimiter(10, time.Minute, 3)
	defer rl.Close()

	e := echo.New()
	e.Use(rl.Middleware())
	e.GET("/p", func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	hit := func(ip string) int {
		req := httptest.NewRequest(http.MethodGet, "/p", nil)
		req.RemoteAddr = ip + ":1234"
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec.Code
	}

	// Fill to capacity: A (oldest) → B → C.
	hit("1.1.1.1")
	time.Sleep(15 * time.Millisecond)
	hit("2.2.2.2")
	time.Sleep(15 * time.Millisecond)
	hit("3.3.3.3")

	// New key D forces an eviction under capacity pressure.
	hit("4.4.4.4")

	rl.mu.Lock()
	defer rl.mu.Unlock()
	if len(rl.requests) > 3 {
		t.Fatalf("expected at most 3 keys, got %d", len(rl.requests))
	}
	if _, ok := rl.requests["/p:1.1.1.1"]; ok {
		t.Fatal("expected oldest key 1.1.1.1 to be evicted")
	}
	for _, ip := range []string{"2.2.2.2", "3.3.3.3", "4.4.4.4"} {
		if _, ok := rl.requests["/p:"+ip]; !ok {
			t.Fatalf("expected recent key %s to survive eviction", ip)
		}
	}
	if _, ok := rl.lastSeen["/p:1.1.1.1"]; ok {
		t.Fatal("expected lastSeen entry for evicted key to be pruned")
	}
}
