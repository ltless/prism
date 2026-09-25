package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/vault"
	"golang.org/x/crypto/bcrypt"
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
	global  *db.GlobalDB
	pool    *db.TenantPool
	pinLock *vault.PinLock
}

func NewService(global *db.GlobalDB, pool *db.TenantPool) *Service {
	return &Service{global: global, pool: pool, pinLock: vault.NewPinLock(global.DB)}
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*UserProfile, error) {
	var profile UserProfile
	var image, coverImage, preferences sql.NullString
	var storageLimit sql.NullInt64

	err := s.global.DB.QueryRow(
		"SELECT id, username, role, image, cover_image, has_completed_setup, storage_limit, preferences, created_at FROM users WHERE id = $1",
		userID,
	).Scan(&profile.ID, &profile.Username, &profile.Role, &image, &coverImage, &profile.HasCompletedSet, &storageLimit, &preferences, &profile.CreatedAt)
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

	return &profile, nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, image, coverImage, preferences *string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := s.global.DB.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if image != nil {
		if _, err := tx.Exec("UPDATE users SET image = $1, updated_at = $2 WHERE id = $3", *image, now, userID); err != nil {
			return fmt.Errorf("update image: %w", err)
		}
	}
	if coverImage != nil {
		if _, err := tx.Exec("UPDATE users SET cover_image = $1, updated_at = $2 WHERE id = $3", *coverImage, now, userID); err != nil {
			return fmt.Errorf("update cover_image: %w", err)
		}
	}
	if preferences != nil {
		if _, err := tx.Exec("UPDATE users SET preferences = $1, updated_at = $2 WHERE id = $3", *preferences, now, userID); err != nil {
			return fmt.Errorf("update preferences: %w", err)
		}
	}
	return tx.Commit()
}

// UpdateStorageLimit sets the user's storage_limit. Valid=true with Int64=0
// means zero bytes allowed; Valid=false means unlimited (SQL NULL).
func (s *Service) UpdateStorageLimit(ctx context.Context, userID string, limit sql.NullInt64) error {
	_, err := s.global.DB.Exec("UPDATE users SET storage_limit = $1 WHERE id = $2", limit, userID)
	return err
}

func (s *Service) MarkSetupComplete(ctx context.Context, userID string) error {
	_, err := s.global.DB.Exec("UPDATE users SET has_completed_setup = TRUE WHERE id = $1", userID)
	return err
}

func (s *Service) SetVaultPin(ctx context.Context, userID, pin string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash pin: %w", err)
	}
	_, err = s.global.DB.Exec("UPDATE users SET vault_pin = $1 WHERE id = $2", string(hash), userID)
	return err
}

func (s *Service) VaultLocked(ctx context.Context, userID string) (bool, time.Duration) {
	return s.pinLock.Locked(userID)
}

func (s *Service) VerifyVaultPin(ctx context.Context, userID, pin string) (bool, error) {
	hasPin, ok, err := s.pinLock.Verify(userID, pin)
	if err != nil {
		return false, fmt.Errorf("verify vault pin: %w", err)
	}
	if !hasPin {
		return false, nil
	}
	if !ok {
		s.pinLock.RecordFailure(userID)
		return false, nil
	}
	s.pinLock.Reset(userID)
	return true, nil
}

func (s *Service) DisableVaultPin(ctx context.Context, userID string) error {
	_, err := s.global.DB.Exec("UPDATE users SET vault_pin = NULL WHERE id = $1", userID)
	return err
}

func (s *Service) GetVaultPinStatus(ctx context.Context, userID string) (bool, error) {
	var stored sql.NullString
	err := s.global.DB.QueryRow("SELECT vault_pin FROM users WHERE id = $1", userID).Scan(&stored)
	if err == sql.ErrNoRows {
		return false, fmt.Errorf("user not found")
	}
	if err != nil {
		return false, fmt.Errorf("query vault_pin: %w", err)
	}
	return stored.Valid && stored.String != "", nil
}

func (s *Service) UpdateUsername(ctx context.Context, userID, newUsername string) error {
	if len(newUsername) < 3 || len(newUsername) > 50 {
		return fmt.Errorf("username must be 3-50 characters")
	}
	_, err := s.global.DB.Exec("UPDATE users SET username = $1 WHERE id = $2", newUsername, userID)
	if err != nil {
		if isUniqueConstraintErr(err) {
			return fmt.Errorf("username already taken")
		}
		return fmt.Errorf("update username: %w", err)
	}
	return nil
}

type StorageUsageResult struct {
	Total      int64 `json:"usage_bytes"`
	ImageBytes int64 `json:"image_bytes"`
	VideoBytes int64 `json:"video_bytes"`
}

func (s *Service) GetStorageUsage(ctx context.Context, userID string) (*StorageUsageResult, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()
	var total, img, vid sql.NullInt64
	err = tdb.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(size), 0),
			COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN size ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN size ELSE 0 END), 0)
		FROM media WHERE user_id = $1`, userID).Scan(&total, &img, &vid)
	if err != nil {
		return nil, fmt.Errorf("query storage usage: %w", err)
	}
	r := &StorageUsageResult{}
	if total.Valid {
		r.Total = total.Int64
	}
	if img.Valid {
		r.ImageBytes = img.Int64
	}
	if vid.Valid {
		r.VideoBytes = vid.Int64
	}
	return r, nil
}

func isUniqueConstraintErr(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" // unique_violation
	}
	return false
}
