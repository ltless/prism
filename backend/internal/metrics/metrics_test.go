package metrics

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestMetrics_RenderAndCount(t *testing.T) {
	m := New()
	m.Inc("prism_uploads_total")
	m.Add("prism_upload_bytes_total", 2048)
	m.Add("prism_upload_bytes_total", 512)

	rec := httptest.NewRecorder()
	c := echo.New().NewContext(
		httptest.NewRequest(http.MethodGet, "/metrics", nil),
		rec,
	)
	if err := m.Handler(c); err != nil {
		t.Fatalf("render: %v", err)
	}
	body := rec.Body.String()
	for _, want := range []string{
		"prism_uploads_total 1",
		"prism_upload_bytes_total 2560",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics output missing %q, got:\n%s", want, body)
		}
	}
}

// The HTTP middleware must classify an aborted (unhandled-error) request as
// 5xx so failure class is observable, and let the error through untouched.
func TestMetrics_MiddlewareErrorStatus(t *testing.T) {
	m := New()
	e := echo.New()
	e.Use(m.Middleware)
	e.GET("/boom", func(c echo.Context) error {
		return echo.NewHTTPError(http.StatusBadGateway, "upstream")
	})

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("middleware must not swallow the error, got %d", rec.Code)
	}
	rec2 := httptest.NewRecorder()
	_ = m.Handler(e.NewContext(httptest.NewRequest(http.MethodGet, "/metrics", nil), rec2))
	if !strings.Contains(rec2.Body.String(), `prism_http_requests_total{status="5xx"} 1`) {
		t.Fatalf("expected 5xx class counter, got:\n%s", rec2.Body.String())
	}
}
