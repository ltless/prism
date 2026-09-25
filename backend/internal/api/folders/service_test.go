package folders

import (
	"context"
	"database/sql"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

func setupTestPool(t *testing.T) *db.TenantPool {
	t.Helper()
	sqlDB := dbtest.NewDB(t)

	// Insert a user for FK constraints
	_, err := sqlDB.Exec("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"test-user", "testuser", "hash", "admin")
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}

	return db.NewTenantPool(sqlDB)
}

func TestFolderService_List_Empty(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	resp, err := svc.List(context.Background(), "test-user")
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
	f, err := svc.Create(context.Background(), "test-user", "My Folder", "blue", "manual", "")
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
	f, err := svc.Create(context.Background(), "test-user", "Smart Nature", "green", "smart", fq)
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
	f, _ := svc.Create(context.Background(), "test-user", "Old Name", "red", "manual", "")
	err := svc.Update(context.Background(), "test-user", f.ID, "New Name")
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	resp, _ := svc.List(context.Background(), "test-user")
	if len(resp.Items) != 1 || resp.Items[0].Name != "New Name" {
		t.Fatalf("expected folder renamed to 'New Name', got '%s'", resp.Items[0].Name)
	}
}

func TestFolderService_Delete(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, _ := svc.Create(context.Background(), "test-user", "Delete Me", "red", "manual", "")
	err := svc.Delete(context.Background(), "test-user", f.ID)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}

	resp, _ := svc.List(context.Background(), "test-user")
	if len(resp.Items) != 0 {
		t.Fatalf("expected 0 folders after delete, got %d", len(resp.Items))
	}
}

func TestFolderService_DeleteWithMediaUnlinks(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	f, _ := svc.Create(context.Background(), "test-user", "Folder", "red", "manual", "")

	// Insert media with this folder_id
	tdb, _ := pool.Get(context.Background(), "test-user")
	defer tdb.Close()

	_, err := tdb.Exec(context.Background(), "INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash, folder_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
		"media-1", "test-user", "Test", "f.jpg", "image/jpeg", 100, "h1", f.ID, 1000)
	if err != nil {
		t.Fatalf("insert media: %v", err)
	}

	err = svc.Delete(context.Background(), "test-user", f.ID)
	if err != nil {
		t.Fatalf("Delete with media: %v", err)
	}

	// Verify media folder_id is now NULL
	var folderID sql.NullString
	tdb.QueryRow(context.Background(), "SELECT folder_id FROM media WHERE id = $1", "media-1").Scan(&folderID)
	if folderID.Valid {
		t.Fatal("expected media folder_id to be NULL after folder delete")
	}
}

func TestFolderService_List_Multiple(t *testing.T) {
	pool := setupTestPool(t)
	svc := NewService(pool)
	svc.Create(context.Background(), "test-user", "B", "red", "manual", "")
	svc.Create(context.Background(), "test-user", "A", "blue", "manual", "")
	svc.Create(context.Background(), "test-user", "C", "green", "manual", "")

	resp, err := svc.List(context.Background(), "test-user")
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
