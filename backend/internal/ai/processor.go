package ai

import (
	"fmt"
	"image"
	"os"

	"golang.org/x/image/draw"
)

const (
	ImageSize  = 224
	ImageMean  = 0.481
	ImageMean2 = 0.458
	ImageMean3 = 0.408
	ImageStd   = 0.269
	ImageStd2  = 0.261
	ImageStd3  = 0.276
)

func PreprocessImage(filePath string) ([]float32, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open image: %w", err)
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	src := img

	if bounds.Dx() != ImageSize || bounds.Dy() != ImageSize {
		dst := image.NewRGBA(image.Rect(0, 0, ImageSize, ImageSize))
		draw.BiLinear.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)
		src = dst
	}

	var rgba *image.RGBA
	switch s := src.(type) {
	case *image.RGBA:
		rgba = s
	default:
		rgba = image.NewRGBA(src.Bounds())
		draw.Draw(rgba, rgba.Bounds(), src, src.Bounds().Min, draw.Src)
	}

	tensor := make([]float32, 3*ImageSize*ImageSize)
	for y := 0; y < ImageSize; y++ {
		for x := 0; x < ImageSize; x++ {
			off := rgba.PixOffset(x, y)
			r := float32(rgba.Pix[off+0]) / 255.0
			g := float32(rgba.Pix[off+1]) / 255.0
			b := float32(rgba.Pix[off+2]) / 255.0

			tensor[0*ImageSize*ImageSize+y*ImageSize+x] = (r - ImageMean) / ImageStd
			tensor[1*ImageSize*ImageSize+y*ImageSize+x] = (g - ImageMean2) / ImageStd2
			tensor[2*ImageSize*ImageSize+y*ImageSize+x] = (b - ImageMean3) / ImageStd3
		}
	}

	return tensor, nil
}


