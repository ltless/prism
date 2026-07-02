/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-id", role: "admin" } })),
}));

vi.mock("@/services/ai/sidecar-client", () => ({
  downloadModel: vi.fn(async () => ({ started: true, downloaded: false, modelId: "x" })),
}));

vi.mock("@/core/utils/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, reset: 0 })),
  rateLimitResponse: vi.fn(() => new NextResponse(null, { status: 429 })),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai/download-model", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("AI download-model admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);
    const res = await POST(makeRequest({ modelId: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "u", role: "standard" } } as any);
    const res = await POST(makeRequest({ modelId: "x" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 202 when download starts", async () => {
    const res = await POST(makeRequest({ modelId: "openai/clip-vit-base-patch32" }));
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.started).toBe(true);
  });

  it("returns 200 when already downloaded", async () => {
    const sidecar = await import("@/services/ai/sidecar-client");
    vi.mocked(sidecar.downloadModel).mockResolvedValueOnce({ started: false, downloaded: true, modelId: "x" });
    const res = await POST(makeRequest({ modelId: "x" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.downloaded).toBe(true);
  });

  it("returns 502 when sidecar unreachable", async () => {
    const sidecar = await import("@/services/ai/sidecar-client");
    vi.mocked(sidecar.downloadModel).mockRejectedValueOnce(new Error("Sidecar unreachable"));
    const res = await POST(makeRequest({ modelId: "x" }));
    expect(res.status).toBe(502);
  });
});
