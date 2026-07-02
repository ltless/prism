import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { fetchModelStatus } from "@/services/ai/sidecar-client";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await rateLimit(`ai:model-status:${session.user.id}`, 30, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const data = await fetchModelStatus();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get model status";
    logger.error("AI model-status proxy failed", { error: message });
    return NextResponse.json({ error: message, models: [] }, { status: 502 });
  }
}
