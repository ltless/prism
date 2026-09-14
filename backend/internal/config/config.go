package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	JWTSecret         string
	JWTDuration       string
	GlobalDB          string
	DatabaseURL       string // PostgreSQL connection string (migration target)
	StoragePath       string
	ModelsPath        string
	CORSOrigin        string
	TrustProxy        bool
	InviteCode        string
	RequireInvite     bool
	NukeToken         string
}

func Load() (*Config, error) {
	godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be set and at least 32 bytes long (got %d)", len(jwtSecret))
	}

	if os.Getenv("DATABASE_URL") == "" {
		return nil, fmt.Errorf("DATABASE_URL must be set (see backend/.env.example)")
	}

	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		JWTSecret:     jwtSecret,
		JWTDuration:   getEnv("JWT_DURATION", "168h"),
		GlobalDB:      getEnv("GLOBAL_DB_PATH", "../prism.db"),
		// No committed default: DATABASE_URL must come from backend/.env or
		// the environment. Failing later with "DATABASE_URL not set" beats
		// silently connecting with a known password.
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		StoragePath:   getEnv("STORAGE_PATH", "../storage/users"),
		ModelsPath:    getEnv("MODELS_PATH", "../storage/models"),
		CORSOrigin:    getEnv("CORS_ORIGIN", "http://localhost:3000"),
		TrustProxy:    getEnv("TRUST_PROXY", "false") == "true",
		InviteCode:    os.Getenv("REGISTRATION_INVITE_CODE"),
		RequireInvite: getEnv("REQUIRE_INVITE", "true") == "true",
		NukeToken:     os.Getenv("NUKE_CONFIRMATION_TOKEN"),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
