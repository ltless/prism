package ai

import (
	"errors"
	"fmt"

	"github.com/ltless/prism/internal/api/config"
	"github.com/ltless/prism/internal/sidecar"
)

var ErrAIInactive = errors.New("AI is not active")

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
	resolver PathResolver
	sidecar  *sidecar.Client
	checker  config.ActiveChecker
}

func NewService(resolver PathResolver, sc *sidecar.Client, checker config.ActiveChecker) *Service {
	return &Service{
		resolver: resolver,
		sidecar:  sc,
		checker:  checker,
	}
}

func (s *Service) SetSidecarClient(c *sidecar.Client) {
	s.sidecar = c
}

// enforceActive blocks AI work when opted-out. A nil checker fails open
// (allows) so misconfiguration never hard-blocks; production always sets one.
func (s *Service) enforceActive() error {
	if s.checker == nil {
		return nil
	}
	active, err := s.checker.IsAIActive()
	if err != nil {
		return fmt.Errorf("check ai active: %w", err)
	}
	if !active {
		return ErrAIInactive
	}
	return nil
}

func (s *Service) loadModelOnServer(modelID string) error {
	if s.sidecar == nil {
		return fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.LoadModel(sidecar.LoadModelRequest{ModelID: modelID})
}

func (s *Service) unloadAllOnServer() error {
	if s.sidecar == nil {
		return fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.UnloadAll()
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
	if err := s.enforceActive(); err != nil {
		return nil, err
	}
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	return s.sidecar.EmbedImage(safePath, "high")
}

func (s *Service) EmbedText(text string) ([]float32, error) {
	if err := s.enforceActive(); err != nil {
		return nil, err
	}
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	return s.sidecar.EmbedText(text, "high")
}

func (s *Service) GenerateTags(userID, filePath string, threshold float32) ([]TagResult, error) {
	if err := s.enforceActive(); err != nil {
		return nil, err
	}
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	tags, err := s.sidecar.GenerateTags(safePath, nil, threshold, "high")
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
	if err := s.enforceActive(); err != nil {
		return nil, err
	}
	if s.sidecar == nil {
		return nil, fmt.Errorf("sidecar not configured")
	}
	safePath, err := s.resolvePath(userID, filePath)
	if err != nil {
		return nil, err
	}
	res, err := s.sidecar.ScoreAesthetic(safePath, "laion", "high")
	if err != nil {
		return nil, err
	}
	return &AestheticScoreResponse{Score: res.Score, Raw: res.Raw}, nil
}

func (s *Service) LoadModel(modelID string) error {
	if err := s.enforceActive(); err != nil {
		return err
	}
	return s.loadModelOnServer(modelID)
}

func (s *Service) Unload() error {
	return s.unloadAllOnServer()
}

func (s *Service) DownloadModel(modelID string) (*sidecar.DownloadModelResult, error) {
	if err := s.enforceActive(); err != nil {
		return nil, err
	}
	if s.sidecar == nil {
		return &sidecar.DownloadModelResult{Error: "sidecar not configured"}, nil
	}
	return s.sidecar.DownloadModel(sidecar.DownloadModelRequest{ModelID: modelID})
}

func (s *Service) HasGPU() bool {
	return s.sidecar != nil
}

func (s *Service) GetStatus() StatusResponse {
	return StatusResponse{Variants: []string{"standard", "sharp", "high"}}
}
