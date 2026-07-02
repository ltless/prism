// Package vault centralises vault-PIN verification and failed-attempt
// lockout. The media handler (un-vault) and the users handler (PIN verify)
// share the lockout state, which lives in the users table rather than in Go
// memory: a backend restart no longer hands a brute-forcer a fresh budget,
// and every instance behind a load balancer honours the same counter.
package vault

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	maxFailures = 5
	lockWindow  = 15 * time.Minute
	lockFor     = 15 * time.Minute
)

// PinLock verifies vault-PIN attempts and records failed-attempt lockout on
// the backed-up user row. The handlers share one instance per process (all
// pointing at the same database), so either route hits the same counter.
type PinLock struct {
	db *sql.DB
}

// NewPinLock returns a PinLock persisted in db.
func NewPinLock(db *sql.DB) *PinLock {
	return &PinLock{db: db}
}

// Locked reports whether userID is locked out and, if so, the remaining
// duration. The lock is read fresh from the database on every call, so a lock
// acquired through one route or instance is honoured by all others.
func (l *PinLock) Locked(userID string) (bool, time.Duration) {
	var until sql.NullTime
	err := l.db.QueryRow("SELECT vault_locked_until FROM users WHERE id = $1", userID).Scan(&until)
	if err != nil || !until.Valid {
		return false, 0
	}
	remaining := time.Until(until.Time)
	if remaining <= 0 {
		return false, 0
	}
	return true, remaining
}

// RecordFailure registers a failed attempt in a single atomic UPDATE: there
// is no read-then-write, so concurrent requests (e.g. two parallel PATCHes)
// each land on the committed counter instead of overwriting one another. When
// the previous failure is older than the window the counter restarts at 1;
// at maxFailures the user is locked for lockFor.
//
// The new count is inlined (not a CTE) so a waiter's EvalPlanQual re-run sees
// the latest committed row: PostgreSQL freezes CTE contents at the statement
// snapshot, which would let two waiters both write the same stale +1.
const attemptCountExpr = `CASE WHEN vault_first_failure_at IS NULL OR vault_first_failure_at < NOW() - $2::interval THEN 1 ELSE vault_failed_attempts + 1 END`

func (l *PinLock) RecordFailure(userID string) {
	query := fmt.Sprintf(`
		UPDATE users SET
			vault_failed_attempts  = %s,
			vault_first_failure_at = CASE WHEN vault_first_failure_at IS NULL OR vault_first_failure_at < NOW() - $2::interval
			                              THEN NOW() ELSE vault_first_failure_at END,
			vault_locked_until     = CASE WHEN %s >= $3 THEN NOW() + $4::interval ELSE NULL END
		WHERE id = $1`, attemptCountExpr, attemptCountExpr)
	_, err := l.db.Exec(query, userID, lockWindow, maxFailures, lockFor)
	if err != nil {
		log.Printf("record vault-pin failure: %v", err)
	}
}

// Reset clears failure and lockout state after a successful verification.
func (l *PinLock) Reset(userID string) {
	_, _ = l.db.Exec(
		"UPDATE users SET vault_failed_attempts = 0, vault_first_failure_at = NULL, vault_locked_until = NULL WHERE id = $1",
		userID)
}

// Verify checks pin against the stored vault PIN for userID. It reports
// whether a PIN is configured at all, and whether it matched. The caller is
// responsible for Locked/RecordFailure/Reset bookkeeping.
func (l *PinLock) Verify(userID, pin string) (hasPin bool, ok bool, err error) {
	var stored sql.NullString
	err = l.db.QueryRow("SELECT vault_pin FROM users WHERE id = $1", userID).Scan(&stored)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	if !stored.Valid || stored.String == "" {
		return false, false, nil
	}
	if bcrypt.CompareHashAndPassword([]byte(stored.String), []byte(pin)) != nil {
		return true, false, nil
	}
	return true, true, nil
}
