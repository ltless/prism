package media

import (
	"fmt"
	"strings"
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

func setupTenantDB(t *testing.T) *db.TenantPool {
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

func intPtr(v int) *int       { return &v }
func strPtr(v string) *string { return &v }

func TestService_List_Empty(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
	item, _, err := svc.Create("test-user", "", "test.jpg", "Test", "image/jpeg", "hash1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Update to trash — PG boolean uses true/false
	err = svc.Update("test-user", item.ID, map[string]interface{}{"is_trash": true})
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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
	_, err := svc.Get("test-user", "nonexistent-id")
	if err == nil {
		t.Fatal("expected error for nonexistent media")
	}
}

func TestService_Update_Whitelist(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)

	// Create a folder first — PG needs user_id
	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	_, err = tdb.Exec("INSERT INTO folders (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
		"folder-1", "test-user", "Test Folder", 1000, 1000)
	if err != nil {
		t.Fatalf("insert folder: %v", err)
	}

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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
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
	svc := NewService(pool, nil)
	for i := 0; i < 10; i++ {
		title := fmt.Sprintf("Item %d", i)
		svc.Create("test-user", "", fmt.Sprintf("%d.jpg", i), title, "image/jpeg", fmt.Sprintf("h%d", i), 100, nil, nil, nil, nil, nil, nil)
	}

	// page 1 with limit 3 → first 3 items
	resp, err := svc.List("test-user", nil, false, false, false, false, "", 1, 3)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(resp.Items))
	}
	if resp.Total != 10 {
		t.Fatalf("expected total 10, got %d", resp.Total)
	}

	// page 4 with limit 3 → last item
	resp, err = svc.List("test-user", nil, false, false, false, false, "", 4, 3)
	if err != nil {
		t.Fatalf("List page 4: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item on page 4, got %d", len(resp.Items))
	}

	// page 0 / limit 0 → defaults (page 1, limit 100) → all 10
	resp, err = svc.List("test-user", nil, false, false, false, false, "", 0, 0)
	if err != nil {
		t.Fatalf("List defaults: %v", err)
	}
	if len(resp.Items) != 10 {
		t.Fatalf("expected 10 items with defaults, got %d", len(resp.Items))
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
	svc := NewService(pool, nil)
	item, _, err := svc.Create("test-user", "", "x.jpg", "<script>alert(1)</script>", "image/jpeg", "h1", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if item.Title != "&lt;script&gt;alert(1)&lt;/script&gt;" {
		t.Fatalf("expected sanitized title, got: %s", item.Title)
	}
}

// Regression: the library (root) view must show only unfiled media — a photo
// moved into a folder disappears from the library, not stays in both places.
func TestService_GetDashboard_RootViewExcludesFiledMedia(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)

	unfiled, _, err := svc.Create("test-user", "", "unfiled.jpg", "Unfiled", "image/jpeg", "h-unfiled", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create unfiled: %v", err)
	}
	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	if _, err := tdb.Exec(`INSERT INTO folders (id, user_id, name) VALUES ($1, $2, $3)`, "folder-1", "test-user", "Folder One"); err != nil {
		t.Fatalf("insert folder: %v", err)
	}
	filed, _, err := svc.Create("test-user", "folder-1", "filed.jpg", "Filed", "image/jpeg", "h-filed", 100, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("create filed: %v", err)
	}
	_ = unfiled

	// Root view: empty-string folder id means folder_id IS NULL.
	root := strPtr("")
	resp, err := svc.GetDashboard("test-user", DashboardParams{FolderID: root})
	if err != nil {
		t.Fatalf("GetDashboard root: %v", err)
	}
	if resp.Total != 1 {
		t.Fatalf("root view: expected 1 unfiled item, got %d", resp.Total)
	}
	for _, it := range resp.Items {
		if it.ID == filed.ID {
			t.Fatal("root view leaked a filed media item")
		}
	}

	// Folder view still returns the filed item.
	folder := "folder-1"
	resp, err = svc.GetDashboard("test-user", DashboardParams{FolderID: &folder})
	if err != nil {
		t.Fatalf("GetDashboard folder: %v", err)
	}
	if resp.Total != 1 || resp.Items[0].ID != filed.ID {
		t.Fatalf("folder view: expected the filed item, got %+v", resp.Items)
	}
}

// Regression: Search used to ignore Page/Limit and return the whole library.
func TestService_Search_Pagination(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
	for i := 0; i < 5; i++ {
		svc.Create("test-user", "", fmt.Sprintf("%d.jpg", i), fmt.Sprintf("Item %d", i), "image/jpeg", fmt.Sprintf("h%d", i), 100, nil, nil, nil, nil, nil, nil)
	}

	// limit 2 on page 1 → 2 items, total 5
	resp, err := svc.Search("test-user", SearchParams{Query: "Item", Page: 1, Limit: 2})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items with limit 2, got %d", len(resp.Items))
	}

	// default limit (unset) must clamp to 100, not unbounded
	resp, err = svc.Search("test-user", SearchParams{Query: "Item"})
	if err != nil {
		t.Fatalf("Search defaults: %v", err)
	}
	if len(resp.Items) != 5 {
		t.Fatalf("expected 5 items with default limit, got %d", len(resp.Items))
	}
}

// Regression: GetDashboard used to SELECT the whole library with no LIMIT.
func TestService_GetDashboard_Pagination(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
	for i := 0; i < 5; i++ {
		svc.Create("test-user", "", fmt.Sprintf("%d.jpg", i), fmt.Sprintf("Item %d", i), "image/jpeg", fmt.Sprintf("hd%d", i), 100, nil, nil, nil, nil, nil, nil)
	}

	resp, err := svc.GetDashboard("test-user", DashboardParams{Limit: 2, Page: 1})
	if err != nil {
		t.Fatalf("GetDashboard: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items with limit 2, got %d", len(resp.Items))
	}
	if resp.Total != 5 {
		t.Fatalf("expected total 5, got %d", resp.Total)
	}
}

// Regression: buildEditorMetadata used to silently drop the user's stored
// metadata when the stored JSON was corrupt.
func TestBuildEditorMetadata_CorruptExisting(t *testing.T) {
	corrupt := "{not valid json"
	if _, err := buildEditorMetadata(&corrupt, nil); err == nil {
		t.Fatal("expected error for corrupt existing metadata")
	}

	good := `{"rating":5}`
	out, err := buildEditorMetadata(&good, []string{"#ffffff"})
	if err != nil {
		t.Fatalf("valid metadata: %v", err)
	}
	if out == "" || !strings.Contains(out, "rating") || !strings.Contains(out, "palette") {
		t.Fatalf("expected merged metadata, got %q", out)
	}
}
