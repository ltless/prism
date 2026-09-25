package media

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func age(t *testing.T, path string) {
	t.Helper()
	old := time.Now().Add(-orphanMinAge - time.Minute)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
}

func TestSweepOrphans(t *testing.T) {
	root := t.TempDir()
	s := newTestStorage(root)
	user := "user-1"
	mediaDir := s.mediaDir(user)
	thumbDir := s.thumbDir(user)
	profileDir := filepath.Join(mediaDir, ".profile")
	for _, d := range []string{mediaDir, thumbDir, profileDir} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}

	keepMedia := filepath.Join(mediaDir, "keep.jpg")
	dropMedia := filepath.Join(mediaDir, "drop.jpg")
	freshMedia := filepath.Join(mediaDir, "fresh.jpg")
	tmp := filepath.Join(mediaDir, ".upload.tmp")
	keepThumb := filepath.Join(thumbDir, "keep.jpg")
	dropThumb := filepath.Join(thumbDir, "drop.jpg")
	keepProfile := filepath.Join(profileDir, "profile_ab.jpg")
	dropProfile := filepath.Join(profileDir, "profile_old.jpg")
	for _, p := range []string{keepMedia, dropMedia, freshMedia, tmp, keepThumb, dropThumb, keepProfile, dropProfile} {
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
		age(t, p)
	}
	if err := os.Chtimes(freshMedia, time.Now(), time.Now()); err != nil {
		t.Fatal(err)
	}

	keep := OrphanKeep{
		Hashes:   map[string]map[string]struct{}{"user-1": {"keep": {}}},
		Profiles: map[string]map[string]struct{}{"user-1": {filepath.Join(".profile", "profile_ab.jpg"): {}}},
	}
	n, err := s.SweepOrphans(keep)
	if err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("removed %d, want 3", n)
	}
	for _, p := range []string{keepMedia, freshMedia, tmp, keepThumb, keepProfile} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s should stay: %v", p, err)
		}
	}
	for _, p := range []string{dropMedia, dropThumb, dropProfile} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("%s should be gone", p)
		}
	}
}
