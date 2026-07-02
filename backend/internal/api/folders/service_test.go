package folders

import (
	"database/sql"
	"os"
	"testing"

	"github.com/ltless/prism/internal/db"
	_ "modernc.org/sqlite"
)

func setupTestPool(t *testing.T) *db.TenantPool {
	t.Helper()
	base := t.TempDir()

	// Manually init tenant DB for test-user — create raw sqlite without pool migration
	f := base + "/test-user/prism.db"
	if err := os.MkdirAll(base+"/test-user", 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	raw, err := sql.Open("sqlite", f)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer raw.Close()

	_, err = raw.Exec(`CREATE TABLE IF NOT EXISTS folders (
		id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT,
		parent_id TEXT, created_at INTEGER, updated_at INTEGER,
		folder_type TEXT NOT NULL DEFAULT 'manual',
		filter_query TEXT
	)`)
	if err != nil {
		t.Fatalf("create folders table: %v", err)
	}
	_, err = raw.Exec(`CREATE TABLE IF NOT EXISTS media (
		id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL,
		mime_type TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER, height INTEGER,
		hash TEXT NOT NULL, captured_at INTEGER, metadata TEXT, folder_id TEXT,
		is_favorite INTEGER DEFAULT 0, is_trash INTEGER DEFAULT 0,
		updated_at INTEGER, created_at INTEGER, duration INTEGER,
		transcode_status TEXT, is_vault INTEGER DEFAULT 0
	)`)
	if err != nil {
		t.Fatalf("create media table: %v", err)
	}

	// Use MultiTenant for media queries but skip its migration by pre-creating the DB file
	pool2 := db.NewTenantPool(base)
	t.Cleanup(func() { os.RemoveAll(base) })
	return pool2
}

func TestFolderService_List_Empty(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	resp, err := svc.List("test-user")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Fatalf("expected 0 folders, got %d", len(resp.Items))
	}
}

func TestFolderService_Create_Valid(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, err := svc.Create("test-user", "My Folder", "blue", "manual", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if f.Name != "My Folder" {
		t.Fatalf("expected 'My Folder', got '%s'", f.Name)
	}
	if f.Color != "blue" {
		t.Fatalf("expected 'blue', got '%s'", f.Color)
	}
	if f.FolderType != "manual" {
		t.Fatalf("expected 'manual', got '%s'", f.FolderType)
	}
}

func TestFolderService_Create_SmartFolder(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	fq := `{"categories":["Nature"],"minScore":0.5}`
	f, err := svc.Create("test-user", "Smart Nature", "green", "smart", fq)
	if err != nil {
		t.Fatalf("Create smart folder: %v", err)
	}
	if f.FolderType != "smart" {
		t.Fatalf("expected 'smart', got '%s'", f.FolderType)
	}
	if f.FilterQuery == nil || *f.FilterQuery != fq {
		t.Fatalf("expected filter_query '%s', got '%v'", fq, f.FilterQuery)
	}
}

func TestFolderService_Update(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, _ := svc.Create("test-user", "Old Name", "red", "manual", "")
	err := svc.Update("test-user", f.ID, "New Name")
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	resp, _ := svc.List("test-user")
	if len(resp.Items) != 1 || resp.Items[0].Name != "New Name" {
		t.Fatalf("expected folder renamed to 'New Name', got '%s'", resp.Items[0].Name)
	}
}

func TestFolderService_Delete(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, _ := svc.Create("test-user", "Delete Me", "red", "manual", "")
	err := svc.Delete("test-user", f.ID)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}

	resp, _ := svc.List("test-user")
	if len(resp.Items) != 0 {
		t.Fatalf("expected 0 folders after delete, got %d", len(resp.Items))
	}
}

func TestFolderService_DeleteWithMediaUnlinks(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, _ := svc.Create("test-user", "Folder", "red", "manual", "")

	// Insert media with this folder_id
	tdb, _ := pool.Get("test-user")
	tdb.Exec("INSERT INTO media (id, title, file_path, mime_type, size, hash, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		"media-1", "Test", "f.jpg", "image/jpeg", 100, "h1", f.ID, 1000)

	err := svc.Delete("test-user", f.ID)
	if err != nil {
		t.Fatalf("Delete with media: %v", err)
	}

	// Verify media folder_id is now NULL
	var folderID sql.NullString
	tdb.QueryRow("SELECT folder_id FROM media WHERE id = ?", "media-1").Scan(&folderID)
	if folderID.Valid {
		t.Fatal("expected media folder_id to be NULL after folder delete")
	}
}

func TestFolderService_List_Multiple(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	svc.Create("test-user", "B", "red", "manual", "")
	svc.Create("test-user", "A", "blue", "manual", "")
	svc.Create("test-user", "C", "green", "manual", "")

	resp, err := svc.List("test-user")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 3 {
		t.Fatalf("expected 3 folders, got %d", len(resp.Items))
	}
	// Should be sorted by name ASC
	if resp.Items[0].Name != "A" || resp.Items[1].Name != "B" || resp.Items[2].Name != "C" {
		t.Fatal("folders should be sorted alphabetically")
	}
}