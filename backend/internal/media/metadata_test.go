package media

import (
	"encoding/binary"
	"testing"
	"time"
)

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
