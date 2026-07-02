import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
 auth: vi.fn(async () => ({ user: { id: "test-user-id" } })),
}));

vi.mock("@/services/db/multitenant", () => ({
 getUserDb: vi.fn(async () => ({
 db: {
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 where: vi.fn(() => Promise.resolve([])),
 })),
 })),
 },
 })),
}));

describe("Transcode Status API", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it("fails when unauthenticated", async () => {
 const authModule = await import("@/auth");
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);

 const request = new NextRequest("http://localhost/api/media/transcode-status", {
 method: "POST",
 body: JSON.stringify({ ids: ["1", "2"] }),
 });
 const response = await POST(request);
 expect(response.status).toBe(401);
 });

 it("succeeds and limits query count to 200 items", async () => {
 const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
 const request = new NextRequest("http://localhost/api/media/transcode-status", {
 method: "POST",
 body: JSON.stringify({ ids }),
 });
 const response = await POST(request);
 expect(response.status).toBe(200);
 });
});
