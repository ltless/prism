"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Spinner, MagnifyingGlass, Star, Heart, Cpu, Warning, Download } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { toast } from "sonner";
import { Toggle } from "@/shared/components/ui/Toggle";
import type { AIModelVariant } from "@/features/ai/types";
import { triggerConfigUpdate } from "@/features/ai/utils/triggerConfigUpdate";
import { useModelDownload } from "@/features/ai/hooks/useModelDownload";
import { fetchModelStatus, reconcileLoadedModels, unloadAllOnServer } from "@/features/ai/services/aiStatusClient";
import type { ModelRow } from "@/features/ai/services/aiStatusClient";
import { SIDECAR_MODEL_IDS, RAM_MODEL_ID } from "@/features/ai/constants";
import type { AITabProps } from "./AITab";

interface GpuInfo {
  gpuAvailable: boolean;
  device?: string;
  platform?: string;
  gpuName?: string;
  torchVersion?: string;
  error?: string;
}

export function AdminAITab({ ai, tagStats, onSetTagStats, scoreStats, onSetScoreStats }: AITabProps) {
  const { downloadCLIP, activateModel, downloadAesthetic, downloadRAM, activateRAM, cancelClip, aestheticDownloaded, setAestheticDownloaded } = useModelDownload(ai);

  const { data: modelData } = useQuery({
    queryKey: ["model-status"],
    queryFn: fetchModelStatus,
    refetchInterval: (query) => {
      const models = query.state.data?.models ?? [];
      return models.some(m => m.downloadState?.status === "downloading") ? 1500 : false;
    },
  });

  const { data: gpuInfo } = useQuery<GpuInfo>({
    queryKey: ["gpu-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai/sidecar/gpu-status");
      if (!res.ok) return { gpuAvailable: false } as GpuInfo;
      return res.json() as Promise<GpuInfo>;
    },
  });

  const models: ModelRow[] | null = modelData?.models ?? null;

  const ramRow = models?.find((m) => m.id === RAM_MODEL_ID);
  const ramDownloaded = !!ramRow?.downloaded;
  const ramLoaded = !!ramRow?.loaded;

  useEffect(() => {
    if (!modelData) return;
    const clipAvailable = modelData.models
      .filter((m) => m.type === "embed" && m.downloaded)
      .map((m) => {
        const entry = Object.entries(SIDECAR_MODEL_IDS).find(([, id]) => id === m.id);
        return entry ? (entry[0] as AIModelVariant) : null;
      })
      .filter((v): v is AIModelVariant => v !== null);
    reconcileLoadedModels(clipAvailable);
    const aesthetic = modelData.models.find((m) => m.type === "aesthetic");
    if (aesthetic?.downloaded) setAestheticDownloaded(true);
  }, [modelData, setAestheticDownloaded]);

  const variants: Array<{ id: AIModelVariant; name: string; desc: string }> = [
  { id: "standard", name: "CLIP Base", desc: "Fast indexing, low VRAM usage (~0.5GB)" },
  { id: "sharp", name: "CLIP Sharp", desc: "Better accuracy with patch16 (~0.5GB)" },
  { id: "high", name: "CLIP High", desc: "Highest precision (~1.7GB VRAM)" },
  ];

  return (
  <div className="flex flex-col gap-6 py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
  {/* Header */}
  <div className="flex items-center justify-between border-b border-main-border/50 pb-3">
  <div className="flex items-center gap-2">
  <Shield size={16} weight="fill" className="text-primary" />
  <div>
  <h3 className="text-[12px] font-semibold text-main-text">AI Configuration</h3>
  <p className="text-xs text-muted-text mt-0.5">Global Admin Settings</p>
  </div>
  </div>
  {ai.aiActive && (
  <div className={cn(
  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
  ai.status === "ready" ? "bg-emerald-500/10 text-emerald-500" :
  ai.status === "loading" || ai.status === "downloading" ? "bg-amber-500/10 text-amber-500 animate-pulse" :
  "bg-muted-text/10 text-muted-text"
  )}>
  {ai.status === "ready" ? "System Ready" : ai.status === "loading" ? "Activating" : ai.status === "downloading" ? "Downloading" : "Inactive"}
  </div>
  )}
  </div>

  {/* Master enable toggle — always visible */}
  <div className="space-y-3 bg-surface-bg border border-main-border/50 rounded-xl p-4">
  <h4 className="text-[11px] font-medium text-muted-text border-b border-main-border/30 pb-2">Enable AI</h4>
  <div className="flex items-center justify-between p-3 rounded-xl border border-main-border/30">
  <div className="flex items-center gap-2">
  <Cpu size={14} weight="light" className="text-muted-text" />
  <div>
  <h5 className="text-[11px] font-medium text-main-text">Activate AI Engine</h5>
  <p className="text-xs text-muted-text">
  {ai.aiActive ? "AI is active — inference and auto-tagging enabled" : "Toggle on to enable AI features"}
  </p>
  </div>
  </div>
  <Toggle
  checked={ai.aiActive}
  onChange={async () => {
  if (ai.aiActive) {
  await unloadAllOnServer();
  ai.setAiActive(false);
  triggerConfigUpdate(ai, { aiActive: false });
  } else {
  ai.setAiActive(true);
  triggerConfigUpdate(ai, { aiActive: true });
  }
  }}
  />
  </div>
  </div>

  {/* Everything else — only when aiActive */}
  {ai.aiActive && (
  <>
  {/* GPU Status */}
  <div className={cn(
  "p-3 rounded-xl border flex items-center justify-between",
  gpuInfo?.gpuAvailable ? "border-emerald-500/20 bg-emerald-500/5" : "border-main-border/50 bg-surface-bg"
  )}>
  <div className="flex items-center gap-2">
  {gpuInfo?.gpuAvailable ? <Cpu size={14} weight="light" className="text-emerald-500" /> : <Warning size={14} weight="fill" className="text-amber-500 animate-pulse" />}
  <span className="text-[11px] text-muted-text">
  {gpuInfo?.error ? "Sidecar Offline" : gpuInfo?.gpuAvailable ? "Hardware GPU Acceleration" : "CPU Fallback Mode"}
  </span>
  </div>
  <span className="text-xs font-mono text-main-text max-w-[200px] truncate">
  {gpuInfo?.error ? "sidecar down" : gpuInfo?.gpuName || "CPU (PyTorch)"}
  </span>
  </div>

  {/* 1. Model Selection */}
  <div className="space-y-3 bg-surface-bg border border-main-border/50 rounded-xl p-4">
  <h4 className="text-[11px] font-medium text-muted-text border-b border-main-border/30 pb-2">1. Core Tagging Models</h4>
  <div className="flex flex-col gap-2">
  {variants.map((v) => {
  const isSelected = ai.variant === v.id;
  const isDownloaded = ai.loadedModels.includes(v.id);
  const isActive = ai.activeVariant === v.id && ai.status === "ready";

  return (
  <div key={v.id} className={cn(
  "p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3",
  isActive ? "border-emerald-500/30 bg-emerald-500/5" :
  isSelected ? "border-primary/30 bg-primary/5" : "border-main-border/30"
  )}>
  <div>
  <div className="flex items-center gap-2">
  <span className="text-[12px] font-medium text-main-text">{v.name}</span>
  {isActive && <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">ACTIVE</span>}
  {isDownloaded && !isActive && <span className="text-[11px] font-medium bg-muted-text/10 text-muted-text px-1.5 py-0.5 rounded">READY</span>}
  </div>
  <p className="text-xs text-muted-text mt-0.5">{v.desc}</p>
  </div>
  <div className="flex items-center gap-2 self-end md:self-auto">
  {!isSelected ? (
  <button onClick={() => { ai.setVariant(v.id); triggerConfigUpdate(ai, { variant: v.id }); }}
  className="px-3 py-1.5 rounded-lg bg-app-bg text-xs font-medium hover:bg-main-border/30 text-main-text cursor-pointer transition-colors">
  Select
  </button>
  ) : (
  <button
  disabled={ai.status === "downloading" || ai.status === "loading"}
  onClick={async () => {
  if (!isDownloaded) {
  const ok = await downloadCLIP(v.id);
  if (!ok) return;
  }
  await activateModel(v.id);
  }}
  className={cn(
  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
  isActive ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
  )}>
  {isActive ? "Re-Activate" : isDownloaded ? "Activate Model" : "Download & Load"}
  </button>
  )}
  </div>
  </div>
  );
  })}
  </div>

  {(ai.status === "downloading" || ai.status === "loading") && (
  <div className="p-3 bg-app-bg rounded-xl border border-main-border/50 mt-3 space-y-2 animate-in fade-in duration-200">
  <div className="flex items-center justify-between text-xs font-medium text-muted-text">
  <span className="flex items-center gap-1.5">
  <Spinner size={10} className="animate-spin text-primary" weight="light" />
  {ai.status === "downloading" ? `Downloading model: ${ai.progress}%` : "Activating model weights..."}
  </span>
  </div>
  {ai.status === "downloading" && (
  <>
  <div className="h-1 bg-main-border/50 rounded-full overflow-hidden">
  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${ai.progress}%` }} />
  </div>
  <button onClick={cancelClip} className="text-xs font-medium text-rose-500 hover:text-rose-400 block cursor-pointer transition-colors">
  Cancel Download
  </button>
  </>
  )}
  </div>
  )}

  </div>

  {/* RAM++ Model */}
  <div className="space-y-3 bg-surface-bg border border-main-border/50 rounded-xl p-4">
  <h4 className="text-[11px] font-medium text-muted-text border-b border-main-border/30 pb-2">Advanced Tagging</h4>
  <div className="p-3 rounded-xl border border-main-border/30">
  <div className="flex items-center justify-between">
  <div>
  <div className="flex items-center gap-2">
  <span className="text-[12px] font-medium text-main-text">RAM++ (Recognize Anything)</span>
  {ramLoaded && <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">ACTIVE</span>}
  {ramDownloaded && !ramLoaded && <span className="text-[11px] font-medium bg-muted-text/10 text-muted-text px-1.5 py-0.5 rounded">READY</span>}
  </div>
  <p className="text-xs text-muted-text mt-0.5">18M params, 384px, ~3GB VRAM. Semantic object/scene tags.</p>
  </div>
  <div className="flex items-center gap-2">
  <button
  disabled={ai.status === "downloading" || ai.status === "loading"}
  onClick={async () => {
  if (!ramDownloaded) {
  const ok = await downloadRAM();
  if (!ok) return;
  }
  await activateRAM();
  }}
  className={cn(
  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
  ramLoaded
  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
  : "bg-primary text-primary-foreground hover:bg-primary/90"
  )}
  >
  {ramLoaded ? "Re-Activate" : ramDownloaded ? "Activate" : "Download & Load"}
  </button>
  </div>
  </div>
  </div>
  </div>

  {/* 2. Feature Toggles */}
  <div className="space-y-3 bg-surface-bg border border-main-border/50 rounded-xl p-4">
  <h4 className="text-[11px] font-medium text-muted-text border-b border-main-border/30 pb-2">2. Advanced AI Features</h4>

  <div className="flex items-center justify-between p-3 rounded-xl border border-main-border/30">
  <div className="flex items-center gap-2">
  <MagnifyingGlass size={14} weight="light" className="text-muted-text" />
  <div>
  <h5 className="text-[11px] font-medium text-main-text">Global AI Processing</h5>
  <p className="text-xs text-muted-text">Process auto-tagging and aesthetics on upload</p>
  </div>
  </div>
  <Toggle checked={ai.globalAIEnabled} onChange={() => { const val = !ai.globalAIEnabled; ai.setGlobalAIEnabled(val); triggerConfigUpdate(ai, { enabled: val }); }} />
  </div>

  <div className="flex items-center justify-between p-3 rounded-xl border border-main-border/30">
  <div className="flex items-center gap-2">
  <Cpu size={14} weight="light" className="text-muted-text" />
  <div>
  <h5 className="text-[11px] font-medium text-main-text">Execution Device</h5>
  <p className="text-xs text-muted-text">Select hardware backend for model inference</p>
  </div>
  </div>
  <div className="flex gap-1.5">
  {(["cpu", "gpu"] as const).map(d => (
  <button key={d} onClick={() => { ai.setDevice(d); triggerConfigUpdate(ai, { device: d }); }}
  className={cn("px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-colors",
  ai.device === d ? "bg-primary border-primary text-primary-foreground" : "bg-app-bg border-main-border/50 text-muted-text"
  )}>
  {d === "cpu" ? "CPU" : "GPU (DirectML)"}
  </button>
  ))}
  </div>
  </div>

  {/* Aesthetic */}
  <div className={cn("p-4 rounded-xl border transition-colors",
  ai.aestheticEnabled ? "border-main-border/50 bg-app-bg" : "border-main-border/30 opacity-70"
  )}>
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2.5">
  <Star size={14} weight={ai.aestheticEnabled ? "fill" : "light"} className={ai.aestheticEnabled ? "text-amber-500" : "text-muted-text"} />
  <div>
  <h5 className="text-[11px] font-medium text-main-text">Aesthetic Evaluation</h5>
  <p className="text-xs text-muted-text">Grade aesthetic scores for media quality</p>
  </div>
  </div>
  <Toggle checked={ai.aestheticEnabled} color="amber" onChange={() => { const val = !ai.aestheticEnabled; ai.setAestheticEnabled(val); triggerConfigUpdate(ai, { aestheticEnabled: val }); }} />
  </div>

  {ai.aestheticEnabled && (
  <div className="mt-4 pt-3 border-t border-main-border/30 space-y-3 animate-in slide-in-from-top-1 duration-200">
  <div className="space-y-1.5">
  <span className="text-xs font-medium text-muted-text block">Scoring Engine</span>
  <div className="grid grid-cols-2 gap-2">
   {([
   { id: "clip" as const, label: "Standard (CLIP)" },
   { id: "laion" as const, label: "LAION v2.5 (PyTorch)" },
   ]).map(m => (
   <button key={m.id} disabled={m.id === "laion" && !aestheticDownloaded} onClick={() => { if (m.id === "laion" && !aestheticDownloaded) return; ai.setAestheticModel(m.id); triggerConfigUpdate(ai, { aestheticModel: m.id }); }}
   className={cn("py-2 rounded-lg text-xs font-medium transition-colors border flex items-center justify-center gap-1.5",
   m.id === "laion" && !aestheticDownloaded ? "bg-app-bg border-main-border/30 text-muted-text/50 cursor-not-allowed" :
   ai.aestheticModel === m.id ? "bg-primary border-primary text-primary-foreground cursor-pointer" : "bg-app-bg border-main-border/50 text-muted-text cursor-pointer"
   )}>
   {m.label}
   {m.id === "laion" && aestheticDownloaded && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
   </button>
   ))}
   </div>
   </div>

   {ai.aestheticModel === "laion" && !aestheticDownloaded && (
   <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3">
   <div>
   <span className="text-xs font-medium text-amber-500 block">Model Missing</span>
   <p className="text-xs text-muted-text mt-0.5">LAION aesthetic model (~1.2GB) required for deep aesthetic scoring.</p>
   </div>
   <button disabled={ai.status === "downloading"} onClick={downloadAesthetic}
   className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
   <Download size={10} weight="light" /> Download
  </button>
   </div>
   )}

   <div className="flex items-center justify-between p-3 rounded-xl border border-main-border/30">
   <div className="flex items-center gap-2">
   <Heart size={12} weight="fill" className="text-rose-500" />
   <div>
   <h6 className="text-[11px] font-medium text-main-text">Auto-Favorite Star Photo</h6>
   <p className="text-xs text-muted-text">Favorite images automatically above {Math.round(ai.autoFavoriteThreshold * 100)}% quality</p>
   </div>
   </div>
   <Toggle checked={ai.autoFavoriteEnabled} color="rose" size="sm" onChange={() => { const val = !ai.autoFavoriteEnabled; ai.setAutoFavoriteEnabled(val); triggerConfigUpdate(ai, { autoFavoriteEnabled: val }); }} />
   </div>
   </div>
   )}
   </div>
   </div>

  {/* 3. Tag Settings */}
  <div className="space-y-3 bg-surface-bg border border-main-border/50 rounded-xl p-4">
  <h4 className="text-[11px] font-medium text-muted-text border-b border-main-border/30 pb-2">3. Tag Settings & Batch Processing</h4>

  <div className="space-y-2">
  <div className="flex items-center justify-between">
  <span className="text-[11px] font-medium text-main-text">Tag Confidence Cutoff</span>
  <span className="text-[11px] font-mono text-primary">{ai.tagThreshold.toFixed(2)}</span>
  </div>
  <input type="range" min="0.05" max="0.95" step="0.05" value={ai.tagThreshold}
  onChange={(e) => { const val = parseFloat(e.target.value); ai.setTagThreshold(val); triggerConfigUpdate(ai, { tagThreshold: val }); }}
  className="w-full h-1 bg-main-border rounded-full appearance-none cursor-pointer accent-primary" />
  <div className="flex justify-between text-[11px] text-muted-text">
  <span>More Tags (0.05)</span><span>More Precise (0.95)</span>
  </div>
  </div>

   <div className="grid grid-cols-2 gap-3 pt-2">
   <div className="p-3 bg-app-bg border border-main-border/30 rounded-xl flex flex-col gap-1">
   <span className="text-xs text-muted-text">Tag Coverage</span>
   <p className="text-[12px] font-semibold text-main-text">{tagStats ? `${tagStats.tagged} / ${tagStats.total}` : "—"}</p>
   </div>
   <div className="p-3 bg-app-bg border border-main-border/30 rounded-xl flex flex-col gap-1">
   <span className="text-xs text-muted-text">Aesthetic Coverage</span>
   <p className="text-[12px] font-semibold text-main-text">{scoreStats ? `${scoreStats.scored} / ${scoreStats.total}` : "—"}</p>
   </div>
   </div>

   {tagStats && tagStats.tagged < tagStats.total && (
   <button onClick={async () => {
   const { batchTagMediaAction, batchScoreAestheticsAction, countTaggedMediaAction, countScoredMediaAction } = await import("@/features/media/services/mediaAIActions");
   toast.promise(
   (async () => {
   let totalTagged = 0, done = false;
   while (!done) { const res = await batchTagMediaAction(); if (!res.success) throw new Error(res.error || "Tagging aborted"); totalTagged += res.tagged; done = res.done; }
   if (ai.aestheticEnabled) {
   let scoredDone = false;
   while (!scoredDone) { const res = await batchScoreAestheticsAction(); if (!res.success) break; scoredDone = res.done; }
   }
   const stats = await countTaggedMediaAction(); if (stats.success) onSetTagStats({ total: stats.total, tagged: stats.tagged });
   const scoreRes = await countScoredMediaAction(); if (scoreRes.success) onSetScoreStats({ total: scoreRes.total, scored: scoreRes.scored });
   window.dispatchEvent(new CustomEvent('prism-ai-update')); return totalTagged;
   })(),
   { loading: "Re-indexing media library (tag + score)...", success: (c: number) => `Finished. Tagged ${c} new items.`, error: "Indexing interrupted" }
   );
   }} className="w-full py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-[11px] font-medium rounded-lg transition-colors cursor-pointer">
   Run Tagging for Remaining Media ({tagStats.total - tagStats.tagged} items)
   </button>
   )}

   {ai.aestheticEnabled && scoreStats && scoreStats.scored < scoreStats.total && tagStats && tagStats.tagged >= tagStats.total && (
   <button onClick={async () => {
   const { batchScoreAestheticsAction, countScoredMediaAction } = await import("@/features/media/services/mediaAIActions");
   toast.promise(
   (async () => {
   let totalScored = 0, done = false;
   while (!done) { const res = await batchScoreAestheticsAction(); if (!res.success) throw new Error(res.error || "Scoring aborted"); totalScored += res.scored; done = res.done; }
   const stats = await countScoredMediaAction(); if (stats.success) onSetScoreStats({ total: stats.total, scored: stats.scored });
   window.dispatchEvent(new CustomEvent('prism-ai-update')); return totalScored;
   })(),
   { loading: "Scoring remaining media...", success: (c: number) => `Finished. Scored ${c} items.`, error: "Scoring interrupted" }
   );
   }} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium rounded-lg transition-colors cursor-pointer">
   Run Scoring for Remaining Media ({scoreStats.total - scoreStats.scored} items)
   </button>
   )}
  </div>

  <p className="text-center text-xs text-muted-text/60 select-none">All indexing runs locally inside a secure background worker.</p>
  </>
  )}
  </div>
  );
}
