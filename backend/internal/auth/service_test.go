package auth

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/ltless/prism/internal/dbtest"
	"golang.org/x/crypto/bcrypt"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return dbtest.NewDB(t)
}

func hashPassword(t *testing.T, pw string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return string(h)
}

func TestService_Login_Valid(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
	"user-1", "testuser", pwh, "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	resp, err := svc.Login(&LoginRequest{Username: "testuser", Password: "testpass"})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if resp.UserID != "user-1" {
		t.Fatalf("expected user-1, got %s", resp.UserID)
	}
	if resp.Role != "admin" {
		t.Fatalf("expected admin, got %s", resp.Role)
	}
}

func TestService_Login_WrongPassword(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
	"user-1", "testuser", pwh, "user")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err = svc.Login(&LoginRequest{Username: "testuser", Password: "wrongpass"})
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestService_Login_UnknownUser(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err := svc.Login(&LoginRequest{Username: "nobody", Password: "testpass"})
	if err == nil {
		t.Fatal("expected error for unknown user")
	}
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestService_Register_Valid(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	resp, err := svc.Register(&RegisterRequest{Username: "newuser", Password: "testpass"})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if resp.Username != "newuser" {
		t.Fatalf("expected newuser, got %s", resp.Username)
	}
	if resp.Role != "user" {
		t.Fatalf("expected user, got %s", resp.Role)
	}
}

func TestService_Register_DuplicateUsername(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
	"user-1", "existing", pwh, "user")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err = svc.Register(&RegisterRequest{Username: "existing", Password: "testpass"})
	if err == nil {
		t.Fatal("expected error for duplicate username")
	}
	if !errors.Is(err, ErrUsernameTaken) {
		t.Fatalf("expected ErrUsernameTaken, got: %v", err)
	}
}

func TestService_Me_Valid(t *testing.T) {
	db := setupTestDB(t)
	pwh := hashPassword(t, "testpass")
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
	"user-1", "testuser", pwh, "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	svc := NewService(db, NewJWTManager("test-secret"), "", false)
	user, err := svc.Me("user-1")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if user.Username != "testuser" {
		t.Fatalf("expected testuser, got %s", user.Username)
	}
	if user.Role != "admin" {
		t.Fatalf("expected admin, got %s", user.Role)
	}
}

func TestService_Me_NotFound(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err := svc.Me("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent user")
	}
}

func TestService_Register_EmptyUsername(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err := svc.Register(&RegisterRequest{Username: "ab", Password: "testpass"})
	if err == nil {
		t.Fatal("expected error for short username")
	}
}

func TestService_Register_ShortPassword(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"), "", false)

	_, err := svc.Register(&RegisterRequest{Username: "newuser", Password: "12345"})
	if err == nil {
		t.Fatal("expected error for short password")
	}
}
