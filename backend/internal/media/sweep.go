package media

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// orphanMinAge keeps an in-flight upload (file on disk, row not committed yet)
// from being deleted. Anything older with no matching row is leftover.
const orphanMinAge = 10 * time.Minute

// OrphanKeep is the set of content hashes and profile-image paths that still
// have a database row, keyed by user id. A user missing from the maps loses
// every old file in their directory.
type OrphanKeep struct {
	Hashes   map[string]map[string]struct{}
	Profiles map[string]map[string]struct{}
}

// SweepOrphans removes media files and thumbnails under basePath whose hash is
// not in keep, and profile images not in keep. Dotfiles (in-progress temps)
// and files newer than orphanMinAge are left alone.
func (s *Storage) SweepOrphans(keep OrphanKeep) (int, error) {
	entries, err := os.ReadDir(s.basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	removed := 0
	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}
		n, err := s.sweepUser(ent.Name(), keep.Hashes[ent.Name()], keep.Profiles[ent.Name()])
		removed += n
		if err != nil {
			return removed, err
		}
	}
	return removed, nil
}

func (s *Storage) sweepUser(userID string, hashes, profiles map[string]struct{}) (int, error) {
	mediaDir := s.mediaDir(userID)
	entries, err := os.ReadDir(mediaDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	removed := 0
	for _, ent := range entries {
		name := ent.Name()
		path := filepath.Join(mediaDir, name)
		switch {
		case name == ".profile" && ent.IsDir():
			n, err := sweepDir(path, func(file string) bool {
				_, ok := profiles[filepath.Join(".profile", file)]
				return ok
			})
			removed += n
			if err != nil {
				return removed, err
			}
		case name == "thumbnails" && ent.IsDir():
			n, err := sweepDir(path, func(file string) bool {
				hash := strings.TrimSuffix(file, filepath.Ext(file))
				_, ok := hashes[hash]
				return ok
			})
			removed += n
			if err != nil {
				return removed, err
			}
		case ent.IsDir() || strings.HasPrefix(name, "."):
			continue
		default:
			if !oldEnough(ent) {
				continue
			}
			hash := strings.TrimSuffix(name, filepath.Ext(name))
			if _, ok := hashes[hash]; ok {
				continue
			}
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return removed, err
			}
			removed++
		}
	}
	return removed, nil
}

// sweepDir removes old files in dir that keep reports false. Subdirs are ignored.
func sweepDir(dir string, keep func(name string) bool) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}
	removed := 0
	for _, ent := range entries {
		if ent.IsDir() || strings.HasPrefix(ent.Name(), ".") || !oldEnough(ent) {
			continue
		}
		if keep(ent.Name()) {
			continue
		}
		if err := os.Remove(filepath.Join(dir, ent.Name())); err != nil && !os.IsNotExist(err) {
			return removed, err
		}
		removed++
	}
	return removed, nil
}

func oldEnough(ent os.DirEntry) bool {
	info, err := ent.Info()
	if err != nil {
		return false
	}
	return time.Since(info.ModTime()) >= orphanMinAge
}
