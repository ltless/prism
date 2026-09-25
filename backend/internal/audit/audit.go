package audit

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/ltless/prism/internal/db"
)

// Recorder persists security-relevant events to error_logs, scoped to the
// acting user (RLS on error_logs keeps each user's audit trail private).
// Insert-only; nobody edits or deletes these rows through the API.
type Recorder struct {
	pool *db.TenantPool
}

func NewRecorder(pool *db.TenantPool) *Recorder {
	return &Recorder{pool: pool}
}

// Event logs one sensitive action: actor -> action -> target -> outcome.
// detail carries reason/error class (e.g. "wrong pin", "locked out"), never
// passwords, PINs, raw tokens, or other secrets.
func (r *Recorder) Event(ctx context.Context, userID, action, target string, success bool, ip, detail string) {
	// nil recorder = audit disabled (unit tests construct handlers without one).
	if r == nil || r.pool == nil {
		return
	}
	meta, err := json.Marshal(map[string]any{
		"action":  action,
		"target":  target,
		"success": success,
		"ip":      ip,
		"detail":  detail,
	})
	if err != nil {
		return
	}
	level := "info"
	if !success {
		level = "warn"
	}
	tdb, err := r.pool.Get(ctx, userID)
	if err != nil {
		log.Printf("audit: tenant conn: %v", err)
		return
	}
	defer tdb.Close()

	source := "audit"
	_, err = tdb.Exec(ctx,
		"INSERT INTO error_logs (user_id, level, message, meta, source, timestamp) VALUES ($1, $2, $3, $4, $5, $6)",
		userID, level, "audit:"+action, string(meta), source, time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		log.Printf("audit: insert: %v", err)
	}
}
