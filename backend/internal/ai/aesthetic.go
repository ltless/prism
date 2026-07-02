package ai

import "math"

var aestheticPairs = [][2]string{
	{"aesthetic photo", "ugly photo"},
	{"beautiful photo", "ugly photo"},
	{"high quality photo", "low quality photo"},
	{"pleasing composition", "bad composition"},
	{"professional photography", "amateur photo"},
	{"visually appealing", "visually unappealing"},
}

type AestheticResult struct {
	Score float32 `json:"score"`
	Raw   float32 `json:"raw"`
}

func (e *Engine) ScoreAesthetic(filePath string, tokenizer *Tokenizer) (*AestheticResult, error) {
	imageEmb, err := e.EmbedImage(filePath)
	if err != nil {
		return nil, err
	}

	n := len(aestheticPairs)
	posTexts := make([]string, n)
	negTexts := make([]string, n)
	for i, pair := range aestheticPairs {
		posTexts[i] = "a photo of " + pair[0]
		negTexts[i] = "a photo of " + pair[1]
	}

	posIDs, posMask := tokenizer.EncodeTexts(posTexts)
	negIDs, negMask := tokenizer.EncodeTexts(negTexts)

	posEmb, err := e.RunText(posIDs, posMask)
	if err != nil {
		return nil, err
	}

	negEmb, err := e.RunText(negIDs, negMask)
	if err != nil {
		return nil, err
	}

	var total float64
	dim := len(imageEmb)
	for i := 0; i < n; i++ {
		var posDot, negDot float64
		for j := 0; j < dim; j++ {
			posDot += float64(imageEmb[j]) * float64(posEmb[i*dim+j])
			negDot += float64(imageEmb[j]) * float64(negEmb[i*dim+j])
		}
		posDot *= 100.0
		negDot *= 100.0

		maxVal := posDot
		if negDot > maxVal {
			maxVal = negDot
		}

		posExp := float64(exp32(float32(posDot - maxVal)))
		negExp := float64(exp32(float32(negDot - maxVal)))
		total += posExp / (posExp + negExp)
	}

	raw := float32(total / float64(n))

	score := 1.0 + raw*9.0

	return &AestheticResult{
		Score: float32(score),
		Raw:   raw,
	}, nil
}

func exp32(x float32) float32 {
	return float32(math.Exp(float64(x)))
}
