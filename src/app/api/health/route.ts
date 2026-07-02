import { db } from "@/services/db";
import { users } from "@/services/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
 try {
 db.select().from(users).limit(1).get();
 return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
 } catch {
 return NextResponse.json({ status: "error" }, { status: 503 });
 }
}
