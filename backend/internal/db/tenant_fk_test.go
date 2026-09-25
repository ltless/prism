package db_test

import (
	"context"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

// H-04: composite tenant FKs. RLS only checks that a written row belongs to
// the current tenant — it does not stop the row from REFERENCING another
// tenant's parent (media -> folder, tag -> media, transcode -> media,
// folder -> parent folder). The composite constraints close that gap at the
// relational layer.
func TestTenantCompositeFKs_RejectCrossTenantReferences(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	pool := db.NewTenantPool(sqlDB)

	mustExec := func(tdb *db.TenantDB, query string, args ...any) {
		t.Helper()
		if _, err := tdb.Exec(context.Background(), query, args...); err != nil {
			t.Fatalf("exec %q: %v", query, err)
		}
	}

	for _, u := range []string{"user-a", "user-b"} {
		if _, err := sqlDB.Exec(
			"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
			u, u, "hash", "user"); err != nil {
			t.Fatalf("insert user %s: %v", u, err)
		}
	}

	tdbA, err := pool.Get(context.Background(), "user-a")
	if err != nil {
		t.Fatalf("get tenant db A: %v", err)
	}
	defer tdbA.Close()
	tdbB, err := pool.Get(context.Background(), "user-b")
	if err != nil {
		t.Fatalf("get tenant db B: %v", err)
	}
	defer tdbB.Close()

	// user-b owns a folder and a media row
	mustExec(tdbB, "INSERT INTO folders (id, user_id, name) VALUES ('f-b', 'user-b', 'B folder')")
	mustExec(tdbB, "INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ('m-b', 'user-b', 'B', 'b.jpg', 'image/jpeg', 1, 'h-b')")

	// user-a's media referencing user-b's folder: RLS WITH CHECK passes
	// (user_id is A's own) — only the composite FK can reject it.
	if _, err := tdbA.Exec(context.Background(),
		"INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
		"m-a", "user-a", "A", "a.jpg", "image/jpeg", 1, "h-a", "f-b"); err == nil {
		t.Fatal("composite FK failed: user-a media references user-b folder")
	}

	// user-a's folder nested under user-b's folder
	if _, err := tdbA.Exec(context.Background(),
		"INSERT INTO folders (id, user_id, name, parent_id) VALUES ('f-a', 'user-a', 'A', 'f-b')"); err == nil {
		t.Fatal("composite FK failed: user-a folder under user-b folder")
	}

	// user-a's tag on user-b's media
	if _, err := tdbA.Exec(context.Background(),
		"INSERT INTO media_tags (media_id, user_id, tag, score, category) VALUES ('m-b', 'user-a', 'tag', 1, 'cat')"); err == nil {
		t.Fatal("composite FK failed: user-a tag on user-b media")
	}

	// user-a's transcode job for user-b's media
	if _, err := tdbA.Exec(context.Background(),
		"INSERT INTO transcode_queue (media_id, user_id) VALUES ('m-b', 'user-a')"); err == nil {
		t.Fatal("composite FK failed: user-a transcode job on user-b media")
	}

	// control: same-tenant references still work
	mustExec(tdbA, "INSERT INTO folders (id, user_id, name) VALUES ('f-a', 'user-a', 'A folder')")
	mustExec(tdbA, "INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash, folder_id) VALUES ('m-a2', 'user-a', 'A2', 'a2.jpg', 'image/jpeg', 1, 'h-a2', 'f-a')")
	mustExec(tdbA, "INSERT INTO media_tags (media_id, user_id, tag, score, category) VALUES ('m-a2', 'user-a', 'tag', 1, 'cat')")
	mustExec(tdbA, "INSERT INTO transcode_queue (media_id, user_id) VALUES ('m-a2', 'user-a')")
	mustExec(tdbA, "INSERT INTO folders (id, user_id, name, parent_id) VALUES ('f-a-child', 'user-a', 'A child', 'f-a')")

	// ON DELETE CASCADE still works within a tenant
	mustExec(tdbA, "DELETE FROM media WHERE id = 'm-a2'")
	for _, q := range []string{
		"SELECT COUNT(*) FROM media_tags WHERE media_id = 'm-a2'",
		"SELECT COUNT(*) FROM transcode_queue WHERE media_id = 'm-a2'",
	} {
		var n int
		if err := tdbA.QueryRow(context.Background(), q).Scan(&n); err != nil {
			t.Fatalf("count after cascade: %v", err)
		}
		if n != 0 {
			t.Fatalf("cascade broken: %q returned %d rows", q, n)
		}
	}
}
