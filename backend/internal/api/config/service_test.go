package config

import (
	"testing"

	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/dbtest"
)

func setupConfigTestDB(t *testing.T) *db.GlobalDB {
	t.Helper()
	sqlDB := dbtest.NewDB(t)
	return &db.GlobalDB{DB: sqlDB}
}

func TestConfigService_Update_EmptyBody(t *testing.T) {
	gdb := setupConfigTestDB(t)
	svc := NewService(gdb)

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
}
