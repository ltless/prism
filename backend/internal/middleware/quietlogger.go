package middleware

import (
	"log"
	"time"

	"github.com/labstack/echo/v4"
)

// QuietLogger replaces Echo's default request logger. It only prints entries
// when the response status is ≥500 (server error) or the request took longer
// than 500ms (slow). Normal traffic is silent.
func QuietLogger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			elapsed := time.Since(start)
			status := c.Response().Status
			if status >= 500 || elapsed > 500*time.Millisecond {
				log.Printf("%s %s %d %v", c.Request().Method, c.Path(), status, elapsed)
			}
			return err
		}
	}
}
