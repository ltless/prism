package db

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

//go:embed migrations/global.sql
var globalMigrations embed.FS

type GlobalDB struct {
	*sql.DB
}

func NewGlobalDB(path string) (*GlobalDB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, fmt.Errorf("create global db dir: %w", err)
	}

	// Foreign keys + WAL must be set via DSN so every pooled connection enforces them.
	// Setting them via db.Exec only affects a single connection in the pool.
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open global db: %w", err)
	}

	if err := runGlobalMigrations(db); err != nil {
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return &GlobalDB{db}, nil
}

func runGlobalMigrations(db *sql.DB) error {
	migrationSQL, err := globalMigrations.ReadFile("migrations/global.sql")
	if err != nil {
		return fmt.Errorf("read global migration: %w", err)
	}

	if _, err := db.Exec(string(migrationSQL)); err != nil {
		return fmt.Errorf("exec global migration: %w", err)
	}

	// Best-effort column additions for legacy DBs created before schema updates
	for _, col := range []string{"vault_pin TEXT", "storage_limit INTEGER", "preferences TEXT"} {
		if _, err := db.Exec("ALTER TABLE users ADD COLUMN " + col); err != nil {
			log.Printf("ALTER TABLE users add %s: %v (expected if column exists)", col, err)
		}
	}

	log.Println("Global migrations applied")
	return nil
}
