package config

import (
	"encoding/hex"
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                       string
	JWTSecret                  string
	JWTDuration                string
	GlobalDB                   string
	DatabaseURL                string // PostgreSQL connection string (migration target)
	StoragePath                string
	ModelsPath                 string
	CORSOrigin                 string
	TrustProxy                 bool
	InviteCode                 string
	RequireInvite              bool
	NukeToken                  string
	EncryptionMasterKey        []byte // decoded 32-byte key
	MediaProcessingConcurrency int
	UploadRateLimit            int
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

	encKeyHex := os.Getenv("ENCRYPTION_MASTER_KEY")
	if len(encKeyHex) != 64 {
		return nil, fmt.Errorf("ENCRYPTION_MASTER_KEY must be set and be 64 hex characters (32 bytes), got %d chars", len(encKeyHex))
	}
	encKey, err := hex.DecodeString(encKeyHex)
	if err != nil {
		return nil, fmt.Errorf("ENCRYPTION_MASTER_KEY must be valid hex: %w", err)
	}

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   jwtSecret,
		JWTDuration: getEnv("JWT_DURATION", "168h"),
		GlobalDB:    getEnv("GLOBAL_DB_PATH", "../prism.db"),
		// No committed default: DATABASE_URL must come from backend/.env or
		// the environment. Failing later with "DATABASE_URL not set" beats
		// silently connecting with a known password.
		DatabaseURL:                os.Getenv("DATABASE_URL"),
		StoragePath:                getEnv("STORAGE_PATH", "../storage/users"),
		ModelsPath:                 getEnv("MODELS_PATH", "../storage/models"),
		CORSOrigin:                 getEnv("CORS_ORIGIN", "http://localhost:3000"),
		TrustProxy:                 getEnv("TRUST_PROXY", "false") == "true",
		InviteCode:                 os.Getenv("REGISTRATION_INVITE_CODE"),
		RequireInvite:              getEnv("REQUIRE_INVITE", "true") == "true",
		NukeToken:                  os.Getenv("NUKE_CONFIRMATION_TOKEN"),
		EncryptionMasterKey:        encKey,
		MediaProcessingConcurrency: getEnvInt("MEDIA_PROCESSING_CONCURRENCY", 4),
		UploadRateLimit:            getEnvInt("UPLOAD_RATE_LIMIT", 100),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return fallback
	}
	return n
}
