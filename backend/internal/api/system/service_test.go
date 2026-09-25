package system

import (
	"context"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

func setupSystemDB(t *testing.T) *db.TenantPool {
	t.Helper()
	sqlDB := dbtest.NewDB(t)
	for _, u := range []struct{ id, username string }{
		{"user-a", "usera"},
		{"user-b", "userb"},
	} {
		_, err := sqlDB.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
			u.id, u.username, "hash", "user")
		if err != nil {
			t.Fatalf("insert user %s: %v", u.id, err)
		}
	}
	return db.NewTenantPool(sqlDB)
}

// tenant scoping: error_logs carries user_id, so one user's logs must never
// surface in another user's /system/logs response.
func TestService_Logs_ScopedPerUser(t *testing.T) {
	pool := setupSystemDB(t)
	svc := NewService(pool)

	source := "test"
	if err := svc.CreateLogEntry(context.Background(), "user-a", "error", "SECRET-OF-A", &source, nil, "2026-09-18T00:00:00Z"); err != nil {
		t.Fatalf("create log for user-a: %v", err)
	}
	if err := svc.CreateLogEntry(context.Background(), "user-b", "error", "SECRET-OF-B", &source, nil, "2026-09-18T00:00:00Z"); err != nil {
		t.Fatalf("create log for user-b: %v", err)
	}

	resp, err := svc.Logs(context.Background(), "user-b", "", 1, 50)
	if err != nil {
		t.Fatalf("logs: %v", err)
	}
	if resp.Total != 1 {
		t.Fatalf("expected user-b to see exactly 1 log, got %d", resp.Total)
	}
	for _, it := range resp.Items {
		if it.Message == "SECRET-OF-A" {
			t.Fatal("tenant scope leak: user-b can read user-a's log")
		}
		if it.Message != "SECRET-OF-B" {
			t.Fatalf("expected user-b's own log, got %q", it.Message)
		}
	}
}
