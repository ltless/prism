package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	// PwdChangedAt is the user's password_changed_at (unix seconds) at token
	// issue time. If the password changes later, this claim no longer matches
	// the DB and the token is rejected — revocation without a token table.
	PwdChangedAt int64 `json:"pwd_chg,omitempty"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret []byte
	ttl    time.Duration
	// claimsValidator, when set, is called with the parsed claims before a
	// request proceeds. Returning an error rejects the token (e.g. revoked
	// because the password changed after issue).
	claimsValidator func(*Claims) error
}

func NewJWTManager(secret string, ttl ...time.Duration) *JWTManager {
	d := 7 * 24 * time.Hour
	if len(ttl) > 0 && ttl[0] > 0 {
		d = ttl[0]
	}
	return &JWTManager{
		secret: []byte(secret),
		ttl:    d,
	}
}

func (m *JWTManager) Generate(userID, username, role string, pwdChangedAt ...int64) (string, error) {
	claims := &Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "prism",
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	if len(pwdChangedAt) > 0 {
		claims.PwdChangedAt = pwdChangedAt[0]
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *JWTManager) SetClaimsValidator(fn func(*Claims) error) {
	m.claimsValidator = fn
}

func (m *JWTManager) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.secret, nil
	}, jwt.WithIssuer("prism"))
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	if m.claimsValidator != nil {
		if err := m.claimsValidator(claims); err != nil {
			return nil, fmt.Errorf("token revoked: %w", err)
		}
	}

	return claims, nil
}
