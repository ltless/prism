package auth

import (
	"errors"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/vault"
)

type Handler struct {
	service  *Service
	vaultMgr *vault.Manager
}

func NewHandler(service *Service, vaultMgr *vault.Manager) *Handler {
	return &Handler{service: service, vaultMgr: vaultMgr}
}

func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	resp, err := h.service.Login(&req)
	if err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			return echo.NewHTTPError(http.StatusBadRequest, "invalid username or password")
		case errors.Is(err, ErrInvalidCredentials):
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
		default:
			log.Printf("Login internal error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}
	}

	SetAuthCookie(c, resp.Token, 7*24*3600)
	return c.JSON(http.StatusOK, resp)
}

func (h *Handler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	resp, err := h.service.Register(&req)
	if err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			return echo.NewHTTPError(http.StatusBadRequest, "username must be 3-50 chars, password at least 8 chars")
		case errors.Is(err, ErrUsernameTaken):
			return echo.NewHTTPError(http.StatusConflict, "username already taken")
		case errors.Is(err, ErrInviteRequired):
			return echo.NewHTTPError(http.StatusBadRequest, "invite code required")
		case errors.Is(err, ErrInviteInvalid):
			return echo.NewHTTPError(http.StatusForbidden, "invalid invite code")
		default:
			log.Printf("Register internal error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}
	}

	SetAuthCookie(c, resp.Token, 7*24*3600)
	return c.JSON(http.StatusCreated, resp)
}

func (h *Handler) Logout(c echo.Context) error {
	ClearAuthCookie(c)
	h.vaultMgr.ClearCookie(c)
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) ChangePassword(c echo.Context) error {
	claims, err := GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.service.ChangePassword(claims.UserID, req.OldPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			return echo.NewHTTPError(http.StatusBadRequest, "invalid password")
		case errors.Is(err, ErrInvalidCredentials):
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid password")
		default:
			log.Printf("ChangePassword internal error: %v", err)
			return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
		}
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) Me(c echo.Context) error {
	claims, err := GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	user, err := h.service.Me(claims.UserID)
	if err != nil {
		log.Printf("Me error: %v", err)
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	resp := map[string]interface{}{
		"id":                  user.ID,
		"username":            user.Username,
		"role":                user.Role,
		"has_completed_setup": user.HasCompletedSetup,
	}
	if user.Image.Valid {
		resp["image"] = user.Image.String
	} else {
		resp["image"] = nil
	}
	if user.CoverImage.Valid {
		resp["cover_image"] = user.CoverImage.String
	} else {
		resp["cover_image"] = nil
	}
	return c.JSON(http.StatusOK, resp)
}
