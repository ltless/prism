package dbtest

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// testDBURL is the connection string for the PostgreSQL test database.
// Resolution order: PRISM_TEST_DB (full URL) > PRISM_TEST_DB_PASSWORD >
// DATABASE_URL from the environment or backend/.env (retargeted at
// prism_test). No committed default password.
var testDBURL = buildTestDBURL()

func buildTestDBURL() string {
	if v := os.Getenv("PRISM_TEST_DB"); v != "" {
		return v
	}
	if v := os.Getenv("PRISM_TEST_DB_PASSWORD"); v != "" {
		return fmt.Sprintf("postgresql://prism:%s@localhost:5432/prism_test", v)
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		// best-effort read of backend/.env — keeps plain `go test` working
		// for local dev without exporting anything. Path is resolved from
		// this source file (not test cwd, which varies per package).
		if envPath, err := backendEnvPath(); err == nil {
			if data, err := os.ReadFile(envPath); err == nil {
				for _, line := range strings.Split(string(data), "\n") {
					if v, ok := strings.CutPrefix(line, "DATABASE_URL="); ok {
						url = strings.TrimSpace(v)
						break
					}
				}
			}
		}
	}
	if url != "" {
		// retarget at the test database
		if idx := strings.LastIndex(url, "/"); idx >= 0 {
			return url[:idx+1] + "prism_test"
		}
	}
	return "postgresql://prism:@localhost:5432/prism_test"
}

// backendEnvPath locates backend/.env relative to this file, independent of
// the test binary's working directory.
func backendEnvPath() (string, error) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("locate testutil.go")
	}
	return filepath.Join(filepath.Dir(thisFile), "..", "..", ".env"), nil
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
