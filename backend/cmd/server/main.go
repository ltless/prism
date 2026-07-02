package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ltless/prism/internal/api"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/config"
	"github.com/ltless/prism/internal/db"
	mw "github.com/ltless/prism/internal/media"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	global, err := db.NewGlobalDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to init global DB: %v", err)
	}
	defer global.Close()

	tenantPool := db.NewTenantPool(global.DB)
	defer tenantPool.Close()

	jwtDuration, err := time.ParseDuration(cfg.JWTDuration)
	if err != nil {
		log.Printf("Warning: invalid JWT_DURATION '%s', using default 168h: %v", cfg.JWTDuration, err)
		jwtDuration = 168 * time.Hour
	}
	jwt := auth.NewJWTManager(cfg.JWTSecret, jwtDuration)

	masterKey, err := mw.LoadMasterKey(cfg.EncryptionMasterKey)
	if err != nil {
		log.Fatalf("invalid encryption master key: %v", err)
	}

	e := api.New(global, tenantPool, jwt, cfg, masterKey)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("Starting server on :%s", cfg.Port)
		e.Server.ReadTimeout = 30 * time.Second
		e.Server.WriteTimeout = 60 * time.Second
		e.Server.IdleTimeout = 120 * time.Second
		if err := e.Start(":" + cfg.Port); err != nil && err != http.ErrServerClosed {
			serverErr <- err
			return
		}
		serverErr <- nil
	}()

	select {
	case <-ctx.Done():
		log.Println("Shutting down gracefully...")
	case err := <-serverErr:
		if err != nil {
			log.Printf("Server failed: %v", err)
		}
	}
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
}
