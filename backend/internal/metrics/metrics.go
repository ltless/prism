package metrics

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/labstack/echo/v4"
)

// Default is the process-wide registry. Handlers and middleware increment
// counters directly; there's no setup step and no config to get wrong.
var Default = New()

type counter struct {
	value atomic.Int64
}

// Metrics is a small Prometheus-text registry. Only `counter` families are
// supported — enough for the operations questions here (request rate,
// upload failures, vault lockouts). No dependencies; labels are baked into
// the metric name.
type Metrics struct {
	mu       sync.Mutex
	counters map[string]*counter
}

func New() *Metrics { return &Metrics{counters: map[string]*counter{}} }

// Add changes a named counter by delta, creating it on first use.
func (m *Metrics) Add(name string, delta int64) {
	m.mu.Lock()
	c := m.counters[name]
	if c == nil {
		c = &counter{}
		m.counters[name] = c
	}
	m.mu.Unlock()
	c.value.Add(delta)
}

// Inc increments a named counter by one.
func (m *Metrics) Inc(name string) { m.Add(name, 1) }

// Handler renders all counters in Prometheus text exposition format.
func (m *Metrics) Handler(c echo.Context) error {
	m.mu.Lock()
	names := make([]string, 0, len(m.counters))
	for n := range m.counters {
		names = append(names, n)
	}
	counters := make(map[string]*counter, len(m.counters))
	for n, c := range m.counters {
		counters[n] = c
	}
	m.mu.Unlock()

	sort.Strings(names)
	out := "# TYPE prism counter\n"
	for _, n := range names {
		out += fmt.Sprintf("%s %d\n", n, counters[n].value.Load())
	}
	return c.String(http.StatusOK, out)
}

// Middleware wraps every request, recording status class and seconds spent.
func (m *Metrics) Middleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		start := time.Now()
		err := next(c)
		code := c.Response().Status
		if err != nil {
			if he, ok := err.(*echo.HTTPError); ok {
				code = he.Code
			} else {
				code = http.StatusInternalServerError
			}
		}
		class := strconv.Itoa(code/100) + "xx"
		m.Inc(`prism_http_requests_total{status="` + class + `"}`)
		m.Add(`prism_http_duration_ms_total{status="`+class+`"}`, time.Since(start).Milliseconds())
		return err
	}
}
