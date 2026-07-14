-- PostgreSQL schema for prism
-- Merged from global.sql + tenant.sql (single-DB architecture with user_id tenancy)

-- ===== GLOBAL TABLES =====

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    image TEXT,
    cover_image TEXT,
    vault_pin TEXT,
    storage_limit BIGINT,
    preferences TEXT,
    has_completed_setup BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
    id TEXT PRIMARY KEY DEFAULT 'global',
    ai TEXT,
    updated_at INTEGER,
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ===== TENANT TABLES (with user_id column) =====

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    parent_id TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    folder_type TEXT NOT NULL DEFAULT 'manual',
    filter_query TEXT,
    FOREIGN KEY (parent_id) REFERENCES folders(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    hash TEXT NOT NULL,
    captured_at BIGINT,
    metadata JSONB,
    folder_id TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_trash BOOLEAN DEFAULT FALSE,
    updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    duration INTEGER,
    transcode_status TEXT,
    is_vault BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (folder_id) REFERENCES folders(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_user_hash ON media (user_id, hash);
CREATE INDEX IF NOT EXISTS idx_media_trash ON media (is_trash);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media (folder_id);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media (is_favorite);
CREATE INDEX IF NOT EXISTS idx_media_vault ON media (is_vault);
CREATE INDEX IF NOT EXISTS media_trash_created_idx ON media (is_trash, created_at);
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media (user_id);

CREATE TABLE IF NOT EXISTS media_tags (
    id SERIAL PRIMARY KEY,
    media_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    score REAL NOT NULL,
    category TEXT NOT NULL,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags (media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags (tag);
CREATE INDEX IF NOT EXISTS idx_media_tags_category ON media_tags (category);
CREATE INDEX IF NOT EXISTS idx_media_tags_cat_score ON media_tags (category, score);
CREATE INDEX IF NOT EXISTS idx_media_tags_user_id ON media_tags (user_id);

CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    meta TEXT,
    source TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs (user_id);

CREATE TABLE IF NOT EXISTS transcode_queue (
    id SERIAL PRIMARY KEY,
    media_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::INTEGER,
    started_at INTEGER,
    finished_at INTEGER,
    error TEXT,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcode_queue_user_id ON transcode_queue (user_id);
