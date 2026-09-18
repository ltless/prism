package auth

import (
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

// Sentinel errors so handlers can distinguish 400/401/500 without string matching.
var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrValidation         = errors.New("validation")
	ErrUsernameTaken      = errors.New("username taken")
	ErrInviteRequired     = errors.New("invite code required")
	ErrInviteInvalid      = errors.New("invalid invite code")
)

// dummyPasswordHash is a valid bcrypt hash used to equalise login timing for
// unknown usernames (see Login).
const dummyPasswordHash = "$2a$10$a4Ehgp16FtY2HONYvsq5Qu4p36RkDxc7D/c1OMA3/vgxjNgBQsymu"

type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required"`
}

type RegisterRequest struct {
	Username   string `json:"username" validate:"required,min=3,max=50"`
	Password   string `json:"password" validate:"required,min=8"`
	InviteCode string `json:"invite_code,omitempty"`
}

type AuthResponse struct {
	Token    string `json:"token"`
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type userRow struct {
	ID                string
	Username          string
	PasswordHash      string
	Role              string
	Image             sql.NullString
	CoverImage        sql.NullString
	HasCompletedSetup bool
	PwdChangedAt      time.Time
}

type Service struct {
	db            *sql.DB
	jwt           *JWTManager
	validate      *validator.Validate
	inviteCode    string
	requireInvite bool
}

func NewService(db *sql.DB, jwt *JWTManager, inviteCode string, requireInvite bool) *Service {
	return &Service{
		db:            db,
		jwt:           jwt,
	validate:      validator.New(),
	inviteCode:    inviteCode,
		requireInvite: requireInvite,
	}
}

func (s *Service) Login(req *LoginRequest) (*AuthResponse, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrValidation, err)
	}

	var user userRow
	err := s.db.QueryRow(
		"SELECT id, username, password_hash, role, password_changed_at FROM users WHERE username = $1",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.PwdChangedAt)

	if err == sql.ErrNoRows {
		// Run a dummy bcrypt comparison so a non-existent user takes the same
		// time as a wrong-password attempt — otherwise response timing leaks
		// which usernames exist.
		_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(req.Password))
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.jwt.Generate(user.ID, user.Username, user.Role, user.PwdChangedAt.Unix())
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}

	return &AuthResponse{
		Token:    token,
		UserID:   user.ID,
	Username: user.Username,
	Role:     user.Role,
	}, nil
}

func (s *Service) Register(req *RegisterRequest) (*AuthResponse, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrValidation, err)
	}

	// Invite code gate. If RequireInvite is true (default), registration
	// requires a matching code even if inviteCode is empty — this prevents
	// accidental open registration when the env var is unset.
	if s.requireInvite {
		if req.InviteCode == "" {
			return nil, ErrInviteRequired
	}
		if s.inviteCode == "" {
			// No code configured but invite is required — reject everything.
			return nil, ErrInviteInvalid
	}
		if subtle.ConstantTimeCompare([]byte(req.InviteCode), []byte(s.inviteCode)) != 1 {
			return nil, ErrInviteInvalid
	}
	} else if s.inviteCode != "" {
	// If RequireInvite is false but a code is set, still validate it
	// when the user provides one (optional gate).
		if req.InviteCode != "" && subtle.ConstantTimeCompare([]byte(req.InviteCode), []byte(s.inviteCode)) != 1 {
			return nil, ErrInviteInvalid
	}
	}

	// Insert directly and rely on the UNIQUE constraint to detect duplicates,
	// avoiding the TOCTOU race between SELECT COUNT and INSERT.
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	id := uuid.New().String()
	_, err = s.db.Exec(
		"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, 'user')",
		id, req.Username, string(hash),
	)
	if err != nil {
		if isUniqueConstraintErr(err) {
			return nil, ErrUsernameTaken
		}
		return nil, fmt.Errorf("insert user: %w", err)
	}

	token, err := s.jwt.Generate(id, req.Username, "user", time.Now().Unix())
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}

	return &AuthResponse{
		Token:    token,
		UserID:   id,
	Username: req.Username,
	Role:     "user",
	}, nil
}

// MeInfo contains only the fields safe to expose via the API.
// PasswordHash is intentionally excluded to prevent accidental leakage.
type MeInfo struct {
	ID                string
	Username          string
	Role              string
	Image             sql.NullString
	CoverImage        sql.NullString
	HasCompletedSetup bool
}

func (s *Service) Me(userID string) (*MeInfo, error) {
	var user MeInfo
	err := s.db.QueryRow(
	"SELECT id, username, role, image, cover_image, has_completed_setup FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Username, &user.Role, &user.Image, &user.CoverImage, &user.HasCompletedSetup)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}
	return &user, nil
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required,min=6"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

func (s *Service) ChangePassword(userID, oldPassword, newPassword string) error {
	if err := s.validate.Struct(&ChangePasswordRequest{
	OldPassword: oldPassword,
	NewPassword: newPassword,
	}); err != nil {
		return fmt.Errorf("%w: %w", ErrValidation, err)
	}

	var hash string
	err := s.db.QueryRow("SELECT password_hash FROM users WHERE id = $1", userID).Scan(&hash)
	if err == sql.ErrNoRows {
		return ErrInvalidCredentials
	}
	if err != nil {
		return fmt.Errorf("query user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)); err != nil {
		return ErrInvalidCredentials
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	now := time.Now().UTC()
	// Bumping password_changed_at revokes every previously issued token.
	_, err = s.db.Exec(
		"UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3",
		string(newHash), now, userID,
	)
	return err
}

// SetClaimsValidator wires the JWT revocation check into the manager:
// a token is rejected when it was issued before the user's last password
// change. PwdChangedAt == 0 means a token from before this feature existed —
// accept it; it expires naturally and any new password change revokes it.
func (s *Service) SetClaimsValidator() {
	s.jwt.SetClaimsValidator(func(claims *Claims) error {
		if claims.PwdChangedAt == 0 {
			return nil
		}
		var changedAt time.Time
		err := s.db.QueryRow(
			"SELECT password_changed_at FROM users WHERE id = $1", claims.UserID,
		).Scan(&changedAt)
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		if err != nil {
			return fmt.Errorf("query pwd_changed_at: %w", err)
		}
		if claims.PwdChangedAt < changedAt.Unix() {
			return fmt.Errorf("password changed after token issue")
		}
		return nil
	})
}

func isUniqueConstraintErr(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" // unique_violation
	}
	return false
}
