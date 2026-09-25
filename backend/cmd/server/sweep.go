package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/ltless/prism/internal/db"
	mw "github.com/ltless/prism/internal/media"
)

// startOrphanSweep reclaims media files whose rows are already gone. Runs
// after listen so a slow walk cannot delay startup. Zero users skips the walk:
// an empty database pointed at a real library must not wipe it.
func startOrphanSweep(sqlDB *sql.DB, pool *db.TenantPool, storage *mw.Storage) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		n, err := sweepOrphans(ctx, sqlDB, pool, storage)
		if err != nil {
			log.Printf("orphan sweep: %v", err)
			return
		}
		if n > 0 {
			log.Printf("orphan sweep removed %d files", n)
		}
	}()
}

func sweepOrphans(ctx context.Context, sqlDB *sql.DB, pool *db.TenantPool, storage *mw.Storage) (int, error) {
	rows, err := sqlDB.QueryContext(ctx, `SELECT id, image, cover_image FROM users`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	keep := mw.OrphanKeep{
		Hashes:   map[string]map[string]struct{}{},
		Profiles: map[string]map[string]struct{}{},
	}
	var userIDs []string
	for rows.Next() {
		var id string
		var image, cover sql.NullString
		if err := rows.Scan(&id, &image, &cover); err != nil {
			return 0, err
		}
		userIDs = append(userIDs, id)
		profiles := map[string]struct{}{}
		if image.Valid && image.String != "" {
			profiles[image.String] = struct{}{}
		}
		if cover.Valid && cover.String != "" {
			profiles[cover.String] = struct{}{}
		}
		keep.Profiles[id] = profiles
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(userIDs) == 0 {
		log.Printf("orphan sweep skipped: no users")
		return 0, nil
	}

	for _, id := range userIDs {
		hashes, err := userHashes(ctx, pool, id)
		if err != nil {
			return 0, err
		}
		keep.Hashes[id] = hashes
	}
	return storage.SweepOrphans(keep)
}

func userHashes(ctx context.Context, pool *db.TenantPool, userID string) (map[string]struct{}, error) {
	tdb, err := pool.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	defer tdb.Close()

	rows, err := tdb.Query(ctx, `SELECT hash FROM media`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hashes := map[string]struct{}{}
	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			return nil, err
		}
		hashes[hash] = struct{}{}
	}
	return hashes, rows.Err()
}
