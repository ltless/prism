package ai

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

type Engine struct {
	session        *ort.DynamicAdvancedSession
	activeVariant  string
	embedDim       int
	modelsBasePath string
	mu             sync.RWMutex
}

func NewEngine(modelsBasePath string) (*Engine, error) {
	return &Engine{modelsBasePath: modelsBasePath}, nil
}

func InitORT(libPath string) error {
	ort.SetSharedLibraryPath(libPath)
	return ort.InitializeEnvironment()
}

func (e *Engine) modelONNXPath(variant string) string {
	var modelID string
	switch variant {
	case "standard":
		modelID = "Xenova/clip-vit-base-patch32"
	case "sharp":
		modelID = "Xenova/clip-vit-base-patch16"
	case "high":
		modelID = "Xenova/clip-vit-large-patch14"
	default:
		return ""
	}
	return filepath.Join(e.modelsBasePath, modelID, "onnx", "model_quantized.onnx")
}

func (e *Engine) LoadModel(variant string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	_ = e.unloadSession()

	onnxPath := e.modelONNXPath(variant)
	if onnxPath == "" {
		return fmt.Errorf("unknown variant: %s", variant)
	}
	if _, err := os.Stat(onnxPath); err != nil {
		return fmt.Errorf("model file not found at %s: %w", onnxPath, err)
	}

	session, err := ort.NewDynamicAdvancedSession(
		onnxPath,
		[]string{"pixel_values", "input_ids", "attention_mask"},
		[]string{"image_embeds", "text_embeds"},
		nil,
	)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}

	e.session = session
	e.activeVariant = variant
	switch variant {
	case "high":
		e.embedDim = 768
	default:
		e.embedDim = 512
	}
	return nil
}

func (e *Engine) UnloadModel() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.unloadSession()
}

func (e *Engine) unloadSession() error {
	if e.session != nil {
		err := e.session.Destroy()
		e.session = nil
		e.activeVariant = ""
		return err
	}
	return nil
}

func (e *Engine) GetActiveVariant() string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.activeVariant
}

func (e *Engine) HasGPU() bool {
	// No GPU detection implemented yet. ONNX Runtime can run on CUDA/DirectML
	// but we'd need to query ort.GetAvailableProviders() — revisit when ONNX
	// provider configuration is exposed.
	return false
}

func (e *Engine) IsLoaded() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.session != nil
}

func (e *Engine) CheckModelExists(variant string) bool {
	p := e.modelONNXPath(variant)
	if p == "" {
		return false
	}
	_, err := os.Stat(p)
	return err == nil
}

func (e *Engine) createDummyPixelValues() ([]float32, error) {
	return make([]float32, 3*ImageSize*ImageSize), nil
}

func (e *Engine) createDummyTextInputs() ([]int64, []int64) {
	ids := make([]int64, 77)
	mask := make([]int64, 77)
	return ids, mask
}

func (e *Engine) RunVision(pixelValues []float32) ([]float32, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	session := e.session
	dim := e.embedDim
	if session == nil {
		return nil, fmt.Errorf("model not loaded")
	}

	pvTensor, err := ort.NewTensor(ort.NewShape(1, 3, ImageSize, ImageSize), pixelValues)
	if err != nil {
		return nil, fmt.Errorf("create pixel values tensor: %w", err)
	}
	defer pvTensor.Destroy()

	dummyIDs, dummyMask := e.createDummyTextInputs()
	idTensor, err := ort.NewTensor(ort.NewShape(1, 77), dummyIDs)
	if err != nil {
		return nil, fmt.Errorf("create dummy input ids tensor: %w", err)
	}
	defer idTensor.Destroy()

	maskTensor, err := ort.NewTensor(ort.NewShape(1, 77), dummyMask)
	if err != nil {
		return nil, fmt.Errorf("create dummy attention mask tensor: %w", err)
	}
	defer maskTensor.Destroy()

	outImage, err := ort.NewEmptyTensor[float32](ort.NewShape(1, int64(dim)))
	if err != nil {
		return nil, fmt.Errorf("create image output tensor: %w", err)
	}
	defer outImage.Destroy()

	outText, err := ort.NewEmptyTensor[float32](ort.NewShape(1, int64(dim)))
	if err != nil {
		return nil, fmt.Errorf("create text output tensor: %w", err)
	}
	defer outText.Destroy()

	if err := session.Run(
		[]ort.Value{pvTensor, idTensor, maskTensor},
		[]ort.Value{outImage, outText},
	); err != nil {
		return nil, fmt.Errorf("run vision: %w", err)
	}

	// Copy before Destroy — GetData() returns a slice over freed C memory.
	data := outImage.GetData()
	result := make([]float32, len(data))
	copy(result, data)
	return result, nil
}

func (e *Engine) RunText(inputIDs, attentionMask []int64) ([]float32, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	session := e.session
	dim := e.embedDim
	if session == nil {
		return nil, fmt.Errorf("model not loaded")
	}

	batchSize := len(inputIDs) / 77
	if batchSize == 0 {
		batchSize = 1
	}

	dummyPV, err := e.createDummyPixelValues()
	if err != nil {
		return nil, fmt.Errorf("create dummy pixel values: %w", err)
	}
	pvTensor, err := ort.NewTensor(ort.NewShape(1, 3, ImageSize, ImageSize), dummyPV)
	if err != nil {
		return nil, fmt.Errorf("create dummy pixel values tensor: %w", err)
	}
	defer pvTensor.Destroy()

	idTensor, err := ort.NewTensor(ort.NewShape(int64(batchSize), 77), inputIDs)
	if err != nil {
		return nil, fmt.Errorf("create input ids tensor: %w", err)
	}
	defer idTensor.Destroy()

	maskTensor, err := ort.NewTensor(ort.NewShape(int64(batchSize), 77), attentionMask)
	if err != nil {
		return nil, fmt.Errorf("create attention mask tensor: %w", err)
	}
	defer maskTensor.Destroy()

	outImage, err := ort.NewEmptyTensor[float32](ort.NewShape(1, int64(dim)))
	if err != nil {
		return nil, fmt.Errorf("create image output tensor: %w", err)
	}
	defer outImage.Destroy()

	outText, err := ort.NewEmptyTensor[float32](ort.NewShape(int64(batchSize), int64(dim)))
	if err != nil {
		return nil, fmt.Errorf("create text output tensor: %w", err)
	}
	defer outText.Destroy()

	if err := session.Run(
		[]ort.Value{pvTensor, idTensor, maskTensor},
		[]ort.Value{outImage, outText},
	); err != nil {
		return nil, fmt.Errorf("run text: %w", err)
	}

	// Copy before Destroy — GetData() returns a slice over freed C memory.
	data := outText.GetData()
	result := make([]float32, len(data))
	copy(result, data)
	return result, nil
}
