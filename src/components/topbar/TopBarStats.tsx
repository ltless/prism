"use client";

import { cn } from "@/core/utils/cn";
import type { AIModelVariant, AestheticModelType } from "@/features/ai/types";

function getStatusColor(val: number) {
  if (val < 50) return "text-emerald-500";
  if (val < 80) return "text-amber-500";
  return "text-rose-500";
}

const AI_STATUS_META: Record<string, { text: string; color: string }> = {
  ready: { text: "ON", color: "text-emerald-500" },
  processing: { text: "ON", color: "text-violet-500" },
  loading: { text: "LD", color: "text-amber-500" },
  downloading: { text: "DL", color: "text-amber-500" },
};

function getAestheticLabel(model: AestheticModelType): string {
  switch (model) {
  case 'clip': return 'CLIP';
  case 'laion': return 'FSW';
  default: return model;
  }
}

interface TopBarStatsProps {
  stats: { cpu: number; ram: number; ramText: string };
  aiStatus: string;
  aiVariant: AIModelVariant | null;
  aiEnabled: boolean;
  aestheticModel?: AestheticModelType;
  aestheticEnabled?: boolean;
}

export function TopBarStats({ stats, aiStatus, aiVariant, aiEnabled, aestheticModel = 'clip', aestheticEnabled = false }: TopBarStatsProps) {
  const aiMeta = AI_STATUS_META[aiStatus] ?? { text: "OFF", color: "text-muted-text" };
  const showAi = aiEnabled && aiMeta.text !== "OFF";
  const cpu = stats?.cpu ?? 0;
  const ram = stats?.ram ?? 0;
  const ramText = stats?.ramText || "0/0GB";

  return (
  <div className="flex items-center gap-2 text-xs font-medium tabular-nums text-muted-text">
  <span className={cn("transition-colors duration-500", getStatusColor(cpu))}>
  {cpu}<span className="text-muted-text ml-0.5">cpu</span>
  </span>
  <span className="text-main-border">·</span>
  <span className={cn("transition-colors duration-500", getStatusColor(ram))}>
  {ramText.split('/')[0]}<span className="text-muted-text ml-0.5">ram</span>
  </span>
  {showAi && (
  <>
  <span className="text-main-border">·</span>
  <span className={cn("transition-colors duration-500", aiMeta.color)}>
  {aiVariant?.toUpperCase()}
  </span>
  <span className={cn("transition-colors duration-500", aestheticEnabled ? "text-sky-500" : "text-muted-text")}>
  {getAestheticLabel(aestheticModel)}
  </span>
  <span className={cn("transition-colors duration-500", aiMeta.color)}>
  {aiMeta.text}
  </span>
  </>
  )}
  {!showAi && (
  <span className="text-muted-text">off</span>
  )}
  </div>
  );
}
