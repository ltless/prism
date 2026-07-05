import { NextResponse } from "next/server";
import { loadModel } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";
import { AiLoadModelSchema } from "../schemas";
import { SIDECAR_MODEL_IDS } from "@/features/ai/constants";
import type { AIModelVariant } from "@/features/ai/types";

export const POST = withSidecarProxy({
  rateLimit: ["ai:load-model", 10, 60_000],
  admin: true,
  schema: AiLoadModelSchema,
  badRequestMessage: "Invalid variant",
  label: "AI load model proxy failed",
  onError: (message) => NextResponse.json({ success: false, error: message, activeVariant: null }, { status: 502 }),
  handler: async ({ data }) => {
    const { variant } = data as { variant: AIModelVariant };
    const modelId = SIDECAR_MODEL_IDS[variant];
    if (!modelId) {
      return NextResponse.json({ success: false, error: "Unknown variant" }, { status: 400 });
    }
    const result = await loadModel(modelId);
    return NextResponse.json({
      success: result.success,
      activeVariant: result.success ? variant : null,
      error: result.detail,
    });
  },
});
