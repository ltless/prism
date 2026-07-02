package config

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/ltless/prism/internal/db"
	_ "modernc.org/sqlite"
)

func setupConfigTestDB(t *testing.T) *db.GlobalDB {
	t.Helper()
	p := t.TempDir() + "/global.db"
	gdb, err := db.NewGlobalDB(p)
	if err != nil {
		t.Fatalf("NewGlobalDB: %v", err)
	}
	t.Cleanup(func() { gdb.Close(); os.Remove(p) })
	return gdb
}

func TestConfigService_Get_Empty(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)
	resp, err := svc.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.AI != nil {
		t.Fatal("expected nil AI config initially")
	}
}

func TestConfigService_UpdateAndGet(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	aiConfig := map[string]interface{}{
		"variant":   "standard",
		"enabled":   true,
		"threshold": 0.5,
	}
	err := svc.Update(map[string]interface{}{"ai": aiConfig})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	resp, err := svc.Get()
	if err != nil {
		t.Fatalf("Get after update: %v", err)
	}
	if resp.AI == nil {
		t.Fatal("expected non-nil AI config after update")
	}
}

func TestConfigService_Update_InvalidBody(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	// Update with empty body should not error
	err := svc.Update(map[string]interface{}{})
	if err != nil {
		t.Fatalf("Update with empty body: %v", err)
	}
}

func TestConfigService_Update_UnrelatedKey(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	err := svc.Update(map[string]interface{}{"unrelated": "value"})
	if err != nil {
		t.Fatalf("Update unrelated key: %v", err)
	}

	// Should not have created an AI config entry
	var count int
	gdb.QueryRow("SELECT COUNT(*) FROM app_config").Scan(&count)
	if count != 0 {
		t.Fatalf("expected 0 rows, got %d", count)
	}
}

func TestConfigService_Update_RejectsNonObjectAI(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	// A raw string is not a valid AI config object.
	err := svc.Update(map[string]interface{}{"ai": "not-an-object"})
	if !errors.Is(err, ErrInvalidAIConfig) {
		t.Fatalf("expected ErrInvalidAIConfig, got %v", err)
	}

	// Nothing should have been written.
	var count int
	gdb.QueryRow("SELECT COUNT(*) FROM app_config").Scan(&count)
	if count != 0 {
		t.Fatalf("expected 0 rows after rejected update, got %d", count)
	}
}

func TestConfigService_Update_RejectsOversizedAI(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

	// Build a config whose JSON exceeds maxAIConfigBytes.
	huge := strings.Repeat("x", maxAIConfigBytes+1)
	err := svc.Update(map[string]interface{}{"ai": map[string]interface{}{"blob": huge}})
	if !errors.Is(err, ErrInvalidAIConfig) {
		t.Fatalf("expected ErrInvalidAIConfig, got %v", err)
	}
}