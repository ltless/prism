import http from "node:http";
import { logger } from "@/core/utils/logger";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8081";

export type SidecarModelType = "embed" | "aesthetic";

export interface SidecarDownloadState {
  status: "idle" | "downloading" | "done" | "error";
  progress?: number;
  filesDone?: number;
  error?: string | null;
}

export interface SidecarModelStatus {
  id: string;
  type: SidecarModelType;
  name: string;
  size: string;
  variant: string | null;
  downloaded: boolean;
  loaded: boolean;
  downloadState: SidecarDownloadState;
}

export interface SidecarModelStatusResponse {
  models: SidecarModelStatus[];
}

export interface SidecarDownloadResponse {
  started: boolean;
  downloaded: boolean;
  modelId: string;
  alreadyDownloading?: boolean;
}

export interface SidecarLoadResponse {
  success: boolean;
  modelId: string;
  detail?: string;
}

export interface SidecarGpuStatus {
  device: string;
  torchVersion?: string;
  cudaAvailable?: boolean;
  mpsAvailable?: boolean;
  error?: string;
}

export interface SidecarHealth {
  status: string;
  device?: string;
}

class SidecarError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SidecarError";
  }
}

function sidecarHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const key = process.env.SIDECAR_KEY;
  if (key) headers["X-Sidecar-Key"] = key;
  return headers;
}

// http.request instead of fetch because undici reuses stale keep-alive
// connections — requests silently vanish into the void. i trust nothing.
async function sidecarFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(`${SIDECAR_URL}${path}`);
  const method = init?.method || "GET";
  const body = typeof init?.body === "string" ? init.body : undefined;
  const headers = sidecarHeaders(init?.headers as Record<string, string> | undefined);

  return new Promise<Response>((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers,
      agent: false,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const bodyStr = Buffer.concat(chunks).toString("utf-8");
        const status = res.statusCode || 200;
        if (status < 200 || status >= 300) {
          logger.error("sidecar.http.fail", { path, status });
          reject(new SidecarError(`AI sidecar HTTP ${status}`));
          return;
        }
        resolve(new Response(bodyStr, { status, headers: { "Content-Type": "application/json" } }));
      });
    });
    req.on("error", (err) => {
      logger.error("sidecar.fetch.fail", { path, error: err.message });
      reject(new SidecarError("AI sidecar unreachable"));
    });
    req.setTimeout(60_000, () => {
      req.destroy(new Error("timeout"));
      reject(new SidecarError("AI sidecar unreachable"));
    });
    if (body) req.write(body);
    req.end();
  });
}

export async function fetchSidecarHealth(): Promise<SidecarHealth> {
  const res = await sidecarFetch("/health");
  return res.json();
}

export async function fetchModelStatus(): Promise<SidecarModelStatusResponse> {
  const res = await sidecarFetch("/model-status");
  return res.json();
}

export async function downloadModel(modelId: string): Promise<SidecarDownloadResponse> {
  const res = await sidecarFetch("/download-model", {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });
  return res.json();
}

export async function loadModel(modelId: string): Promise<SidecarLoadResponse> {
  const res = await sidecarFetch("/load-model", {
    method: "POST",
    body: JSON.stringify({ modelId }),
  });
  return res.json();
}

export async function fetchSidecarGpuStatus(): Promise<SidecarGpuStatus> {
  const res = await sidecarFetch("/gpu-status");
  return res.json();
}

export interface SidecarBatchTagItem {
  id: string;
  filePath: string;
  mediaDir?: string;
}

export interface SidecarBatchTagResult {
  id: string;
  tags: string[];
  tagScores: number[];
  embedding: number[] | null;
  error?: string;
}

export interface SidecarBatchTagResponse {
  tagged: number;
  results: SidecarBatchTagResult[];
}

export async function sidecarBatchTag(
  items: SidecarBatchTagItem[],
  variant: string,
  tagThreshold: number,
  batchSize?: number,
  taxonomy?: Record<string, string[]>,
): Promise<SidecarBatchTagResponse> {
  const res = await sidecarFetch("/batch-tag", {
    method: "POST",
    body: JSON.stringify({ items, variant, tagThreshold, batchSize: batchSize ?? 1, taxonomy: taxonomy ?? null }),
  });
  return res.json();
}

export interface SidecarBatchScoreItem {
  id: string;
  filePath: string;
}

export interface SidecarBatchScoreResult {
  id: string;
  score: number | null;
  raw: number | null;
  model: string;
  error?: string;
}

export interface SidecarBatchScoreResponse {
  scored: number;
  results: SidecarBatchScoreResult[];
}

export async function sidecarBatchScore(
  items: SidecarBatchScoreItem[],
  model: string,
  variant: string,
  batchSize?: number,
): Promise<SidecarBatchScoreResponse> {
  const res = await sidecarFetch("/batch-score", {
    method: "POST",
    body: JSON.stringify({ items, model, variant, batchSize: batchSize ?? 1 }),
  });
  return res.json();
}

export interface SidecarEmbedImageResponse {
  embedding: number[];
}

export async function sidecarEmbedImage(filePath: string, variant: string = "high"): Promise<SidecarEmbedImageResponse> {
  const res = await sidecarFetch("/embed-image", {
    method: "POST",
    body: JSON.stringify({ filePath, variant }),
  });
  return res.json();
}

export async function sidecarEmbedText(text: string, variant: string = "high"): Promise<SidecarEmbedImageResponse> {
  const res = await sidecarFetch("/embed-text", {
    method: "POST",
    body: JSON.stringify({ text, variant }),
  });
  return res.json();
}

export interface SidecarTagScore {
  tag: string;
  score: number;
  category?: string;
}

export interface SidecarGenerateTagsResponse {
  tags: SidecarTagScore[];
}

export async function sidecarGenerateTags(
  filePath: string,
  variant: string,
  tagThreshold: number,
  taxonomy?: Record<string, string[]>,
): Promise<SidecarGenerateTagsResponse> {
  const res = await sidecarFetch("/generate-tags", {
    method: "POST",
    body: JSON.stringify({ filePath, variant, tagThreshold, taxonomy: taxonomy ?? null }),
  });
  return res.json();
}

export function getSidecarUrl(): string {
  return SIDECAR_URL;
}

