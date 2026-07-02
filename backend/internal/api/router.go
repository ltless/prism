package api

import (
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/ltless/prism/internal/ai"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/config"
	"github.com/ltless/prism/internal/db"
	mediaH "github.com/ltless/prism/internal/api/media"
	folderH "github.com/ltless/prism/internal/api/folders"
	aiH "github.com/ltless/prism/internal/api/ai"
	configH "github.com/ltless/prism/internal/api/config"
	userH "github.com/ltless/prism/internal/api/users"
	mediaS "github.com/ltless/prism/internal/media"
	appmw "github.com/ltless/prism/internal/middleware"
)

func New(global *db.GlobalDB, tenantPool *db.TenantPool, jwt *auth.JWTManager, cfg *config.Config, aiEngine *ai.Engine, aiTokenizer *ai.Tokenizer) *echo.Echo {
	e := echo.New()

	// Only trust X-Forwarded-For when explicitly behind a known proxy. Default
	// (no IPExtractor) uses the socket peer address so attackers cannot spoof
	// the header to bypass rate limits or audit logs.
	if cfg.TrustProxy {
		e.IPExtractor = echo.ExtractIPFromXFFHeader()
	}

	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(appmw.CORS(cfg.CORSOrigin))

	rl := appmw.NewRateLimiter(100, time.Minute)
	e.Use(rl.Middleware())

	authSvc := auth.NewService(global.DB, jwt)
	authH := auth.NewHandler(authSvc)

	mediaStorage := mediaS.NewStorage(cfg.StoragePath)
	mediaSvc := mediaH.NewService(tenantPool)
	mediaHandler := mediaH.NewHandler(mediaSvc, mediaStorage)

	folderSvc := folderH.NewService(tenantPool)
	folderHandler := folderH.NewHandler(folderSvc)

	api := e.Group("/api/v1")

	// Stricter rate limit on auth endpoints to slow brute force.
	authRL := appmw.NewRateLimiter(10, time.Minute)
	authG := api.Group("/auth")
	authG.Use(authRL.Middleware())
	authG.POST("/login", authH.Login)
	authG.POST("/register", authH.Register)
	authG.POST("/logout", authH.Logout)

	protected := api.Group("")
	protected.Use(jwt.Middleware)
	protected.GET("/auth/me", authH.Me)

	mediaG := protected.Group("/media")
	mediaG.GET("", mediaHandler.List)
	mediaG.POST("", mediaHandler.Upload)
	mediaG.GET("/:id", mediaHandler.Get)
	mediaG.DELETE("/:id", mediaHandler.Delete)
	mediaG.PATCH("/:id", mediaHandler.Update)
	mediaG.PUT("/bulk/move", mediaHandler.BulkMove)
	mediaG.GET("/files/*", mediaHandler.ServeFile)

	foldersG := protected.Group("/folders")
	foldersG.GET("", folderHandler.List)
	foldersG.POST("", folderHandler.Create)
	foldersG.PUT("/:id", folderHandler.Update)
	foldersG.DELETE("/:id", folderHandler.Delete)

	configSvc := configH.NewService(global)
	configHandler := configH.NewHandler(configSvc)
	configG := protected.Group("/config")
	configG.GET("", configHandler.Get)
	configG.PUT("", configHandler.Update, auth.RequireAdmin)

	usersSvc := userH.NewService(global)
	usersHandler := userH.NewHandler(usersSvc)
	usersG := protected.Group("/users")
	usersG.GET("/me", usersHandler.GetProfile)
	usersG.PUT("/me", usersHandler.UpdateProfile)
	usersG.PUT("/me/storage-limit", usersHandler.UpdateStorageLimit, auth.RequireAdmin)
	usersG.POST("/me/setup-complete", usersHandler.SetupComplete)

	aiSvc := aiH.NewService(aiEngine, aiTokenizer, mediaStorage)
	aiHandler := aiH.NewHandler(aiSvc)
	aiG := protected.Group("/ai")
	aiG.POST("/embed-image", aiHandler.EmbedImage)
	aiG.POST("/embed-text", aiHandler.EmbedText)
	aiG.POST("/generate-tags", aiHandler.GenerateTags)
	aiG.POST("/aesthetic-score", aiHandler.AestheticScore)
	aiG.POST("/load-model", aiHandler.LoadModel, auth.RequireAdmin)
	aiG.GET("/status", aiHandler.Status)
	aiG.GET("/gpu-status", aiHandler.GPUStatus)

	e.Server.RegisterOnShutdown(rl.Close)
	e.Server.RegisterOnShutdown(authRL.Close)

	return e
}
