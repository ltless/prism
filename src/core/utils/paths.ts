import path from "path";
import fs from "fs/promises";

const ROOT = process.cwd();

export function getStorageRoot(): string {
  return path.join(ROOT, "storage");
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "postgresql://prism:***@localhost:5432/prism";
}

// Kept for backward compat — drizzle migrations folder
export function getDrizzleDir(): string {
  return path.join(ROOT, "drizzle");
}

export interface UserPaths {
  mediaDir: string;
  thumbDir: string;
}

const pathCache = new Map<string, UserPaths>();

/** Get user-specific storage paths (media files, thumbnails). */
export async function getUserPaths(userId: string): Promise<UserPaths> {
  const cached = pathCache.get(userId);
  if (cached) return cached;

  const userBaseDir = path.join(getStorageRoot(), "users", userId);
  const mediaDir = path.join(userBaseDir, "media");
  const thumbDir = path.join(mediaDir, "thumbnails");

  const paths: UserPaths = { mediaDir, thumbDir };
  pathCache.set(userId, paths);
  return paths;
}
