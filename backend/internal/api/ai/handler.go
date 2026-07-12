package ai

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

// aiErr maps service errors to HTTP responses: an opted-out AI returns 403 so
// clients can distinguish "AI disabled" from a real failure.
func (h *Handler) aiErr(err error) error {
	if errors.Is(err, ErrAIInactive) {
		return echo.NewHTTPError(http.StatusForbidden, "AI is not active")
	}
	log.Printf("ai error: %v", err)
	return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
}

type addTagBody struct {
	FilePath string  `json:"filePath"`
	Variant  string  `json:"variant,omitempty"`
}

type embedImageBody struct {
	FilePath string `json:"filePath"`
	Variant  string `json:"variant,omitempty"`
}

type embedTextBody struct {
	Text    string `json:"text"`
	Variant string `json:"variant,omitempty"`
}

type generateTagsBody struct {
	FilePath     string  `json:"filePath"`
	Variant      string  `json:"variant,omitempty"`
	TagThreshold float32 `json:"tagThreshold,omitempty"`
}

type loadModelBody struct {
	ModelID string `json:"modelId"`
}

type aestheticScoreBody struct {
	FilePath string `json:"filePath"`
}

func (h *Handler) EmbedImage(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body embedImageBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.FilePath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "filePath required")
	}
	emb, err := h.svc.EmbedImage(claims.UserID, body.FilePath)
	if err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"embedding": emb,
	})
}

func (h *Handler) EmbedText(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	var body embedTextBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.Text == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "text required")
	}
	emb, err := h.svc.EmbedText(body.Text)
	if err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"embedding": emb,
	})
}

func (h *Handler) GenerateTags(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body generateTagsBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.FilePath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "filePath required")
	}
	tags, err := h.svc.GenerateTags(claims.UserID, body.FilePath, body.TagThreshold)
	if err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"tags": tags,
	})
}

func (h *Handler) LoadModel(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	var body loadModelBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.ModelID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "modelId required")
	}
	if err := h.svc.LoadModel(body.ModelID); err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"modelId":  body.ModelID,
	})
}

func (h *Handler) Unload(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	if err := h.svc.Unload(); err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *Handler) Status(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	status := h.svc.GetStatus()
	return c.JSON(http.StatusOK, status)
}

func (h *Handler) AestheticScore(c echo.Context) error {
	claims, err := auth.GetClaimsOrErr(c)
	if err != nil {
		return err
	}
	var body aestheticScoreBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.FilePath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "filePath required")
	}
	res, err := h.svc.ScoreAesthetic(claims.UserID, body.FilePath)
	if err != nil {
		return h.aiErr(err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) SidecarStatus(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	if err := h.svc.SidecarHealth(); err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"reachable": false,
			"error":     err.Error(),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"reachable": true,
	})
}

func (h *Handler) SidecarGPUStatus(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	status, err := h.svc.SidecarGPUStatus()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "sidecar unreachable: "+err.Error())
	}
	return c.JSON(http.StatusOK, status)
}

func (h *Handler) SidecarModelStatus(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	status, err := h.svc.SidecarModelStatus()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "sidecar unreachable: "+err.Error())
	}
	return c.JSON(http.StatusOK, status)
}

func (h *Handler) GPUStatus(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"available": h.svc.HasGPU(),
	})
}

type downloadModelBody struct {
	ModelID string `json:"modelId"`
}

func (h *Handler) DownloadModel(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	var body downloadModelBody
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if body.ModelID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "modelId required")
	}
	result, err := h.svc.DownloadModel(body.ModelID)
	if err != nil {
		if errors.Is(err, ErrAIInactive) {
			return echo.NewHTTPError(http.StatusForbidden, "AI is not active")
		}
		return echo.NewHTTPError(http.StatusBadGateway, "sidecar unreachable: "+err.Error())
	}
	status := http.StatusOK
	if result.Started {
		status = http.StatusAccepted
	}
	return c.JSON(status, result)
}
