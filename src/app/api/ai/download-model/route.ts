import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { downloadModel } from "@/services/ai/sidecar-client";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

const Schema = z.object({
  modelId: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await rateLimit(`ai:download-model:${session.user.id}`, 10, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid modelId" }, { status: 400 });
    }
    const data = await downloadModel(parsed.data.modelId);
    return NextResponse.json(data, { status: data.started ? 202 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start download";
    logger.error("AI download-model proxy failed", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
