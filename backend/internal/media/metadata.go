package media

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"math"
	"time"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"golang.org/x/image/draw"
)

type ImageMetadata struct {
	Width      int
	Height     int
	CapturedAt *int64
	ExifData   map[string]interface{}
	Palette    []string
}

func ExtractImageMetadata(data []byte) (*ImageMetadata, error) {
	src, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}

	meta := &ImageMetadata{
		Width:    src.Bounds().Dx(),
		Height:   src.Bounds().Dy(),
		ExifData: make(map[string]interface{}),
	}

	if format == "jpeg" {
		if exif, capturedAt := parseJPEGEXIF(data); exif != nil {
			meta.ExifData = exif
			if capturedAt != nil {
				meta.CapturedAt = capturedAt
			}
		}
	}

	meta.Palette = extractPalette(src)

	return meta, nil
}

func extractPalette(src image.Image) []string {
	dst := image.NewRGBA(image.Rect(0, 0, 32, 32))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)

	type bucket struct {
		rSum, gSum, bSum uint64
		count            uint64
	}
	buckets := make(map[[3]uint8]*bucket)

	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			off := (y*32 + x) * 4
			r := dst.Pix[off]
			g := dst.Pix[off+1]
			b := dst.Pix[off+2]
			key := [3]uint8{r / 16 * 16, g / 16 * 16, b / 16 * 16}
			if _, ok := buckets[key]; !ok {
				buckets[key] = &bucket{}
			}
			buckets[key].rSum += uint64(r)
			buckets[key].gSum += uint64(g)
			buckets[key].bSum += uint64(b)
			buckets[key].count++
		}
	}

	type paletteColor struct {
		r, g, b uint8
		count   uint64
	}
	var colors []paletteColor
	for _, b := range buckets {
		colors = append(colors, paletteColor{
			r:     uint8(b.rSum / b.count),
			g:     uint8(b.gSum / b.count),
			b:     uint8(b.bSum / b.count),
			count: b.count,
		})
	}

	for i := 0; i < len(colors); i++ {
		for j := i + 1; j < len(colors); j++ {
			if colors[j].count > colors[i].count {
				colors[i], colors[j] = colors[j], colors[i]
			}
		}
	}

	const minDist = 45.0
	var selected []paletteColor
	dist := func(a, b paletteColor) float64 {
		dr := float64(a.r) - float64(b.r)
		dg := float64(a.g) - float64(b.g)
		db := float64(a.b) - float64(b.b)
		return math.Sqrt(dr*dr + dg*dg + db*db)
	}

	for _, c := range colors {
		tooClose := false
		for _, s := range selected {
			if dist(c, s) < minDist {
				tooClose = true
				break
			}
		}
		if !tooClose {
			selected = append(selected, c)
			if len(selected) >= 5 {
				break
			}
		}
	}

	palette := make([]string, 0, len(selected))
	for _, c := range selected {
		palette = append(palette, fmt.Sprintf("#%02x%02x%02x", c.r, c.g, c.b))
	}
	return palette
}

func parseJPEGEXIF(data []byte) (map[string]interface{}, *int64) {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return nil, nil
	}

	pos := 2
	for pos+1 < len(data) {
		if data[pos] != 0xFF {
			break
		}
		marker := data[pos+1]
		if marker == 0xD8 || marker == 0xD9 || marker == 0x00 {
			pos++
			continue
		}
		if pos+3 >= len(data) {
			break
		}
		length := int(data[pos+2])<<8 | int(data[pos+3])
		if length == 0 {
			break
		}
		if marker == 0xE1 && length+2 <= len(data)-pos {
			exifBytes := data[pos+4 : pos+2+length]
			if len(exifBytes) >= 6 && string(exifBytes[:4]) == "Exif" && exifBytes[4] == 0 && exifBytes[5] == 0 {
				return parseTIFF(exifBytes[6:])
			}
		}
		pos += 2 + length
	}
	return nil, nil
}

