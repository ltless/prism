import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import {
  fetchSidecarHealth,
  fetchModelStatus,
  downloadModel,
  loadModel,
  fetchSidecarGpuStatus,
  getSidecarUrl,
  sidecarBatchTag,
  sidecarBatchScore,
  sidecarEmbedImage,
  sidecarEmbedText,
  sidecarGenerateTags,
} from "../sidecar-client";

vi.mock("@/core/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock http.request — sidecarFetch uses http.request (not fetch) to bypass
// undici connection-pool reuse issues.
function mockHttpRequest(response: { statusCode: number; body: unknown }) {
  const mockReq = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    setTimeout: vi.fn(),
    destroy: vi.fn(),
  };
  const mockRes = {
    statusCode: response.statusCode,
    on: (event: string, cb: (chunk?: Buffer) => void) => {
      if (event === "data") {
        cb(Buffer.from(JSON.stringify(response.body)));
      } else if (event === "end") {
        cb();
      }
    },
  };
  vi.spyOn(http, "request").mockImplementation(((
    _opts: unknown,
    cb: (res: typeof mockRes) => void,
  ) => {
    cb(mockRes);
    return mockReq as unknown as http.ClientRequest;
  }) as (...args: unknown[]) => http.ClientRequest);
  return mockReq;
}

const ok = (body: unknown, status = 200) => mockHttpRequest({ statusCode: status, body });

describe("sidecar-client", () => {
  beforeEach(() => {
    vi.spyOn(http, "request");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchSidecarHealth returns parsed body", async () => {
    ok({ status: "ok", device: "cpu" });
    const data = await fetchSidecarHealth();
    expect(data.status).toBe("ok");
    expect(data.device).toBe("cpu");
  });

  it("fetchModelStatus returns models array", async () => {
    ok({ models: [{ id: "openai/clip-vit-base-patch32", type: "embed", name: "CLIP Base", size: "~600MB", variant: "standard", downloaded: true, loaded: false, downloadState: { status: "idle" } }] });
    const data = await fetchModelStatus();
    expect(data.models).toHaveLength(1);
    expect(data.models[0].id).toBe("openai/clip-vit-base-patch32");
  });

  it("downloadModel POSTs modelId", async () => {
    ok({ started: true, downloaded: false, modelId: "x" }, 202);
    const data = await downloadModel("x");
    expect(data.started).toBe(true);
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", path: "/download-model" }),
      expect.any(Function),
    );
  });

  it("loadModel returns success + modelId", async () => {
    ok({ success: true, modelId: "y" });
    const data = await loadModel("y");
    expect(data.success).toBe(true);
    expect(data.modelId).toBe("y");
  });

  it("fetchSidecarGpuStatus returns torch info", async () => {
    ok({ device: "cpu", torchVersion: "2.12.1+cpu", cudaAvailable: false, mpsAvailable: false });
    const data = await fetchSidecarGpuStatus();
    expect(data.torchVersion).toBe("2.12.1+cpu");
    expect(data.cudaAvailable).toBe(false);
  });

  it("throws on non-ok response (no path leak)", async () => {
    mockHttpRequest({ statusCode: 404, body: { detail: "not found" } });
    await expect(fetchSidecarHealth()).rejects.toThrow(/HTTP 404/);
  });

  it("getSidecarUrl returns default", () => {
    expect(getSidecarUrl()).toBe("http://localhost:8081");
  });

  it("sidecarBatchTag POSTs items + returns results", async () => {
    ok({ tagged: 1, results: [{ id: "a", tags: ["x"], tagScores: [0.9], embedding: [0.1] }] });
    const data = await sidecarBatchTag([{ id: "a", filePath: "/tmp/a.jpg" }], "standard", 0.1);
    expect(data.tagged).toBe(1);
    expect(data.results[0].tags).toEqual(["x"]);
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", path: "/batch-tag" }),
      expect.any(Function),
    );
  });

  it("sidecarBatchScore POSTs items + returns scores", async () => {
    ok({ scored: 1, results: [{ id: "a", score: 0.7, raw: 6.3, model: "laion" }] });
    const data = await sidecarBatchScore([{ id: "a", filePath: "/tmp/a.jpg" }], "laion", "standard");
    expect(data.scored).toBe(1);
    expect(data.results[0].score).toBe(0.7);
  });

  it("sidecarEmbedImage returns embedding", async () => {
    ok({ embedding: [0.1, 0.2] });
    const data = await sidecarEmbedImage("/tmp/a.jpg", "standard");
    expect(data.embedding).toEqual([0.1, 0.2]);
  });

  it("sidecarEmbedText returns embedding", async () => {
    ok({ embedding: [0.3, 0.4] });
    const data = await sidecarEmbedText("sunset", "standard");
    expect(data.embedding).toEqual([0.3, 0.4]);
  });

  it("sidecarGenerateTags returns tags", async () => {
    ok({ tags: [{ tag: "sunset", score: 0.9 }] });
    const data = await sidecarGenerateTags("/tmp/a.jpg", "standard", 0.1);
    expect(data.tags[0].tag).toBe("sunset");
  });
});
