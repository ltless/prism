package media

import (
	"encoding/json"
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"log"
	"net/http"
	"strconv"
)

func (h *Handler) List(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	folderID := c.QueryParam("folder_id")
	var fID *string
	if folderID != "" {
		fID = &folderID
	}
	favorites := c.QueryParam("favorites") == "true"
	trash := c.QueryParam("trash") == "true"
	vault := c.QueryParam("vault") == "true"
	dedup := c.QueryParam("dedup") == "true"
	search := c.QueryParam("search")

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	// The vault read path is gated server-side: without a valid short-lived
	// unlock token the whole vault listing is refused (403) rather than
	// returning the user's entire library.
	if vault {
		if err := h.vaultMgr.Require(c, claims.UserID); err != nil {
			return err
		}
	}

	resp, err := h.svc.List(claims.UserID, fID, favorites, trash, vault, dedup, search, page, limit)
	if err != nil {
		log.Printf("MediaList error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Get(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")
	item, err := h.svc.Get(claims.UserID, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	// Vault items are not enumerable while locked — 404 hides existence.
	if item.IsVault && !h.vaultMgr.Unlocked(c, claims.UserID) {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Delete(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")
	item, err := h.svc.Delete(claims.UserID, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "media not found")
	}

	h.storage.DeleteFile(claims.UserID, item.FilePath)

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// mediaUpdateBody is the validated PATCH /media/:id payload. Pointer fields
// distinguish "absent" (nil) from "present but null/zero" — maps cannot.
type mediaUpdateBody struct {
	Title    *string          `json:"title"`
	Metadata *json.RawMessage `json:"metadata"`
	FolderID *string          `json:"folder_id"`
	Favorite *bool            `json:"is_favorite"`
	Trash    *bool            `json:"is_trash"`
	Vault    *bool            `json:"is_vault"`
	Pin      string           `json:"pin"`
}

func (h *Handler) Update(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")

	var body mediaUpdateBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	// Vault gate: leaving the vault requires the PIN regardless of transport.
	if body.Vault != nil && !*body.Vault {
		if err := h.checkVaultPin(c, claims, body.Pin); err != nil {
			return err
		}
	}

	updates := updateMapFrom(body)

	if len(updates) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "no fields to update")
	}

	if err := h.svc.Update(claims.UserID, id, updates); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
