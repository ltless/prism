package config

import (
	"database/sql"
	"fmt"

	"github.com/ltless/prism/internal/db"
)

// ActiveChecker reports whether AI is opted-in (active).
type ActiveChecker interface {
	IsAIActive() (bool, error)
}

type Service struct {
	global *db.GlobalDB
}

func NewService(global *db.GlobalDB) *Service {
	return &Service{global: global}
}

// IsAIActive always returns false now that AI is removed.
func (s *Service) IsAIActive() (bool, error) {
	return false, nil
}

func (s *Service) Get() (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (s *Service) Update(body map[string]interface{}) error {
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
