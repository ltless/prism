import { auth } from "@/auth";
import { db } from "@/services/db";
import { errorLogs } from "@/services/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

const VALID_LEVELS = new Set(["info", "warn", "error"]);
const MAX_META_SIZE = 64 * 1024; // 64KB

export async function POST(request: Request) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`log:${session.user.id}`, 30, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  const body = await request.json();
  const { level, message, meta, source, timestamp } = body;

  if (!VALID_LEVELS.has(level)) {
  return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
  return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > 5000) {
  return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  if (source !== undefined && source !== null) {
  if (typeof source !== "string") {
  return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }
  if (source.length > 500) {
  return NextResponse.json({ error: "Source too long" }, { status: 400 });
  }
  }

  if (timestamp !== undefined && timestamp !== null) {
  const parsedDate = new Date(timestamp);
  if (isNaN(parsedDate.getTime())) {
  return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }
  const now = Date.now();
  const minTime = now - 30 * 24 * 60 * 60 * 1000;
  const maxTime = now + 24 * 60 * 60 * 1000;
  const timeVal = parsedDate.getTime();
  if (timeVal < minTime || timeVal > maxTime) {
  return NextResponse.json({ error: "Timestamp out of bounds" }, { status: 400 });
  }
  }

  let metaStr: string | null = null;
  if (meta !== undefined && meta !== null) {
  metaStr = JSON.stringify(meta);
  if (metaStr.length > MAX_META_SIZE) {
  return NextResponse.json({ error: "Meta too large" }, { status: 400 });
  }
  }

  await db.insert(errorLogs).values({
  level,
  message,
  meta: metaStr,
  source: source ?? null,
  timestamp: timestamp ?? new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
  } catch (err) {
  logger.error("Log API POST failed", { error: String(err) });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
 try {
 const session = await auth();
 if (!session?.user?.id) {
 return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }
 if (session.user.role !== "admin") {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 const { searchParams } = new URL(request.url);
 const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

 const entries = await db
 .select()
 .from(errorLogs)
 .orderBy(desc(errorLogs.id))
 .limit(limit);

 const parsed = entries.map((e) => ({
 ...e,
 meta: safeParseMeta(e.meta),
 }));

 return NextResponse.json(parsed);
 } catch (err) {
 logger.error("Log API GET failed", { error: String(err) });
 return NextResponse.json({ error: "Internal server error" }, { status: 500 });
 }
}

function safeParseMeta(raw: string | null): unknown {
 if (!raw) return null;
 try {
 return JSON.parse(raw);
 } catch {
 return null;
 }
}
