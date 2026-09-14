import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

import { goFetch } from "@/lib/api";
import { ApiSchemaError, validateApiResponse, mediaListSchema, meResponseSchema } from "@/lib/apiSchemas";

const realFetch = global.fetch;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ foo: "bar" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.stubGlobal("fetch", realFetch);
  vi.unstubAllGlobals();
});

describe("goFetch schema validation (F10)", () => {
  const listSchema = z.object({ items: z.array(z.object({ id: z.string() })), total: z.number() });

  it("returns the parsed body when it matches the schema", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: "a" }], total: 1 }), { status: 200 }),
    );
    const res = await goFetch("/api/v1/media", undefined, listSchema);
    expect(res).toEqual({ items: [{ id: "a" }], total: 1 });
  });

  it("throws ApiSchemaError when the response shape drifts", async () => {
    // body has no items/total — e.g. Go returned an error object with 200
    await expect(goFetch("/api/v1/media", undefined, listSchema)).rejects.toThrow(ApiSchemaError);
  });

  it("keeps the old cast behavior when no schema is given", async () => {
    const res = await goFetch<{ foo: string }>("/api/v1/media");
    expect(res.foo).toBe("bar");
  });
});

describe("validateApiResponse", () => {
  it("reports the offending field in the error message", () => {
    expect(() =>
      validateApiResponse("/api/v1/auth/me", meResponseSchema, { id: 1, username: "u", role: "admin" }),
    ).toThrow(/id/);
  });

  it("accepts a well-formed media list", () => {
    const ok = validateApiResponse("/api/v1/media", mediaListSchema, {
      items: [{ id: "1", title: "t", filePath: "a.jpg", mimeType: "image/jpeg", size: 1, width: null, height: null, hash: "h" }],
      total: 1,
    });
    expect(ok.total).toBe(1);
  });
});
