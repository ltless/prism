import { z } from "zod";
import type { SmartFolderFilter } from "./types";

export const SmartFolderFilterSchema = z.object({
  categories: z.array(z.string().min(1).max(50)).max(20),
  minScore: z.number().min(0).max(1),
});

// Safely parse a stored filterQuery JSON string into a SmartFolderFilter.
// Returns null on any malformed/legacy data so read paths never crash and
// never hand attacker-controlled shapes to query builders.
export function parseSmartFolderFilter(
  json: string | null | undefined
): SmartFolderFilter | null {
  if (!json) return null;
  try {
    const raw: unknown = JSON.parse(json);
    const parsed = SmartFolderFilterSchema.safeParse(raw);
    return parsed.success ? (parsed.data as SmartFolderFilter) : null;
  } catch {
    return null;
  }
}
