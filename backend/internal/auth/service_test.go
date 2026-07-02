package auth

import (
	"database/sql"
	"errors"
	"os"
	"testing"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	f := t.TempDir() + "/test.db"
	db, err := sql.Open("sqlite", f)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() { db.Close(); os.Remove(f) })

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		t.Fatalf("enable WAL: %v", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
		image TEXT, cover_image TEXT, vault_pin TEXT,
		storage_limit INTEGER, preferences TEXT,
		has_completed_setup INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`)
	if err != nil {
		t.Fatalf("create users table: %v", err)
	}
	return db
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
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
		"user-1", "testuser", pwh, "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

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
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
		"user-1", "testuser", pwh, "user")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

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
	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

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
	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

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
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
		"user-1", "existing", pwh, "user")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

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
	_, err := db.Exec("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
		"user-1", "testuser", pwh, "admin")
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	svc := NewService(db, NewJWTManager("test-secret"))
	user, err := svc.Me("user-1")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if user.Username != "testuser" {
		t.Fatalf("expected testuser, got %s", user.Username)
	}
}

func TestService_Me_NotFound(t *testing.T) {
	db := setupTestDB(t)
	svc := NewService(db, NewJWTManager("test-secret"))

	_, err := svc.Me("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent user")
	}
}

func TestService_Register_EmptyUsername(t *testing.T) {
	db := setupTestDB(t)
	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

	_, err := svc.Register(&RegisterRequest{Username: "ab", Password: "testpass"})
	if err == nil {
		t.Fatal("expected error for short username")
	}
}

func TestService_Register_ShortPassword(t *testing.T) {
	db := setupTestDB(t)
	jwt := NewJWTManager("test-secret")
	svc := NewService(db, jwt)

	_, err := svc.Register(&RegisterRequest{Username: "newuser", Password: "12345"})
	if err == nil {
		t.Fatal("expected error for short password")
	}
}