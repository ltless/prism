import { NextResponse } from "next/server";
import { sidecarEmbedText } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";
import { AiEmbedTextSchema } from "../schemas";

export const POST = withSidecarProxy({
  rateLimit: ["ai:embed-text", 30, 60_000],
  schema: AiEmbedTextSchema,
  label: "AI embed text failed",
  onError: () => NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 }),
  handler: async ({ data }) => {
    const result = await sidecarEmbedText(data.text, data.variant);
    return NextResponse.json({ embedding: result.embedding });
  },
});
