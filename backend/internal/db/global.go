package db

import (
	"database/sql"
	"embed"
	"fmt"
	"log"

	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed migrations/postgres.sql
var pgMigrations embed.FS

type GlobalDB struct {
	*sql.DB
}

func NewGlobalDB(databaseURL string) (*GlobalDB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	log.Println("PostgreSQL connected and migrations applied")
	return &GlobalDB{db}, nil
}

func runMigrations(db *sql.DB) error {
	migrationSQL, err := pgMigrations.ReadFile("migrations/postgres.sql")
	if err != nil {
		return fmt.Errorf("read migration: %w", err)
	}

	if _, err := db.Exec(string(migrationSQL)); err != nil {
		return fmt.Errorf("exec migration: %w", err)
	}

	log.Println("Database migrations applied")
	return nil
}
