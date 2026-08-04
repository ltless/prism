import { NextRequest, NextResponse } from "next/server";

const store = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  reqOrKey: NextRequest | string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  let key: string;
 if (typeof reqOrKey === "string") {
 key = reqOrKey;
 } else {
 const ip =
      (reqOrKey as NextRequest & { ip?: string })?.ip ??
      reqOrKey.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      reqOrKey.headers.get("x-real-ip") ??
      "anonymous";
 key = `${reqOrKey.nextUrl.pathname}:${ip}`;
 }

  const now = Date.now();

  if (store.size > 1000) {
  for (const [k, r] of store) {
  if (now > r.resetTime) store.delete(k);
  }
  }

  const record = store.get(key);

 if (!record || now > record.resetTime) {
 store.set(key, { count: 1, resetTime: now + windowMs });
 return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
 }

 record.count++;

 if (record.count > limit) {
 return { success: false, limit, remaining: 0, reset: record.resetTime };
 }

 return { success: true, limit, remaining: limit - record.count, reset: record.resetTime };
}

function rateLimitResponse(reset: number) {
 return new NextResponse(
 JSON.stringify({ error: "Too many requests. Please try again later." }),
 {
 status: 429,
 headers: {
 "Content-Type": "application/json",
 "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
 },
 }
 );
}
