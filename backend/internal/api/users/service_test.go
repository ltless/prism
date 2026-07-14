package users

import (
	"database/sql"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
	"golang.org/x/crypto/bcrypt"
)

func setupTestDB(t *testing.T) *db.GlobalDB {
	t.Helper()
	sqlDB := dbtest.NewDB(t)
	gdb := &db.GlobalDB{DB: sqlDB}

	h, _ := bcrypt.GenerateFromPassword([]byte("testpass"), bcrypt.MinCost)
	_, err := gdb.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
	"user-1", "testuser", string(h), "admin")
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	return gdb
}

func ptr(s string) *string { return &s }

func TestUsersService_GetProfile(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	user, err := svc.GetProfile("user-1")
	if err != nil {
		t.Fatalf("GetProfile: %v", err)
	}
	if user.Username != "testuser" {
		t.Fatalf("expected testuser, got %s", user.Username)
	}
	if user.Role != "admin" {
		t.Fatalf("expected admin, got %s", user.Role)
	}
}

func TestUsersService_GetProfile_NotFound(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	_, err := svc.GetProfile("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent user")
	}
}

func TestUsersService_UpdateProfile(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	err := svc.UpdateProfile("user-1", ptr("newimage"), ptr("newcover"), nil)
	if err != nil {
		t.Fatalf("UpdateProfile: %v", err)
	}

	user, _ := svc.GetProfile("user-1")
	if user.Image == nil || *user.Image != "newimage" {
		t.Fatalf("expected image 'newimage', got %v", user.Image)
	}
}

func TestUsersService_UpdateProfile_Preferences(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	prefs := `{"theme":"dark"}`
	err := svc.UpdateProfile("user-1", nil, nil, &prefs)
	if err != nil {
		t.Fatalf("UpdateProfile with prefs: %v", err)
	}
}

func TestUsersService_UpdateStorageLimit(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	err := svc.UpdateStorageLimit("user-1", 1000000)
	if err != nil {
		t.Fatalf("UpdateStorageLimit: %v", err)
	}

	var limit sql.NullInt64
	err = gdb.QueryRow("SELECT storage_limit FROM users WHERE id = $1", "user-1").Scan(&limit)
	if err != nil {
		t.Fatalf("query storage_limit: %v", err)
	}
	if !limit.Valid || limit.Int64 != 1000000 {
		t.Fatalf("expected 1000000, got %v", limit)
	}
}

func TestUsersService_MarkSetupComplete(t *testing.T) {
	gdb := setupTestDB(t)
	svc := NewService(gdb, nil)
	err := svc.MarkSetupComplete("user-1")
	if err != nil {
		t.Fatalf("MarkSetupComplete: %v", err)
	}

	var completed bool
	err = gdb.QueryRow("SELECT has_completed_setup FROM users WHERE id = $1", "user-1").Scan(&completed)
	if err != nil {
		t.Fatalf("query has_completed_setup: %v", err)
	}
	if !completed {
		t.Fatalf("expected true, got %v", completed)
	}
}
