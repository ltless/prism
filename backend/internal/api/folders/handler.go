package folders

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	resp, err := h.svc.List(c.Request().Context(), claims.UserID)
	if err != nil {
		log.Printf("FolderList error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Create(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		Name        string `json:"name"`
		Color       string `json:"color"`
		FolderType  string `json:"folder_type"`
		FilterQuery string `json:"filter_query"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if body.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	if len(body.Name) > 100 {
		return echo.NewHTTPError(http.StatusBadRequest, "name must be 100 characters or less")
	}

	// Validate folder_type if provided.
	validFolderTypes := map[string]bool{"regular": true, "smart": true}
	if body.FolderType != "" && !validFolderTypes[body.FolderType] {
		return echo.NewHTTPError(http.StatusBadRequest, "folder_type must be 'regular' or 'smart'")
	}

	item, err := h.svc.Create(c.Request().Context(), claims.UserID, body.Name, body.Color, body.FolderType, body.FilterQuery)
	if err != nil {
		log.Printf("FolderCreate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) Update(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")

	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if body.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	if len(body.Name) > 100 {
		return echo.NewHTTPError(http.StatusBadRequest, "name must be 100 characters or less")
	}

	if err := h.svc.Update(c.Request().Context(), claims.UserID, id, body.Name); err != nil {
		log.Printf("FolderUpdate error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Delete(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	id := c.Param("id")

	if err := h.svc.Delete(c.Request().Context(), claims.UserID, id); err != nil {
		log.Printf("FolderDelete error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
