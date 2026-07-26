"use server";

import { media } from "@/services/db/schema";
import { sql, and, eq, gte, lte, inArray, isNull, or } from "drizzle-orm";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { auth } from "@/auth";

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
