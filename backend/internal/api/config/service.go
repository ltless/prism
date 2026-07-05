package config

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/ltless/prism/internal/db"
)

// ErrInvalidAIConfig is returned when the "ai" config value is not a JSON
// object or exceeds the allowed size. Handlers map it to a 400.
var ErrInvalidAIConfig = errors.New("invalid ai config")

// Cap stored AI config so an admin (or a leaked admin token) can't stuff an
// arbitrarily large blob into app_config.
const maxAIConfigBytes = 64 * 1024

type AppConfigResponse struct {
	AI *string `json:"ai"`
}

type Service struct {
	global *db.GlobalDB
}

func NewService(global *db.GlobalDB) *Service {
	return &Service{global: global}
}

func (s *Service) Get() (*AppConfigResponse, error) {
	var aiValue sql.NullString
	err := s.global.DB.QueryRow("SELECT value FROM app_config WHERE key = 'ai'").Scan(&aiValue)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query config: %w", err)
	}

	var resp AppConfigResponse
	if aiValue.Valid {
		resp.AI = &aiValue.String
	}
	return &resp, nil
}

func (s *Service) Update(body map[string]interface{}) error {
	if ai, ok := body["ai"]; ok {
		// Only accept a JSON object; reject strings/numbers/arrays/etc. so
		// the stored value always matches the shape the reader expects.
		aiMap, ok := ai.(map[string]interface{})
		if !ok {
			return ErrInvalidAIConfig
		}
		aiJSON, err := json.Marshal(aiMap)
		if err != nil {
			return fmt.Errorf("marshal ai config: %w", err)
		}
		if len(aiJSON) > maxAIConfigBytes {
			return ErrInvalidAIConfig
		}
		_, err = s.global.DB.Exec(
			"INSERT INTO app_config (key, value) VALUES ('ai', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
			string(aiJSON), string(aiJSON),
		)
		if err != nil {
			return fmt.Errorf("upsert ai config: %w", err)
		}
	}

	return nil
}

const storageDefaultKey = "storage_default_bytes"

func (s *Service) GetStorageDefault() (*int64, error) {
	var value sql.NullString
	err := s.global.DB.QueryRow("SELECT value FROM app_settings WHERE key = ?", storageDefaultKey).Scan(&value)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query storage default: %w", err)
	}
	if !value.Valid {
		return nil, nil
	}
	var bytes int64
	if _, err := fmt.Sscanf(value.String, "%d", &bytes); err != nil {
		return nil, nil
	}
	return &bytes, nil
}

func (s *Service) UpdateStorageDefault(bytes int64) error {
	val := fmt.Sprintf("%d", bytes)
	_, err := s.global.DB.Exec(
		"INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
		storageDefaultKey, val, val,
	)
	return err
}