package auth

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

type contextKey string

const UserClaimsKey contextKey = "user_claims"

const AuthCookieName = "auth_token"

// cookieSecure is set from COOKIE_SECURE at startup. Scheme detection alone
// misses TLS terminated in front of the process.
var cookieSecure bool

func SetCookieSecure(secure bool) { cookieSecure = secure }

func cookieIsSecure(c echo.Context) bool {
	return cookieSecure || c.Scheme() == "https"
}

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

// GetClaimsOrErr returns the authenticated claims or an Unauthorized HTTPError.
// Use this in protected handler methods to replace the 3-line nil-check pattern.
func GetClaimsOrErr(c echo.Context) (*Claims, error) {
	claims := GetClaims(c)
	if claims == nil {
		return nil, echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
	}
	return claims, nil
}

// RequireAdmin rejects non-admin callers. The JWT role claim only proves
// what the role was at issue time — authorization re-reads the current role
// from the database so revoking admin takes effect on already-issued tokens.
// Must be used after JWTManager.Middleware so claims are populated.
func (s *Service) RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		claims := GetClaims(c)
		if claims == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "not authenticated")
		}
		var role string
		err := s.db.QueryRow("SELECT role FROM users WHERE id = $1", claims.UserID).Scan(&role)
		if err != nil {
			// Deleted user or DB failure → fail closed.
			if err != sql.ErrNoRows {
				log.Printf("RequireAdmin role lookup: %v", err)
			}
			return echo.NewHTTPError(http.StatusForbidden, "admin only")
		}
		if role != "admin" {
			return echo.NewHTTPError(http.StatusForbidden, "admin only")
		}
		return next(c)
	}
}

// SetAuthCookie sets the auth_token cookie with HttpOnly + Secure (HTTPS, or
// COOKIE_SECURE) + SameSite=Lax so it cannot be read by JavaScript and is
// only sent over secure transports and on same-site navigations.
func SetAuthCookie(c echo.Context, token string, maxAge int) {
	c.SetCookie(&http.Cookie{
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   cookieIsSecure(c),
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
		Secure:   cookieIsSecure(c),
		SameSite: http.SameSiteLaxMode,
	})
}
