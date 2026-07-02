import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getUserDb } from "@/services/db/multitenant";
import { media } from "@/services/db/schema";
import { desc, eq, and, like } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ items: [] }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const rawPage = Number(searchParams.get("page")) || DEFAULT_PAGE;
    const rawLimit = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
    const page = Math.max(1, Math.floor(rawPage));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)));
    const offset = (page - 1) * limit;

    const { db } = await getUserDb(userId);

    const items = db
      .select()
      .from(media)
      .where(and(eq(media.isTrash, false), like(media.mimeType, "image/%")))
      .orderBy(desc(media.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
