package users

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/ltless/prism/internal/db"
)

type UserProfile struct {
	ID              string  `json:"id"`
	Username        string  `json:"username"`
	Role            string  `json:"role"`
	Image           *string `json:"image"`
	CoverImage      *string `json:"cover_image"`
	HasCompletedSet bool    `json:"has_completed_setup"`
	StorageLimit    *int64  `json:"storage_limit"`
	Preferences     *string `json:"preferences"`
	CreatedAt       string  `json:"created_at"`
}

type Service struct {
	global *db.GlobalDB
}

func NewService(global *db.GlobalDB) *Service {
	return &Service{global: global}
}

func (s *Service) GetProfile(userID string) (*UserProfile, error) {
	var profile UserProfile
	var image, coverImage, preferences sql.NullString
	var storageLimit sql.NullInt64
	var hasCompleted int

	err := s.global.DB.QueryRow(
		"SELECT id, username, role, image, cover_image, has_completed_setup, storage_limit, preferences, created_at FROM users WHERE id = ?",
		userID,
	).Scan(&profile.ID, &profile.Username, &profile.Role, &image, &coverImage, &hasCompleted, &storageLimit, &preferences, &profile.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}

	if image.Valid {
		profile.Image = &image.String
	}
	if coverImage.Valid {
		profile.CoverImage = &coverImage.String
	}
	if storageLimit.Valid {
		profile.StorageLimit = &storageLimit.Int64
	}
	if preferences.Valid {
		profile.Preferences = &preferences.String
	}
	profile.HasCompletedSet = hasCompleted == 1

	return &profile, nil
}

func (s *Service) UpdateProfile(userID string, image, coverImage, preferences *string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := s.global.DB.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if image != nil {
		if _, err := tx.Exec("UPDATE users SET image = ?, updated_at = ? WHERE id = ?", *image, now, userID); err != nil {
			return fmt.Errorf("update image: %w", err)
		}
	}
	if coverImage != nil {
		if _, err := tx.Exec("UPDATE users SET cover_image = ?, updated_at = ? WHERE id = ?", *coverImage, now, userID); err != nil {
			return fmt.Errorf("update cover_image: %w", err)
		}
	}
	if preferences != nil {
		if _, err := tx.Exec("UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?", *preferences, now, userID); err != nil {
			return fmt.Errorf("update preferences: %w", err)
		}
	}
	return tx.Commit()
}

func (s *Service) UpdateStorageLimit(userID string, limit int64) error {
	_, err := s.global.DB.Exec("UPDATE users SET storage_limit = ? WHERE id = ?", limit, userID)
	return err
}

func (s *Service) MarkSetupComplete(userID string) error {
	_, err := s.global.DB.Exec("UPDATE users SET has_completed_setup = 1 WHERE id = ?", userID)
	return err
}