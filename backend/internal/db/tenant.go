package db

import (
	"context"
	"database/sql"
	"fmt"
)

// TenantDB is a per-request connection with the tenant identity set as a
// PostgreSQL session variable (app.current_user_id). Row-Level Security
// policies on the tenant tables read that variable, so even a query that
// forgets WHERE user_id = $1 cannot leak another tenant's rows.
//
// The caller MUST defer tdb.Close() — Close resets the variable and returns
// the connection to the pool. A connection that slips back with a stale
// variable fails closed: RLS policies treat an empty setting as no tenant.
type TenantDB struct {
	*sql.Conn
	pool *TenantPool
}

// TenantPool hands out per-request, tenant-scoped connections from the
// shared *sql.DB pool.
type TenantPool struct {
	db *sql.DB
}

func NewTenantPool(db *sql.DB) *TenantPool {
	return &TenantPool{db: db}
}

// Close is a no-op — the underlying *sql.DB is shared with GlobalDB
// and closed by main.go via global.Close().
func (p *TenantPool) Close() {}

// Get acquires a connection from the pool and sets app.current_user_id on it
// so RLS policies scope every statement on that connection to userID.
func (p *TenantPool) Get(userID string) (*TenantDB, error) {
	ctx := context.Background()
	conn, err := p.db.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquire conn: %w", err)
	}
	// Parameterized SET via set_config — userID never interpolated into SQL.
	// Session-scoped (local=false): this connection is dedicated to this
	// request until Close.
	if _, err := conn.ExecContext(ctx, "SELECT set_config('app.current_user_id', $1, false)", userID); err != nil {
		conn.Close()
		return nil, fmt.Errorf("set tenant context: %w", err)
	}
	return &TenantDB{Conn: conn, pool: p}, nil
}

// Close resets the tenant variable and returns the connection to the pool.
// Safe to call multiple times (sql.Conn.Close is idempotent).
func (t *TenantDB) Close() error {
	if t.Conn == nil {
		return nil
	}
	_, err := t.Conn.ExecContext(context.Background(), "SELECT set_config('app.current_user_id', '', false)")
	closeErr := t.Conn.Close()
	if err != nil {
		return err
	}
	return closeErr
}

// sql.Conn only exposes *Context methods; re-add the database/sql-style
// names the service code already uses.

func (t *TenantDB) Query(query string, args ...any) (*sql.Rows, error) {
	return t.Conn.QueryContext(context.Background(), query, args...)
}

func (t *TenantDB) QueryRow(query string, args ...any) *sql.Row {
	return t.Conn.QueryRowContext(context.Background(), query, args...)
}

func (t *TenantDB) Exec(query string, args ...any) (sql.Result, error) {
	return t.Conn.ExecContext(context.Background(), query, args...)
}

// Begin starts a transaction. The tenant variable set on the connection
// stays visible inside the transaction (same session), so RLS keeps
// applying to every statement in it.
func (t *TenantDB) Begin() (*sql.Tx, error) {
	return t.Conn.BeginTx(context.Background(), nil)
}
