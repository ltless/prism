package ai

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
	Variant string `json:"variant"`
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
		log.Printf("EmbedImage error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
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
		log.Printf("EmbedText error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
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
		log.Printf("GenerateTags error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
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
	if body.Variant == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "variant required")
	}
	if err := h.svc.LoadModel(body.Variant); err != nil {
		log.Printf("LoadModel error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":       true,
		"activeVariant": body.Variant,
	})
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
		log.Printf("AestheticScore error: %v", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "internal error")
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) GPUStatus(c echo.Context) error {
	if _, err := auth.GetClaimsOrErr(c); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"available": h.svc.HasGPU(),
	})
}
