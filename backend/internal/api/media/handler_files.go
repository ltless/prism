package media

import (
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/metrics"
	"log"
	"net/http"
	"path/filepath"
	"strings"
)

func (h *Handler) ServeFile(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	isThumb := c.QueryParam("thumb") == "1"
	filePath := c.Param("*")

	// Vault reads are gated by hash: on-disk media files are named
	// <hash><ext>. While locked, any request for a vault file — original or
	// thumbnail — returns 404 so the existence of vault items stays hidden.
	if !h.vaultMgr.Unlocked(c, claims.UserID) {
		hash := filepath.Base(filePath)
		hash = strings.TrimSuffix(hash, filepath.Ext(hash))
		isVaultHash, err := h.svc.IsVaultHash(c.Request().Context(), claims.UserID, hash)
		if err != nil {
			log.Printf("IsVaultHash error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}
		if isVaultHash {
			return echo.NewHTTPError(http.StatusNotFound, "media not found")
		}
	}

	if isThumb {
		return h.storage.ServeThumbnail(c, claims.UserID, filePath)
	}

	// H-05: originals decrypt to a temp plaintext copy before streaming —
	// bound concurrent expensive serves per user.
	if !h.serveLimit.tryAcquire(claims.UserID) {
		metrics.Default.Inc("prism_media_serves_limited_total")
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many concurrent downloads")
	}
	defer h.serveLimit.release(claims.UserID)
	metrics.Default.Add("prism_media_serves_active", 1)
	defer metrics.Default.Add("prism_media_serves_active", -1)
	return h.storage.ServeFile(c, claims.UserID, filePath)
}
