package media

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// VaultLocked reports whether userID is currently locked out of vault-PIN
// verified operations (un-vault, PIN verify) and, if so, the remaining time.
func (s *Service) VaultLocked(ctx context.Context, userID string) (bool, time.Duration) {
	return s.pinLock.Locked(userID)
}

// VaultUnlockAllowed reports whether userID may move media out of the vault.
// If no vault PIN is configured the operation is allowed; otherwise the PIN
// must match. Failed attempts share the lockout counter with the PIN verify
// endpoint.
func (s *Service) VaultUnlockAllowed(ctx context.Context, userID, pin string) (bool, error) {
	if s.globalDB == nil {
		return false, errors.New("global db not configured")
	}
	hasPin, ok, err := s.pinLock.Verify(userID, pin)
	if err != nil {
		return false, fmt.Errorf("verify vault pin: %w", err)
	}
	if !hasPin {
		return true, nil
	}
	if !ok {
		s.pinLock.RecordFailure(userID)
		return false, nil
	}
	s.pinLock.Reset(userID)
	return true, nil
}

// IsVaultHash reports whether the given content hash belongs to a vault item
// for this user. An unknown hash (not our media, e.g. a profile image) is not
// vault business and returns (false, nil). The unique index on (user_id, hash)
// keeps the lookup indexed.
func (s *Service) IsVaultHash(ctx context.Context, userID, hash string) (bool, error) {
	tdb, err := s.pool.Get(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("get tenant db: %w", err)
	}
	defer tdb.Close()

	var isVault bool
	err = tdb.QueryRow(ctx,
		"SELECT is_vault FROM media WHERE user_id = $1 AND hash = $2",
		userID, hash,
	).Scan(&isVault)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("query is_vault: %w", err)
	}
	return isVault, nil
}
