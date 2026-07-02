package media

import (
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"log"
	"net/http"
	"strconv"
)

// requireVaultUnlock enforces the vault PIN when a request tries to move
// media OUT of the vault (is_vault:false). The pin never reaches the SQL
// update — updateMapFrom omits it.
func (h *Handler) requireVaultUnlock(c echo.Context, claims *auth.Claims, body mediaUpdateBody) error {
	if body.Vault == nil || *body.Vault {
		return nil
	}
	return h.checkVaultPin(c, claims, body.Pin)
}

// updateMapFrom converts the typed request body into the update map consumed
// by Service.Update/UpdateByHash. Only explicitly-provided fields are set.
func updateMapFrom(body mediaUpdateBody) map[string]interface{} {
	updates := make(map[string]interface{})
	if body.Title != nil {
		updates["title"] = sanitizeTitle(*body.Title)
	}
	if body.Metadata != nil {
		updates["metadata"] = string(*body.Metadata)
	}
	if body.FolderID != nil {
		updates["folder_id"] = *body.FolderID
	}
	if body.Favorite != nil {
		updates["is_favorite"] = boolToInt(*body.Favorite)
	}
	if body.Trash != nil {
		updates["is_trash"] = boolToInt(*body.Trash)
	}
	if body.Vault != nil {
		updates["is_vault"] = boolToInt(*body.Vault)
	}
	return updates
}

// checkVaultPin validates the vault PIN with shared lockout accounting.
func (h *Handler) checkVaultPin(c echo.Context, claims *auth.Claims, pin string) error {
	if locked, retry := h.svc.VaultLocked(claims.UserID); locked {
		c.Response().Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many failed attempts, try again later")
	}
	allowed, err := h.svc.VaultUnlockAllowed(claims.UserID, pin)
	if err != nil {
		log.Printf("VaultUnlockAllowed error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if !allowed {
		return echo.NewHTTPError(http.StatusForbidden, "invalid vault pin")
	}
	return nil
}
