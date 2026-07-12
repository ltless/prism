import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import type { AIState } from "@/features/ai/store";
import type { AIModelVariant } from "@/features/ai/types";
import {
  downloadModelOnServer,
  loadModelOnServer,
  fetchModelStatus,
  variantToModelId,
  aestheticModelId,
  unloadAllOnServer,
} from "@/features/ai/services/aiStatusClient";
import { RAM_MODEL_ID } from "@/features/ai/constants";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10 * 60_000;

interface DownloadOptions {
  modelId: string;
  label: string;
  onProgress?: (pct: number) => void;
  signal?: { cancelled: boolean };
}

async function pollUntilDone(opts: DownloadOptions): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (opts.signal?.cancelled) return false;
    const status = await fetchModelStatus();
    if (!status) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const row = status.models.find((m) => m.id === opts.modelId);
    if (!row) {
      toast.error(`Model ${opts.label} not found in registry`);
      return false;
    }
    if (row.downloaded) {
      opts.onProgress?.(100);
      return true;
    }
    const state = row.downloadState;
    if (state?.status === "error") {
      toast.error(`${opts.label} download failed: ${state.error || "unknown"}`);
      return false;
    }
    const pct = typeof state?.progress === "number" ? state.progress : 0;
    opts.onProgress?.(pct);
    await sleep(POLL_INTERVAL_MS);
  }
  toast.error(`${opts.label} download timed out`);
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useModelDownload(ai: AIState) {
  const clipCancelRef = useRef({ cancelled: false });
  const aestheticCancelRef = useRef({ cancelled: false });
  const [aestheticDownloaded, setAestheticDownloaded] = useState(false);

  const downloadCLIP = useCallback(async (variant: AIModelVariant) => {
    try {
      if (ai.status === "downloading" || ai.status === "loading") return false;
      clipCancelRef.current = { cancelled: false };
      const cancelSignal = clipCancelRef.current;
      if (!ai.globalAIEnabled) ai.setGlobalAIEnabled(true);

      ai.setStatus("downloading");
      ai.setProgress(0);
      const modelId = variantToModelId(variant);
      const label = `CLIP ${variant}`;

      const res = await downloadModelOnServer(modelId);
      if (res.error) {
        ai.setStatus("idle");
        toast.error(`${label}: ${res.error}`);
        return false;
      }
      if (res.downloaded) {
        ai.setProgress(100);
        ai.addLoadedModel(variant);
        toast.success(`${label} already downloaded`);
        return true;
      }
      if (!res.started && !res.alreadyDownloading) {
        ai.setStatus("idle");
        toast.error(`${label}: failed to start download`);
        return false;
      }

      const ok = await pollUntilDone({
        modelId,
        label,
        onProgress: (pct) => ai.setProgress(pct),
        signal: cancelSignal,
      });
      if (!ok) {
        ai.setStatus("idle");
        return false;
      }
      ai.setProgress(100);
      ai.addLoadedModel(variant);
      toast.success(`${label} downloaded!`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
      ai.setStatus("idle");
      return false;
    }
  }, [ai]);

  const activateModel = useCallback(async (variant: AIModelVariant) => {
    try {
      ai.setStatus("loading");
      const modelId = variantToModelId(variant);
      const { success, error } = await loadModelOnServer(modelId);
      if (success) {
        ai.setActiveVariant(variant);
        ai.setStatus("ready");
        toast.success(`${variant} activated`);
        return true;
      }
      ai.setStatus("idle");
      toast.error(error || "Activation failed");
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed");
      ai.setStatus("idle");
      return false;
    }
  }, [ai]);

  const downloadAesthetic = useCallback(async () => {
    try {
      aestheticCancelRef.current = { cancelled: false };
      const cancelSignal = aestheticCancelRef.current;
      ai.setStatus("downloading");
      ai.setProgress(0);
      const modelId = aestheticModelId();
      const label = "LAION Aesthetic v2.5";

      const res = await downloadModelOnServer(modelId);
      if (res.error) {
        ai.setStatus("idle");
        toast.error(`${label}: ${res.error}`);
        return false;
      }
      if (res.downloaded) {
        ai.setProgress(100);
        setAestheticDownloaded(true);
        ai.setStatus("idle");
        toast.success(`${label} already downloaded`);
        return true;
      }
      if (!res.started && !res.alreadyDownloading) {
        ai.setStatus("idle");
        toast.error(`${label}: failed to start download`);
        return false;
      }

      const ok = await pollUntilDone({
        modelId,
        label,
        onProgress: (pct) => ai.setProgress(pct),
        signal: cancelSignal,
      });
      if (!ok) {
        ai.setStatus("idle");
        return false;
      }
      setAestheticDownloaded(true);
      ai.setStatus("idle");
      toast.success("LAION Aesthetic v2.5 ready");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      ai.setStatus("idle");
      return false;
    }
  }, [ai]);

  const downloadRAM = useCallback(async () => {
    try {
      ai.setStatus("downloading");
      ai.setProgress(0);
      const label = "RAM++ (Recognize Anything)";
      const res = await downloadModelOnServer(RAM_MODEL_ID);
      if (res.error) {
        ai.setStatus("idle");
        toast.error(`${label}: ${res.error}`);
        return false;
      }
      if (res.downloaded) {
        ai.setProgress(100);
        ai.setStatus("idle");
        toast.success(`${label} already downloaded`);
        return true;
      }
      if (!res.started && !res.alreadyDownloading) {
        ai.setStatus("idle");
        toast.error(`${label}: failed to start download`);
        return false;
      }

      const ok = await pollUntilDone({
        modelId: RAM_MODEL_ID,
        label,
        onProgress: (pct) => ai.setProgress(pct),
        signal: { cancelled: false },
      });
      if (!ok) {
        ai.setStatus("idle");
        return false;
      }
      ai.setProgress(100);
      ai.setStatus("idle");
      toast.success(`${label} downloaded!`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
      ai.setStatus("idle");
      return false;
    }
  }, [ai]);

  const activateRAM = useCallback(async () => {
    try {
      ai.setStatus("loading");
      const { success, error } = await loadModelOnServer(RAM_MODEL_ID);
      if (success) {
        ai.setStatus("ready");
        toast.success("RAM++ activated");
        return true;
      }
      ai.setStatus("idle");
      toast.error(error || "RAM++ activation failed");
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "RAM++ activation failed");
      ai.setStatus("idle");
      return false;
    }
  }, [ai]);

  const cancelClip = useCallback(() => { clipCancelRef.current.cancelled = true; }, []);
  const cancelAesthetic = useCallback(() => { aestheticCancelRef.current.cancelled = true; }, []);

  return {
    downloadCLIP,
    activateModel,
    downloadAesthetic,
    downloadRAM,
    activateRAM,
    cancelClip,
    cancelAesthetic,
    aestheticDownloaded,
    setAestheticDownloaded,
  };
}
