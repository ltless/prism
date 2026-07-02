import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadModel } from "@/services/ai/sidecar-client";
import { SIDECAR_MODEL_IDS, ALLOWED_VARIANTS } from "@/features/ai/constants";
import type { AIModelVariant } from "@/features/ai/types";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

const Schema = z.object({
  variant: z.enum(ALLOWED_VARIANTS as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await rateLimit(`ai:load-model:${session.user.id}`, 10, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
    }

    const { variant } = parsed.data as { variant: AIModelVariant };
    const modelId = SIDECAR_MODEL_IDS[variant];
    if (!modelId) {
      return NextResponse.json({ success: false, error: "Unknown variant" }, { status: 400 });
    }

    // loads model in the sidecar process.
    const data = await loadModel(modelId);
    return NextResponse.json({
      success: data.success,
      activeVariant: data.success ? variant : null,
      error: data.detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load model";
    logger.error("AI load model proxy failed", { error: message });
    return NextResponse.json({ success: false, error: message, activeVariant: null }, { status: 502 });
  }
}
