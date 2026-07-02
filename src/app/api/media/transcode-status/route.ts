import { auth } from "@/auth";
import { getUserDb } from "@/services/db/multitenant";
import { NextRequest, NextResponse } from "next/server";
import { media } from "@/services/db/schema";
import { inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return new Response("Unauthorized", { status: 401 });

 const { ids } = await request.json();
 if (!Array.isArray(ids) || ids.length === 0) {
 return NextResponse.json({ statuses: {} });
 }

 const mediaIds = ids.slice(0, 200);

 const { db } = await getUserDb(userId);
 const rows = await db
 .select({
 id: media.id,
 transcodeStatus: media.transcodeStatus,
 duration: media.duration,
 })
 .from(media)
 .where(inArray(media.id, mediaIds));

 const statuses: Record<string, { status: string | null; duration: number | null }> = {};
 for (const row of rows) {
 statuses[row.id] = {
 status: row.transcodeStatus,
 duration: row.duration,
 };
 }

 return NextResponse.json({ statuses });
}
