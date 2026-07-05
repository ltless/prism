import { useAIStore } from "@/features/ai/store";
import { ALLOWED_VARIANTS, SIDECAR_MODEL_IDS, AESTHETIC_MODEL_ID } from "@/features/ai/constants";
import type { AIModelVariant } from "@/features/ai/types";
import type { SidecarModelStatus, SidecarModelStatusResponse, SidecarDownloadState } from "@/services/ai/sidecar-client";

const VARIANT_TO_MODEL: Record<AIModelVariant, string> = SIDECAR_MODEL_IDS;
const MODEL_TO_VARIANT: Record<string, AIModelVariant> = Object.fromEntries(
  (Object.entries(SIDECAR_MODEL_IDS) as Array<[AIModelVariant, string]>).map(([v, m]) => [m, v]),
);

export type ModelRow = SidecarModelStatus;

export async function fetchModelStatus(): Promise<{ models: ModelRow[] } | null> {
  try {
    const res = await fetch("/api/v1/ai/sidecar/model-status");
    if (!res.ok) return null;
    const data = (await res.json()) as SidecarModelStatusResponse | { error: string };
    if (!("models" in data)) return null;
    return { models: data.models };
  } catch {
    return null;
  }
}

export async function fetchAIStatus(): Promise<{ activeVariant: AIModelVariant | null; available: AIModelVariant[] }> {
  const status = await fetchModelStatus();
  if (!status) return { activeVariant: null, available: [] };

  const available: AIModelVariant[] = [];
  let activeVariant: AIModelVariant | null = null;
  for (const m of status.models) {
    if (m.type !== "embed") continue;
    const variant = MODEL_TO_VARIANT[m.id];
    if (!variant) continue;
    if (m.downloaded) available.push(variant);
    if (m.loaded) activeVariant = variant;
  }
  return { activeVariant, available };
}

async function extractError(res: Response, fallback: string): Promise<string> {
  // Pull the {error: ...} detail out of the body even on non-ok responses so
  // the toast shows "AI sidecar unreachable" (actionable) instead of "HTTP 502".
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // body wasn't JSON — fall through to fallback
  }
  return fallback;
}

export async function loadModelOnServer(variant: AIModelVariant): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/v1/ai/load-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant }),
  });
  if (!res.ok) return { success: false, error: await extractError(res, `HTTP ${res.status}`) };
  const data = await res.json();
  return { success: !!data.success, error: data.error };
}

export async function downloadModelOnServer(modelId: string): Promise<{ started: boolean; downloaded: boolean; alreadyDownloading?: boolean; error?: string }> {
  const res = await fetch("/api/v1/ai/download-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) return { started: false, downloaded: false, error: await extractError(res, `HTTP ${res.status}`) };
  const data = await res.json();
  return {
    started: !!data.started,
    downloaded: !!data.downloaded,
    alreadyDownloading: !!data.alreadyDownloading,
    error: data.error,
  };
}

export function getDownloadState(models: ModelRow[] | null, modelId: string): SidecarDownloadState | null {
  if (!models) return null;
  const row = models.find((m) => m.id === modelId);
  return row ? row.downloadState : null;
}

export function reconcileLoadedModels(
  available: AIModelVariant[],
  store = useAIStore.getState(),
) {
  for (const v of ALLOWED_VARIANTS) {
    if (available.includes(v) && !store.loadedModels.includes(v)) {
      store.addLoadedModel(v);
    } else if (!available.includes(v) && store.loadedModels.includes(v)) {
      store.removeLoadedModel(v);
    }
  }
}

export function variantToModelId(variant: AIModelVariant): string {
  return VARIANT_TO_MODEL[variant];
}

export function aestheticModelId(): string {
  return AESTHETIC_MODEL_ID;
}
