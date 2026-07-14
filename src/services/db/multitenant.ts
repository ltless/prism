import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';
import { db } from './index';
import path from 'path';
import fs from 'fs/promises';
import { getStorageRoot } from '@/core/utils/paths';

export interface UserPaths {
  mediaDir: string;
  thumbDir: string;
}

export interface CachedUserDb {
  db: NodePgDatabase<typeof schema>;
  paths: UserPaths;
}

const pathCache = new Map<string, UserPaths>();

/**
 * Utility to get user-specific storage paths (media files, thumbnails).
 * Database is now shared PostgreSQL — no per-user DB files.
 */
export async function getUserPaths(userId: string): Promise<UserPaths> {
  const cached = pathCache.get(userId);
  if (cached) return cached;

  const userBaseDir = path.join(getStorageRoot(), 'users', userId);
  const mediaDir = path.join(userBaseDir, 'media');
  const thumbDir = path.join(mediaDir, 'thumbnails');

  const paths: UserPaths = { mediaDir, thumbDir };
  pathCache.set(userId, paths);
  return paths;
}

/**
 * Returns the shared PostgreSQL Drizzle instance + user file paths.
 * In the single-DB architecture, all tenant data lives in one PG database
 * with user_id column filtering. The db instance is shared across all users.
 */
export async function getUserDb(userId: string): Promise<CachedUserDb> {
  const paths = await getUserPaths(userId);
  await fs.mkdir(paths.thumbDir, { recursive: true });
  return { db, paths };
}
