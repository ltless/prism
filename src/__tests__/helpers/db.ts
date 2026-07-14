import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://prism:prism_dev_2024@localhost:5432/prism_test';

const TRUNCATE_TABLES = [
  'media_tags',
  'media',
  'folders',
  'transcode_queue',
  'error_logs',
  'app_settings',
  'app_config',
  'users',
];

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  image TEXT,
  cover_image TEXT,
  has_completed_setup BOOLEAN NOT NULL DEFAULT FALSE,
  vault_pin TEXT,
  storage_limit INTEGER,
  preferences TEXT,
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
  value TEXT
);

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
  is_vault BOOLEAN DEFAULT FALSE,
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  duration INTEGER,
  transcode_status TEXT,
  FOREIGN KEY (folder_id) REFERENCES folders(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  source TEXT,
  timestamp TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_user_hash ON media (user_id, hash);
CREATE INDEX IF NOT EXISTS idx_media_trash ON media (is_trash);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media (folder_id);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media (is_favorite);
CREATE INDEX IF NOT EXISTS idx_media_vault ON media (is_vault);
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media (user_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags (media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags (tag);
CREATE INDEX IF NOT EXISTS idx_media_tags_category ON media_tags (category);
CREATE INDEX IF NOT EXISTS idx_media_tags_cat_score ON media_tags (category, score);
CREATE INDEX IF NOT EXISTS idx_media_tags_user_id ON media_tags (user_id);
`;

export async function createTestDb() {
  const pool = new Pool({ connectionString: TEST_DB_URL });

  // Ensure schema exists
  await pool.query(CREATE_TABLES_SQL);

  // Truncate all tables for fresh state
  for (const table of TRUNCATE_TABLES) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }

  const db = drizzle(pool, { schema });

  const cleanup = async () => {
    for (const table of TRUNCATE_TABLES) {
      await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }
    await pool.end();
  };

  return { db, pool, cleanup };
}

export async function seedUser(
  db: NodePgDatabase<typeof schema>,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const suffix = crypto.randomUUID().slice(0, 8);
  await db.insert(schema.users).values({
    id,
    username: `testuser_${suffix}`,
    passwordHash: '$2a$10$mockhash',
    role: 'user',
    hasCompletedSetup: true,
    ...overrides,
  });
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!rows[0]) throw new Error('seedUser: failed to insert user');
  return rows[0];
}

/** Convenience: seed a minimal user for FK constraints in integration tests */
export async function seedTestUser(db: NodePgDatabase<typeof schema>, id = 'u1') {
  await db.insert(schema.users).values({
    id,
    username: `testuser_${id}`,
    passwordHash: 'hash',
    role: 'user',
    hasCompletedSetup: false,
  });
}
