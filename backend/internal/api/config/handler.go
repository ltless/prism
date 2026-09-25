package config

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/audit"
	"github.com/ltless/prism/internal/auth"
)

type Handler struct {
	svc   *Service
	audit *audit.Recorder
}

func NewHandler(svc *Service, auditRec *audit.Recorder) *Handler {
	return &Handler{svc: svc, audit: auditRec}
}

func (h *Handler) Get(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}

	cfg, err := h.svc.Get(c.Request().Context())
	if err != nil {
		log.Printf("GetConfig error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, cfg)
}

func (h *Handler) GetStorageDefault(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}

	val, err := h.svc.GetStorageDefault(c.Request().Context())
	if err != nil {
		log.Printf("GetStorageDefault error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	resp := map[string]interface{}{"storage_default_bytes": nil}
	if val != nil {
		resp["storage_default_bytes"] = *val
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) UpdateStorageDefault(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		StorageDefaultBytes int64 `json:"storage_default_bytes"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.StorageDefaultBytes < 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "storage_default_bytes must be >= 0")
	}

	if err := h.svc.UpdateStorageDefault(c.Request().Context(), body.StorageDefaultBytes); err != nil {
		log.Printf("UpdateStorageDefault error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "config_storage_default", "", true, c.RealIP(), "")

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Update(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		Theme string `json:"theme"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.svc.Update(c.Request().Context(), body); err != nil {
		log.Printf("UpdateConfig error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.audit.Event(c.Request().Context(), claims.UserID, "config_update", "", true, c.RealIP(), "")

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
