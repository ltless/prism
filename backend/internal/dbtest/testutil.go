package dbtest

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// testDBURL is the connection string for the PostgreSQL test database.
// It can be overridden via the PRISM_TEST_DB env var.
var testDBURL = "postgresql://prism:prism_dev_2024@localhost:5432/prism_test"

func init() {
	if v := os.Getenv("PRISM_TEST_DB"); v != "" {
		testDBURL = v
	}
}

// NewDB connects to the PostgreSQL test database and runs migrations.
// It truncates all tables before returning so each test starts clean.
// The *sql.DB is closed automatically via t.Cleanup.
func NewDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("pgx", testDBURL)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("ping test db: %v", err)
	}

	if err := runMigrations(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	if err := truncateAll(db); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	t.Cleanup(func() {
		truncateAll(db)
		db.Close()
	})

	return db
}

// runMigrations executes the schema SQL to ensure all tables exist.
func runMigrations(db *sql.DB) error {
	migrationSQL := schemaSQL
	if _, err := db.Exec(migrationSQL); err != nil {
		return fmt.Errorf("exec migration: %w", err)
	}
	return nil
}

// truncateAll clears all tables in child-first order.
func truncateAll(db *sql.DB) error {
	tables := []string{
	"media_tags",
	"media",
	"folders",
	"transcode_queue",
	"error_logs",
	"app_settings",
	"app_config",
	"users",
	}
	for _, t := range tables {
		if _, err := db.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", t)); err != nil {
			return fmt.Errorf("truncate %s: %w", t, err)
	}
	}
	return nil
}
