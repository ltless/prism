"use server";

import { media } from "@/services/db/schema";
import { sql, and, eq, gte, lte, inArray, isNull, or } from "drizzle-orm";
import type { MediaMetadata } from "../types";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { auth } from "@/auth";
import { logger } from "@/core/utils/logger";
import { sidecarEmbedText } from "@/services/ai/sidecar-client";
import { cosineSimilarity } from "@/shared/utils/cosineSimilarity";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/services/db/schema";

const CACHE_TTL = 30 * 60 * 1000;

declare global {
   
  var __prismSearchCache: {
    embeddings: Map<string, { data: Map<string, Float32Array>; lastAccessed: number }>;
    lastSync: Map<string, number>;
    lastMax: Map<string, number>;
  } | undefined;
}

const globalCache = globalThis.__prismSearchCache ?? {
  embeddings: new Map<string, { data: Map<string, Float32Array>; lastAccessed: number }>(),
  lastSync: new Map<string, number>(),
  lastMax: new Map<string, number>(),
};
globalThis.__prismSearchCache = globalCache;

const embeddingCache = globalCache.embeddings;
const lastSyncPerUser = globalCache.lastSync;
const lastMaxUpdatedAt = globalCache.lastMax;

function getUserCache(userId: string): Map<string, Float32Array> {
  const entry = embeddingCache.get(userId);
  if (!entry) {
    const data = new Map<string, Float32Array>();
    embeddingCache.set(userId, { data, lastAccessed: Date.now() });
    return data;
  }
  if (Date.now() - entry.lastAccessed > CACHE_TTL) {
    embeddingCache.delete(userId);
    const data = new Map<string, Float32Array>();
    embeddingCache.set(userId, { data, lastAccessed: Date.now() });
    return data;
  }
  entry.lastAccessed = Date.now();
  return entry.data;
}

async function syncEmbeddingCache(userId: string, db: NodePgDatabase<typeof schema>) {
  const now = Date.now();
  const userLastSync = lastSyncPerUser.get(userId) ?? 0;
  if (now - userLastSync < 2000 && embeddingCache.size > 0) {
    return;
  }
  
  try {
    const statsRows = await db.select({
      maxUpdated: sql`MAX(${media.updatedAt})`,
      count: sql`COUNT(${media.id})`
    }).from(media).where(
      and(
        eq(media.isTrash, false),
        eq(media.isVault, false),
        sql`${media.metadata} IS NOT NULL`
      )
    ).limit(1);
    
    const stats = statsRows[0] as { maxUpdated: number | null; count: number } | undefined;
    const currentMax = stats?.maxUpdated ?? 0;
    const userCache = getUserCache(userId);

    const userMaxUpdated = lastMaxUpdatedAt.get(userId) ?? 0;
		if (userCache.size === stats?.count && userMaxUpdated === currentMax) {
      lastSyncPerUser.set(userId, now);
      return;
    }

    const BATCH_SIZE = 5000;
    let offset = 0;

    const currentIds = new Set<string>();
    const MAX_BATCHES = 100;
    let batches = 0;

    while (batches < MAX_BATCHES) {
      const rows = await db.select({ id: media.id, metadata: media.metadata }).from(media).where(
        and(
          eq(media.isTrash, false),
          eq(media.isVault, false),
          sql`${media.metadata} IS NOT NULL`
        )
      ).limit(BATCH_SIZE).offset(offset);

      if (rows.length === 0) break;

      for (const r of rows) {
        currentIds.add(r.id);
        const meta = r.metadata as MediaMetadata | null;
        if (meta?.embedding && Array.isArray(meta.embedding)) {
          if (!userCache.has(r.id)) {
            userCache.set(r.id, new Float32Array(meta.embedding));
          }
        }
      }
      offset += BATCH_SIZE;
      batches++;
    }
    if (batches === MAX_BATCHES) {
      logger.warn("syncEmbeddingCache hit MAX_BATCHES limit", { userId });
    }

    for (const cachedId of userCache.keys()) {
      if (!currentIds.has(cachedId)) {
        userCache.delete(cachedId);
      }
    }

    lastMaxUpdatedAt.set(userId, currentMax);
    lastSyncPerUser.set(userId, now);
  } catch {
  }
}
export async function searchMediaAction(
 query: string,
 folderId?: string | null,
 filters?: { mimeType?: string | null; dateFrom?: string | null; dateTo?: string | null }
) {
 return safeAction("searchMedia", async () => {
 const { db } = await getContext();
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const folderCondition = folderId === undefined
 ? undefined
 : folderId === null
 ? isNull(media.folderId)
 : eq(media.folderId, folderId);

 const mimeCondition = filters?.mimeType
 ? filters.mimeType === "image"
 ? sql`${media.mimeType} LIKE 'image/%'`
 : sql`${media.mimeType} LIKE 'video/%'`
 : undefined;

 // Drizzle column descriptors are never null in JS, so COALESCE does the heavy lifting
 const dateCol = sql`COALESCE(${media.capturedAt}, ${media.createdAt})`;
 const dateCondition = filters?.dateFrom
 ? gte(dateCol, new Date(filters.dateFrom).getTime())
 : undefined;
 const dateToCondition = filters?.dateTo
 ? lte(dateCol, new Date(filters.dateTo).getTime())
 : undefined;

 const dedupSubquery = db.select({ id: sql`MIN(${media.id})` })
 .from(media)
 .where(and(eq(media.isTrash, false), folderCondition, mimeCondition, dateCondition, dateToCondition))
 .groupBy(media.hash);

  try {
  const embedResult = await sidecarEmbedText(query, "high");
  if (embedResult.embedding) {
  const queryEmbedding = new Float32Array(embedResult.embedding);

    // Synchronize in-memory embedding cache from database
    await syncEmbeddingCache(userId, db);

    const userCache = getUserCache(userId);

    const items = await db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 folderCondition,
 mimeCondition,
 dateCondition,
 dateToCondition,
 inArray(media.id, dedupSubquery)
 )
 );

    const qLower = query.toLowerCase();
    const scored = items
      .map(item => {
        const cachedVector = userCache.get(item.id);
        let score = 0;
        if (cachedVector) {
          score = cosineSimilarity(queryEmbedding, cachedVector);
        } else {
          const metadata = (item.metadata ?? {}) as MediaMetadata;
          if (metadata?.embedding) {
            const vector = new Float32Array(metadata.embedding);
            userCache.set(item.id, vector);
            score = cosineSimilarity(queryEmbedding, vector);
          }
        }
        
        const metadata = (item.metadata ?? {}) as MediaMetadata;
        if (score < 0.15) {
          if (item.title.toLowerCase().includes(qLower)) score = 0.5;
          else if (metadata?.tags?.some((t: string) => t.toLowerCase().includes(qLower))) score = 0.4;
        }
        return { ...item, _score: score };
      })
      .filter(item => item._score > 0.1)
      .sort((a, b) => b._score - a._score)
      .slice(0, 100);

 return { items: scored, total: scored.length, query, mode: "semantic" as const };
 }
 } catch {
 // AI model not available — fall through to keyword search
 }

 const qLike = `%${query.toLowerCase()}%`;
 const items = await db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 folderCondition,
 mimeCondition,
 dateCondition,
 dateToCondition,
 inArray(media.id, dedupSubquery),
 or(
 sql`LOWER(${media.title}) LIKE ${qLike}`,
 sql`${media.metadata} IS NOT NULL AND LOWER(${media.metadata}::text) LIKE ${qLike}`
 )
 )
 );

 return { items, total: items.length, query, mode: "keyword" as const };
 });
}
