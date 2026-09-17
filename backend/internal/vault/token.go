package vault

import (
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

const (
	// TokenCookieName is the HttpOnly cookie holding a vault-unlock token.
	TokenCookieName = "vault_token"
	// TokenTTL bounds how long a successful PIN unlock stays valid server-side.
	TokenTTL = 15 * time.Minute
	// VaultTokenHeader is the server-to-server transport for the vault token
	// (Next.js server actions read the HttpOnly cookie and forward it here).
	VaultTokenHeader = "X-Vault-Token"

	tokenIssuer = "prism-vault"
)

type tokenClaims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// Manager issues and validates short-lived vault-unlock JWTs. The signing
// secret is domain-separated from the auth JWT secret (authSecret +
// "|vault-unlock-v1"), so an auth token can never validate as a vault token
// and vice versa even though both are HS256.
type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(authSecret string) *Manager {
	return &Manager{
		secret: []byte(authSecret + "|vault-unlock-v1"),
		ttl:    TokenTTL,
	}
}

// Issue signs a vault-unlock token bound to userID.
func (m *Manager) Issue(userID string) (string, error) {
	claims := &tokenClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tokenIssuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Unlocked reports whether the request presents a valid, unexpired vault
// token belonging to userID. The token is read from the HttpOnly cookie (set
// directly when the browser calls Go) or the X-Vault-Token header (forwarded
// by Next.js server actions). Forged signatures and another user's valid
// token are both rejected.
func (m *Manager) Unlocked(c echo.Context, userID string) bool {
	tokenStr := ""
	if ck, err := c.Cookie(TokenCookieName); err == nil && ck.Value != "" {
		tokenStr = ck.Value
	} else if h := c.Request().Header.Get(VaultTokenHeader); h != "" {
		tokenStr = h
	}
	if tokenStr == "" {
		return false
	}
	claims, err := m.validate(tokenStr)
	if err != nil || claims.UserID != userID {
		return false
	}
	return true
}

// Require returns a 403 "vault locked" when the caller has no valid unlock
// token for userID. Used on read paths that expose vault items.
func (m *Manager) Require(c echo.Context, userID string) error {
	if m.Unlocked(c, userID) {
		return nil
	}
	return echo.NewHTTPError(http.StatusForbidden, "vault locked")
}

// SetCookie writes the vault_token cookie with the same profile as the auth
// cookie: HttpOnly, SameSite=Lax, Secure on HTTPS, MaxAge = TTL.
func (m *Manager) SetCookie(c echo.Context, token string) {
	m.writeCookie(c, token, int(m.ttl.Seconds()))
}

// ClearCookie expires the vault_token cookie.
func (m *Manager) ClearCookie(c echo.Context) {
	m.writeCookie(c, "", -1)
}

func (m *Manager) writeCookie(c echo.Context, value string, maxAge int) {
	c.SetCookie(&http.Cookie{
		Name:     TokenCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   c.Scheme() == "https",
		SameSite: http.SameSiteLaxMode,
	})
}

func (m *Manager) validate(tokenStr string) (*tokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &tokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return m.secret, nil
	}, jwt.WithIssuer(tokenIssuer))
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*tokenClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}
