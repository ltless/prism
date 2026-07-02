package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/ltless/prism/internal/ai"
	"github.com/ltless/prism/internal/api"
	"github.com/ltless/prism/internal/auth"
	"github.com/ltless/prism/internal/config"
	"github.com/ltless/prism/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	global, err := db.NewGlobalDB(cfg.GlobalDB)
	if err != nil {
		log.Fatalf("Failed to init global DB: %v", err)
	}
	defer global.Close()

	tenantPool := db.NewTenantPool(cfg.StoragePath)
	defer tenantPool.Close()

	jwtDuration, err := time.ParseDuration(cfg.JWTDuration)
	if err != nil {
		log.Printf("Warning: invalid JWT_DURATION '%s', using default 168h: %v", cfg.JWTDuration, err)
		jwtDuration = 168 * time.Hour
	}
	jwt := auth.NewJWTManager(cfg.JWTSecret, jwtDuration)

	if err := ai.InitORT(cfg.ONNXLibPath); err != nil {
		log.Fatalf("Failed to init ONNX Runtime: %v", err)
	}
	aiEngine, err := ai.NewEngine(cfg.ModelsPath)
	if err != nil {
		log.Fatalf("Failed to create AI engine: %v", err)
	}
	aiTokenizer, err := ai.NewTokenizer(
		filepath.Join(cfg.ModelsPath, "Xenova/clip-vit-large-patch14/vocab.json"),
		filepath.Join(cfg.ModelsPath, "Xenova/clip-vit-large-patch14/merges.txt"),
	)
	if err != nil {
		log.Printf("Warning: AI tokenizer init failed (models not downloaded yet): %v", err)
		aiTokenizer = nil
	}
	if aiTokenizer == nil {
		log.Println("AI tokenizer unavailable (download models in Settings to enable)")
	}

	e := api.New(global, tenantPool, jwt, cfg, aiEngine, aiTokenizer)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("Starting server on :%s", cfg.Port)
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
