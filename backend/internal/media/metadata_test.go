package media

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"testing"
	"time"
)

// buildPNGHeader crafts minimal PNG bytes: signature + valid IHDR chunk
// declaring the given dimensions. image.DecodeConfig only needs the header,
// so no pixel data is required.
func buildPNGHeader(width, height uint32) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})

	var ihdr bytes.Buffer
	binary.Write(&ihdr, binary.BigEndian, width)
	binary.Write(&ihdr, binary.BigEndian, height)
	ihdr.Write([]byte{8, 2, 0, 0, 0}) // bit depth, color type RGB, compression, filter, interlace

	binary.Write(&buf, binary.BigEndian, uint32(ihdr.Len()))
	chunk := append([]byte("IHDR"), ihdr.Bytes()...)
	buf.Write(chunk)
	binary.Write(&buf, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return buf.Bytes()
}

// Regression: a crafted PNG declaring huge dimensions must be rejected by the
// cheap header check, before image.Decode allocates width*height*4 bytes.
func TestExtractImageMetadata_RejectsDecompressionBomb(t *testing.T) {
	data := buildPNGHeader(50000, 50000) // 2.5 GP > maxImagePixels
	_, err := ExtractImageMetadata(data)
	if err == nil {
		t.Fatal("expected error for oversized image dimensions")
	}
	if err != errImageTooLarge {
		t.Fatalf("expected errImageTooLarge, got %v", err)
	}
}

func TestValidateImageDimensions(t *testing.T) {
	if err := validateImageDimensions(4000, 3000); err != nil {
		t.Fatalf("expected 12MP image to pass, got %v", err)
	}
	if err := validateImageDimensions(maxImagePixels+1, 1); err == nil {
		t.Fatal("expected error when pixel count exceeds cap")
	}
	if err := validateImageDimensions(0, 100); err == nil {
		t.Fatal("expected error for zero width")
	}
}

// buildTIFF crafts a little-endian TIFF buffer: header at 0, IFDs placed at
// the given offsets, each IFD's "next IFD" pointer set from nextOffsets.
func buildTIFF(ifds map[uint32][]byte, nextOffsets map[uint32]uint32) []byte {
	var size uint32 = 46
	buf := make([]byte, size)
	buf[0], buf[1] = 'I', 'I'
	binary.LittleEndian.PutUint16(buf[2:4], 42) // TIFF magic
	binary.LittleEndian.PutUint32(buf[4:8], 8)  // IFD0 at offset 8

	for off, ifd := range ifds {
		copy(buf[off:], ifd)
		binary.LittleEndian.PutUint32(buf[off+uint32(len(ifd))-4:], nextOffsets[off])
	}
	return buf
}

// ifdBytes returns a 0-entry IFD body: 2-byte entry count + 4-byte next pointer.
func ifdBytes() []byte {
	return make([]byte, 6)
}

// Regression: a crafted TIFF whose IFD chain points backwards (A→B→A) used to
// spin parseIFD forever, hanging the request goroutine.
func TestParseTIFF_CyclicIFDChainTerminates(t *testing.T) {
	// IFD0 at 8 (6 bytes → ends 14) and IFD1 at 40 (6 bytes → ends 46).
	ifdA := ifdBytes()
	ifdB := ifdBytes()
	data := buildTIFF(map[uint32][]byte{8: ifdA, 40: ifdB}, map[uint32]uint32{8: 40, 40: 8})

	done := make(chan struct{})
	go func() {
		parseTIFF(data)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("parseTIFF did not terminate on cyclic IFD chain (infinite loop)")
	}
}

// Sanity: a well-formed single IFD still parses (empty EXIF, no capturedAt).
func TestParseTIFF_ValidSingleIFD(t *testing.T) {
	data := buildTIFF(map[uint32][]byte{8: ifdBytes()}, map[uint32]uint32{8: 0})
	exif, capturedAt := parseTIFF(data)
	if capturedAt != nil {
		t.Fatalf("expected nil capturedAt, got %v", *capturedAt)
	}
	if exif == nil {
		t.Fatal("expected non-nil exif map for valid TIFF")
	}
}
