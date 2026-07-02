import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { fetchSidecarGpuStatus } from "@/services/ai/sidecar-client";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`ai:gpu-status:${session.user.id}`, 30, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const sidecar = await fetchSidecarGpuStatus();
    const gpuAvailable = Boolean(sidecar.cudaAvailable || sidecar.mpsAvailable);
    return NextResponse.json({
      gpuAvailable,
      device: sidecar.device,
      platform: sidecar.cudaAvailable ? "cuda" : sidecar.mpsAvailable ? "mps" : "cpu",
      gpuName: sidecar.cudaAvailable ? "CUDA (PyTorch)" : sidecar.mpsAvailable ? "MPS (PyTorch)" : `CPU (torch ${sidecar.torchVersion || "?"})`,
      torchVersion: sidecar.torchVersion,
      error: sidecar.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get GPU status";
    logger.error("AI gpu-status proxy failed", { error: message });
    return NextResponse.json({ gpuAvailable: false, error: message }, { status: 502 });
  }
}
