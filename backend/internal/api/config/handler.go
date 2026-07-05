package config

import (
	"errors"
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

func (h *Handler) Get(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}

	cfg, err := h.svc.Get()
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

	val, err := h.svc.GetStorageDefault()
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
	if _, err := auth.GetClaimsOrErr(c); err != nil {
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

	if err := h.svc.UpdateStorageDefault(body.StorageDefaultBytes); err != nil {
		log.Printf("UpdateStorageDefault error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Update(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}

	var body map[string]interface{}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.svc.Update(body); err != nil {
		if errors.Is(err, ErrInvalidAIConfig) {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid ai config")
		}
		log.Printf("UpdateConfig error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}