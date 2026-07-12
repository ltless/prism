package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ltless/prism/internal/sidecar"
)

type mockResolver struct{}

func (m *mockResolver) ResolveUserMediaPath(userID, filePath string) (string, error) {
	return filePath, nil
}

// newTestSidecar spins up an httptest server with the given response payloads
// and returns a real *sidecar.Client pointed at it, plus a record of the
// last request body received for assertions.
func newTestSidecar(t *testing.T, handler http.HandlerFunc) (*sidecar.Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return sidecar.NewClient(srv.URL, "test-key"), srv
}

func TestService_EmbedImage_DelegatesToSidecar(t *testing.T) {
	c, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embed-image" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["variant"] != "high" {
			t.Fatalf("expected variant high, got %v", body["variant"])
		}
		json.NewEncoder(w).Encode(map[string]any{"embedding": []float32{0.1, 0.2, 0.3}})
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, c)
	emb, err := svc.EmbedImage("user-1", "/tmp/test.jpg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(emb) != 3 || emb[0] != 0.1 {
		t.Fatalf("unexpected embedding: %v", emb)
	}
}

func TestService_EmbedText_DelegatesToSidecar(t *testing.T) {
	c, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embed-text" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["variant"] != "high" {
			t.Fatalf("expected variant high, got %v", body["variant"])
		}
		json.NewEncoder(w).Encode(map[string]any{"embedding": []float32{0.4, 0.5, 0.6}})
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, c)
	emb, err := svc.EmbedText("hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(emb) != 3 {
		t.Fatalf("unexpected embedding: %v", emb)
	}
}

func TestService_GenerateTags_DelegatesToSidecar(t *testing.T) {
	c, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/generate-tags" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["variant"] != "high" {
			t.Fatalf("expected variant high, got %v", body["variant"])
		}
		if body["tagThreshold"] != 0.5 {
			t.Fatalf("expected tagThreshold 0.5, got %v", body["tagThreshold"])
		}
		json.NewEncoder(w).Encode(map[string]any{"tags": []map[string]any{
			{"tag": "sunset", "score": 0.95, "category": "Sky & Light"},
		}})
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, c)
	res, err := svc.GenerateTags("user-1", "/tmp/sunset.jpg", 0.5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 1 || res[0].Tag != "sunset" || res[0].Category != "Sky & Light" {
		t.Fatalf("unexpected tags: %v", res)
	}
}

func TestService_ScoreAesthetic_DelegatesToSidecar(t *testing.T) {
	c, srv := newTestSidecar(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/aesthetic-score" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["model"] != "laion" || body["variant"] != "high" {
			t.Fatalf("unexpected model/variant: %v/%v", body["model"], body["variant"])
		}
		json.NewEncoder(w).Encode(map[string]any{"score": 0.8, "raw": 0.75})
	})
	defer srv.Close()
	svc := NewService(&mockResolver{}, c)
	res, err := svc.ScoreAesthetic("user-1", "/tmp/photo.jpg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Score != 0.8 || res.Raw != 0.75 {
		t.Fatalf("unexpected score: %v", res)
	}
}

func TestService_LoadModel_AlwaysNil(t *testing.T) {
	svc := NewService(&mockResolver{}, &sidecar.Client{})
	if err := svc.LoadModel("standard"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestService_HasGPU_TrueWithSidecar(t *testing.T) {
	svc := NewService(&mockResolver{}, &sidecar.Client{})
	if !svc.HasGPU() {
		t.Fatal("expected HasGPU true when sidecar set")
	}
}

func TestService_HasGPU_FalseWithoutSidecar(t *testing.T) {
	svc := NewService(&mockResolver{}, nil)
	if svc.HasGPU() {
		t.Fatal("expected HasGPU false without sidecar")
	}
}

func TestService_GetStatus_Variants(t *testing.T) {
	svc := NewService(&mockResolver{}, &sidecar.Client{})
	status := svc.GetStatus()
	if len(status.Variants) != 3 || !strings.Contains(strings.Join(status.Variants, ","), "high") {
		t.Fatalf("expected 3 variants incl high, got %v", status.Variants)
	}
}

func TestService_NilSidecar_ReturnsError(t *testing.T) {
	svc := NewService(&mockResolver{}, nil)
	if _, err := svc.EmbedImage("user-1", "/tmp/test.jpg"); err == nil {
		t.Fatal("expected error with nil sidecar")
	}
	if _, err := svc.EmbedText("hello"); err == nil {
		t.Fatal("expected error with nil sidecar")
	}
	if _, err := svc.GenerateTags("user-1", "/tmp/t.jpg", 0.5); err == nil {
		t.Fatal("expected error with nil sidecar")
	}
	if _, err := svc.ScoreAesthetic("user-1", "/tmp/t.jpg"); err == nil {
		t.Fatal("expected error with nil sidecar")
	}
}
