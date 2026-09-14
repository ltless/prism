import { z } from "zod";

/**
 * Runtime response schemas for the highest-value API boundaries (F10).
 *
 * goFetch/goFetchUpload cast `res.json() as Promise<T>` — a type-level
 * assertion with zero runtime guarantee. These schemas make drift fail loudly
 * at the boundary instead of as an `undefined` crash three components away.
 *
 * TODO(F10): extend schema coverage to the rest of the API surface
 * incrementally (folders, users, config, system). Only critical
 * UI-state feeds are covered in this first pass: auth session (/auth/me),
 * media list/item, and the upload response.
 *
 * Schemas are deliberately loose (`passthrough`, nullable optionals): they
 * assert the fields the UI actually reads, not the full backend contract, so
 * additive backend changes don't break the client.
 */

export class ApiSchemaError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(
      `Unexpected response shape from ${path}: ${issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`,
    );
    this.name = "ApiSchemaError";
  }
}

/** Validate a parsed JSON body against a schema, or throw ApiSchemaError. */
export function validateApiResponse<T>(
  path: string,
  schema: z.ZodType<T>,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiSchemaError(path, result.error.issues);
  }
  return result.data;
}

export const meResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  image: z.string().nullable().optional(),
  cover_image: z.string().nullable().optional(),
  has_completed_setup: z.boolean().optional(),
});

export const mediaItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    filePath: z.string(),
    mimeType: z.string(),
    size: z.number(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    hash: z.string(),
    isFavorite: z.boolean().optional(),
    isTrash: z.boolean().optional(),
    isVault: z.boolean().nullable().optional(),
    folderId: z.string().nullable().optional(),
    capturedAt: z.number().nullable().optional(),
    updatedAt: z.number().nullable().optional(),
    createdAt: z.number().nullable().optional(),
    duration: z.number().nullable().optional(),
    transcodeStatus: z.string().nullable().optional(),
  })
  .passthrough();

export const mediaListSchema = z.object({
  items: z.array(mediaItemSchema),
  total: z.number(),
});

export const uploadResponseSchema = z
  .object({
    success: z.boolean(),
    isDuplicate: z.boolean().optional(),
    mediaId: z.string().optional(),
    transcodeStatus: z.string().optional(),
  })
  .passthrough();
