package db_test

import (
	"context"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

// RLS defense-in-depth: even with the app-level WHERE user_id = $1 removed,
// the database must refuse to return another tenant's rows.
func TestTenantPool_RLS_EnforcesIsolation(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)

	mustExec := func(tdb *db.TenantDB, query string, args ...any) {
		t.Helper()
		if _, err := tdb.Exec(context.Background(), query, args...); err != nil {
			t.Fatalf("exec %q: %v", query, err)
		}
	}

	// two users
	for _, u := range []string{"user-a", "user-b"} {
		if _, err := sqlDB.Exec(
			"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
			u, u, "hash", "user"); err != nil {
			t.Fatalf("insert user %s: %v", u, err)
		}
	}

	// each inserts one media row via a scoped connection
	tdbA, err := pool.Get(context.Background(), "user-a")
	if err != nil {
		t.Fatalf("get tenant db A: %v", err)
	}
	defer tdbA.Close()
	mustExec(tdbA, "INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		"m-a", "user-a", "A", "a.jpg", "image/jpeg", 1, "h-a")

	tdbB, err := pool.Get(context.Background(), "user-b")
	if err != nil {
		t.Fatalf("get tenant db B: %v", err)
	}
	defer tdbB.Close()
	mustExec(tdbB, "INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		"m-b", "user-b", "B", "b.jpg", "image/jpeg", 1, "h-b")

	// A deliberately forgets WHERE user_id: RLS must still scope the scan
	var count int
	if err := tdbA.QueryRow(context.Background(), "SELECT COUNT(*) FROM media").Scan(&count); err != nil {
		t.Fatalf("count as user-a: %v", err)
	}
	if count != 1 {
		t.Fatalf("RLS failed: user-a sees %d rows, wants 1", count)
	}

	// A tries to write user-b's row: RLS WITH CHECK must reject
	if _, err := tdbA.Exec(context.Background(),
		"INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		"m-b2", "user-b", "evil", "x.jpg", "image/jpeg", 1, "h-b2"); err == nil {
		t.Fatal("RLS failed: user-a inserted a row owned by user-b")
	}

	// A tries to UPDATE with no WHERE: RLS USING silently scopes it to A's
	// own rows — user-b's title must stay untouched
	if _, err := tdbA.Exec(context.Background(), "UPDATE media SET title = 'stolen'"); err != nil {
		t.Fatalf("update as user-a: %v", err)
	}
	var titleB string
	if err := tdbB.QueryRow(context.Background(), "SELECT title FROM media WHERE id = 'm-b'").Scan(&titleB); err != nil {
		t.Fatalf("read user-b title: %v", err)
	}
	if titleB != "B" {
		t.Fatalf("RLS failed: user-a rewrote user-b's row (title=%q)", titleB)
	}
	// and A's own row was updated
	var titleA string
	if err := tdbA.QueryRow(context.Background(), "SELECT title FROM media WHERE id = 'm-a'").Scan(&titleA); err != nil {
		t.Fatalf("read user-a title: %v", err)
	}
	if titleA != "stolen" {
		t.Fatalf("expected user-a own row updated, got %q", titleA)
	}
}

// Fail-closed: a connection without the tenant variable set (or after reset)
// must see zero tenant rows.
func TestTenantPool_RLS_FailsClosedWithoutContext(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)

	if _, err := sqlDB.Exec(
		"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"user-a", "user-a", "hash", "user"); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	tdb, err := pool.Get(context.Background(), "user-a")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	if _, err := tdb.Exec(context.Background(),
		"INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		"m-a", "user-a", "A", "a.jpg", "image/jpeg", 1, "h-a"); err != nil {
		t.Fatalf("insert media: %v", err)
	}
	tdb.Close()

	// after Close, the variable is reset — a raw pooled connection (no
	// tenant context) must see nothing
	var count int
	if err := sqlDB.QueryRow("SELECT COUNT(*) FROM media").Scan(&count); err != nil {
		t.Fatalf("count without tenant context: %v", err)
	}
	if count != 0 {
		t.Fatalf("RLS failed closed: unscoped connection sees %d rows, wants 0", count)
	}
}
