import { NextResponse } from "next/server";
import { fetchSidecarGpuStatus } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";

export const GET = withSidecarProxy({
  rateLimit: ["ai:gpu-status", 30, 60_000],
  label: "AI gpu-status proxy failed",
  onError: (message) => NextResponse.json({ gpuAvailable: false, error: message }, { status: 502 }),
  handler: async () => {
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
  },
});
