package middleware

import (
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type RateLimiter struct {
	mu        sync.Mutex
	requests  map[string][]time.Time
	lastSeen  map[string]time.Time
	limit     int
	window    time.Duration
	maxKeys   int
	skipPaths map[string]bool
	done      chan struct{}
}

func NewRateLimiter(limit int, window time.Duration, maxKeys ...int) *RateLimiter {
	mk := 10000
	if len(maxKeys) > 0 && maxKeys[0] > 0 {
		mk = maxKeys[0]
	}
	rl := &RateLimiter{
		requests:  make(map[string][]time.Time),
		lastSeen:  make(map[string]time.Time),
		limit:     limit,
		window:    window,
		maxKeys:   mk,
		skipPaths: make(map[string]bool),
		done:      make(chan struct{}),
	}

	go rl.cleanup()
	return rl
}

// SkipPath exempts a route path from rate limiting for all HTTP methods.
func (rl *RateLimiter) SkipPath(path string) {
	rl.skipPaths["* "+path] = true
}

// SkipMethodPath exempts a route path from rate limiting for a single HTTP
// method only — e.g. exempt high-frequency GETs while still limiting POSTs.
func (rl *RateLimiter) SkipMethodPath(method, path string) {
	rl.skipPaths[method+" "+path] = true
}

// Close stops the background cleanup goroutine. Safe to call multiple times.
func (rl *RateLimiter) Close() {
	select {
	case <-rl.done:
	default:
		close(rl.done)
	}
}

func (rl *RateLimiter) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Path()
			if rl.skipPaths["* "+path] || rl.skipPaths[c.Request().Method+" "+path] {
				return next(c)
			}
			ip := c.RealIP()
			// RealIP trusts X-Forwarded-For/X-Real-IP.
			// In production behind a reverse proxy, configure TrustedProxies
			// to prevent IP spoofing bypassing rate limits.
			key := path + ":" + ip

			rl.mu.Lock()
			now := time.Now()
			windowStart := now.Add(-rl.window)

			times := rl.requests[key]
			var valid []time.Time
			for _, t := range times {
				if t.After(windowStart) {
					valid = append(valid, t)
				}
			}

		if len(valid) >= rl.limit {
			rl.mu.Unlock()
			// Drain the request body so Go doesn't RST the connection while
			// the proxy is still writing the upload — the browser would see a
			// network error instead of the 429. BodyLimit already caps uploads
			// at 210MB, so draining is bounded.
			if c.Request().Body != nil {
				io.Copy(io.Discard, c.Request().Body)
			}
			// Seconds until the oldest request in the window ages out — the
			// earliest the client can successfully retry.
			retryAfter := int(rl.window.Seconds())
			if len(valid) > 0 {
				if s := int(time.Until(valid[0].Add(rl.window)).Seconds()) + 1; s > 0 {
					retryAfter = s
				}
			}
			c.Response().Header().Set("Retry-After", strconv.Itoa(retryAfter))
			return echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
		}

			if len(rl.requests) >= rl.maxKeys {
				// Evict the least-recently-seen key (F11): a random map-order
				// eviction could wipe a currently-limited attacker's counter
				// (resetting their quota) or an active user's tracking.
				oldestKey := ""
				var oldest time.Time
				for k, t := range rl.lastSeen {
					if oldestKey == "" || t.Before(oldest) {
						oldestKey = k
						oldest = t
					}
				}
				if oldestKey != "" {
					delete(rl.requests, oldestKey)
					delete(rl.lastSeen, oldestKey)
				}
			}
			rl.requests[key] = append(valid, now)
			rl.lastSeen[key] = now
			rl.mu.Unlock()

			return next(c)
		}
	}
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-rl.done:
			return
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now().Add(-rl.window)
			for key, times := range rl.requests {
				var valid []time.Time
				for _, t := range times {
					if t.After(now) {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.requests, key)
					delete(rl.lastSeen, key)
				} else {
					rl.requests[key] = valid
				}
			}
			rl.mu.Unlock()
		}
	}
}
