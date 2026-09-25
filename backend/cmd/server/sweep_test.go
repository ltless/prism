package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
	mw "github.com/ltless/prism/internal/media"
)

func TestSweepOrphans_RemovesUnreferenced(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	if _, err := sqlDB.Exec(
		`INSERT INTO users (id, username, password_hash, role, image) VALUES ($1, $2, $3, 'user', $4)`,
		"user-1", "u1", "hash", filepath.Join(".profile", "me.jpg"),
	); err != nil {
		t.Fatal(err)
	}
	pool := db.NewTenantPool(sqlDB)
	tdb, err := pool.Get(context.Background(), "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tdb.Exec(context.Background(),
		`INSERT INTO media (id, user_id, title, file_path, mime_type, size, hash) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		"m1", "user-1", "keep", "keep.jpg", "image/jpeg", 1, "keep",
	); err != nil {
		t.Fatal(err)
	}
	tdb.Close()

	mk, err := mw.LoadMasterKey(bytes.Repeat([]byte{0x42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	storage := mw.NewStorage(root, mk)
	mediaDir := storage.MediaDir("user-1")
	for _, d := range []string{mediaDir, storage.ThumbDir("user-1"), filepath.Join(mediaDir, ".profile")} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	old := time.Now().Add(-time.Hour)
	writeOld := func(path string, fresh bool) {
		t.Helper()
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
		if !fresh {
			if err := os.Chtimes(path, old, old); err != nil {
				t.Fatal(err)
			}
		}
	}
	keep := filepath.Join(mediaDir, "keep.jpg")
	drop := filepath.Join(mediaDir, "drop.jpg")
	fresh := filepath.Join(mediaDir, "fresh.jpg")
	profile := filepath.Join(mediaDir, ".profile", "me.jpg")
	oldProfile := filepath.Join(mediaDir, ".profile", "old.jpg")
	writeOld(keep, false)
	writeOld(drop, false)
	writeOld(fresh, true)
	writeOld(profile, false)
	writeOld(oldProfile, false)

	n, err := sweepOrphans(context.Background(), sqlDB, pool, storage)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("removed %d, want 2", n)
	}
	for _, p := range []string{keep, fresh, profile} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s should stay: %v", p, err)
		}
	}
	for _, p := range []string{drop, oldProfile} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("%s should be gone", p)
		}
	}
}

func TestSweepOrphans_NoUsersSkips(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	mk, err := mw.LoadMasterKey(bytes.Repeat([]byte{0x42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	storage := mw.NewStorage(root, mk)
	mediaDir := storage.MediaDir("ghost")
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(mediaDir, "only.jpg")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-time.Hour)
	if err := os.Chtimes(file, old, old); err != nil {
		t.Fatal(err)
	}

	n, err := sweepOrphans(context.Background(), sqlDB, db.NewTenantPool(sqlDB), storage)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("removed %d with no users, want 0", n)
	}
	if _, err := os.Stat(file); err != nil {
		t.Fatal(err)
	}
}
