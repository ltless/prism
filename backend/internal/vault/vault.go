// Package vault centralises vault-PIN verification and failed-attempt
// lockout. The media handler (un-vault) and the users handler (PIN verify)
// share this state so a brute-force via either route hits the same counter.
package vault

import (
	"database/sql"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	maxFailures = 5
	lockWindow  = 15 * time.Minute
	lockFor     = 15 * time.Minute
)

type attemptState struct {
	failures int
	first    time.Time
	lockedAt time.Time
}

var (
	mu     sync.Mutex
	states = map[string]*attemptState{}
)

// Locked reports whether userID is locked out and, if so, the remaining
// duration.
func Locked(userID string) (bool, time.Duration) {
	mu.Lock()
	defer mu.Unlock()
	st := states[userID]
	if st == nil || st.lockedAt.IsZero() {
		return false, 0
	}
	remaining := lockFor - time.Since(st.lockedAt)
	if remaining <= 0 {
		delete(states, userID)
		return false, 0
	}
	return true, remaining
}

// RecordFailure registers a failed attempt, locking the user out once
// maxFailures is reached within the window.
func RecordFailure(userID string) {
	mu.Lock()
	defer mu.Unlock()
	now := time.Now()
	st := states[userID]
	if st == nil || now.Sub(st.first) > lockWindow {
		st = &attemptState{first: now}
	}
	st.failures++
	if st.failures >= maxFailures {
		st.lockedAt = now
	}
	states[userID] = st
	pruneLocked(now)
}

// Reset clears failure state after a successful verification.
func Reset(userID string) {
	mu.Lock()
	delete(states, userID)
	mu.Unlock()
}

// pruneLocked drops stale entries so the map cannot grow without bound.
// Caller holds mu.
func pruneLocked(now time.Time) {
	if len(states) < 1024 {
		return
	}
	for id, st := range states {
		if st.lockedAt.IsZero() && now.Sub(st.first) > lockWindow {
			delete(states, id)
		}
	}
}

// Verify checks pin against the stored vault PIN for userID. It reports
// whether a PIN is configured at all, and whether it matched. The caller is
// responsible for Locked/RecordFailure/Reset bookkeeping.
func Verify(db *sql.DB, userID, pin string) (hasPin bool, ok bool, err error) {
	var stored sql.NullString
	err = db.QueryRow("SELECT vault_pin FROM users WHERE id = $1", userID).Scan(&stored)
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
