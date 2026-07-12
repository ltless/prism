package media

import (
	"fmt"
	"os"
	"testing"

	"github.com/ltless/prism/internal/db"
	_ "modernc.org/sqlite"
)

func setupTenantDB(t *testing.T) *db.TenantPool {
	t.Helper()
	base := t.TempDir()
	pool := db.NewTenantPool(base)

	// Manually create tenant DB for test-user
	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}

	// Ensure tables exist (re-run CREATE TABLE for test freshness)
	_, err = tdb.Exec(`CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT,
		parent_id TEXT, created_at INTEGER, folder_type TEXT NOT NULL DEFAULT 'manual',
		filter_query TEXT, FOREIGN KEY (parent_id) REFERENCES folders(id)
	)`)
	if err != nil {
		t.Fatalf("create folders table: %v", err)
	}
	_, err = tdb.Exec(`CREATE TABLE IF NOT EXISTS media (
		id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL,
		mime_type TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER,
		hash TEXT NOT NULL, captured_at INTEGER, metadata TEXT, folder_id TEXT,
		is_favorite INTEGER DEFAULT 0, is_trash INTEGER DEFAULT 0,
		updated_at INTEGER, created_at INTEGER, duration INTEGER,
		transcode_status TEXT, is_vault INTEGER DEFAULT 0,
		FOREIGN KEY (folder_id) REFERENCES folders(id)
	)`)
	if err != nil {
		t.Fatalf("create media table: %v", err)
	}

	t.Cleanup(func() {
		os.RemoveAll(base)
	})
	return pool
}

func intPtr(v int) *int { return &v }
func strPtr(v string) *string { return &v }

type stubActive struct{ active bool }

func (s stubActive) IsAIActive() (bool, error) { return s.active, nil }

func TestService_List_Empty(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	resp, err := svc.List("test-user", nil, false, false, false, false, "", 1, 50)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Fatalf("expected 0 items, got %d", len(resp.Items))
	}
	if resp.Total != 0 {
		t.Fatalf("expected total 0, got %d", resp.Total)
	}
}

