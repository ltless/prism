package media

import (
	"github.com/ltless/prism/internal/audit"
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/vault"
	"sync"
	"time"
)

// defaultProcessingConcurrency caps how many uploads may be post-processed
// (thumbnail + EXIF / ffmpeg) at once. Overridable via
// MEDIA_PROCESSING_CONCURRENCY.
const defaultProcessingConcurrency = 4

// processingAcquireTimeout is how long an upload waits for a processing slot
// before being shed with 503. Backpressure, not rejection of the bytes.
const processingAcquireTimeout = 30 * time.Second

// processingPool bounds concurrent post-upload processing. A slot is acquired
// on the request path before any upload work starts and released by the
// background job when it finishes, so saturation applies backpressure instead
// of spawning an unbounded goroutine per upload.
type processingPool struct {
	sem     chan struct{}
	timeout time.Duration
}

func newProcessingPool(size int, timeout time.Duration) *processingPool {
	if size < 1 {
		size = 1
	}
	return &processingPool{sem: make(chan struct{}, size), timeout: timeout}
}

func (p *processingPool) acquire() bool {
	select {
	case p.sem <- struct{}{}:
		return true
	case <-time.After(p.timeout):
		return false
	}
}

func (p *processingPool) release() { <-p.sem }

// defaultServeConcurrency caps how many expensive decrypt+stream serves
// (originals) one user may hold open at once. Thumbnails are plaintext and
// exempt. Tune to actual hardware when needed.
const defaultServeConcurrency = 4

// serveLimiter bounds per-user concurrent expensive media serves (H-05).
// Every original-file request decrypts to a temp plaintext copy — CPU, disk
// I/O, and bandwidth per request — so a single account must not be able to
// open unbounded concurrent streams.
type serveLimiter struct {
	mu    sync.Mutex
	slots map[string]chan struct{}
	limit int
}

func newServeLimiter(limit int) *serveLimiter {
	if limit < 1 {
		limit = 1
	}
	return &serveLimiter{slots: make(map[string]chan struct{}), limit: limit}
}

// tryAcquire takes a slot without waiting; false means the user already
// holds the maximum concurrent expensive serves.
func (l *serveLimiter) tryAcquire(userID string) bool {
	l.mu.Lock()
	ch := l.slots[userID]
	if ch == nil {
		ch = make(chan struct{}, l.limit)
		l.slots[userID] = ch
	}
	l.mu.Unlock()
	select {
	case ch <- struct{}{}:
		return true
	default:
		return false
	}
}

// release returns a slot. Entries live for the process lifetime — one small
// channel per user, bounded by the user count.
func (l *serveLimiter) release(userID string) {
	l.mu.Lock()
	ch := l.slots[userID]
	l.mu.Unlock()
	if ch == nil {
		return
	}
	select {
	case <-ch:
	default:
	}
}

type Handler struct {
	svc        *Service
	storage    *mw.Storage
	nukeToken  string
	pool       *processingPool
	serveLimit *serveLimiter
	vaultMgr   *vault.Manager
	audit      *audit.Recorder
}

func NewHandler(svc *Service, storage *mw.Storage, nukeToken string, vaultMgr *vault.Manager, auditRec *audit.Recorder, processingConcurrency ...int) *Handler {
	concurrency := defaultProcessingConcurrency
	if len(processingConcurrency) > 0 && processingConcurrency[0] > 0 {
		concurrency = processingConcurrency[0]
	}
	return &Handler{
		svc:        svc,
		storage:    storage,
		nukeToken:  nukeToken,
		pool:       newProcessingPool(concurrency, processingAcquireTimeout),
		serveLimit: newServeLimiter(defaultServeConcurrency),
		vaultMgr:   vaultMgr,
		audit:      auditRec,
	}
}
