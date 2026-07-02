"use client";

import { Star, Heart } from "@phosphor-icons/react";
import { SectionCard, Field } from "@/shared/components/SectionCard";

interface AestheticCardProps {
  aestheticScore?: number;
  autofavorited?: boolean;
  aestheticModel?: string;
  aestheticScoredAt?: string;
}

function formatModelLabel(model?: string): string | null {
  if (!model) return null;
  if (model === "clip") return "CLIP";
  if (model === "laion") return "FSW";
  return model.toUpperCase();
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function AestheticCard({ aestheticScore, autofavorited, aestheticModel, aestheticScoredAt }: AestheticCardProps) {
  if (aestheticScore === undefined) return null;
  const pct = Math.max(0, Math.min(100, aestheticScore * 100));
  const modelLabel = formatModelLabel(aestheticModel);
  const scoredDate = formatDate(aestheticScoredAt);
  return (
    <SectionCard compact icon={Star} title="Quality">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-text">Score</span>
          <span className="text-xs font-mono font-semibold text-amber-500">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1 w-full bg-surface-bg rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {autofavorited && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-500">
            <Heart size={11} weight="fill" />
            Auto-favorited
          </div>
        )}
        {(modelLabel || scoredDate) && (
          <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-main-border/30">
            <Field label="Model" value={modelLabel} />
            <Field label="Scored" value={scoredDate} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
