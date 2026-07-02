package media

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// Envelope encryption for media files.
//
// On-disk layout for every encrypted file:
//
//	magic       [4]byte   "PRE1"
//	wrapNonce   [12]byte  nonce used to wrap this file's data key
//	wrappedDEK  [48]byte  AES-256-GCM(masterKey, wrapNonce, dek) -> 32-byte key + 16-byte tag
//
// followed by a stream of chunks, each:
//
//	chunkLen    uint32 big-endian — plaintext length of this chunk
//	chunkNonce  [12]byte
//	ciphertext  chunkLen+16 bytes — AES-256-GCM(dek, chunkNonce, plaintext)
//
// Every file gets its own random 256-bit data-encryption-key (DEK). The DEK
// is wrapped with a single master key (KEK) so the master key never touches
// file content directly, and rotating it later only means re-wrapping DEKs,
// not re-encrypting every photo on disk.
//
// Chunking (1 MiB/chunk, each with its own nonce + auth tag) means: large
// video files stream through without ever sitting fully in memory, and a
// corrupted/tampered chunk is caught immediately at that chunk instead of
// only being detected after reading the entire file.

const (
	encMagic   = "PRE1"
	chunkSize  = 1 << 20 // 1 MiB of plaintext per chunk
	nonceSize  = 12
	keySize    = 32
	gcmTagSize = 16
	headerSize = 4 + nonceSize + keySize + gcmTagSize // magic + wrapNonce + wrappedDEK
)

// ErrNotEncrypted is returned by DecryptFromFile when the source does not
// start with the prism encryption magic bytes — e.g. a pre-migration
// plaintext file, or something that isn't a prism media file at all.
var ErrNotEncrypted = errors.New("media: file is not in prism encrypted format")

// MasterKey is the server-wide key-encryption-key used to wrap per-file
// data keys. It lives only in memory, loaded once at process startup from
// ENCRYPTION_MASTER_KEY. It is never written to disk and never used to
// encrypt file bytes directly — only to wrap/unwrap per-file DEKs.
type MasterKey struct {
	key [keySize]byte
}

// LoadMasterKey builds a MasterKey from raw 32-byte key material, as
// produced by e.g. `openssl rand -hex 32` and hex/base64-decoded by the
// caller before this is called. Fail closed: wrong length is a config
// error, never silently truncated or padded.
func LoadMasterKey(raw []byte) (*MasterKey, error) {
	if len(raw) != keySize {
		return nil, fmt.Errorf("master key must be %d bytes, got %d", keySize, len(raw))
	}
	mk := &MasterKey{}
	copy(mk.key[:], raw)
	return mk, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func randomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return b, nil
}

func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// wrapDEK encrypts a freshly generated per-file data key under the master key.
func (mk *MasterKey) wrapDEK(dek []byte) (nonce, wrapped []byte, err error) {
	gcm, err := newGCM(mk.key[:])
	if err != nil {
		return nil, nil, err
	}
	nonce, err = randomBytes(nonceSize)
	if err != nil {
		return nil, nil, err
	}
	wrapped = gcm.Seal(nil, nonce, dek, nil)
	return nonce, wrapped, nil
}

// unwrapDEK reverses wrapDEK. A failure here almost always means either the
// wrong master key is loaded, or the file's header bytes were corrupted —
// both are treated as fatal for that file, never silently ignored.
func (mk *MasterKey) unwrapDEK(nonce, wrapped []byte) ([]byte, error) {
	gcm, err := newGCM(mk.key[:])
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, wrapped, nil)
}

