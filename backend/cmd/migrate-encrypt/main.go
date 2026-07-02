package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/ltless/prism/internal/config"
	mw "github.com/ltless/prism/internal/media"
)

// migrate-encrypt re-encrypts existing plaintext media files in STORAGE_PATH
// into the prism envelope format. Run once before deploying a backend that
// enforces encryption on serve; it is idempotent (already-encrypted files are
// skipped), so it can safely be re-run or resumed after an interruption.
//
// Thumbnails are deliberately left plaintext (see §3 in enc.md).
func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	mk, err := mw.LoadMasterKey(cfg.EncryptionMasterKey)
	if err != nil {
		log.Fatalf("invalid encryption master key: %v", err)
	}

	root := cfg.StoragePath
	if fi, err := os.Stat(root); err != nil {
		log.Fatalf("storage path %q: %v", root, err)
	} else if !fi.IsDir() {
		log.Fatalf("storage path %q is not a directory", root)
	}

	files, encrypted, skipped, failed, bytesIn, bytesOut := migrate(root, mk)
	log.Printf("done: %d files (%d encrypted, %d already-encrypted, %d failed)", files, encrypted, skipped, failed)
	log.Printf("bytes: %d plaintext in -> %d encrypted out", bytesIn, bytesOut)
	if failed > 0 {
		os.Exit(1)
	}
}

// migrate walks root and encrypts every plaintext file in place. Thumbnail
// directories are skipped. Returns run statistics.
func migrate(root string, mk *mw.MasterKey) (files, encrypted, skipped, failed, bytesIn, bytesOut int64) {
	start := time.Now()

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if info.Name() == "thumbnails" {
				return filepath.SkipDir
			}
			return nil
		}

		files++
		err = migrateFile(mk, path, info.Size(), &encrypted, &skipped, &bytesIn, &bytesOut)
		if err != nil {
			failed++
			log.Printf("ERROR %s: %v", path, err)
			return nil
		}
		if files%50 == 0 {
			log.Printf("progress: %d files, %d encrypted, %d skipped, %d failed (%s elapsed)",
				files, encrypted, skipped, failed, time.Since(start).Round(time.Second))
		}
		return nil
	})
	if err != nil {
		log.Printf("walk %q: %v", root, err)
	}
	return files, encrypted, skipped, failed, bytesIn, bytesOut
}

// migrateFile encrypts path in place via tmp + atomic rename. Existing
// encrypted files are skipped. The original file is only replaced after a
// fully successful write to a temp file in the same directory.
func migrateFile(mk *mw.MasterKey, path string, plaintextSize int64, encrypted, skipped *int64, bytesIn, bytesOut *int64) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()

	peek := make([]byte, 4)
	n, _ := io.ReadFull(src, peek)
	if mw.IsEncrypted(peek[:n]) {
		*skipped++
		return nil
	}

	tmpPath := filepath.Join(filepath.Dir(path), ".migrate-"+uuid.NewString()+".tmp")
	tmp, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := mk.EncryptToFile(tmp, src); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	if fi, err := os.Stat(path); err == nil {
		*bytesOut += fi.Size()
	}
	*bytesIn += plaintextSize
	*encrypted++
	return nil
}