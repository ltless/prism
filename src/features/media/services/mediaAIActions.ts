"use server";

import { media, mediaTags } from "@/services/db/schema";
import { TAG_TO_CATEGORY } from "@/features/ai/tag-candidates.mts";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import path from "path";
import type { AIModelVariant } from "@/features/ai/types";
import type { MediaMetadata } from "@/features/media/types";
import { sidecarBatchTag, sidecarBatchScore } from "@/services/ai/sidecar-client";
import { getContext } from "./mediaContext";
import { getEffectiveAIConfig } from "@/features/settings/services/aiConfig";
import { safeAction } from "@/core/utils/action";
import { auth } from "@/auth";

const AI_BATCH_SIZE = Math.max(1, Math.floor(Number(process.env.AI_BATCH_SIZE ?? 1)));

async function checkAIEnabled(): Promise<{ ok: true; config: { variant: AIModelVariant; tagThreshold: number; autoFavoriteThreshold: number; aestheticEnabled: boolean; autoFavoriteEnabled: boolean; aestheticModel: string; device: string; customTaxonomy?: Record<string, string[]> } } | { ok: false; error: string }> {
  const result = await getEffectiveAIConfig();
  if (!result.success) return { ok: false, error: result.error };

  if (!result.config.isEnabled) {
    return { ok: false, error: "AI is disabled by your admin." };
  }

  return {
    ok: true,
    config: {
      variant: result.config.variant,
      tagThreshold: result.config.tagThreshold,
      autoFavoriteThreshold: result.config.autoFavoriteThreshold,
      aestheticEnabled: result.config.aestheticEnabled,
      autoFavoriteEnabled: result.config.autoFavoriteEnabled,
      aestheticModel: result.config.aestheticModel || "clip",
      device: result.config.device || "gpu",
      customTaxonomy: result.config.customTaxonomy,
    },
  };
}

export async function batchTagMediaAction() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) {
 throw new Error("Unauthorized");
 }

 const guard = await checkAIEnabled();
 if (!guard.ok) return { success: false, error: guard.error, tagged: 0, remaining: 0, done: false };
  const { variant, tagThreshold, customTaxonomy } = guard.config;

  return safeAction("BatchTagMedia", async () => {
    const { db, paths } = await getContext();

    const untagged = await db.select()
    .from(media)
    .where(
      and(
      sql`json_extract(metadata, '$.aiProcessed') IS NULL`,
      eq(media.isTrash, false)
      )
    )
    .limit(10);

    if (untagged.length === 0) {
      return { tagged: 0, remaining: 0, done: true };
    }

    const result = await sidecarBatchTag(
      untagged.map(item => ({
        id: item.id,
        filePath: path.join(paths.mediaDir, item.filePath),
        mediaDir: paths.mediaDir,
      })),
      variant,
      tagThreshold,
      AI_BATCH_SIZE,
      customTaxonomy,
    );

  const batchResult = result;

  // wrap metadata writes in a transaction — N updates for the price of 1 WAL flush
  db.transaction((tx) => {
    for (const item of batchResult.results) {
      const existingMedia = untagged.find(u => u.id === item.id);
      if (!existingMedia) continue;
      const existingMeta = (existingMedia.metadata as MediaMetadata) || {};
      const aiMetadata = {
        ...existingMeta,
        embedding: item.embedding,
        tags: item.tags,
        tagScores: item.tagScores,
        aiProcessed: true,
        updatedAt: new Date().toISOString(),
      };
      tx.update(media)
      .set({ metadata: aiMetadata, updatedAt: new Date() })
      .where(eq(media.id, item.id))
      .run();
    }
  });

  const tagMediaIds = batchResult.results.filter(r => r.tags?.length > 0).map(r => r.id);
  if (tagMediaIds.length > 0) {
    await db.delete(mediaTags).where(inArray(mediaTags.mediaId, tagMediaIds));
    const allTagRows = batchResult.results.flatMap(item =>
      (item.tags || []).map((tag, i) => ({
        mediaId: item.id,
        tag,
        score: item.tagScores?.[i] ?? 0,
        category: TAG_TO_CATEGORY[tag] ?? "Other",
      }))
    );
    if (allTagRows.length > 0) {
      await db.insert(mediaTags).values(allTagRows);
    }
  }

 const remainingResult = await db.select({ count: sql<number>`count(*)` })
 .from(media)
 .where(
 and(
 sql`json_extract(metadata, '$.aiProcessed') IS NULL`,
 eq(media.isTrash, false)
 )
 );
 const remaining = Number(remainingResult[0]?.count) || 0;

 revalidatePath("/dashboard");
 return { tagged: batchResult.tagged, remaining, done: remaining === 0 };
 });
}

