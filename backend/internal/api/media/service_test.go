package media

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"sync/atomic"
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

func TestService_List_VaultTrashCombinations(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)

	mk := func(title, hash string) *MediaItem {
		t.Helper()
		item, dup, err := svc.Create("test-user", "", "f_"+hash+".jpg", title, "image/jpeg", hash, 100, nil, nil, nil, nil, nil, nil)
		if err != nil {
			t.Fatalf("create %s: %v", title, err)
		}
		if dup {
			t.Fatalf("create %s: unexpected duplicate", title)
		}
		return item
	}

	plain := mk("plain", "h-plain")
	trashed := mk("trashed", "h-trash")
	vaulted := mk("vaulted", "h-vault")
	vaultTrashed := mk("vault-trashed", "h-vault-trash")
	favorited := mk("favorited", "h-fav")

	set := func(id string, updates map[string]interface{}) {
		t.Helper()
		if err := svc.Update("test-user", id, updates); err != nil {
			t.Fatalf("update %s: %v", id, err)
		}
	}
	set(trashed.ID, map[string]interface{}{"is_trash": true})
	set(vaulted.ID, map[string]interface{}{"is_vault": true})
	set(vaultTrashed.ID, map[string]interface{}{"is_vault": true, "is_trash": true})
	set(favorited.ID, map[string]interface{}{"is_favorite": true})

	ids := func(resp *ListResponse) map[string]bool {
		out := make(map[string]bool, len(resp.Items))
		for _, it := range resp.Items {
			out[it.ID] = true
		}
		return out
	}

	assertSet := func(desc string, got map[string]bool, want ...*MediaItem) {
		t.Helper()
		wantSet := make(map[string]bool, len(want))
		for _, it := range want {
			wantSet[it.ID] = true
		}
		if len(got) != len(wantSet) {
			t.Fatalf("%s: got %d items, want %d (got %v)", desc, len(got), len(wantSet), got)
		}
		for id := range wantSet {
			if !got[id] {
				t.Fatalf("%s: missing item %s", desc, id)
			}
		}
	}

	cases := []struct {
		name             string
		favorites, trash bool
		vault            bool
		want             []*MediaItem
	}{
		{"default", false, false, false, []*MediaItem{plain, favorited}},
		{"trash", false, true, false, []*MediaItem{trashed}},
		{"vault", false, false, true, []*MediaItem{vaulted}},
		{"vault+trash", false, true, true, []*MediaItem{vaultTrashed}},
		{"favorites", true, false, false, []*MediaItem{favorited}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := svc.List("test-user", nil, tc.favorites, tc.trash, tc.vault, false, "", 1, 50)
			if err != nil {
				t.Fatalf("List: %v", err)
			}
			assertSet(tc.name, ids(resp), tc.want...)
		})
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

// F3: concurrent uploads for the same user must not collectively exceed the
// storage limit. The check and insert share a transaction serialized by an
// advisory lock, so exactly the number of files that fit under the limit land.
func TestService_CreateWithinQuota_ConcurrentRespectsLimit(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	if _, err := sqlDB.Exec(
		"INSERT INTO users (id, username, password_hash, role, storage_limit) VALUES ($1, $2, $3, $4, $5)",
		"quota-user", "quotauser", "hash", "admin", int64(1000)); err != nil {
		t.Fatalf("insert quota user: %v", err)
	}
	pool := db.NewTenantPool(sqlDB)
	svc := NewService(pool, nil)

	const workers = 10
	const fileSize = 200
	var wg sync.WaitGroup
	var created int64
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			item, dup, err := svc.CreateWithinQuota("quota-user", "", fmt.Sprintf("f%d.jpg", i), "T", "image/jpeg", fmt.Sprintf("h%d", i), fileSize, nil, nil, nil, nil, nil, nil)
			if errors.Is(err, ErrQuotaExceeded) {
				return
			}
			if err != nil {
				t.Errorf("worker %d: %v", i, err)
				return
			}
			if !dup && item != nil {
				atomic.AddInt64(&created, 1)
			}
		}(i)
	}
	wg.Wait()

	tdb, err := pool.Get("quota-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	var used int64
	if err := tdb.QueryRow("SELECT COALESCE(SUM(size), 0) FROM media WHERE user_id = $1", "quota-user").Scan(&used); err != nil {
		t.Fatalf("sum usage: %v", err)
	}
	if used > 1000 {
		t.Fatalf("total usage %d exceeds limit 1000", used)
	}
	if created != 5 {
		t.Fatalf("expected exactly 5 uploads to fit under the limit, got %d", created)
	}
}

