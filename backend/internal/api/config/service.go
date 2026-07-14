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

// ErrAIInactive is returned by AI work when the opt-in flag (app_config.aiActive)
// is false. Handlers map it to HTTP 403.
var ErrAIInactive = errors.New("AI is not active")

// ActiveChecker reports whether AI is opted-in (active).
type ActiveChecker interface {
	IsAIActive() (bool, error)
}

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
	err := s.global.DB.QueryRow("SELECT ai FROM app_config WHERE id = 'global'").Scan(&aiValue)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query config: %w", err)
	}

	var resp AppConfigResponse
	if aiValue.Valid {
		resp.AI = &aiValue.String
	}
	return &resp, nil
}

// IsAIActive reports whether AI is opt-in enabled. Defaults to false when no
// config is stored or the blob is malformed.
func (s *Service) IsAIActive() (bool, error) {
	resp, err := s.Get()
	if err != nil {
		return false, err
	}
	if resp.AI == nil {
		return false, nil
	}
	var m struct {
		AiActive bool `json:"aiActive"`
	}
	if err := json.Unmarshal([]byte(*resp.AI), &m); err != nil {
		return false, fmt.Errorf("parse ai config: %w", err)
	}
	return m.AiActive, nil
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
			"INSERT INTO app_config (id, ai) VALUES ('global', $1) ON CONFLICT (id) DO UPDATE SET ai = $1",
			string(aiJSON),
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
	err := s.global.DB.QueryRow("SELECT value FROM app_settings WHERE key = $1", storageDefaultKey).Scan(&value)
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
	"INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
	storageDefaultKey, val,
	)
	return err
}
