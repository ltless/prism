package media

import (
	"bytes"
	"errors"
	"fmt"
	"testing"
)

func testMasterKey() *MasterKey {
	mk, err := LoadMasterKey(bytes.Repeat([]byte{0x42}, keySize))
	if err != nil {
		panic(err)
	}
	return mk
}

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	sizes := []int{0, 1, chunkSize, chunkSize + 1, 5*chunkSize/2 + 13}
	mk := testMasterKey()
	for _, size := range sizes {
		t.Run(fmt.Sprintf("%d bytes", size), func(t *testing.T) {
			input := make([]byte, size)
			for i := range input {
				input[i] = byte(i*31 + size)
			}
			if size > 0 {
				input[0] = byte(size) // make the first byte content-dependent
			}

			var enc bytes.Buffer
			if err := mk.EncryptToFile(&enc, bytes.NewReader(input)); err != nil {
				t.Fatalf("encrypt: %v", err)
			}
			if size > 0 && !IsEncrypted(enc.Bytes()[:4]) {
				t.Fatal("encrypted output missing magic header")
			}

			var dec bytes.Buffer
			if err := mk.DecryptFromFile(&dec, bytes.NewReader(enc.Bytes())); err != nil {
				t.Fatalf("decrypt: %v", err)
			}
			if !bytes.Equal(dec.Bytes(), input) {
				t.Fatalf("round-trip mismatch: got %d bytes, want %d", dec.Len(), size)
			}
		})
	}
}

func TestEncryptDecrypt_EmptyFile_ProducesHeaderOnly(t *testing.T) {
	var enc bytes.Buffer
	mk := testMasterKey()
	if err := mk.EncryptToFile(&enc, bytes.NewReader(nil)); err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if enc.Len() != headerSize {
		t.Fatalf("empty file should be header-only (%d bytes), got %d", headerSize, enc.Len())
	}
	var dec bytes.Buffer
	if err := mk.DecryptFromFile(&dec, bytes.NewReader(enc.Bytes())); err != nil {
		t.Fatalf("decrypt empty: %v", err)
	}
	if dec.Len() != 0 {
		t.Fatalf("expected empty plaintext, got %d bytes", dec.Len())
	}
}

// flipBit flips bit at bitOffset (0-based bit index from start of data).
func flipBit(data []byte, bitOffset int) {
	data[bitOffset/8] ^= 1 << (bitOffset % 8)
}

func TestEncryptDecrypt_TamperDetection(t *testing.T) {
	input := bytes.Repeat([]byte{0xAB, 0xCD}, chunkSize/2+1234)
	mk := testMasterKey()

	var enc bytes.Buffer
	if err := mk.EncryptToFile(&enc, bytes.NewReader(input)); err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	// Flip one bit in the first ciphertext chunk and one in the second.
	for _, bitOffset := range []int{headerSize * 8, (headerSize + 4 + nonceSize + 100) * 8} {
		if bitOffset/8 >= enc.Len() {
			continue
		}
		corrupt := append([]byte(nil), enc.Bytes()...)
		flipBit(corrupt, bitOffset)
		var dec bytes.Buffer
		err := mk.DecryptFromFile(&dec, bytes.NewReader(corrupt))
		if err == nil {
			t.Fatalf("expected auth failure after flipping bit %d", bitOffset)
		}
		if dec.Len() != 0 {
			t.Fatal("no partial output may be produced on tamper")
		}
	}
}

func TestEncryptDecrypt_WrongMasterKey(t *testing.T) {
	input := []byte("some plaintext that must not decrypt with the wrong key")
	mkA := testMasterKey()
	other := bytes.Repeat([]byte{0x7E}, keySize)
	mkB, err := LoadMasterKey(other)
	if err != nil {
		t.Fatal(err)
	}

	var enc bytes.Buffer
	if err := mkA.EncryptToFile(&enc, bytes.NewReader(input)); err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	var dec bytes.Buffer
	err = mkB.DecryptFromFile(&dec, bytes.NewReader(enc.Bytes()))
	if err == nil {
		t.Fatal("expected decrypt failure with wrong master key")
	}
	if errors.Is(err, ErrNotEncrypted) {
		t.Fatal("wrong master key must not be reported as not-encrypted")
	}
}

func TestDecryptFromFile_NotEncrypted(t *testing.T) {
	mk := testMasterKey()

	// Pre-migration plaintext JPEG beginning with the JPEG SOI marker. Longer
	// than the envelope header so the magic check is the deciding signal.
	jpeg := make([]byte, 80)
	copy(jpeg, []byte{0xFF, 0xD8, 0xFF, 0xE0, 'J', 'F', 'I', 'F', 0, 1, 0, 0})
	var dec bytes.Buffer
	err := mk.DecryptFromFile(&dec, bytes.NewReader(jpeg))
	if !errors.Is(err, ErrNotEncrypted) {
		t.Fatalf("expected ErrNotEncrypted, got: %v", err)
	}
}

func TestIsEncrypted(t *testing.T) {
	if !IsEncrypted([]byte(encMagic)) {
		t.Fatal("expected PRE1 magic to be detected")
	}
	if IsEncrypted([]byte{0xFF, 0xD8, 0xFF, 0xE0}) {
		t.Fatal("expected JPEG magic to be rejected")
	}
	if IsEncrypted([]byte("PR")) {
		t.Fatal("short input must not be encrypted")
	}
}

func TestDecryptFromFile_HugeChunkLen_Rejected(t *testing.T) {
	mk := testMasterKey()
	input := bytes.Repeat([]byte{0x11}, 1024)
	var enc bytes.Buffer
	if err := mk.EncryptToFile(&enc, bytes.NewReader(input)); err != nil {
		t.Fatal(err)
	}
	// Corrupt the first chunk's plaintext length so it claims ~4GiB.
	tampered := append([]byte(nil), enc.Bytes()...)
	tampered[headerSize] = 0xFF
	tampered[headerSize+1] = 0xFF
	tampered[headerSize+2] = 0xFF
	tampered[headerSize+3] = 0xFE
	var dec bytes.Buffer
	err := mk.DecryptFromFile(&dec, bytes.NewReader(tampered))
	if err == nil {
		t.Fatal("expected error for implausible chunk length")
	}
	if dec.Len() != 0 {
		t.Fatal("no output may be produced for an invalid chunk length")
	}
}
