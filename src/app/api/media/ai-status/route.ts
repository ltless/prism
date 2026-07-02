import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/features/media/services/mediaContext";
import { media } from "@/services/db/schema";
import { inArray } from "drizzle-orm";
import type { MediaMetadata } from "@/features/media/types";
import { logger } from "@/core/utils/logger";

export async function POST(request: NextRequest) {
 const session = await auth();
 if (!session?.user?.id) {
 return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }

 const { ids } = await request.json();
 if (!Array.isArray(ids) || ids.length === 0) {
 return NextResponse.json({ statuses: {} });
 }

 const mediaIds = ids.slice(0, 200);
 if (mediaIds.length === 0) {
 return NextResponse.json({ statuses: {} });
 }

 try {
 const { db } = await getContext();
 const rows = await db
 .select({ id: media.id, metadata: media.metadata })
 .from(media)
 .where(inArray(media.id, mediaIds));

 const statuses: Record<string, { done: boolean; hasTags: boolean }> = {};
 for (const row of rows) {
 const meta = (row.metadata as MediaMetadata) || {};
 statuses[row.id] = {
 done: meta.aiProcessed === true,
 hasTags: Array.isArray(meta.tags) && (meta.tags as unknown[]).length > 0,
 };
 }

 return NextResponse.json({ statuses });
 } catch (error) {
 logger.error("AI status check failed", { error: String(error) });
 return NextResponse.json({ error: "Failed to check AI status" }, { status: 500 });
 }
}
