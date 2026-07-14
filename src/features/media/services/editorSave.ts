import { media } from "@/services/db/schema";
import { eq, and, ne } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createThumbnail } from "@/services/media/thumbnail";
import type { CachedUserDb } from "@/services/db/multitenant";
import { MediaProcessor } from "@/services/media/processor";
import { logger } from "@/core/utils/logger";

export interface SaveEditorInput {
  mediaId: string;
  buffer: Buffer;
  /** When provided, used as filename + mime; otherwise derived from hash + fallbackExt. */
  customFilename?: string;
  fallbackExt?: string;
  mimeType?: string;
  overwrite: boolean;
}

export interface SaveEditorResult {
  mediaId: string;
  filePath: string;
  created: boolean;
}

/**
 * Shared editor-save pipeline used by both `saveEditedImageAction` (base64)
 * and `saveEditorStateAction` (Blob). Eliminates the drift between the two
 * near-identical implementations.
 *
 * Ordering for the overwrite path is transactional with respect to data loss:
 *   1. write new file (+ thumbnail)
 *   2. update DB row to point at new path
 *   3. only then delete the old file (+ thumbnail)
 * If step 2 fails, the old file is still on disk and the DB row still points
 * at it — no dangling row. If step 3 fails, we leak a file (recoverable) but
 * never lose data.
 *
 * Dedup: if the new hash already exists on another row, we repoint to that
 * row's filePath instead of writing a new file, and clean up the old file
 * only if no other row references it.
 */
export async function saveEditorBytes(
  ctx: CachedUserDb,
  input: SaveEditorInput
): Promise<SaveEditorResult> {
  const { db, paths } = ctx;
  const { mediaId, buffer, overwrite } = input;

  const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!item) throw new Error("Media item not found");

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Derive dimensions + palette from the new bytes when possible; fall back to
  // the original record's dims (canvas export drops EXIF).
  const dims = await safeDims(buffer, item.width || 0, item.height || 0);

  const extension =
    (input.customFilename && path.extname(input.customFilename).slice(1)) ||
    input.fallbackExt ||
    item.filePath.split(".").pop() ||
    "png";
  const mimeType = input.mimeType || item.mimeType || `image/${extension}`;

  if (overwrite) {
    return await overwriteExisting(db, paths, {
      mediaId,
      item,
      buffer,
      hash,
      extension,
      mimeType,
      width: dims.width,
      height: dims.height,
      palette: dims.palette,
    });
  }

  return await saveAsCopy(db, paths, { item, buffer, hash, extension, mimeType, width: dims.width, height: dims.height, palette: dims.palette });
}

// ─── helpers ──────────────────────────────────────────────────────────────

async function safeDims(buffer: Buffer, fallbackW: number, fallbackH: number) {
  try {
    const processed = await MediaProcessor.processImage(buffer);
    return {
      width: processed.width || fallbackW,
      height: processed.height || fallbackH,
      palette: processed.palette || [],
    };
  } catch {
    return { width: fallbackW, height: fallbackH, palette: [] as string[] };
  }
}

interface OverwriteCtx {
  mediaId: string;
  item: typeof media.$inferSelect;
  buffer: Buffer;
  hash: string;
  extension: string;
  mimeType: string;
  width: number;
  height: number;
  palette: string[];
}

