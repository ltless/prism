package sidecar

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

type roundTripFunc func(r *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r), nil
}

func TestGenerateTagsParsesResponse(t *testing.T) {
	c := &Client{baseURL: "http://test", key: "k", hc: &http.Client{Transport: roundTripFunc(func(r *http.Request) *http.Response {
		body, _ := json.Marshal(map[string]any{
			"tags": []map[string]any{{"tag": "person", "score": 0.9, "category": "People"}},
		})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}}
	})}}
	tags, err := c.GenerateTags("/x.jpg", nil, 0.1, "high")
	if err != nil {
		t.Fatal(err)
	}
	if len(tags) != 1 || tags[0].Tag != "person" {
		t.Fatalf("unexpected: %+v", tags)
	}
}

func TestEmbedImageParsesResponse(t *testing.T) {
	c := &Client{baseURL: "http://test", key: "k", hc: &http.Client{Transport: roundTripFunc(func(r *http.Request) *http.Response {
		body, _ := json.Marshal(map[string]any{
			"embedding": []float32{0.1, 0.2, 0.3},
		})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}}
	})}}
	emb, err := c.EmbedImage("/x.jpg", "high")
	if err != nil {
		t.Fatal(err)
	}
	if len(emb) != 3 || emb[0] != 0.1 {
		t.Fatalf("unexpected: %+v", emb)
	}
}

func TestEmbedTextParsesResponse(t *testing.T) {
	c := &Client{baseURL: "http://test", key: "k", hc: &http.Client{Transport: roundTripFunc(func(r *http.Request) *http.Response {
		body, _ := json.Marshal(map[string]any{
			"embedding": []float32{0.4, 0.5},
		})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}}
	})}}
	emb, err := c.EmbedText("hello", "high")
	if err != nil {
		t.Fatal(err)
	}
	if len(emb) != 2 || emb[1] != 0.5 {
		t.Fatalf("unexpected: %+v", emb)
	}
}

func TestScoreAestheticParsesResponse(t *testing.T) {
	c := &Client{baseURL: "http://test", key: "k", hc: &http.Client{Transport: roundTripFunc(func(r *http.Request) *http.Response {
		body, _ := json.Marshal(map[string]any{
			"score": 7.5,
			"raw":   0.83,
		})
		return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}}
	})}}
	res, err := c.ScoreAesthetic("/x.jpg", "aesthetic", "high")
	if err != nil {
		t.Fatal(err)
	}
	if res.Score != 7.5 || res.Raw != 0.83 {
		t.Fatalf("unexpected: %+v", res)
	}
}
