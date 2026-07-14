import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/services/db/schema";
import { DEFAULT_USER_QUOTA_BYTES } from "@/core/constants";

export const STORAGE_DEFAULT_KEY = "storage_default_quota";

/**
 * Parse the stored app_settings value into an effective bytes limit.
 *   null/undefined (no row) → 10 GiB fallback
 *   "unlimited"            → null (unlimited)
 *   numeric string         → that many bytes
 */
export function parseGlobalDefaultBytes(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return DEFAULT_USER_QUOTA_BYTES;
  if (value === "unlimited") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_USER_QUOTA_BYTES;
  return n;
}

/** Read the admin-configured global default quota from app_settings. null = unlimited. */
export async function getGlobalStorageDefaultBytes(db: NodePgDatabase<typeof schema>): Promise<number | null> {
  const rows = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, STORAGE_DEFAULT_KEY))
    .limit(1);
  return parseGlobalDefaultBytes(rows[0]?.value ?? null);
}

/**
 * Resolve the effective storage limit for a user.
 *   explicit per-user limit (future page) wins
 *   admin default → unlimited
 *   else → global default (null = unlimited)
 */
export function effectiveStorageLimit(
  role: string | undefined,
  userStorageLimit: number | null,
  globalDefault: number | null,
): number | null {
  if (userStorageLimit !== null) return userStorageLimit;
  if (role === "admin") return null;
  return globalDefault;
}
