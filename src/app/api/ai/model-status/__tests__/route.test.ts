/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextResponse } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-id", role: "admin" } })),
}));

vi.mock("@/services/ai/sidecar-client", () => ({
  fetchModelStatus: vi.fn(async () => ({ models: [] })),
}));

vi.mock("@/core/utils/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, reset: 0 })),
  rateLimitResponse: vi.fn(() => new NextResponse(null, { status: 429 })),
}));

describe("AI model-status admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "u", role: "standard" } } as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with models for admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.models).toEqual([]);
  });

  it("returns 502 when sidecar unreachable", async () => {
    const sidecar = await import("@/services/ai/sidecar-client");
    vi.mocked(sidecar.fetchModelStatus).mockRejectedValueOnce(new Error("AI sidecar unreachable"));
    const res = await GET();
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toMatch(/sidecar unreachable/i);
  });
});