// EncryptToFile streams src through AES-256-GCM in fixed-size chunks,
// writing the envelope header followed by the ciphertext chunks to dst.
// Call this in place of a plain io.Copy wherever media bytes are written
// to disk (uploads, editor saves, profile images, generated thumbnails).
func (mk *MasterKey) EncryptToFile(dst io.Writer, src io.Reader) error {
	dek, err := randomBytes(keySize)
	if err != nil {
		return err
	}
	defer zero(dek)

	wrapNonce, wrappedDEK, err := mk.wrapDEK(dek)
	if err != nil {
		return fmt.Errorf("wrap data key: %w", err)
	}

	if _, err := dst.Write([]byte(encMagic)); err != nil {
		return err
	}
	if _, err := dst.Write(wrapNonce); err != nil {
		return err
	}
	if _, err := dst.Write(wrappedDEK); err != nil {
		return err
	}

	gcm, err := newGCM(dek)
	if err != nil {
		return err
	}

	buf := make([]byte, chunkSize)
	lenBuf := make([]byte, 4)
	for {
		n, readErr := io.ReadFull(src, buf)
		if n > 0 {
			nonce, err := randomBytes(nonceSize)
			if err != nil {
				return err
			}
			ciphertext := gcm.Seal(nil, nonce, buf[:n], nil)

			binary.BigEndian.PutUint32(lenBuf, uint32(n))
			if _, err := dst.Write(lenBuf); err != nil {
				return err
			}
			if _, err := dst.Write(nonce); err != nil {
				return err
			}
			if _, err := dst.Write(ciphertext); err != nil {
				return err
			}
		}
		if readErr == io.EOF || readErr == io.ErrUnexpectedEOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("read plaintext: %w", readErr)
		}
	}
	return nil
}

// DecryptFromFile reverses EncryptToFile, verifying and streaming each
// chunk to dst as it goes. Any authentication failure — wrong key, or a
// tampered/corrupted byte anywhere in the file — aborts immediately and
// nothing further is written. Never serve partially-decrypted output.
func (mk *MasterKey) DecryptFromFile(dst io.Writer, src io.Reader) error {
	header := make([]byte, headerSize)
	if _, err := io.ReadFull(src, header); err != nil {
		return fmt.Errorf("read header: %w", err)
	}
	if string(header[:4]) != encMagic {
		return ErrNotEncrypted
	}
	wrapNonce := header[4 : 4+nonceSize]
	wrappedDEK := header[4+nonceSize:]

	dek, err := mk.unwrapDEK(wrapNonce, wrappedDEK)
	if err != nil {
		return fmt.Errorf("unwrap data key (wrong master key or corrupted file): %w", err)
	}
	defer zero(dek)

	gcm, err := newGCM(dek)
	if err != nil {
		return err
	}

	lenBuf := make([]byte, 4)
	nonceBuf := make([]byte, nonceSize)
	for {
		if _, err := io.ReadFull(src, lenBuf); err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("read chunk length: %w", err)
		}
		n := binary.BigEndian.Uint32(lenBuf)
		if n > chunkSize {
			// chunkLen is attacker-readable from the file: a huge value here
			// would otherwise force a multi-GB allocation per chunk (OOM DoS
			// on serve of a tampered file). EncryptToFile never writes more
			// than chunkSize plaintext per chunk, so anything larger is
			// corrupt and can fail fast without reading further.
			return fmt.Errorf("invalid chunk length %d (max %d)", n, chunkSize)
		}

		if _, err := io.ReadFull(src, nonceBuf); err != nil {
			return fmt.Errorf("read chunk nonce: %w", err)
		}

		ciphertext := make([]byte, int(n)+gcmTagSize)
		if _, err := io.ReadFull(src, ciphertext); err != nil {
			return fmt.Errorf("read chunk data: %w", err)
		}

		plaintext, err := gcm.Open(nil, nonceBuf, ciphertext, nil)
		if err != nil {
			return fmt.Errorf("chunk failed authentication (corrupted or tampered): %w", err)
		}
		if _, err := dst.Write(plaintext); err != nil {
			return err
		}
	}
	return nil
}

// IsEncrypted peeks at the first 4 bytes of a reader to check for the prism
// magic header, without consuming bytes needed later — useful during the
// plaintext-to-encrypted migration to skip files already converted.
func IsEncrypted(peek []byte) bool {
	return len(peek) >= 4 && string(peek[:4]) == encMagic
}