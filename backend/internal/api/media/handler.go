package media

import (
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/vault"
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

type Handler struct {
	svc       *Service
	storage   *mw.Storage
	nukeToken string
	pool      *processingPool
	vaultMgr  *vault.Manager
}

func NewHandler(svc *Service, storage *mw.Storage, nukeToken string, vaultMgr *vault.Manager, processingConcurrency ...int) *Handler {
	concurrency := defaultProcessingConcurrency
	if len(processingConcurrency) > 0 && processingConcurrency[0] > 0 {
		concurrency = processingConcurrency[0]
	}
	return &Handler{
		svc:       svc,
		storage:   storage,
		nukeToken: nukeToken,
		pool:      newProcessingPool(concurrency, processingAcquireTimeout),
		vaultMgr:  vaultMgr,
	}
}
