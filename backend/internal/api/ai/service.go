package ai

import (
	"fmt"

	"github.com/ltless/prism/internal/ai"
	"github.com/ltless/prism/internal/sidecar"
)

// PathResolver validates and resolves a user-supplied file path against the
// caller's media directory. *media.Storage implements this in production.
type PathResolver interface {
	ResolveUserMediaPath(userID, filePath string) (string, error)
}

type AestheticScoreResponse struct {
	Score float32 `json:"score"`
	Raw   float32 `json:"raw"`
}

type TagResult struct {
	Tag      string  `json:"tag"`
	Score    float32 `json:"score"`
	Category string  `json:"category"`
}

type StatusResponse struct {
	ActiveVariant string   `json:"activeVariant"`
	Available     []string `json:"available"`
	Variants      []string `json:"variants"`
}

type Service struct {
	engine    Engine
	tokenizer *ai.Tokenizer
	resolver  PathResolver
	sidecar   *sidecar.Client
}

func NewService(engine Engine, tokenizer *ai.Tokenizer, resolver PathResolver) *Service {
	return &Service{
		engine:    engine,
		tokenizer: tokenizer,
		resolver:  resolver,
	}
}

func (s *Service) SetSidecarClient(c *sidecar.Client) {
	s.sidecar = c
}

func (s *Service) SidecarHealth() error {
	if s.sidecar == nil {
		return fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.Health()
}

func (s *Service) SidecarGPUStatus() (*sidecar.GPUStatus, error) {
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.GPUStatus()
}

func (s *Service) SidecarModelStatus() (*sidecar.ModelStatus, error) {
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.ModelStatus()
}

func (s *Service) resolvePath(userID, filePath string) (string, error) {
	if s.resolver == nil {
		return "", fmt.Errorf("path resolver not available")
	}
	return s.resolver.ResolveUserMediaPath(userID, filePath)
}

func (s *Service) EmbedImage(userID, filePath string) ([]float32, error) {
	if s.engine == nil {
		return nil, fmt.Errorf("AI engine not initialized")
	}
	if !s.engine.IsLoaded() {
		return nil, fmt.Errorf("model not loaded")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	return s.engine.EmbedImage(safePath)
}

func (s *Service) EmbedText(text string) ([]float32, error) {
	if s.engine == nil {
		return nil, fmt.Errorf("AI engine not initialized")
	}
	if !s.engine.IsLoaded() {
		return nil, fmt.Errorf("model not loaded")
	}
	if s.tokenizer == nil {
		return nil, fmt.Errorf("tokenizer not available")
	}
	return s.engine.EmbedText(text, s.tokenizer)
}

func (s *Service) GenerateTags(userID, filePath string, threshold float32) ([]TagResult, error) {
	if s.engine == nil {
		return nil, fmt.Errorf("AI engine not initialized")
	}
	if !s.engine.IsLoaded() {
		return nil, fmt.Errorf("model not loaded")
	}
	if s.tokenizer == nil {
		return nil, fmt.Errorf("tokenizer not available")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	tags, err := s.engine.GenerateTags(safePath, threshold, s.tokenizer)
	if err != nil {
		return nil, err
	}
	results := make([]TagResult, len(tags))
	for i, t := range tags {
		results[i] = TagResult{Tag: t.Tag, Score: t.Score, Category: t.Category}
	}
	return results, nil
}

func (s *Service) ScoreAesthetic(userID, filePath string) (*AestheticScoreResponse, error) {
	if s.engine == nil {
		return nil, fmt.Errorf("AI engine not initialized")
	}
	if !s.engine.IsLoaded() {
		return nil, fmt.Errorf("model not loaded")
	}
	if s.tokenizer == nil {
		return nil, fmt.Errorf("tokenizer not available")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	res, err := s.engine.ScoreAesthetic(safePath, s.tokenizer)
	if err != nil {
		return nil, err
	}
	return &AestheticScoreResponse{Score: res.Score, Raw: res.Raw}, nil
}

func (s *Service) LoadModel(variant string) error {
	if s.engine == nil {
		return fmt.Errorf("AI engine not initialized")
	}
	return s.engine.LoadModel(variant)
}

func (s *Service) DownloadModel(modelID string) (*sidecar.DownloadModelResult, error) {
	if s.sidecar == nil {
		return &sidecar.DownloadModelResult{Error: "sidecar not configured"}, nil
	}
	return s.sidecar.DownloadModel(sidecar.DownloadModelRequest{ModelID: modelID})
}

func (s *Service) HasGPU() bool {
	if s.engine == nil {
		return false
	}
	return s.engine.HasGPU()
}

func (s *Service) GetStatus() StatusResponse {
	if s.engine == nil {
		return StatusResponse{Variants: []string{"standard", "sharp", "high"}}
	}
	active := s.engine.GetActiveVariant()
	available := []string{}
	for _, v := range []string{"standard", "sharp", "high"} {
		if s.engine.CheckModelExists(v) {
			available = append(available, v)
		}
	}
	return StatusResponse{
		ActiveVariant: active,
		Available:     available,
		Variants:      []string{"standard", "sharp", "high"},
	}
}
