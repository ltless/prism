package auth

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

type contextKey string

const UserClaimsKey contextKey = "user_claims"

const AuthCookieName = "auth_token"

func (m *JWTManager) Middleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Prefer Bearer header; fall back to the auth_token cookie so the
		// browser-supplied HttpOnly cookie works for same-origin fetches.
		tokenStr := ""
		authHeader := c.Request().Header.Get("Authorization")
		if parts := strings.SplitN(authHeader, " ", 2); len(parts) == 2 && parts[0] == "Bearer" {
			tokenStr = parts[1]
		}
		if tokenStr == "" {
			if ck, err := c.Cookie(AuthCookieName); err == nil && ck.Value != "" {
				tokenStr = ck.Value
			}
		}
		if tokenStr == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization")
		}

		claims, err := m.Validate(tokenStr)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
		}

		c.Set(string(UserClaimsKey), claims)
		return next(c)
	}
}

func GetClaims(c echo.Context) *Claims {
	claims, ok := c.Get(string(UserClaimsKey)).(*Claims)
	if !ok {
		return nil
	}
	return claims
}

// RequireAdmin returns an Echo middleware that rejects non-admin callers.
// Must be used after JWTManager.Middleware so claims are populated.
func RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		claims := GetClaims(c)
		if claims == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
		}
		if claims.Role != "admin" {
			return echo.NewHTTPError(http.StatusForbidden, "admin only")
		}
		return next(c)
	}
}

// SetAuthCookie sets the auth_token cookie with HttpOnly + Secure (when on
// HTTPS) + SameSite=Lax so it cannot be read by JavaScript and is only sent
// over secure transports and on same-site navigations.
func SetAuthCookie(c echo.Context, token string, maxAge int) {
	secure := c.Scheme() == "https"
	c.SetCookie(&http.Cookie{
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearAuthCookie expires the auth_token cookie.
func ClearAuthCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     AuthCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   c.Scheme() == "https",
		SameSite: http.SameSiteLaxMode,
	})
}
