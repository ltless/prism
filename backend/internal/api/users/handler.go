package users

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/ltless/prism/internal/auth"
	mw "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/vault"
)

const maxPreferencesSize = 10 * 1024        // 10KB
const maxProfileImageSize = 5 * 1024 * 1024 // 5MB

type Handler struct {
	svc      *Service
	storage  *mw.Storage
	vaultMgr *vault.Manager
}

func NewHandler(svc *Service, storage *mw.Storage, vaultMgr *vault.Manager) *Handler {
	return &Handler{svc: svc, storage: storage, vaultMgr: vaultMgr}
}

// UploadProfileImage accepts a multipart file + type ("image"|"coverImage"),
// validates it, stores it under the user's .profile/ dir and points
// users.image / users.cover_image at it. All file writes go through the Go
// storage layer — Next.js never touches the filesystem.
func (h *Handler) UploadProfileImage(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}

	kind := c.FormValue("type")
	if kind != "image" && kind != "coverImage" {
		return echo.NewHTTPError(http.StatusBadRequest, "type must be image or coverImage")
	}

	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "no file uploaded")
	}
	defer file.Close()

	if c.Request().ContentLength > maxProfileImageSize {
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 5MB)")
	}
	data, err := io.ReadAll(io.LimitReader(file, maxProfileImageSize+1))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "read failed")
	}
	if len(data) > maxProfileImageSize {
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "file too large (max 5MB)")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if err := h.storage.ValidateUpload(data, ext); err != nil {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, err.Error())
	}

	relPath, err := h.storage.SaveProfileImage(claims.UserID, data, ext)
	if err != nil {
		log.Printf("SaveProfileImage error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "save failed")
	}

	var imageErr error
	if kind == "image" {
		imageErr = h.svc.UpdateProfile(claims.UserID, &relPath, nil, nil)
	} else {
		imageErr = h.svc.UpdateProfile(claims.UserID, nil, &relPath, nil)
	}
	if imageErr != nil {
		log.Printf("UpdateProfile error: %v", imageErr)
		return echo.NewHTTPError(http.StatusInternalServerError, "update failed")
	}

	return c.JSON(http.StatusOK, map[string]string{"path": relPath})
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

	// storage_limit semantics (F6): NULL = unlimited, 0 = zero bytes allowed.
	// json.RawMessage distinguishes JSON null (unlimited) from an absent field
	// (rejected); negative numbers are rejected.
	var body struct {
		StorageLimit json.RawMessage `json:"storage_limit"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	limit := sql.NullInt64{}
	switch {
	case len(body.StorageLimit) == 0:
		return echo.NewHTTPError(http.StatusBadRequest, "storage_limit is required")
	case string(body.StorageLimit) == "null":
		// unlimited — leave limit invalid (NULL)
	default:
		var n int64
		if err := json.Unmarshal(body.StorageLimit, &n); err != nil || n < 0 {
			return echo.NewHTTPError(http.StatusBadRequest, "storage_limit must be a non-negative integer or null")
		}
		limit = sql.NullInt64{Int64: n, Valid: true}
	}

	if err := h.svc.UpdateStorageLimit(claims.UserID, limit); err != nil {
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
	if locked, retry := h.svc.VaultLocked(claims.UserID); locked {
		c.Response().Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many failed attempts, try again later")
	}
	ok, err := h.svc.VerifyVaultPin(claims.UserID, body.Pin)
	if err != nil {
		log.Printf("VerifyVaultPin error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid pin")
	}
	// A successful unlock grants a short-lived read token so the vault page
	// can fetch media server-side without re-sending the PIN on every
	// request. The token lives in an HttpOnly cookie (vault_token).
	token, err := h.vaultMgr.Issue(claims.UserID)
	if err != nil {
		log.Printf("Issue vault token error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	h.vaultMgr.SetCookie(c, token)
	return c.JSON(http.StatusOK, map[string]bool{"valid": true})
}

// LockVault revokes the vault read token for this session, so the frontend can
// lock explicitly (tab hidden, idle timeout) instead of waiting for the TTL.
func (h *Handler) LockVault(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	h.vaultMgr.ClearCookie(c)
	return c.JSON(http.StatusOK, map[string]bool{"success": true})
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
	// Disabling the PIN must not leave a still-valid unlock token behind.
	h.vaultMgr.ClearCookie(c)
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
