package ai

import (
	"fmt"
	"math"
)

func L2Normalize(vec []float32) []float32 {
	var sum float64
	for _, v := range vec {
		sum += float64(v) * float64(v)
	}
	norm := float32(math.Sqrt(sum))
	if norm == 0 {
		return vec
	}
	out := make([]float32, len(vec))
	for i, v := range vec {
		out[i] = v / norm
	}
	return out
}

func (e *Engine) EmbedImage(filePath string) ([]float32, error) {
	pixels, err := PreprocessImage(filePath)
	if err != nil {
		return nil, fmt.Errorf("preprocess image: %w", err)
	}

	emb, err := e.RunVision(pixels)
	if err != nil {
		return nil, fmt.Errorf("run vision: %w", err)
	}

	return L2Normalize(emb), nil
}

func (e *Engine) EmbedText(text string, tokenizer *Tokenizer) ([]float32, error) {
	inputIDs, attentionMask := tokenizer.EncodeTexts([]string{text})

	emb, err := e.RunText(inputIDs, attentionMask)
	if err != nil {
		return nil, fmt.Errorf("run text: %w", err)
	}

	return L2Normalize(emb), nil
}

func (e *Engine) GetLogits(filePath string, texts []string, tokenizer *Tokenizer) ([]float32, error) {
	pixels, err := PreprocessImage(filePath)
	if err != nil {
		return nil, fmt.Errorf("preprocess image: %w", err)
	}

	imageEmb, err := e.RunVision(pixels)
	if err != nil {
		return nil, fmt.Errorf("run vision: %w", err)
	}
	imageNorm := L2Normalize(imageEmb)

	inputIDs, attentionMask := tokenizer.EncodeTexts(texts)

	textEmb, err := e.RunText(inputIDs, attentionMask)
	if err != nil {
		return nil, fmt.Errorf("run text: %w", err)
	}

	textNorm := L2Normalize(textEmb)

	n := len(texts)
	if len(imageNorm) == 0 {
		return nil, fmt.Errorf("empty image embedding")
	}
	dim := len(imageNorm)
	logits := make([]float32, n)
	for i := 0; i < n; i++ {
		var dot float64
		for j := 0; j < dim; j++ {
			dot += float64(imageNorm[j]) * float64(textNorm[i*dim+j])
		}
		logits[i] = float32(dot * 100.0)
	}

	return logits, nil
}
