import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  image text,
  cover_image text,
  has_completed_setup integer DEFAULT 0,
  vault_pin text,
  storage_limit integer,
  preferences text,
  created_at integer DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS folders (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text,
  parent_id text REFERENCES folders(id),
  folder_type text NOT NULL DEFAULT 'manual',
  filter_query text,
  created_at integer DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS media (
  id text PRIMARY KEY,
  title text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  width integer,
  height integer,
  hash text NOT NULL,
  captured_at integer,
  metadata text,
  folder_id text REFERENCES folders(id),
  is_favorite integer DEFAULT 0,
  is_trash integer DEFAULT 0,
  is_vault integer DEFAULT 0,
  updated_at integer DEFAULT (unixepoch()),
  created_at integer DEFAULT (unixepoch()),
  duration integer,
  transcode_status text
);

CREATE TABLE IF NOT EXISTS media_tags (
  id integer PRIMARY KEY AUTOINCREMENT,
  media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag text NOT NULL,
  score real NOT NULL,
  category text NOT NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
  id integer PRIMARY KEY AUTOINCREMENT,
  level text NOT NULL,
  message text NOT NULL,
  meta text,
  source text,
  timestamp text NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  id text PRIMARY KEY DEFAULT 'global',
  ai text,
  updated_at integer,
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_media_hash ON media(hash);
CREATE INDEX IF NOT EXISTS idx_media_trash ON media(is_trash);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media(is_favorite);
CREATE INDEX IF NOT EXISTS idx_media_vault ON media(is_vault);
CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag);
CREATE INDEX IF NOT EXISTS idx_media_tags_category ON media_tags(category);
CREATE INDEX IF NOT EXISTS idx_media_tags_cat_score ON media_tags(category, score);
`;

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_TABLES_SQL);
  const db = drizzle(sqlite, { schema });
  const cleanup = () => { sqlite.close(); };
  return { db, sqlite, cleanup };
}

export function seedUser(
  db: BetterSQLite3Database<typeof schema>,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
) {
  const id = crypto.randomUUID();
  const suffix = crypto.randomUUID().slice(0, 8);
  db.insert(schema.users).values({
    id,
    username: `testuser_${suffix}`,
    passwordHash: '$2a$10$mockhash',
    role: 'user',
    hasCompletedSetup: true,
    createdAt: new Date(),
    ...overrides,
  }).run();
  const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!row) throw new Error('seedUser: failed to insert user');
  return row;
}