// F4: the embedded-items scan for duplicate detection must be capped and must
// filter out metadata-less rows in SQL, not after loading them into memory.
func TestService_QueryEmbeddedItems_CappedAtLimit(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)

	embedMeta := `{"embedding":[0.1,0.2]}`
	const extra = 5
	for i := 0; i < maxEmbeddedItems+extra; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("e%d.jpg", i), "E", "image/jpeg",
			fmt.Sprintf("he%d", i), 10, nil, nil, nil, &embedMeta, nil, nil); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	// Rows without any metadata must be filtered by the query itself.
	for i := 0; i < 3; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("n%d.jpg", i), "N", "image/jpeg",
			fmt.Sprintf("hn%d", i), 10, nil, nil, nil, nil, nil, nil); err != nil {
			t.Fatalf("create no-meta %d: %v", i, err)
		}
	}

	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	selectCols := `id, title, file_path, mime_type, size, width, height, hash,
		folder_id, is_favorite, is_trash, is_vault, captured_at, updated_at, created_at,
		metadata, duration, transcode_status`

	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)
	withEmb, err := svc.queryEmbeddedItems(tdb, "test-user", selectCols, false)
	if err != nil {
		t.Fatalf("queryEmbeddedItems: %v", err)
	}
	if len(withEmb) != maxEmbeddedItems {
		t.Fatalf("expected scan capped at %d, got %d", maxEmbeddedItems, len(withEmb))
	}
	if !strings.Contains(buf.String(), "capped") {
		t.Fatalf("expected cap warning to be logged, got: %q", buf.String())
	}
}

// F6: a storage_limit of 0 must mean "zero bytes allowed" — any upload is
// rejected — while NULL still means unlimited. Older code treated <=0 as
// unlimited, silently granting infinite storage to zero-limit accounts.
func TestService_CreateWithinQuota_ZeroAndNullLimits(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	if _, err := sqlDB.Exec(
		"INSERT INTO users (id, username, password_hash, role, storage_limit) VALUES ($1, $2, $3, $4, $5)",
		"zero-user", "zerouser", "hash", "admin", 0); err != nil {
		t.Fatalf("insert zero-limit user: %v", err)
	}
	if _, err := sqlDB.Exec(
		"INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
		"null-user", "nulluser", "hash", "admin"); err != nil {
		t.Fatalf("insert null-limit user: %v", err)
	}
	pool := db.NewTenantPool(sqlDB)
	svc := NewService(pool, nil)

	if _, _, err := svc.CreateWithinQuota("zero-user", "", "z.jpg", "Z", "image/jpeg", "hz", 1, nil, nil, nil, nil, nil, nil); !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("zero limit: expected ErrQuotaExceeded, got %v", err)
	}
	if _, _, err := svc.CreateWithinQuota("null-user", "", "n.jpg", "N", "image/jpeg", "hn", 1, nil, nil, nil, nil, nil, nil); err != nil {
		t.Fatalf("null limit (unlimited): unexpected error %v", err)
	}
}

