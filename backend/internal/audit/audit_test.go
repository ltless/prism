package audit

import (
	"context"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

// M-06: an audit event lands in error_logs, scoped to the acting user so the
// RLS policy keeps each user's trail private.
func TestRecorder_EventPersistsScoped(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)

	for _, u := range []string{"user-a", "user-b"} {
		if _, err := sqlDB.Exec(
			"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, 'user')",
			u, u, "hash"); err != nil {
			t.Fatalf("insert user %s: %v", u, err)
		}
	}

	r := NewRecorder(pool)
	r.Event(context.Background(), "user-a", "nuke", "user-a", true, "127.0.0.1", "")
	r.Event(context.Background(), "user-a", "vault_pin_verify", "user-a", false, "127.0.0.1", "invalid pin")
	r.Event(context.Background(), "user-b", "bulk_trash", "ids=2", true, "127.0.0.1", "")

	// each user sees only their own events
	for _, tc := range []struct{ user, expect string }{
		{"user-a", "audit:nuke"},
		{"user-b", "audit:bulk_trash"},
	} {
		tdb, err := pool.Get(context.Background(), tc.user)
		if err != nil {
			t.Fatalf("get tenant db %s: %v", tc.user, err)
		}
		var msg string
		if err := tdb.QueryRow(context.Background(),
			"SELECT message FROM error_logs WHERE user_id = $1 ORDER BY id LIMIT 1", tc.user,
		).Scan(&msg); err != nil {
			t.Fatalf("read event for %s: %v", tc.user, err)
		}
		if msg != tc.expect {
			t.Fatalf("user %s first event = %q, want %q", tc.user, msg, tc.expect)
		}
		tdb.Close()
	}

	// caller-provided detail/reason is preserved
	tdb, err := pool.Get(context.Background(), "user-a")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	var meta string
	if err := tdb.QueryRow(context.Background(),
		"SELECT meta FROM error_logs WHERE user_id = 'user-a' ORDER BY id DESC LIMIT 1",
	).Scan(&meta); err != nil {
		t.Fatalf("read meta: %v", err)
	}
	if meta == "" || meta == "null" {
		t.Fatalf("expected non-empty meta, got %q", meta)
	}
}
