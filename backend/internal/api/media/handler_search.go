package media

import (
	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) BatchTranscodeStatus(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	statuses, err := h.svc.BatchTranscodeStatus(claims.UserID, body.IDs)
	if err != nil {
		log.Printf("BatchTranscodeStatus error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"statuses": statuses,
	})
}

func (h *Handler) Search(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	params := SearchParams{
		Query:        c.QueryParam("q"),
		Page:         parseInt(c.QueryParam("page")),
		Limit:        parseInt(c.QueryParam("limit")),
		IncludeVault: h.vaultMgr.Unlocked(c, claims.UserID),
	}

	folderID := c.QueryParam("folder_id")
	if folderID != "" {
		params.FolderID = &folderID
	}

	if tagsParam := c.QueryParam("tags"); tagsParam != "" {
		params.Tags = strings.Split(tagsParam, ",")
	}

	if mimeParam := c.QueryParam("mime_type"); mimeParam != "" {
		params.MimeType = &mimeParam
	}

	if df := c.QueryParam("date_from"); df != "" {
		if v, err := strconv.ParseInt(df, 10, 64); err == nil {
			params.DateFrom = &v
		}
	}
	if dt := c.QueryParam("date_to"); dt != "" {
		if v, err := strconv.ParseInt(dt, 10, 64); err == nil {
			params.DateTo = &v
		}
	}

	resp, err := h.svc.Search(claims.UserID, params)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) CountTagged(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	res, err := h.svc.CountTagged(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) CountScored(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	res, err := h.svc.CountScored(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Dashboard(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	// Library (root) view shows only unfiled media. An absent folder_id param
	// means "no folder" — the service maps an empty-string FolderID to
	// folder_id IS NULL. Without this, filed photos leak into the library.
	folderID := c.QueryParam("folder_id")
	unfiled := ""
	var fID *string
	if folderID == "" {
		fID = &unfiled
	} else {
		fID = &folderID
	}
	favorites := c.QueryParam("is_favorite") == "true"

	params := DashboardParams{
		FolderID:     fID,
		IsFavorite:   favorites,
		Page:         page,
		Limit:        limit,
		IncludeVault: h.vaultMgr.Unlocked(c, claims.UserID),
	}

	smart := c.QueryParam("smart") == "true"
	if smart {
		cats := c.QueryParam("categories")
		if cats != "" {
			params.Categories = strings.Split(cats, ",")
		}
		minScore, _ := strconv.ParseFloat(c.QueryParam("minScore"), 64)
		params.MinScore = minScore
	}

	resp, err := h.svc.GetDashboard(claims.UserID, params)
	if err != nil {
		log.Printf("Dashboard error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Duplicates(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	resp, err := h.svc.GetDuplicates(claims.UserID, h.vaultMgr.Unlocked(c, claims.UserID))
	if err != nil {
		log.Printf("Duplicates error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, resp)
}