// F9: smart-folder tag matching runs as an inline subquery — no unbounded ID
// list materialized in Go — and stays correct for large matches: the result
// is paged, totals match, untagged media never leaks in, pages don't overlap.
// Regression: the dashboard COUNT query and the inbox count discarded their
// Scan error, so a broken query silently left Total and the inbox badge at 0
// with nothing in the log. Assert the numbers, not just that nothing panics.
func TestService_GetDashboard_TotalAndInboxCount(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
	for i := 0; i < 3; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("%d.jpg", i), fmt.Sprintf("Item %d", i),
			"image/jpeg", fmt.Sprintf("h-count-%d", i), 100, nil, nil, nil, nil, nil, nil); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	resp, err := svc.GetDashboard("test-user", DashboardParams{Limit: 10, Page: 1})
	if err != nil {
		t.Fatalf("GetDashboard: %v", err)
	}
	if resp.Total != 3 {
		t.Fatalf("expected total 3, got %d", resp.Total)
	}
	if got := resp.FolderCounts["__inbox__"]; got != 3 {
		t.Fatalf("expected inbox count 3, got %d", got)
	}
}

// TestService_Create_DuplicateHash pins the assumption the dashboard dedup
// relies on: (user_id, hash) is unique, so at most one row per hash exists and
// the "earliest upload per hash" selection has nothing to choose between.
func TestService_GetDashboard_DedupKeepsSingleRowPerHash(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)
	for i := 0; i < 3; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("d%d.jpg", i), "Dup", "image/jpeg", "h-shared", 100, nil, nil, nil, nil, nil, nil); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	resp, err := svc.GetDashboard("test-user", DashboardParams{Limit: 10, Page: 1})
	if err != nil {
		t.Fatalf("GetDashboard: %v", err)
	}
	if resp.Total != 1 || len(resp.Items) != 1 {
		t.Fatalf("expected a single deduped row for the shared hash, got total=%d items=%d", resp.Total, len(resp.Items))
	}

	// Repeated calls must be stable — same representative row every time.
	again, err := svc.GetDashboard("test-user", DashboardParams{Limit: 10, Page: 1})
	if err != nil {
		t.Fatalf("GetDashboard repeat: %v", err)
	}
	if again.Items[0].ID != resp.Items[0].ID {
		t.Fatalf("dedup representative changed between calls: %s vs %s", resp.Items[0].ID, again.Items[0].ID)
	}
}

func TestService_GetDashboard_SmartFolderLargeMatch(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)

	const tagged = 30
	const untagged = 5
	for i := 0; i < tagged; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("t%d.jpg", i), "T", "image/jpeg",
			fmt.Sprintf("st%d", i), 10, nil, nil, nil, nil, nil, nil); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	for i := 0; i < untagged; i++ {
		if _, _, err := svc.Create("test-user", "", fmt.Sprintf("u%d.jpg", i), "U", "image/jpeg",
			fmt.Sprintf("su%d", i), 10, nil, nil, nil, nil, nil, nil); err != nil {
			t.Fatalf("create untagged %d: %v", i, err)
		}
	}

	tdb, err := pool.Get("test-user")
	if err != nil {
		t.Fatalf("get tenant db: %v", err)
	}
	defer tdb.Close()
	// Tag the tagged set by real media id (media_tags.media_id is an FK to
	// media.id, not file_path).
	rows, err := tdb.Query("SELECT id FROM media WHERE file_path LIKE 't%.jpg'")
	if err != nil {
		t.Fatalf("query ids: %v", err)
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan id: %v", err)
		}
		ids = append(ids, id)
	}
	rows.Close()
	if len(ids) != tagged {
		t.Fatalf("expected %d tagged ids, got %d", tagged, len(ids))
	}
	for _, id := range ids {
		if _, err := tdb.Exec(
			"INSERT INTO media_tags (media_id, user_id, tag, score, category) VALUES ($1, $2, $3, $4, $5)",
			id, "test-user", "nature", 0.9, "scene"); err != nil {
			t.Fatalf("tag %s: %v", id, err)
		}
	}

	page1, err := svc.GetDashboard("test-user", DashboardParams{Categories: []string{"scene"}, MinScore: 0.5, Limit: 10, Page: 1})
	if err != nil {
		t.Fatalf("dashboard page 1: %v", err)
	}
	if page1.Total != tagged {
		t.Fatalf("expected total %d, got %d", tagged, page1.Total)
	}
	if len(page1.Items) != 10 {
		t.Fatalf("expected paged 10 items, got %d", len(page1.Items))
	}
	for _, it := range page1.Items {
		if !strings.HasPrefix(it.FilePath, "t") {
			t.Fatalf("untagged media %s leaked into smart folder result", it.FilePath)
		}
	}

	page2, err := svc.GetDashboard("test-user", DashboardParams{Categories: []string{"scene"}, MinScore: 0.5, Limit: 10, Page: 2})
	if err != nil {
		t.Fatalf("dashboard page 2: %v", err)
	}
	seen := map[string]bool{}
	for _, it := range append(page1.Items, page2.Items...) {
		if seen[it.ID] {
			t.Fatalf("item %s appeared on both pages (pagination broken)", it.ID)
		}
		seen[it.ID] = true
	}
}

