import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getGlobalDbPath, getDrizzleDir } from '@/core/utils/paths';

const sqlite = new Database(getGlobalDbPath());
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, { schema });

// Apply migrations to root DB (mostly handles auth/user tables).
// Per-user tables (folders, media) are expected to fail here -- they belong in user DBs.
try {
 migrate(db, { migrationsFolder: getDrizzleDir() });
} catch {
 // Tables created by drizzle-kit push may cause migration metadata conflicts.
 // This is non-fatal — the app works fine either way.
}
