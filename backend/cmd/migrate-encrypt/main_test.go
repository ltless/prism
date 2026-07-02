package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	mw "github.com/ltless/prism/internal/media"
)

func TestMigrate_IdempotentAndSkipsThumbnails(t *testing.T) {
	root := t.TempDir()

	// Plaintext media file to be encrypted.
	mediaDir := filepath.Join(root, "user1", "media")
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		t.Fatal(err)
	}
	plain := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F'}
	mediaFile := filepath.Join(mediaDir, "abc.jpg")
	if err := os.WriteFile(mediaFile, plain, 0o644); err != nil {
		t.Fatal(err)
	}

	// Already-encrypted file must be skipped untouched.
	mk := testMigrateMasterKey()
	var enc bytes.Buffer
	if err := mk.EncryptToFile(&enc, bytes.NewReader([]byte("already encrypted"))); err != nil {
		t.Fatal(err)
	}
	preEncFile := filepath.Join(mediaDir, "pre.bin")
	if err := os.WriteFile(preEncFile, enc.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}

	// Thumbnail stays plaintext by design.
	thumbDir := filepath.Join(root, "user1", "media", "thumbnails")
	if err := os.MkdirAll(thumbDir, 0o755); err != nil {
		t.Fatal(err)
	}
	thumbFile := filepath.Join(thumbDir, "abc.jpg")
	if err := os.WriteFile(thumbFile, []byte("thumb bytes"), 0o644); err != nil {
		t.Fatal(err)
	}

	files, encrypted, skipped, failed, _, _ := migrate(root, mk)
	if files != 2 || encrypted != 1 || skipped != 1 || failed != 0 {
		t.Fatalf("first run: files=%d encrypted=%d skipped=%d failed=%d, want 2/1/1/0",
			files, encrypted, skipped, failed)
	}

	// Media file is now PRE1 and round-trips.
	got, err := os.ReadFile(mediaFile)
	if err != nil {
		t.Fatal(err)
	}
	if !mw.IsEncrypted(got) {
		t.Fatal("media file not encrypted after migrate")
	}
	var dec bytes.Buffer
	if err := mk.DecryptFromFile(&dec, bytes.NewReader(got)); err != nil {
		t.Fatalf("decrypt migrated file: %v", err)
	}
	if !bytes.Equal(dec.Bytes(), plain) {
		t.Fatal("migrated file bytes changed")
	}

	// Thumbnail untouched.
	thumbGot, err := os.ReadFile(thumbFile)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(thumbGot, []byte("thumb bytes")) {
		t.Fatal("thumbnail should have stayed plaintext")
	}

	// Second run: everything skipped (thumbnail dir is not walked at all).
	files, encrypted, skipped, failed, _, _ = migrate(root, mk)
	if files != 2 || encrypted != 0 || skipped != 2 || failed != 0 {
		t.Fatalf("second run: files=%d encrypted=%d skipped=%d failed=%d, want 2/0/2/0",
			files, encrypted, skipped, failed)
	}
}

func testMigrateMasterKey() *mw.MasterKey {
	mk, err := mw.LoadMasterKey(bytes.Repeat([]byte{0x24}, 32))
	if err != nil {
		panic(err)
	}
	return mk
}