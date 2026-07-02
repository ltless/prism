"use server";

import { media, mediaTags, folders } from "@/services/db/schema";
import { sql, and, eq, gte, lte, inArray, isNull, lt, or, desc } from "drizzle-orm";
import type { SmartFolderFilter, MediaMetadata } from "../types";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { auth } from "@/auth";
import { logger } from "@/core/utils/logger";
import { sidecarEmbedText } from "@/services/ai/sidecar-client";
import { cosineSimilarity } from "@/shared/utils/cosineSimilarity";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { parseSmartFolderFilter } from "@/features/media/schemas";
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

function syncEmbeddingCache(userId: string, db: BetterSQLite3Database<typeof schema>) {
  const now = Date.now();
  const userLastSync = lastSyncPerUser.get(userId) ?? 0;
  if (now - userLastSync < 2000 && embeddingCache.size > 0) {
    return;
  }
  
  try {
    const stats = db.select({
      maxUpdated: sql`MAX(${media.updatedAt})`,
      count: sql`COUNT(${media.id})`
    }).from(media).where(
      and(
        eq(media.isTrash, false),
        eq(media.isVault, false),
        sql`${media.metadata} IS NOT NULL`
      )
    ).get() as { maxUpdated: number | null; count: number };
    
    const currentMax = stats?.maxUpdated ? new Date(stats.maxUpdated).getTime() : 0;
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
      const rows = db.select({ id: media.id, metadata: media.metadata }).from(media).where(
        and(
          eq(media.isTrash, false),
          eq(media.isVault, false),
          sql`${media.metadata} IS NOT NULL`
        )
      ).limit(BATCH_SIZE).offset(offset).all();

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



export async function loadMoreMediaAction(cursor: { createdAt: Date; id: string } | null, limit: number = 50, folderId?: string | null, isFavorite?: boolean) {
 return safeAction("loadMoreMedia", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const { db } = await getContext();

 // check if the requested folder is a smart folder
 let smartFilter: SmartFolderFilter | null = null;
 if (folderId) {
 const folder = db.select().from(folders).where(eq(folders.id, folderId)).get();
	if (folder?.folderType === "smart" && folder.filterQuery) {
		smartFilter = parseSmartFolderFilter(folder.filterQuery);
	}
 }

 const cursorCondition = cursor
 ? or(
 lt(media.createdAt, cursor.createdAt),
 and(eq(media.createdAt, cursor.createdAt), lt(media.id, cursor.id))
 )
 : undefined;

 const favoriteCondition = isFavorite === undefined
 ? undefined
 : eq(media.isFavorite, true);

 if (smartFilter) {
 // smart folder: find matching media via media_tags JOIN, ignore folderId filter
 const matchingMediaIds = db
 .selectDistinct({ mediaId: mediaTags.mediaId })
 .from(mediaTags)
 .where(
 and(
 inArray(mediaTags.category, smartFilter.categories),
 gte(mediaTags.score, smartFilter.minScore)
 )
 )
 .all()
 .map(r => r.mediaId);

 if (matchingMediaIds.length === 0) return { items: [] };

 const items = db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 eq(media.isVault, false),
 inArray(media.id, matchingMediaIds),
 favoriteCondition,
 cursorCondition,
 inArray(
 media.id,
 db.select({ id: sql`MIN(${media.id})` })
 .from(media)
 .where(and(eq(media.isTrash, false), eq(media.isVault, false), inArray(media.id, matchingMediaIds)))
 .groupBy(media.hash)
 )
 )
 ).orderBy(desc(media.createdAt), desc(media.id)).limit(limit).all();

 return { items };
 }

 // regular folder (existing logic)
 const folderCondition = folderId === undefined
 ? undefined
 : folderId === null
 ? isNull(media.folderId)
 : eq(media.folderId, folderId);

 const items = db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 folderCondition,
 favoriteCondition,
 cursorCondition,
 inArray(
 media.id,
 db.select({ id: sql`MIN(${media.id})` })
 .from(media)
 .where(and(eq(media.isTrash, false), folderCondition, favoriteCondition))
 .groupBy(media.hash)
 )
 )
 ).orderBy(desc(media.createdAt), desc(media.id)).limit(limit).all();

 return { items };
 });
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

 // Drizzle column descriptors are never null in JS, so SQLite's COALESCE does the heavy lifting
 const dateCol = sql`COALESCE(${media.capturedAt}, ${media.createdAt})`;
 const dateCondition = filters?.dateFrom
 ? gte(dateCol, Math.floor(new Date(filters.dateFrom).getTime() / 1000))
 : undefined;
 const dateToCondition = filters?.dateTo
 ? lte(dateCol, Math.floor(new Date(filters.dateTo).getTime() / 1000))
 : undefined;

 const dedupSubquery = db.select({ id: sql`MIN(${media.id})` })
 .from(media)
 .where(and(eq(media.isTrash, false), folderCondition, mimeCondition, dateCondition, dateToCondition))
 .groupBy(media.hash);

  try {
  const embedResult = await sidecarEmbedText(query, "standard");
  if (embedResult.embedding) {
  const queryEmbedding = new Float32Array(embedResult.embedding);

    // Synchronize in-memory embedding cache from database
    syncEmbeddingCache(userId, db);

    const userCache = getUserCache(userId);

    const items = db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 folderCondition,
 mimeCondition,
 dateCondition,
 dateToCondition,
 inArray(media.id, dedupSubquery)
 )
 ).all();

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
 const items = db.select().from(media).where(
 and(
 eq(media.isTrash, false),
 folderCondition,
 mimeCondition,
 dateCondition,
 dateToCondition,
 inArray(media.id, dedupSubquery),
 or(
 sql`LOWER(${media.title}) LIKE ${qLike}`,
 sql`${media.metadata} IS NOT NULL AND LOWER(${media.metadata}) LIKE ${qLike}`
 )
 )
 ).all();

 return { items, total: items.length, query, mode: "keyword" as const };
 });
}
