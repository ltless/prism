/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-id", role: "admin" } })),
}));

vi.mock("@/services/ai/sidecar-client", () => ({
  loadModel: vi.fn(async () => ({ success: true, modelId: "openai/clip-vit-base-patch32" })),
}));

vi.mock("@/core/utils/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, reset: 0 })),
  rateLimitResponse: vi.fn(() => new NextResponse(null, { status: 429 })),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai/load-model", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("AI load-model admin gate (sidecar proxy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);
    const res = await POST(makeRequest({ variant: "standard" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "u", role: "standard" } } as any);
    const res = await POST(makeRequest({ variant: "standard" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid variant", async () => {
    const res = await POST(makeRequest({ variant: "bogus" }));
    expect(res.status).toBe(400);
  });

  it("proxies to sidecar and returns success + activeVariant", async () => {
    const res = await POST(makeRequest({ variant: "standard" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.activeVariant).toBe("standard");
  });

  it("returns failure when sidecar loadModel fails", async () => {
    const sidecar = await import("@/services/ai/sidecar-client");
    vi.mocked(sidecar.loadModel).mockResolvedValueOnce({ success: false, modelId: "x", detail: "model not downloaded" });
    const res = await POST(makeRequest({ variant: "standard" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.activeVariant).toBeNull();
  });

  it("returns 502 when sidecar unreachable", async () => {
    const sidecar = await import("@/services/ai/sidecar-client");
    vi.mocked(sidecar.loadModel).mockRejectedValueOnce(new Error("AI sidecar unreachable"));
    const res = await POST(makeRequest({ variant: "standard" }));
    expect(res.status).toBe(502);
  });
});
