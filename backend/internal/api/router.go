package api

import (
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/config"
	"github.com/ltless/prism/internal/db"
	mediaH "github.com/ltless/prism/internal/api/media"
	folderH "github.com/ltless/prism/internal/api/folders"
	configH "github.com/ltless/prism/internal/api/config"
	systemH "github.com/ltless/prism/internal/api/system"
	userH "github.com/ltless/prism/internal/api/users"
	mediaS "github.com/ltless/prism/internal/media"
	appmw "github.com/ltless/prism/internal/middleware"
)

func New(global *db.GlobalDB, tenantPool *db.TenantPool, jwt *auth.JWTManager, cfg *config.Config) *echo.Echo {
	e := echo.New()

	// Only trust X-Forwarded-For when explicitly behind a known proxy.
	// Otherwise force the socket peer address — Echo's default RealIP() reads
	// the XFF header, which would let attackers rotate it to bypass rate limits.
	if cfg.TrustProxy {
		e.IPExtractor = echo.ExtractIPFromXFFHeader()
	} else {
		e.IPExtractor = echo.ExtractIPDirect()
	}

	e.Use(appmw.QuietLogger())
	e.Use(echomw.Recover())
	e.Use(appmw.CORS(cfg.CORSOrigin))

	rl := appmw.NewRateLimiter(100, time.Minute)
	rl.SkipPath("/api/v1/media")
	rl.SkipPath("/api/v1/media/files/*")
	e.Use(rl.Middleware())

	authSvc := auth.NewService(global.DB, jwt, cfg.InviteCode, cfg.RequireInvite)
	authSvc.SetClaimsValidator()
	authH := auth.NewHandler(authSvc)

	mediaStorage := mediaS.NewStorage(cfg.StoragePath)
	mediaSvc := mediaH.NewService(tenantPool, configH.NewService(global))
	mediaSvc.SetGlobalDB(global)
	mediaHandler := mediaH.NewHandler(mediaSvc, mediaStorage, cfg.NukeToken)

	folderSvc := folderH.NewService(tenantPool)
	folderHandler := folderH.NewHandler(folderSvc)

	systemSvc := systemH.NewService(tenantPool)
	systemHandler := systemH.NewHandler(systemSvc)

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
	mediaG.POST("/batch/transcode-status", mediaHandler.BatchTranscodeStatus)
	mediaG.POST("/resolve-duplicate", mediaHandler.ResolveDuplicate)
	mediaG.GET("/dashboard", mediaHandler.Dashboard)
	mediaG.GET("/duplicates", mediaHandler.Duplicates)
	mediaG.GET("/search", mediaHandler.Search)
	mediaG.POST("/:id/save-editor", mediaHandler.SaveEditor, echomw.BodyLimit("70MB"))
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
	usersHandler := userH.NewHandler(usersSvc, mediaStorage)
	usersG := protected.Group("/users")
	usersG.POST("/me/profile-image", usersHandler.UploadProfileImage)
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

	systemG := protected.Group("/system")
	systemG.GET("/stats", systemHandler.Stats)
	systemG.GET("/logs", systemHandler.Logs)
	systemG.POST("/logs", systemHandler.CreateLog)

	e.Server.RegisterOnShutdown(rl.Close)
	e.Server.RegisterOnShutdown(authRL.Close)

	return e
}
