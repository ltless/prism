package vault

import (
	"database/sql"
	"sync"
	"testing"

	"github.com/ltless/prism/internal/dbtest"
	"golang.org/x/crypto/bcrypt"
)

func insertUser(t *testing.T, db *sql.DB, id string) {
	t.Helper()
	_, err := db.Exec("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)", id, "user-"+id, "hash")
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
}

func TestPinLock_UnderFiveFailuresStaysUnlocked(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	pl := NewPinLock(sqlDB)

	for i := 1; i < maxFailures; i++ {
		pl.RecordFailure("u1")
	}
	locked, _ := pl.Locked("u1")
	if locked {
		t.Fatalf("expected unlocked after %d failures, got locked", maxFailures-1)
	}
}

func TestPinLock_FiveFailuresLock(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	pl := NewPinLock(sqlDB)

	for i := 0; i < maxFailures; i++ {
		pl.RecordFailure("u1")
	}
	locked, remaining := pl.Locked("u1")
	if !locked {
		t.Fatal("expected locked after 5 failures")
	}
	if remaining <= 0 || remaining > lockFor {
		t.Fatalf("expected remaining in (0, %v], got %v", lockFor, remaining)
	}
}

func TestPinLock_SuccessResetsState(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	_, err := sqlDB.Exec("INSERT INTO users (id, username, password_hash, vault_pin) VALUES ($1, $2, $3, $4)",
		"u1", "user-u1", "hash", string(hash))
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	pl := NewPinLock(sqlDB)

	for i := 0; i < 3; i++ {
		pl.RecordFailure("u1")
	}
	hasPin, ok, err := pl.Verify("u1", "123456")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !hasPin || !ok {
		t.Fatalf("expected valid pin to verify, got hasPin=%v ok=%v", hasPin, ok)
	}
	pl.Reset("u1")

	locked, _ := pl.Locked("u1")
	if locked {
		t.Fatal("expected unlocked after successful verify")
	}
	var attempts int
	if err := sqlDB.QueryRow("SELECT vault_failed_attempts FROM users WHERE id = 'u1'").Scan(&attempts); err != nil {
		t.Fatalf("read attempts: %v", err)
	}
	if attempts != 0 {
		t.Fatalf("expected attempts reset to 0, got %d", attempts)
	}
}

func TestPinLock_WindowExpiredResetsCounter(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	// A near-brute-force budget from a previous window (16 min ago).
	_, err := sqlDB.Exec(
		"UPDATE users SET vault_failed_attempts = 4, vault_first_failure_at = NOW() - INTERVAL '16 minutes' WHERE id = 'u1'")
	if err != nil {
		t.Fatalf("seed old failures: %v", err)
	}
	pl := NewPinLock(sqlDB)

	pl.RecordFailure("u1")

	var attempts int
	if err := sqlDB.QueryRow("SELECT vault_failed_attempts FROM users WHERE id = 'u1'").Scan(&attempts); err != nil {
		t.Fatalf("read attempts: %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected counter restarted at 1, got %d", attempts)
	}
	if locked, _ := pl.Locked("u1"); locked {
		t.Fatal("expected unlocked after window reset")
	}
}

func TestPinLock_LockSurvivesInstanceRecreation(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	first := NewPinLock(sqlDB)
	for i := 0; i < maxFailures; i++ {
		first.RecordFailure("u1")
	}

	// A fresh instance models a backend restart: the lock must be read back
	// from the database, not from memory.
	second := NewPinLock(sqlDB)
	locked, _ := second.Locked("u1")
	if !locked {
		t.Fatal("expected lock to survive instance recreation")
	}
}

func TestPinLock_ConcurrentRecordFailureNoLostUpdate(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	pl := NewPinLock(sqlDB)

	const goroutines = 8
	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pl.RecordFailure("u1")
		}()
	}
	wg.Wait()

	var attempts int
	if err := sqlDB.QueryRow("SELECT vault_failed_attempts FROM users WHERE id = 'u1'").Scan(&attempts); err != nil {
		t.Fatalf("read attempts: %v", err)
	}
	if attempts != goroutines {
		t.Fatalf("expected %d recorded failures, got %d", goroutines, attempts)
	}
}

func TestPinLock_VerifyNoPinConfigured(t *testing.T) {
	sqlDB := dbtest.NewDB(t)
	insertUser(t, sqlDB, "u1")
	pl := NewPinLock(sqlDB)

	hasPin, ok, err := pl.Verify("u1", "123456")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if hasPin || ok {
		t.Fatalf("expected no-pin to be hasPin=false ok=false, got hasPin=%v ok=%v", hasPin, ok)
	}
}