func TestService_CreateAndList(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	item, dup, err := svc.Create("test-user", "", "test.jpg", "Test Image", "image/jpeg", "abc123", 1024, intPtr(100), intPtr(200), nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if dup {
		t.Fatal("expected not duplicate")
	}
	if item.Title != "Test Image" {
		t.Fatalf("expected 'Test Image', got '%s'", item.Title)
	}

	resp, err := svc.List("test-user", nil, false, false, false, false, "", 1, 50)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	if resp.Total != 1 {
		t.Fatalf("expected total 1, got %d", resp.Total)
	}
}

func TestService_Create_DuplicateHash(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	_, dup, err := svc.Create("test-user", "", "a.jpg", "A", "image/jpeg", "samehash", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}
	if dup {
		t.Fatal("first insert should not be duplicate")
	}

	_, dup, err = svc.Create("test-user", "", "b.jpg", "B", "image/jpeg", "samehash", 200, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("second create: %v", err)
	}
	if !dup {
		t.Fatal("second insert with same hash should be duplicate")
	}
}

func TestService_List_WithTrashFilter(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	item, _, err := svc.Create("test-user", "", "test.jpg", "Test", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Update to trash
	err = svc.Update("test-user", item.ID, map[string]interface{}{"is_trash": 1})
	if err != nil {
		t.Fatalf("Update to trash: %v", err)
	}

	// List non-trashed
	resp, err := svc.List("test-user", nil, false, false, false, false, "", 1, 50)
	if err != nil {
		t.Fatalf("List non-trashed: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Fatalf("expected 0 non-trashed items, got %d", len(resp.Items))
	}

	// List trashed
	resp, err = svc.List("test-user", nil, false, true, false, false, "", 1, 50)
	if err != nil {
		t.Fatalf("List trashed: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 trashed item, got %d", len(resp.Items))
	}
}

func TestService_Get_Found(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	created, _, err := svc.Create("test-user", "", "test.jpg", "Test", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := svc.Get("test-user", created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != created.ID {
		t.Fatalf("expected id %s, got %s", created.ID, got.ID)
	}
	if got.Title != "Test" {
		t.Fatalf("expected 'Test', got '%s'", got.Title)
	}
}

func TestService_Get_NotFound(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	_, err := svc.Get("test-user", "nonexistent-id")
	if err == nil {
		t.Fatal("expected error for nonexistent media")
	}
}

func TestService_Update_Whitelist(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	item, _, err := svc.Create("test-user", "", "test.jpg", "Original", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Allowed field
	err = svc.Update("test-user", item.ID, map[string]interface{}{"title": "Updated"})
	if err != nil {
		t.Fatalf("Update title: %v", err)
	}
	got, _ := svc.Get("test-user", item.ID)
	if got.Title != "Updated" {
		t.Fatalf("expected 'Updated', got '%s'", got.Title)
	}

	// Disallowed field (should be silently ignored)
	err = svc.Update("test-user", item.ID, map[string]interface{}{"file_path": "evil.jpg"})
	if err != nil {
		t.Fatalf("Update file_path: %v", err)
	}
	got, _ = svc.Get("test-user", item.ID)
	if got.FilePath != "test.jpg" {
		t.Fatalf("expected file_path 'test.jpg', got '%s'", got.FilePath)
	}
}

func TestService_Delete(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	item, _, err := svc.Create("test-user", "", "test.jpg", "Test", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	deleted, err := svc.Delete("test-user", item.ID)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if deleted.ID != item.ID {
		t.Fatalf("expected id %s, got %s", item.ID, deleted.ID)
	}

	_, err = svc.Get("test-user", item.ID)
	if err == nil {
		t.Fatal("expected error after delete")
	}
}

func TestService_BulkMove(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})

	// Create a folder first
	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	tdb.Exec("INSERT INTO folders (id, name, created_at) VALUES (?, ?, 1000)", "folder-1", "Test Folder")

	a, _, _ := svc.Create("test-user", "", "a.jpg", "A", "image/jpeg", "h1", 100, nil, nil, nil, nil, nil, nil)
	b, _, _ := svc.Create("test-user", "", "b.jpg", "B", "image/jpeg", "h2", 100, nil, nil, nil, nil, nil, nil)

	fid := "folder-1"
	err = svc.BulkMove("test-user", []string{a.ID, b.ID}, &fid)
	if err != nil {
		t.Fatalf("BulkMove: %v", err)
	}

	gotA, _ := svc.Get("test-user", a.ID)
	if gotA.FolderID == nil || *gotA.FolderID != "folder-1" {
		t.Fatal("expected A in folder-1")
	}
	gotB, _ := svc.Get("test-user", b.ID)
	if gotB.FolderID == nil || *gotB.FolderID != "folder-1" {
		t.Fatal("expected B in folder-1")
	}
}

func TestService_List_Search(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	svc.Create("test-user", "", "cat.jpg", "Cute Cat", "image/jpeg", "h1", 100, nil, nil, nil, nil, nil, nil)
	svc.Create("test-user", "", "dog.jpg", "Happy Dog", "image/jpeg", "h2", 100, nil, nil, nil, nil, nil, nil)

	resp, err := svc.List("test-user", nil, false, false, false, false, "cat", 1, 50)
	if err != nil {
		t.Fatalf("List search: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 result for 'cat', got %d", len(resp.Items))
	}
}

func TestService_List_SearchWildcardEscaped(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	svc.Create("test-user", "", "a.jpg", "100% Done", "image/jpeg", "h1", 100, nil, nil, nil, nil, nil, nil)
	svc.Create("test-user", "", "b.jpg", "50% Done", "image/jpeg", "h2", 100, nil, nil, nil, nil, nil, nil)
	svc.Create("test-user", "", "c.jpg", "Plain", "image/jpeg", "h3", 100, nil, nil, nil, nil, nil, nil)

	// Searching for "%" should ONLY match literal percent, not all rows
	resp, err := svc.List("test-user", nil, false, false, false, false, "%", 1, 50)
	if err != nil {
		t.Fatalf("List search wildcard: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 results (titles containing literal '%%'), got %d", len(resp.Items))
	}

	// Searching for "_" should ONLY match literal underscore, not single-char wildcard
	svc.Create("test-user", "", "d.jpg", "Hello_World", "image/jpeg", "h4", 100, nil, nil, nil, nil, nil, nil)
	resp, err = svc.List("test-user", nil, false, false, false, false, "_", 1, 50)
	if err != nil {
		t.Fatalf("List search underscore: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 result (title with literal '_'), got %d", len(resp.Items))
	}
}

func TestService_List_Pagination(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	for i := 0; i < 10; i++ {
		title := fmt.Sprintf("Item %d", i)
		svc.Create("test-user", "", fmt.Sprintf("%d.jpg", i), title, "image/jpeg", fmt.Sprintf("h%d", i), 100, nil, nil, nil, nil, nil, nil)
	}

	// pagination removed — List now returns all items
	resp, err := svc.List("test-user", nil, false, false, false, false, "", 1, 3)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 10 {
		t.Fatalf("expected 10 items (all), got %d", len(resp.Items))
	}
	if resp.Total != 10 {
		t.Fatalf("expected total 10, got %d", resp.Total)
	}
}

func TestService_SanitizeTitle(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "Hello World"},
		{"<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"},
		{"Foo & Bar", "Foo &amp; Bar"},
		{"\"quote\" 'test'", "&quot;quote&quot; &#39;test&#39;"},
		{"<b>bold</b>", "&lt;b&gt;bold&lt;/b&gt;"},
	}
	for _, tt := range tests {
		got := sanitizeTitle(tt.input)
		if got != tt.expected {
			t.Fatalf("sanitizeTitle(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestService_SanitizeTitle_Applied(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, stubActive{true})
	item, _, err := svc.Create("test-user", "", "x.jpg", "<script>alert(1)</script>", "image/jpeg", "h1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if item.Title != "&lt;script&gt;alert(1)&lt;/script&gt;" {
		t.Fatalf("expected sanitized title, got: %s", item.Title)
	}
}