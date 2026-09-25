package media

import (
	"net/http"
	"testing"
)

func TestServeLimiter_BoundsPerUser(t *testing.T) {
	l := newServeLimiter(2)

	if !l.tryAcquire("u1") || !l.tryAcquire("u1") {
		t.Fatal("first two acquires must succeed")
	}
	if l.tryAcquire("u1") {
		t.Fatal("third concurrent acquire must be rejected")
	}
	if !l.tryAcquire("u2") {
		t.Fatal("another user must be unaffected")
	}

	l.release("u1")
	if !l.tryAcquire("u1") {
		t.Fatal("freed slot must be acquirable again")
	}

	// release without a matching acquire must not underflow into another
	// user's future slot
	l.release("u1")
	l.release("u1")
	l.release("nobody")
}

// H-05: with all serve slots held, the next original-file request gets 429
// before touching storage; after release it proceeds (404 — no such file).
func TestHandler_ServeFile_ConcurrencyBounded(t *testing.T) {
	e, h, token, _ := setupMediaHandler(t)
	e.GET("/api/v1/media/files/*", h.ServeFile)

	for i := 0; i < defaultServeConcurrency; i++ {
		if !h.serveLimit.tryAcquire("test-user") {
			t.Fatalf("prefill acquire %d failed", i)
		}
	}

	rec := testRequest(e, "GET", "/api/v1/media/files/missing.jpg", token, "", "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 with slots exhausted, got %d", rec.Code)
	}

	h.serveLimit.release("test-user")
	rec = testRequest(e, "GET", "/api/v1/media/files/missing.jpg", token, "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after release (limiter passed, file missing), got %d", rec.Code)
	}
}
