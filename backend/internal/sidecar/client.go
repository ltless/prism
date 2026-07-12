package sidecar

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL string
	key     string
	hc      *http.Client
}

type BatchTagItem struct {
	ID       string `json:"id"`
	FilePath string `json:"filePath"`
	MediaDir string `json:"mediaDir"`
}

type BatchTagRequest struct {
	Items        []BatchTagItem          `json:"items"`
	Variant      string                  `json:"variant"`
	Taxonomy     map[string][]string     `json:"taxonomy"`
	TagThreshold float32                 `json:"tagThreshold"`
	BatchSize    int                     `json:"batchSize"`
}

type BatchTagResponse struct {
	Tagged  int               `json:"tagged"`
	Results []BatchTagResult  `json:"results"`
}

type BatchTagResult struct {
	ID         string    `json:"id"`
	Tags       []string  `json:"tags"`
	TagScores  []float32 `json:"tagScores"`
	Embedding  []float32 `json:"embedding,omitempty"`
	Error      *string   `json:"error,omitempty"`
}

type BatchScoreItem struct {
	ID       string `json:"id"`
	FilePath string `json:"filePath"`
}

type BatchScoreRequest struct {
	Items     []BatchScoreItem `json:"items"`
	Model     string           `json:"model"`
	Variant   string           `json:"variant"`
	BatchSize int              `json:"batchSize"`
}

type BatchScoreResponse struct {
	Scored  int                `json:"scored"`
	Results []BatchScoreResult `json:"results"`
}

type BatchScoreResult struct {
	ID    string   `json:"id"`
	Score *float32 `json:"score"`
	Raw   *float32 `json:"raw"`
	Model string   `json:"model"`
	Error *string  `json:"error,omitempty"`
}

type GPUStatus struct {
	Device       string `json:"device"`
	TorchVersion string `json:"torchVersion,omitempty"`
	CudaAvailable bool  `json:"cudaAvailable"`
	MpsAvailable  bool  `json:"mpsAvailable"`
	Error        string `json:"error,omitempty"`
}

type ModelStatus struct {
	Models []ModelInfo `json:"models"`
}

type ModelInfo struct {
	ID             string `json:"id"`
	Type           string `json:"type"`
	Name           string `json:"name"`
	Size           int64  `json:"size"`
	Variant        string `json:"variant"`
	Downloaded     bool   `json:"downloaded"`
	Loaded         bool   `json:"loaded"`
	DownloadState  string `json:"downloadState"`
}

func NewClient(baseURL, key string) *Client {
	return &Client{
		baseURL: baseURL,
		key:     key,
		hc: &http.Client{
			Timeout: 60 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
			},
		},
	}
}

func (c *Client) authHeader() http.Header {
	h := http.Header{}
	if c.key != "" {
		h.Set("X-Sidecar-Key", c.key)
	}
	return h
}

func (c *Client) post(path string, body, result interface{}) error {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		return fmt.Errorf("encode body: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+path, &buf)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header = c.authHeader()
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("sidecar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sidecar error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

func (c *Client) get(path string, result interface{}) error {
	req, err := http.NewRequest("GET", c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header = c.authHeader()

	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("sidecar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sidecar error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

func (c *Client) Health() error {
	req, err := http.NewRequest("GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	req.Header = c.authHeader()

	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("sidecar returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) BatchTag(req BatchTagRequest) (*BatchTagResponse, error) {
	var resp BatchTagResponse
	if err := c.post("/batch-tag", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) BatchScore(req BatchScoreRequest) (*BatchScoreResponse, error) {
	var resp BatchScoreResponse
	if err := c.post("/batch-score", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) GPUStatus() (*GPUStatus, error) {
	var resp GPUStatus
	if err := c.get("/gpu-status", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) ModelStatus() (*ModelStatus, error) {
	var resp ModelStatus
	if err := c.get("/model-status", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

type DownloadModelRequest struct {
	ModelID string `json:"modelId"`
}

type DownloadModelResult struct {
	Started           bool   `json:"started"`
	Downloaded        bool   `json:"downloaded"`
	AlreadyDownloading bool   `json:"alreadyDownloading"`
	Error             string `json:"error,omitempty"`
}

func (c *Client) DownloadModel(req DownloadModelRequest) (*DownloadModelResult, error) {
	var resp DownloadModelResult
	if err := c.post("/download-model", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

type EmbedResponse struct {
	Embedding []float32 `json:"embedding"`
}

type TagScore struct {
	Tag      string  `json:"tag"`
	Score    float32 `json:"score"`
	Category string  `json:"category"`
}

type TagsResponse struct {
	Tags []TagScore `json:"tags"`
}

type ScoreResponse struct {
	Score float32 `json:"score"`
	Raw   float32 `json:"raw"`
}

func (c *Client) EmbedImage(filePath, variant string) ([]float32, error) {
	var r EmbedResponse
	if err := c.post("/embed-image", map[string]any{"filePath": filePath, "variant": variant}, &r); err != nil {
		return nil, err
	}
	return r.Embedding, nil
}

func (c *Client) EmbedText(text, variant string) ([]float32, error) {
	var r EmbedResponse
	if err := c.post("/embed-text", map[string]any{"text": text, "variant": variant}, &r); err != nil {
		return nil, err
	}
	return r.Embedding, nil
}

func (c *Client) GenerateTags(filePath string, taxonomy map[string][]string, threshold float32, variant string) ([]TagScore, error) {
	var r TagsResponse
	if err := c.post("/generate-tags", map[string]any{"filePath": filePath, "taxonomy": taxonomy, "tagThreshold": threshold, "variant": variant}, &r); err != nil {
		return nil, err
	}
	return r.Tags, nil
}

func (c *Client) ScoreAesthetic(filePath, model, variant string) (*ScoreResponse, error) {
	var r ScoreResponse
	if err := c.post("/aesthetic-score", map[string]any{"filePath": filePath, "model": model, "variant": variant}, &r); err != nil {
		return nil, err
	}
	return &r, nil
}