// F1: while the vault is locked, Search, Dashboard and Duplicates must all
// exclude vault items; with IncludeVault=true they must include them.
//
// Near-duplicate groups (the only kind that can form: (user_id, hash) is
// unique, so same-user exact-hash groups never materialize) are clustered by
// embedding similarity, so the vault item shares the cluster's embedding.
func TestService_IncludeVaultGates(t *testing.T) {
	pool := setupTenantDB(t)
	svc := NewService(pool, nil)

	near := `{"embedding":[1,0]}`
	far := `{"embedding":[1,100]}`

	mk := func(title, hash, metadata string) *MediaItem {
		it, _, err := svc.Create("test-user", "", hash+".jpg", title, "image/jpeg", hash, 100, nil, nil, nil, &metadata, nil, nil)
		if err != nil {
			t.Fatalf("create %s: %v", title, err)
		}
		return it
	}
	mk("plain", "hz-far", far)
	mk("sim-a", "hz-sima", near)
	mk("sim-b", "hz-simb", near)
	vaulted := mk("sim-c", "hz-simc", near)
	if err := svc.Update("test-user", vaulted.ID, map[string]interface{}{"is_vault": true}); err != nil {
		t.Fatalf("mark vault: %v", err)
	}

	// Search: raw rows are 4; locked must return the 3 non-vault items.
	s, err := svc.Search("test-user", SearchParams{Limit: 50})
	if err != nil {
		t.Fatalf("search locked: %v", err)
	}
	if s.Total != 3 {
		t.Fatalf("search locked: expected 3 items, got %d", s.Total)
	}
	su, err := svc.Search("test-user", SearchParams{Limit: 50, IncludeVault: true})
	if err != nil {
		t.Fatalf("search unlocked: %v", err)
	}
	if su.Total != 4 {
		t.Fatalf("search unlocked: expected 4 items, got %d", su.Total)
	}

	// Dashboard uses the same dedup path.
	d, err := svc.GetDashboard("test-user", DashboardParams{Limit: 50})
	if err != nil {
		t.Fatalf("dashboard locked: %v", err)
	}
	if d.Total != 3 {
		t.Fatalf("dashboard locked: expected 3 items, got %d", d.Total)
	}
	du, err := svc.GetDashboard("test-user", DashboardParams{Limit: 50, IncludeVault: true})
	if err != nil {
		t.Fatalf("dashboard unlocked: %v", err)
	}
	if du.Total != 4 {
		t.Fatalf("dashboard unlocked: expected 4 items, got %d", du.Total)
	}

	// Duplicates: the near-duplicate cluster has 2 non-vault + 1 vault member.
	gd, err := svc.GetDuplicates("test-user", false)
	if err != nil {
		t.Fatalf("duplicates locked: %v", err)
	}
	if len(gd.Groups) != 1 || len(gd.Groups[0].Items) != 2 {
		t.Fatalf("duplicates locked: expected one group of 2, got %d groups", len(gd.Groups))
	}
	gu, err := svc.GetDuplicates("test-user", true)
	if err != nil {
		t.Fatalf("duplicates unlocked: %v", err)
	}
	if len(gu.Groups) != 1 || len(gu.Groups[0].Items) != 3 {
		t.Fatalf("duplicates unlocked: expected one group of 3, got %d groups", len(gu.Groups))
	}
}