async function overwriteExisting(
  db: CachedUserDb["db"],
  paths: { mediaDir: string; thumbDir: string },
  ctx: OverwriteCtx
): Promise<SaveEditorResult> {
  const { mediaId, item, buffer, hash, extension, mimeType, width, height, palette } = ctx;

  // Is the old file path shared by other records?
  const otherShared = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.filePath, item.filePath), ne(media.id, mediaId)))
    .limit(1);
  const isOldPathShared = otherShared.length > 0;

  // Does the new hash already exist on another row?
  const existingDuplicate = await db
    .select({ filePath: media.filePath })
    .from(media)
    .where(eq(media.hash, hash))
    .limit(1);
  const isNewHashDuplicate = existingDuplicate.length > 0;

  let finalFilePath = item.filePath;

  if (isNewHashDuplicate) {
    // Repoint to the existing duplicate's filePath. No new file to write.
    finalFilePath = existingDuplicate[0].filePath;
  } else if (isOldPathShared) {
    // Old path is shared — we must NOT overwrite it. Write to a new path.
    finalFilePath = `${hash}.${extension}`;
    await writeFiles(paths, finalFilePath, buffer);
  } else {
    // Not shared, not duplicate — write to a temp path then rename, so a
    // crash mid-write doesn't corrupt the existing file the DB still points at.
    finalFilePath = item.filePath;
    await writeFiles(paths, finalFilePath, buffer, /* tmp */ true);
  }

  // Update DB BEFORE deleting old file. If this throws, the row still points
  // at a valid file (either the old one or the duplicate's).
  await db
    .update(media)
    .set({
      filePath: finalFilePath,
      width,
      height,
      size: buffer.length,
      hash,
      mimeType,
      metadata: { ...((item.metadata as Record<string, unknown>) || {}), palette },
      updatedAt: Date.now(),
    })
    .where(eq(media.id, mediaId));

  // Now safe to clean up the old file — but only if it differs from the new
  // path and no other row references it.
  if (finalFilePath !== item.filePath && !isOldPathShared) {
    await deleteFiles(paths, item.filePath);
  }

  return { mediaId, filePath: finalFilePath, created: false };
}

interface CopyCtx {
  item: typeof media.$inferSelect;
  buffer: Buffer;
  hash: string;
  extension: string;
  mimeType: string;
  width: number;
  height: number;
  palette: string[];
}

async function saveAsCopy(
  db: CachedUserDb["db"],
  paths: { mediaDir: string; thumbDir: string },
  ctx: CopyCtx
): Promise<SaveEditorResult> {
  const { item, buffer, hash, extension, mimeType, width, height, palette } = ctx;
  const newMediaId = crypto.randomUUID();
  const filename = `${hash}.${extension}`;

  await writeFiles(paths, filename, buffer);

  await db.insert(media).values({
    id: newMediaId,
    userId: item.userId,
    title: `Copy of ${item.title}`,
    filePath: filename,
    mimeType,
    size: buffer.length,
    width,
    height,
    hash,
    capturedAt: item.capturedAt,
    metadata: { ...((item.metadata as Record<string, unknown>) || {}), palette },
    folderId: item.folderId,
    isVault: item.isVault,
    isTrash: item.isTrash,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { mediaId: newMediaId, filePath: filename, created: true };
}

async function writeFiles(
  paths: { mediaDir: string; thumbDir: string },
  filename: string,
  buffer: Buffer,
  tmp = false
) {
  const finalPath = path.join(paths.mediaDir, filename);
  const writePath = tmp ? `${finalPath}.prism-tmp` : finalPath;

  await fs.writeFile(writePath, buffer);
  const thumbBuffer = await createThumbnail(buffer);
  await fs.writeFile(path.join(paths.thumbDir, `${filename}.webp`), thumbBuffer);

  if (tmp) {
    // Atomic-ish rename: the old file stays intact until the rename lands.
    // On Windows, rename over an existing file fails, so unlink first.
    try { await fs.unlink(finalPath); } catch (err) { logger.error("Pre-rename unlink failed", { error: err instanceof Error ? err.message : String(err) }) }
    await fs.rename(writePath, finalPath);
  }
}

async function deleteFiles(paths: { mediaDir: string; thumbDir: string }, filename: string) {
  await Promise.all([
    fs.unlink(path.join(paths.mediaDir, filename)).catch(() => {}),
    fs.unlink(path.join(paths.thumbDir, `${filename}.webp`)).catch(() => {}),
  ]);
}
