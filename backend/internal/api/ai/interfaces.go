package ai

import "github.com/ltless/prism/internal/ai"

type Engine interface {
	IsLoaded() bool
	EmbedImage(filePath string) ([]float32, error)
	EmbedText(text string, tokenizer *ai.Tokenizer) ([]float32, error)
	GenerateTags(filePath string, threshold float32, tokenizer *ai.Tokenizer) ([]ai.TagResult, error)
	ScoreAesthetic(filePath string, tokenizer *ai.Tokenizer) (*ai.AestheticResult, error)
	LoadModel(variant string) error
	HasGPU() bool
	GetActiveVariant() string
	CheckModelExists(variant string) bool
}