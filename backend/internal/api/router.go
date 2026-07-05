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
	systemH "github.com/ltless/prism/internal/api/system"
	userH "github.com/ltless/prism/internal/api/users"
	mediaS "github.com/ltless/prism/internal/media"
	"github.com/ltless/prism/internal/sidecar"
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
	e.Use(echomw.BodyLimit("1MB"))
	e.Use(appmw.CORS(cfg.CORSOrigin))

	rl := appmw.NewRateLimiter(100, time.Minute)
	e.Use(rl.Middleware())

	authSvc := auth.NewService(global.DB, jwt, cfg.InviteCode, cfg.RequireInvite)
	authH := auth.NewHandler(authSvc)

	mediaStorage := mediaS.NewStorage(cfg.StoragePath)
	mediaSvc := mediaH.NewService(tenantPool)
	mediaHandler := mediaH.NewHandler(mediaSvc, mediaStorage)

	folderSvc := folderH.NewService(tenantPool)
	folderHandler := folderH.NewHandler(folderSvc)

	systemSvc := systemH.NewService(tenantPool)
	systemHandler := systemH.NewHandler(systemSvc)

	sidecarClient := sidecar.NewClient(cfg.SidecarURL, cfg.SidecarKey)

	api := e.Group("/api/v1")

	// Unauthenticated health check.
	api.GET("/health", systemHandler.Health)

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
	protected.POST("/auth/change-password", authH.ChangePassword)

	mediaG := protected.Group("/media")
	mediaG.GET("", mediaHandler.List)
	mediaG.POST("", mediaHandler.Upload, echomw.BodyLimit("210MB"))
	mediaG.GET("/:id", mediaHandler.Get)
	mediaG.DELETE("/:id", mediaHandler.Delete)
	mediaG.PATCH("/:id", mediaHandler.Update)
	mediaG.PUT("/bulk/move", mediaHandler.BulkMove)
	mediaG.GET("/files/*", mediaHandler.ServeFile)
	mediaG.POST("/bulk/favorite", mediaHandler.BulkFavorite)
	mediaG.POST("/bulk/trash", mediaHandler.BulkTrash)
	mediaG.POST("/bulk/restore", mediaHandler.BulkRestore)
	mediaG.POST("/empty-trash", mediaHandler.EmptyTrash)
	mediaG.POST("/bulk/vault", mediaHandler.BulkVault)
	mediaG.POST("/batch/ai-tags", mediaHandler.BatchAITags)
	mediaG.POST("/batch/aesthetic-score", mediaHandler.BatchAestheticScore)
	mediaG.POST("/batch/ai-status", mediaHandler.BatchAIStatus)
	mediaG.POST("/batch/transcode-status", mediaHandler.BatchTranscodeStatus)
	mediaG.POST("/resolve-duplicate", mediaHandler.ResolveDuplicate)
	mediaG.GET("/dashboard", mediaHandler.Dashboard)
	mediaG.GET("/duplicates", mediaHandler.Duplicates)
	mediaG.GET("/search", mediaHandler.Search)
	mediaG.POST("/:id/save-editor", mediaHandler.SaveEditor)
	mediaG.PATCH("/hash/:hash", mediaHandler.UpdateByHash)
	mediaG.POST("/nuke", mediaHandler.Nuke)
	mediaG.POST("/auto-cleanup", mediaHandler.AutoCleanup)
	mediaG.GET("/count/tagged", mediaHandler.CountTagged)
	mediaG.GET("/count/scored", mediaHandler.CountScored)

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
	configG.GET("/storage-default", configHandler.GetStorageDefault)
	configG.PUT("/storage-default", configHandler.UpdateStorageDefault, auth.RequireAdmin)

	usersSvc := userH.NewService(global, tenantPool)
	usersHandler := userH.NewHandler(usersSvc)
	usersG := protected.Group("/users")
	usersG.GET("/me", usersHandler.GetProfile)
	usersG.PUT("/me", usersHandler.UpdateProfile)
	usersG.PUT("/me/storage-limit", usersHandler.UpdateStorageLimit, auth.RequireAdmin)
	usersG.POST("/me/setup-complete", usersHandler.SetupComplete)
	usersG.POST("/me/vault-pin", usersHandler.SetVaultPin)
	usersG.POST("/me/vault-pin/verify", usersHandler.VerifyVaultPin)
	usersG.DELETE("/me/vault-pin", usersHandler.DisableVaultPin)
	usersG.GET("/me/vault-pin/status", usersHandler.GetVaultPinStatus)
	usersG.PUT("/me/username", usersHandler.UpdateUsername)
	usersG.GET("/me/storage-usage", usersHandler.GetStorageUsage)

	aiSvc := aiH.NewService(aiEngine, aiTokenizer, mediaStorage)
	aiSvc.SetSidecarClient(sidecarClient)
	aiHandler := aiH.NewHandler(aiSvc)
	aiG := protected.Group("/ai")
	aiG.POST("/embed-image", aiHandler.EmbedImage)
	aiG.POST("/embed-text", aiHandler.EmbedText)
	aiG.POST("/generate-tags", aiHandler.GenerateTags)
	aiG.POST("/aesthetic-score", aiHandler.AestheticScore)
	aiG.POST("/load-model", aiHandler.LoadModel, auth.RequireAdmin)
	aiG.GET("/status", aiHandler.Status)
	aiG.GET("/gpu-status", aiHandler.GPUStatus)
	aiG.GET("/sidecar-status", aiHandler.SidecarStatus)
	aiG.GET("/sidecar/gpu-status", aiHandler.SidecarGPUStatus)
	aiG.GET("/sidecar/model-status", aiHandler.SidecarModelStatus)
	aiG.POST("/download-model", aiHandler.DownloadModel, auth.RequireAdmin)

	systemG := protected.Group("/system")
	systemG.GET("/stats", systemHandler.Stats)
	systemG.GET("/logs", systemHandler.Logs)
	systemG.POST("/logs", systemHandler.CreateLog)

	e.Server.RegisterOnShutdown(rl.Close)
	e.Server.RegisterOnShutdown(authRL.Close)

	return e
}
