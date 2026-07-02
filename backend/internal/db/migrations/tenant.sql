-- Schema matches Next.js Drizzle schema (prism.db) exactly
-- so both Go backend and Next.js read/write the same database.

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    parent_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    folder_type TEXT NOT NULL DEFAULT 'manual',
    filter_query TEXT,
    FOREIGN KEY (parent_id) REFERENCES folders(id)
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    hash TEXT NOT NULL,
    captured_at INTEGER,
    metadata TEXT,
    folder_id TEXT,
    is_favorite INTEGER DEFAULT false,
    is_trash INTEGER DEFAULT false,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    duration INTEGER,
    transcode_status TEXT,
    is_vault INTEGER DEFAULT false,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_hash ON media (hash);
CREATE INDEX IF NOT EXISTS idx_media_trash ON media (is_trash);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media (folder_id);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media (is_favorite);
CREATE INDEX IF NOT EXISTS idx_media_vault ON media (is_vault);
CREATE INDEX IF NOT EXISTS media_trash_created_idx ON media (is_trash, created_at);

CREATE TABLE IF NOT EXISTS media_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    media_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    score REAL NOT NULL,
    category TEXT NOT NULL,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags (media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags (tag);
CREATE INDEX IF NOT EXISTS idx_media_tags_category ON media_tags (category);
CREATE INDEX IF NOT EXISTS idx_media_tags_cat_score ON media_tags (category, score);

CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    meta TEXT,
    source TEXT,
    timestamp TEXT NOT NULL
);