func parseTIFF(data []byte) (map[string]interface{}, *int64) {
	if len(data) < 8 {
		return nil, nil
	}

	var bo binary.ByteOrder
	if data[0] == 'I' && data[1] == 'I' {
		bo = binary.LittleEndian
	} else if data[0] == 'M' && data[1] == 'M' {
		bo = binary.BigEndian
	} else {
		return nil, nil
	}

	tiffMagic := bo.Uint16(data[2:4])
	if tiffMagic != 42 {
		return nil, nil
	}

	ifdOffset := int(bo.Uint32(data[4:8]))
	if ifdOffset < 8 || ifdOffset >= len(data) {
		return nil, nil
	}

	exif := make(map[string]interface{})
	var capturedAt *int64

	var parseIFD func(offset int) int
	parseIFD = func(offset int) int {
		if offset+2 > len(data) {
			return 0
		}
		count := int(bo.Uint16(data[offset : offset+2]))
		offset += 2

		var exifIFDOffset, gpsIFDOffset int

		for i := 0; i < count && offset+12 <= len(data); i++ {
			tag := bo.Uint16(data[offset : offset+2])
			typ := bo.Uint16(data[offset+2 : offset+4])
			valOffset := offset + 8

			rawVal := readEXIFValue(data, bo, typ, valOffset)

			switch tag {
			case 0x010F:
				if s, ok := rawVal.(string); ok {
					exif["make"] = s
				}
			case 0x0110:
				if s, ok := rawVal.(string); ok {
					exif["model"] = s
				}
			case 0x0112:
				if n, ok := rawVal.(int); ok && n >= 1 && n <= 8 {
					exif["orientation"] = n
				}
			case 0x0131:
				if s, ok := rawVal.(string); ok {
					exif["software"] = s
				}
			case 0x8769:
				if n, ok := rawVal.(int); ok {
					exifIFDOffset = n
				}
			case 0x8825:
				if n, ok := rawVal.(int); ok {
					gpsIFDOffset = n
				}
			case 0x0132:
				if s, ok := rawVal.(string); ok {
					if t, err := time.Parse("2006:01:02 15:04:05", s); err == nil {
						unix := t.Unix()
						capturedAt = &unix
					}
				}
			case 0x9003:
				if s, ok := rawVal.(string); ok {
					if capturedAt == nil {
						if t, err := time.Parse("2006:01:02 15:04:05", s); err == nil {
							unix := t.Unix()
							capturedAt = &unix
						}
					}
				}
			}

			offset += 12
		}

		if exifIFDOffset > 0 && exifIFDOffset < len(data) {
			parseExifIFD(data, bo, exifIFDOffset, exif)
		}
		if gpsIFDOffset > 0 && gpsIFDOffset < len(data) {
			parseGPSIFD(data, bo, gpsIFDOffset, exif)
		}

		if offset+4 <= len(data) {
			return int(bo.Uint32(data[offset : offset+4]))
		}
		return 0
	}

	nextIFD := parseIFD(ifdOffset)
	for nextIFD > 0 && nextIFD < len(data) {
		nextIFD = parseIFD(nextIFD)
	}

	return exif, capturedAt
}

func parseExifIFD(data []byte, bo binary.ByteOrder, offset int, exif map[string]interface{}) {
	if offset+2 > len(data) {
		return
	}
	count := int(bo.Uint16(data[offset : offset+2]))
	offset += 2

	for i := 0; i < count && offset+12 <= len(data); i++ {
		tag := bo.Uint16(data[offset : offset+2])
		typ := bo.Uint16(data[offset+2 : offset+4])
		valOffset := offset + 8

		rawVal := readEXIFValue(data, bo, typ, valOffset)

		switch tag {
		case 0x829A:
			if f, ok := rawVal.(float64); ok {
				exif["exposure"] = f
			}
		case 0x829D:
			if f, ok := rawVal.(float64); ok {
				exif["f_number"] = f
			}
		case 0x8827:
			if n, ok := rawVal.(int); ok {
				exif["iso"] = n
			}
		case 0x920A:
			if f, ok := rawVal.(float64); ok {
				exif["focal_length"] = f
			}
		case 0xA433:
			if s, ok := rawVal.(string); ok {
				exif["lens"] = s
			}
		case 0x9209:
			if f, ok := rawVal.(float64); ok {
				exif["flash"] = f
			}
		case 0xA403:
			if n, ok := rawVal.(int); ok {
				exif["white_balance"] = n
			}
		case 0x9207:
			if n, ok := rawVal.(int); ok {
				exif["metering_mode"] = n
			}
		case 0x8822:
			if n, ok := rawVal.(int); ok {
				exif["exposure_program"] = n
			}
		case 0xA001:
			if n, ok := rawVal.(int); ok {
				exif["color_space"] = n
			}
		}

		offset += 12
	}
}

