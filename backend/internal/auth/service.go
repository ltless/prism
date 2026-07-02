package auth

import (
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
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

type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required,min=6"`
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
	ID              string
	Username        string
	PasswordHash    string
	Role            string
	Image           sql.NullString
	CoverImage      sql.NullString
	HasCompletedSetup int
}

type Service struct {
	db       *sql.DB
	jwt      *JWTManager
	validate *validator.Validate
}

func NewService(db *sql.DB, jwt *JWTManager) *Service {
	return &Service{
		db:       db,
		jwt:      jwt,
		validate: validator.New(),
	}
}

func (s *Service) Login(req *LoginRequest) (*AuthResponse, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrValidation, err)
	}

	var user userRow
	err := s.db.QueryRow(
		"SELECT id, username, password_hash, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)

	if err == sql.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.jwt.Generate(user.ID, user.Username, user.Role)
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

	// Invite code gate — mirrors the Next.js registerAction. If
	// REGISTRATION_INVITE_CODE is set, the request must supply a matching code.
	if expected := os.Getenv("REGISTRATION_INVITE_CODE"); expected != "" {
		if req.InviteCode == "" {
			return nil, ErrInviteRequired
		}
		if subtle.ConstantTimeCompare([]byte(req.InviteCode), []byte(expected)) != 1 {
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
		"INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, 'user')",
		id, req.Username, string(hash),
	)
	if err != nil {
		// modernc.org/sqlite returns a UNIQUE constraint error; treat as taken.
		if isUniqueConstraintErr(err) {
			return nil, ErrUsernameTaken
		}
		return nil, fmt.Errorf("insert user: %w", err)
	}

	token, err := s.jwt.Generate(id, req.Username, "user")
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

func (s *Service) Me(userID string) (*userRow, error) {
	var user userRow
	err := s.db.QueryRow(
		"SELECT id, username, password_hash, role, image, cover_image, has_completed_setup FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.Image, &user.CoverImage, &user.HasCompletedSetup)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}
	return &user, nil
}

func isUniqueConstraintErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "constraint failed: UNIQUE")
}
