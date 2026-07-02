import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs/promises';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getStorageRoot, getDrizzleDir } from '@/core/utils/paths';
import { logger } from '@/core/utils/logger';

export interface UserPaths {
 mediaDir: string;
 thumbDir: string;
 dbPath: string;
}

export interface CachedUserDb {
  db: BetterSQLite3Database<typeof schema>;
  paths: UserPaths;
  sqlite: InstanceType<typeof Database>;
}

/**
 * In-memory connection cache keyed by userId.
 * LRU eviction to prevent unbounded growth.
 * TTL-based eviction for idle connections.
 *
 * `pendingDb` holds in-flight connection creation promises so concurrent
 * callers for the same userId share one creation attempt instead of racing
 * and leaking the losing Database handle.
 */
const MAX_CACHED_USERS = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;
const dbCache = new Map<string, { entry: CachedUserDb; accessedAt: number }>();
const pathCache = new Map<string, UserPaths>();
const pendingDb = new Map<string, Promise<CachedUserDb>>();

function lruSet<T>(cache: Map<string, T>, key: string, value: T, max: number, onEvict?: (entry: T) => void) {
 if (cache.size >= max) {
 const oldest = cache.keys().next().value;
 if (oldest) {
 const entry = cache.get(oldest);
 if (entry && onEvict) onEvict(entry);
 cache.delete(oldest);
 }
 }
 cache.set(key, value);
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer() {
 if (cleanupTimer) return;
 cleanupTimer = setInterval(() => {
 const now = Date.now();
 for (const [userId, cached] of dbCache) {
 if (now - cached.accessedAt > CACHE_TTL_MS) {
  try { cached.entry.sqlite.close(); } catch (err) { logger.error("Cache cleanup sqlite close failed", { error: err instanceof Error ? err.message : String(err) }) }
 dbCache.delete(userId);
 pathCache.delete(userId);
 }
 }
 }, CLEANUP_INTERVAL_MS);
 if (cleanupTimer.unref) cleanupTimer.unref();
}

function touchCache(userId: string) {
  const cached = dbCache.get(userId);
  if (cached) {
    cached.accessedAt = Date.now();
    dbCache.delete(userId);
    dbCache.set(userId, cached);
  }
}

/**
 * Utility to get user-specific storage paths.
 */
export async function getUserPaths(userId: string): Promise<UserPaths> {
 const cached = pathCache.get(userId);
 if (cached) return cached;

 const userBaseDir = path.join(getStorageRoot(), 'users', userId);
 const mediaDir = path.join(userBaseDir, 'media');
 const thumbDir = path.join(mediaDir, 'thumbnails');
 const dbPath = path.join(userBaseDir, 'prism.db');

 const paths: UserPaths = { mediaDir, thumbDir, dbPath };
 lruSet(pathCache, userId, paths, MAX_CACHED_USERS * 2);
 return paths;
}

/**
 * Dynamic Database Factory — returns a cached Drizzle instance for a specific user.
 *
 * Concurrent calls for the same userId share a single in-flight creation promise
 * via `pendingDb`. Without this, two callers would each open a Database handle;
 * the second `dbCache.set` would overwrite the first and leak its sqlite handle.
 */
export async function getUserDb(userId: string): Promise<CachedUserDb> {
  const cached = dbCache.get(userId);
  if (cached) {
    touchCache(userId);
    return cached.entry;
  }

  const pending = pendingDb.get(userId);
  if (pending) return pending;

  const promise = (async () => {
    const paths = await getUserPaths(userId);

    await fs.mkdir(paths.thumbDir, { recursive: true });

    const sqlite = new Database(paths.dbPath);

    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite, { schema });

    try {
      const migrationsPath = getDrizzleDir();
      migrate(db, { migrationsFolder: migrationsPath });
    } catch (error) {
      logger.error("Migration failed for user", { userId, error: String(error) });
      sqlite.close();
      throw error;
    }

    const entry: CachedUserDb = { db, sqlite, paths };
    dbCache.set(userId, { entry, accessedAt: Date.now() });
    lruSet(dbCache, userId, { entry, accessedAt: Date.now() }, MAX_CACHED_USERS, (evicted) => {
      try { evicted.entry.sqlite.close(); } catch (err) { logger.error("LRU eviction sqlite close failed", { error: err instanceof Error ? err.message : String(err) }) }
    });

    startCleanupTimer();

    return entry;
  })();

  pendingDb.set(userId, promise);
  try {
    return await promise;
  } finally {
    pendingDb.delete(userId);
  }
}