func parseGPSIFD(data []byte, bo binary.ByteOrder, offset int, exif map[string]interface{}) {
	if offset+2 > len(data) {
		return
	}
	count := int(bo.Uint16(data[offset : offset+2]))
	offset += 2

	var latRef, lngRef string
	var latRational, lngRational [3]float64
	hasLat, hasLng := false, false

	for i := 0; i < count && offset+12 <= len(data); i++ {
		tag := bo.Uint16(data[offset : offset+2])
		typ := bo.Uint16(data[offset+2 : offset+4])
		valOffset := offset + 8

		switch tag {
		case 0x0001:
			latRef = readEXIFValue(data, bo, typ, valOffset).(string)
		case 0x0002:
			if v, ok := readGPSRationals(data, bo, typ, valOffset); ok {
				latRational = v
				hasLat = true
			}
		case 0x0003:
			lngRef = readEXIFValue(data, bo, typ, valOffset).(string)
		case 0x0004:
			if v, ok := readGPSRationals(data, bo, typ, valOffset); ok {
				lngRational = v
				hasLng = true
			}
		}

		offset += 12
	}

	if hasLat && hasLng {
		lat := gpsRationalToDeg(latRational)
		lng := gpsRationalToDeg(lngRational)
		if latRef == "S" {
			lat = -lat
		}
		if lngRef == "W" {
			lng = -lng
		}
		exif["lat"] = lat
		exif["lng"] = lng
	}
}

func readGPSRationals(data []byte, bo binary.ByteOrder, typ uint16, offset int) ([3]float64, bool) {
	if typ != 5 && typ != 10 {
		return [3]float64{}, false
	}

	var ptr int
	if offset+4 <= len(data) {
		ptr = int(bo.Uint32(data[offset : offset+4]))
	} else {
		return [3]float64{}, false
	}

	var result [3]float64
	for i := 0; i < 3 && ptr+8 <= len(data); i++ {
		num := int32(bo.Uint32(data[ptr : ptr+4]))
		den := int32(bo.Uint32(data[ptr+4 : ptr+8]))
		if den != 0 {
			result[i] = float64(num) / float64(den)
		}
		ptr += 8
	}
	return result, true
}

func gpsRationalToDeg(r [3]float64) float64 {
	return r[0] + r[1]/60.0 + r[2]/3600.0
}

func readEXIFValue(data []byte, bo binary.ByteOrder, typ uint16, offset int) interface{} {
	var count uint32
	if offset+4 <= len(data) {
		count = bo.Uint32(data[offset : offset+4])
	} else {
		return nil
	}

	switch typ {
	case 2:
		if offset+4 <= len(data) && int(count) <= len(data)-int(bo.Uint32(data[offset:offset+4])) {
			ptr := int(bo.Uint32(data[offset : offset+4]))
			end := ptr + int(count)
			if count > 4 {
				if end > len(data) {
					end = len(data)
				}
				s := string(bytes.TrimRight(data[ptr:end], "\x00"))
				return s
			}
			s := string(bytes.TrimRight(data[offset:offset+int(count)], "\x00"))
			return s
		}
	case 3:
		return int(bo.Uint16(data[offset : offset+2]))
	case 4, 9:
		return int(bo.Uint32(data[offset : offset+4]))
	case 5, 10:
		if offset+4 <= len(data) {
			ptr := int(bo.Uint32(data[offset : offset+4]))
			if ptr+8 <= len(data) {
				num := int32(bo.Uint32(data[ptr : ptr+4]))
				den := int32(bo.Uint32(data[ptr+4 : ptr+8]))
				if den != 0 {
					return float64(num) / float64(den)
				}
			}
		}
	case 7:
		return nil
	}
	return nil
}

type ImageInfo struct {
	Width  int
	Height int
}

func GetImageInfo(data []byte) (*ImageInfo, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	return &ImageInfo{Width: cfg.Width, Height: cfg.Height}, nil
}
