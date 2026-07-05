package users

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
)

const maxPreferencesSize = 10 * 1024 // 10KB

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetProfile(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	user, err := h.svc.GetProfile(claims.UserID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	return c.JSON(http.StatusOK, user)
}

func (h *Handler) UpdateProfile(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		Image       *string `json:"image"`
		CoverImage  *string `json:"cover_image"`
		Preferences *string `json:"preferences"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if body.Preferences != nil {
		if len(*body.Preferences) > maxPreferencesSize {
			return echo.NewHTTPError(http.StatusBadRequest, "preferences too large (max 10KB)")
		}
		if !json.Valid([]byte(*body.Preferences)) {
			return echo.NewHTTPError(http.StatusBadRequest, "preferences must be valid JSON")
		}
	}

	if err := h.svc.UpdateProfile(claims.UserID, body.Image, body.CoverImage, body.Preferences); err != nil {
		log.Printf("UpdateProfile error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) UpdateStorageLimit(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var body struct {
		StorageLimit int64 `json:"storage_limit"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	if err := h.svc.UpdateStorageLimit(claims.UserID, body.StorageLimit); err != nil {
		log.Printf("UpdateStorageLimit error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) SetVaultPin(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		Pin string `json:"pin"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(body.Pin) < 4 {
		return echo.NewHTTPError(http.StatusBadRequest, "pin must be at least 4 characters")
	}
	if err := h.svc.SetVaultPin(claims.UserID, body.Pin); err != nil {
		log.Printf("SetVaultPin error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) VerifyVaultPin(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		Pin string `json:"pin"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	ok, err := h.svc.VerifyVaultPin(claims.UserID, body.Pin)
	if err != nil {
		log.Printf("VerifyVaultPin error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid pin")
	}
	return c.JSON(http.StatusOK, map[string]bool{"valid": true})
}

func (h *Handler) DisableVaultPin(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	if err := h.svc.DisableVaultPin(claims.UserID); err != nil {
		log.Printf("DisableVaultPin error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) GetVaultPinStatus(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	enabled, err := h.svc.GetVaultPinStatus(claims.UserID)
	if err != nil {
		log.Printf("GetVaultPinStatus error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"enabled": enabled})
}

func (h *Handler) UpdateUsername(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if err := h.svc.UpdateUsername(claims.UserID, body.Username); err != nil {
		msg := err.Error()
		if msg == "username already taken" {
			return echo.NewHTTPError(http.StatusConflict, msg)
		}
		if msg == "username must be 3-50 characters" {
			return echo.NewHTTPError(http.StatusBadRequest, msg)
		}
		log.Printf("UpdateUsername error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) GetStorageUsage(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	usage, err := h.svc.GetStorageUsage(claims.UserID)
	if err != nil {
		log.Printf("GetStorageUsage error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, usage)
}

func (h *Handler) SetupComplete(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	if err := h.svc.MarkSetupComplete(claims.UserID); err != nil {
		log.Printf("SetupComplete error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}