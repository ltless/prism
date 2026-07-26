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
}

func Load() (*Config, error) {
	godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be set and at least 32 bytes long (got %d)", len(jwtSecret))
	}

	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		JWTSecret:     jwtSecret,
		JWTDuration:   getEnv("JWT_DURATION", "168h"),
		GlobalDB:      getEnv("GLOBAL_DB_PATH", "../prism.db"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgresql://prism:prism_dev_2024@localhost:5432/prism"),
		StoragePath:   getEnv("STORAGE_PATH", "../storage/users"),
		ModelsPath:    getEnv("MODELS_PATH", "../storage/models"),
		CORSOrigin:    getEnv("CORS_ORIGIN", "http://localhost:3000"),
		TrustProxy:    getEnv("TRUST_PROXY", "false") == "true",
		InviteCode:    os.Getenv("REGISTRATION_INVITE_CODE"),
		RequireInvite: getEnv("REQUIRE_INVITE", "true") == "true",
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
