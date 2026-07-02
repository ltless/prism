package media

import (
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
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
		isVaultHash, err := h.svc.IsVaultHash(claims.UserID, hash)
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
	return h.storage.ServeFile(c, claims.UserID, filePath)
}
