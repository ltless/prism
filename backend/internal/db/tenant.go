package db

import "database/sql"

// TenantDB wraps the shared *sql.DB. In the PostgreSQL single-DB architecture,
// all tenant data lives in one database with user_id column filtering.
// The wrapper is kept so service code can still call pool.Get(userID).
type TenantDB struct {
	*sql.DB
}

// TenantPool is a thin wrapper around the shared *sql.DB.
// Previously managed per-user SQLite files via LRU cache; now just returns
// the shared PostgreSQL connection. Kept to minimise changes in service code.
type TenantPool struct {
	db *sql.DB
}

func NewTenantPool(db *sql.DB) *TenantPool {
	return &TenantPool{db: db}
}

// Get returns the shared *sql.DB wrapped as *TenantDB.
// userID is no longer used to select a database, but is accepted to preserve
// the existing interface. Service queries must filter by user_id explicitly.
func (p *TenantPool) Get(userID string) (*TenantDB, error) {
	return &TenantDB{p.db}, nil
}

// Close is a no-op — the underlying *sql.DB is shared with GlobalDB
// and closed by main.go via global.Close().
func (p *TenantPool) Close() {}
