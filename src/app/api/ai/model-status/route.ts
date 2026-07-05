import { NextResponse } from "next/server";
import { fetchModelStatus } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";

export const GET = withSidecarProxy({
  rateLimit: ["ai:model-status", 30, 60_000],
  admin: true,
  label: "AI model-status proxy failed",
  onError: (message) => NextResponse.json({ error: message, models: [] }, { status: 502 }),
  handler: async () => {
    const data = await fetchModelStatus();
    return NextResponse.json(data);
  },
});
