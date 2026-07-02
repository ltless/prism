package ai

import (
	"testing"

	"github.com/ltless/prism/internal/ai"
)

type mockEngine struct {
	isLoaded         bool
	embedImageFn     func(string) ([]float32, error)
	embedTextFn      func(string, *ai.Tokenizer) ([]float32, error)
	generateTagsFn   func(string, float32, *ai.Tokenizer) ([]ai.TagResult, error)
	scoreAestheticFn func(string, *ai.Tokenizer) (*ai.AestheticResult, error)
	loadModelFn      func(string) error
	hasGPU           bool
	activeVariant    string
	checkExistsFn    func(string) bool
}

type mockResolver struct{}

func (m *mockResolver) ResolveUserMediaPath(userID, filePath string) (string, error) {
	return filePath, nil
}

func (m *mockEngine) IsLoaded() bool                                              { return m.isLoaded }
func (m *mockEngine) EmbedImage(p string) ([]float32, error)                      { return m.embedImageFn(p) }
func (m *mockEngine) EmbedText(t string, tok *ai.Tokenizer) ([]float32, error)    { return m.embedTextFn(t, tok) }
func (m *mockEngine) GenerateTags(p string, th float32, tok *ai.Tokenizer) ([]ai.TagResult, error) {
	return m.generateTagsFn(p, th, tok)
}
func (m *mockEngine) ScoreAesthetic(p string, tok *ai.Tokenizer) (*ai.AestheticResult, error) {
	return m.scoreAestheticFn(p, tok)
}
func (m *mockEngine) LoadModel(v string) error                    { return m.loadModelFn(v) }
func (m *mockEngine) HasGPU() bool                                { return m.hasGPU }
func (m *mockEngine) GetActiveVariant() string                    { return m.activeVariant }
func (m *mockEngine) CheckModelExists(v string) bool              { return m.checkExistsFn(v) }

func TestService_EmbedImage_WithEngine(t *testing.T) {
	svc := NewService(&mockEngine{
		isLoaded: true,
		embedImageFn: func(p string) ([]float32, error) {
			return []float32{0.1, 0.2, 0.3}, nil
		},
	}, nil, &mockResolver{})
	emb, err := svc.EmbedImage("user-1", "/tmp/test.jpg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(emb) != 3 || emb[0] != 0.1 {
		t.Fatalf("unexpected embedding: %v", emb)
	}
}

func TestService_EmbedImage_NotLoaded(t *testing.T) {
	svc := NewService(&mockEngine{isLoaded: false, embedImageFn: func(p string) ([]float32, error) {
		return nil, nil
	}}, nil, &mockResolver{})
	_, err := svc.EmbedImage("user-1", "/tmp/test.jpg")
	if err == nil {
		t.Fatal("expected error for unloaded model")
	}
}

func TestService_EmbedText_NoTokenizer(t *testing.T) {
	svc := NewService(&mockEngine{
		isLoaded: true,
		embedTextFn: func(s string, tok *ai.Tokenizer) ([]float32, error) {
			return []float32{0.4, 0.5, 0.6}, nil
		},
	}, nil, &mockResolver{})
	_, err := svc.EmbedText("hello")
	if err == nil {
		t.Fatal("expected error without tokenizer")
	}
}

func TestService_GenerateTags_NoTokenizer(t *testing.T) {
	svc := NewService(&mockEngine{
		isLoaded: true,
		generateTagsFn: func(p string, th float32, tok *ai.Tokenizer) ([]ai.TagResult, error) {
			return []ai.TagResult{{Tag: "sunset", Score: 0.95, Category: "Sky & Light"}}, nil
		},
	}, nil, &mockResolver{})
	_, err := svc.GenerateTags("user-1", "/tmp/sunset.jpg", 0.5)
	if err == nil {
		t.Fatal("expected error without tokenizer")
	}
}

func TestService_ScoreAesthetic_NoTokenizer(t *testing.T) {
	svc := NewService(&mockEngine{
		isLoaded: true,
		scoreAestheticFn: func(p string, tok *ai.Tokenizer) (*ai.AestheticResult, error) {
			return &ai.AestheticResult{Score: 0.8, Raw: 0.75}, nil
		},
	}, nil, &mockResolver{})
	_, err := svc.ScoreAesthetic("user-1", "/tmp/photo.jpg")
	if err == nil {
		t.Fatal("expected error without tokenizer")
	}
}

func TestService_LoadModel_Success(t *testing.T) {
	svc := NewService(&mockEngine{
		loadModelFn: func(v string) error { return nil },
	}, nil, &mockResolver{})
	if err := svc.LoadModel("standard"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestService_HasGPU_True(t *testing.T) {
	svc := NewService(&mockEngine{hasGPU: true}, nil, &mockResolver{})
	if !svc.HasGPU() {
		t.Fatal("expected HasGPU true")
	}
}

func TestService_HasGPU_False(t *testing.T) {
	svc := NewService(&mockEngine{hasGPU: false}, nil, &mockResolver{})
	if svc.HasGPU() {
		t.Fatal("expected HasGPU false")
	}
}

func TestService_GetStatus_ActiveVariant(t *testing.T) {
	svc := NewService(&mockEngine{
		activeVariant: "sharp",
		checkExistsFn: func(v string) bool { return v == "sharp" },
	}, nil, &mockResolver{})
	status := svc.GetStatus()
	if status.ActiveVariant != "sharp" {
		t.Fatalf("expected sharp, got %s", status.ActiveVariant)
	}
	if len(status.Available) != 1 || status.Available[0] != "sharp" {
		t.Fatalf("expected [sharp], got %v", status.Available)
	}
}

func TestService_GetStatus_MultipleAvailable(t *testing.T) {
	svc := NewService(&mockEngine{
		activeVariant: "standard",
		checkExistsFn: func(v string) bool {
			return v == "standard" || v == "high"
		},
	}, nil, &mockResolver{})
	status := svc.GetStatus()
	if len(status.Available) != 2 {
		t.Fatalf("expected 2 available, got %v", status.Available)
	}
}

func TestService_NilEngine_ReturnsError(t *testing.T) {
	svc := NewService(nil, nil, &mockResolver{})
	_, err := svc.EmbedImage("user-1", "/tmp/test.jpg")
	if err == nil {
		t.Fatal("expected error with nil engine")
	}
	if svc.HasGPU() {
		t.Fatal("HasGPU should be false with nil engine")
	}
	if err := svc.LoadModel("standard"); err == nil {
		t.Fatal("expected error loading model with nil engine")
	}
}