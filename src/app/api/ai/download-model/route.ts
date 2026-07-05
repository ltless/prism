import { NextResponse } from "next/server";
import { downloadModel } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";
import { AiDownloadModelSchema } from "../schemas";

export const POST = withSidecarProxy({
  rateLimit: ["ai:download-model", 10, 60_000],
  admin: true,
  schema: AiDownloadModelSchema,
  badRequestMessage: "Invalid modelId",
  label: "AI download-model proxy failed",
  handler: async ({ data }) => {
    const result = await downloadModel(data.modelId);
    return NextResponse.json(result, { status: result.started ? 202 : 200 });
  },
});
