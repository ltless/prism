package system

import (
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) Stats(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	stats, err := h.svc.Stats(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, stats)
}

func (h *Handler) Logs(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	page := parseInt(c.QueryParam("page"))
	limit := parseInt(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	level := c.QueryParam("level")

	logs, err := h.svc.Logs(claims.UserID, level, page, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, logs)
}

func (h *Handler) CreateLog(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		Level     string  `json:"level"`
		Message   string  `json:"message"`
		Meta      *string `json:"meta"`
		Source    *string `json:"source"`
		Timestamp *string `json:"timestamp"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	validLevels := map[string]bool{"info": true, "warn": true, "error": true}
	if !validLevels[body.Level] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid level")
	}
	if body.Message == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "message required")
	}
	ts := body.Timestamp
	if ts == nil {
		now := time.Now().UTC().Format(time.RFC3339)
		ts = &now
	}
	if err := h.svc.CreateLogEntry(claims.UserID, body.Level, body.Message, body.Source, body.Meta, *ts); err != nil {
		log.Printf("CreateLog error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"ok": true})
}

func parseInt(s string) int {
	if s == "" {
		return 0
	}
	n := 0
	for _, d := range s {
		if d < '0' || d > '9' {
			return 0
		}
		n = n*10 + int(d-'0')
	}
	return n
}