export async function batchScoreAestheticsAction() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) {
 throw new Error("Unauthorized");
 }

 const guard = await checkAIEnabled();
 if (!guard.ok) return { success: false, error: guard.error, scored: 0, remaining: 0, done: false };
 if (!guard.config.aestheticEnabled) {
 return { success: false, error: "Aesthetic scoring is disabled in your preferences.", scored: 0, remaining: 0, done: true };
 }
 const { variant, autoFavoriteThreshold, autoFavoriteEnabled, aestheticModel } = guard.config;

 return safeAction("BatchScoreAesthetics", async () => {
 const { db, paths } = await getContext();

 const unscored = await db.select()
 .from(media)
 .where(
 and(
 sql`json_extract(metadata, '$.aestheticScored') IS NULL`,
 eq(media.isTrash, false)
 )
 )
 .limit(10);

 if (unscored.length === 0) {
 return { scored: 0, remaining: 0, done: true };
 }

  const result = await sidecarBatchScore(
    unscored.map(item => ({
      id: item.id,
      filePath: path.join(paths.mediaDir, item.filePath),
    })),
    aestheticModel,
    variant,
    AI_BATCH_SIZE,
  );

  const batchResult = result;

  for (const item of batchResult.results) {
    const existingMedia = unscored.find(u => u.id === item.id);
    if (!existingMedia) continue;
    const existingMeta = (existingMedia.metadata as MediaMetadata) || {};
    const isFavorite = autoFavoriteEnabled && item.score !== null && item.score >= (autoFavoriteThreshold ?? 0.9);
    const aiMetadata = {
      ...existingMeta,
      aestheticScore: item.score,
      aestheticScored: true,
      aestheticScoredAt: new Date().toISOString(),
      aestheticModel: item.model || aestheticModel,
      updatedAt: new Date().toISOString(),
    };
    await db.update(media)
    .set({
      metadata: aiMetadata,
      isFavorite: isFavorite || existingMedia.isFavorite,
      updatedAt: new Date(),
    })
    .where(eq(media.id, item.id));
  }

 const remainingResult = await db.select({ count: sql<number>`count(*)` })
 .from(media)
 .where(
 and(
 sql`json_extract(metadata, '$.aestheticScored') IS NULL`,
 eq(media.isTrash, false)
 )
 );
 const remaining = Number(remainingResult[0]?.count) || 0;

 revalidatePath("/dashboard");
 return { scored: batchResult.scored, remaining, done: remaining === 0 };
 });
}

export async function countTaggedMediaAction() {
  return countMediaByAIField("aiProcessed", "tagged");
}

export async function countScoredMediaAction() {
  return countMediaByAIField("aestheticScored", "scored");
}

type AICountField = "aiProcessed" | "aestheticScored";

async function countMediaByAIField(field: AICountField, label: string) {
  return safeAction(`Count${label.charAt(0).toUpperCase() + label.slice(1)}Media`, async () => {
    const { db } = await getContext();
    const result = await db.select({ count: sql<number>`count(*)` }).from(media);
    const total = Number(result[0]?.count) || 0;
    // Bind the json path as a parameter instead of sql.raw — the field is a
    // hardcoded literal, but binding makes the value inert regardless.
    const jsonPath = `$.${field}`;
    const fieldResult = await db.select({ count: sql<number>`count(*)` })
    .from(media)
    .where(sql`json_extract(metadata, ${jsonPath}) = 1`);
    const count = Number(fieldResult[0]?.count) || 0;
    return { total, [label]: count };
  });
}
