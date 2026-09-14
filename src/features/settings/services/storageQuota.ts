import { DEFAULT_USER_QUOTA_BYTES } from "@/core/constants";

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

/** Resolve the effective storage limit for a user. */
export function effectiveStorageLimit(
  role: string | undefined,
  userStorageLimit: number | null,
  globalDefault: number | null,
): number | null {
  if (userStorageLimit !== null) return userStorageLimit;
  if (role === "admin") return null;
  return globalDefault;
}
