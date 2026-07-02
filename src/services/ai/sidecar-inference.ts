import path from "path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { media, mediaTags } from "@/services/db/schema";
import * as schema from "@/services/db/schema";
import { TAG_TO_CATEGORY } from "@/features/ai/tag-candidates.mts";
import type { MediaMetadata } from "@/features/media/types";
import { sidecarBatchTag, sidecarBatchScore } from "./sidecar-client";
import { logger } from "@/core/utils/logger";

const AI_BATCH_SIZE = Math.max(1, Math.floor(Number(process.env.AI_BATCH_SIZE ?? 1)));

// 4 concurrent × 2 torch threads = 8 threads. more than that and your pc
// starts questioning its life choices.
const MAX_CONCURRENT_AI = Math.max(1, Math.floor(Number(process.env.SIDECAR_MAX_CONCURRENT ?? 4)));
let _activeAI = 0;
const _aiQueue: Array<() => void> = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (_activeAI >= MAX_CONCURRENT_AI) {
    await new Promise<void>((resolve) => _aiQueue.push(resolve));
  }
  _activeAI++;
  try {
    return await fn();
  } finally {
    _activeAI--;
    _aiQueue.shift()?.();
  }
}

export interface UploadAIParams {
  db: BetterSQLite3Database<typeof schema>;
  mediaDir: string;
  mediaId: string;
  filename: string;
  variant: string;
  tagThreshold: number;
  aestheticEnabled: boolean;
  aestheticModel: string;
  autoFavoriteEnabled: boolean;
  autoFavoriteThreshold: number;
  customTaxonomy?: Record<string, string[]>;
}

export async function processUploadAI(params: UploadAIParams): Promise<void> {
  await withConcurrencyLimit(() => _processUploadAIInner(params));
}

async function _processUploadAIInner(params: UploadAIParams): Promise<void> {
  const { db, mediaDir, mediaId, filename, variant, tagThreshold,
    aestheticEnabled, aestheticModel, autoFavoriteEnabled,
    autoFavoriteThreshold, customTaxonomy } = params;
  const filePath = path.join(mediaDir, filename);
  const meta: Record<string, unknown> = { processedAt: new Date().toISOString(), aiModel: variant };
  let isFavorite: boolean | undefined;

  try {
    const result = await sidecarBatchTag(
      [{ id: mediaId, filePath, mediaDir }],
      variant, tagThreshold, AI_BATCH_SIZE, customTaxonomy,
    );
    const row = result.results[0];
    if (row) {
      meta.embedding = row.embedding;
      meta.tags = row.tags;
      meta.tagScores = row.tagScores;
    }
  } catch (err) {
    logger.error("sidecar.tag.fail", { mediaId, error: err instanceof Error ? err.message : String(err) });
    meta.embeddingError = err instanceof Error ? err.message : String(err);
  }

  if (aestheticEnabled) {
    try {
      const result = await sidecarBatchScore(
        [{ id: mediaId, filePath }], aestheticModel, variant, AI_BATCH_SIZE,
      );
      const row = result.results[0];
      if (row && row.score !== null) {
        meta.aestheticScore = row.score;
        meta.aestheticScored = true;
        meta.aestheticModel = row.model;
        meta.aestheticScoredAt = new Date().toISOString();
        if (autoFavoriteEnabled && row.score >= autoFavoriteThreshold) {
          isFavorite = true;
        }
      }
    } catch (err) {
      logger.error("sidecar.score.fail", { mediaId, error: err instanceof Error ? err.message : String(err) });
      meta.aestheticError = err instanceof Error ? err.message : String(err);
    }
  }

  try {
    const existing = db.select({ metadata: media.metadata, isFavorite: media.isFavorite })
      .from(media).where(eq(media.id, mediaId)).get();
    const existingMeta = (existing?.metadata as MediaMetadata) || {};
    const merged = { ...existingMeta, ...meta, aiProcessed: true };
    db.update(media).set({
      metadata: merged,
      isFavorite: isFavorite ?? existing?.isFavorite,
      updatedAt: new Date(),
    }).where(eq(media.id, mediaId)).run();

    if (Array.isArray(meta.tags) && Array.isArray(meta.tagScores)) {
      const tagPairs = (meta.tags as string[]).map((tag, i) => ({
        tag, score: (meta.tagScores as number[])[i] ?? 0,
      }));
      db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId)).run();
      if (tagPairs.length > 0) {
        const categoryMap = buildCategoryMap(customTaxonomy);
        db.insert(mediaTags).values(
          tagPairs.map(({ tag, score }) => ({
            mediaId, tag, score,
            category: (customTaxonomy ? categoryMap[tag] : TAG_TO_CATEGORY[tag]) ?? "Other",
          })),
        ).run();
      }
    }
  } catch (err) {
    logger.error("sidecar.db.fail", { mediaId, error: err instanceof Error ? err.message : String(err) });
  }
}

function buildCategoryMap(taxonomy?: Record<string, string[]>): Record<string, string> {
  const map: Record<string, string> = {};
  if (!taxonomy) return map;
  for (const [cat, tags] of Object.entries(taxonomy)) {
    for (const t of tags) map[t] = cat;
  }
  return map;
}
