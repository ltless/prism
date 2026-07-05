package db

import (
	"container/list"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

//go:embed migrations/tenant.sql
var tenantMigrations embed.FS

type TenantDB struct {
	*sql.DB
}

type TenantPool struct {
	mu       sync.Mutex
	dbs      map[string]*TenantDB
	order    *list.List // LRU order; front = most recently used
	orderIdx map[string]*list.Element
	basePath string
	maxOpen  int
	migrated map[string]bool // tracks which tenants have been initialized
}

func NewTenantPool(basePath string) *TenantPool {
	return &TenantPool{
		dbs:      make(map[string]*TenantDB),
		order:    list.New(),
		orderIdx: make(map[string]*list.Element),
		basePath: basePath,
		maxOpen:  128,
		migrated: make(map[string]bool),
	}
}

func (p *TenantPool) Get(userID string) (*TenantDB, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if tdb, ok := p.dbs[userID]; ok {
		p.touchLocked(userID)
		return tdb, nil
	}

	dir := filepath.Join(p.basePath, userID)
	cleanDir := filepath.Clean(dir)
	if !strings.HasPrefix(cleanDir, filepath.Clean(p.basePath)+string(filepath.Separator)) &&
		cleanDir != filepath.Clean(p.basePath) {
		return nil, fmt.Errorf("invalid userID: path traversal detected")
	}
	if err := os.MkdirAll(cleanDir, 0755); err != nil {
		return nil, fmt.Errorf("create tenant dir: %w", err)
	}

	path := filepath.Join(cleanDir, "prism.db")

	// Foreign keys + WAL + busy_timeout via DSN so every pooled connection enforces them.
	// busy_timeout(5000) makes SQLite wait up to 5s instead of returning SQLITE_BUSY
	// on concurrent writes — critical for batch uploads hitting the same tenant DB.
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open tenant db: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)

	// Only run migrations for tenants we haven't initialized yet in this
	// process. The IF NOT EXISTS in the migration SQL makes it idempotent,
	// but skipping it avoids unnecessary DB round-trips on every pool miss.
	if !p.migrated[userID] {
		migrationSQL, err := tenantMigrations.ReadFile("migrations/tenant.sql")
		if err != nil {
			sqlDB.Close()
			return nil, fmt.Errorf("read tenant migration: %w", err)
		}

		if _, err := sqlDB.Exec(string(migrationSQL)); err != nil {
			sqlDB.Close()
			return nil, fmt.Errorf("exec tenant migration: %w", err)
		}

		// filter_query column was added after initial schema; safe to ignore if already present
		if _, err := sqlDB.Exec("ALTER TABLE folders ADD COLUMN filter_query TEXT"); err != nil {
			log.Printf("ALTER TABLE folders add filter_query: %v (expected if column exists)", err)
		}

		// updated_at column was added after initial schema; safe to ignore if already present.
		// NOTE: SQLite (modernc driver) rejects ADD COLUMN with a non-constant default
		// (e.g. strftime), so use a constant default. Existing rows get 0/NULL which is
		// fine since the column is always written explicitly on create/update.
		if _, err := sqlDB.Exec("ALTER TABLE folders ADD COLUMN updated_at INTEGER DEFAULT 0"); err != nil {
			log.Printf("ALTER TABLE folders add updated_at: %v (expected if column exists)", err)
		}

		p.migrated[userID] = true
		log.Printf("Tenant DB initialized for user %s", userID)
	}

	tdb := &TenantDB{sqlDB}
	p.dbs[userID] = tdb
	p.orderIdx[userID] = p.order.PushBack(userID)

	// Evict least-recently-used if over capacity.
	for p.order.Len() > p.maxOpen {
		oldest := p.order.Front()
		if oldest == nil {
			break
		}
		oldID := oldest.Value.(string)
		if old := p.dbs[oldID]; old != nil {
			old.Close()
		}
		delete(p.dbs, oldID)
		delete(p.orderIdx, oldID)
		p.order.Remove(oldest)
	}

	return tdb, nil
}

// touchLocked moves userID to the back of the LRU list. Caller must hold p.mu.
func (p *TenantPool) touchLocked(userID string) {
	if el, ok := p.orderIdx[userID]; ok {
		p.order.MoveToBack(el)
	}
}

// Close closes every open tenant DB. Safe to call on shutdown.
func (p *TenantPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for id, tdb := range p.dbs {
		if tdb != nil && tdb.DB != nil {
			tdb.Close()
		}
		delete(p.dbs, id)
	}
	p.order.Init()
	p.orderIdx = make(map[string]*list.Element)
}
