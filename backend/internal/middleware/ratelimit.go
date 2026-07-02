package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
	maxKeys  int
	done     chan struct{}
}

func NewRateLimiter(limit int, window time.Duration, maxKeys ...int) *RateLimiter {
	mk := 10000
	if len(maxKeys) > 0 && maxKeys[0] > 0 {
		mk = maxKeys[0]
	}
	rl := &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
		maxKeys:  mk,
		done:     make(chan struct{}),
	}

	go rl.cleanup()
	return rl
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
			ip := c.RealIP()
			// RealIP trusts X-Forwarded-For/X-Real-IP.
			// In production behind a reverse proxy, configure TrustedProxies
			// to prevent IP spoofing bypassing rate limits.
			key := c.Path() + ":" + ip

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
				return echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
			}

			if len(rl.requests) >= rl.maxKeys {
				for k := range rl.requests {
					delete(rl.requests, k)
					break
				}
			}
			rl.requests[key] = append(valid, now)
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
				} else {
					rl.requests[key] = valid
				}
			}
			rl.mu.Unlock()
		}
	}
}
