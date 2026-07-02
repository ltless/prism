"use client";

import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import { SectionCard } from "@/shared/components/SectionCard";
import { ChartPieSlice, Image as ImageIcon, Spinner, Video } from "@phosphor-icons/react";

export interface StorageData {
  usedBytes: number;
  limitBytes: number | null;
  remainingBytes: number | null;
  imageBytes: number;
  videoBytes: number;
  globalDefaultBytes: number | null;
}

function barColor(percentage: number): string {
  if (percentage > 90) return "from-rose-500 to-red-600";
  if (percentage > 70) return "from-amber-500 to-orange-500";
  return "from-emerald-400 to-primary/80";
}

export function UsageOverviewCard({ data, isLoading }: { data: StorageData | null; isLoading: boolean }) {
  const hasLimit = data?.limitBytes != null;
  const percentage = hasLimit ? Math.min(100, (data!.usedBytes / data!.limitBytes!) * 100) : 0;

  return (
    <SectionCard icon={ChartPieSlice} title="Disk Usage Overview" bodyClassName="flex flex-col gap-5">
      {isLoading ? <LoadingBlock /> : (
        <>
          <UsageSummary data={data} hasLimit={hasLimit} percentage={percentage} />
          {data && <BreakdownRow data={data} />}
        </>
      )}
    </SectionCard>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-6">
      <Spinner size={20} className="animate-spin text-muted-text" weight="light" />
    </div>
  );
}

function UsageSummary({ data, hasLimit, percentage }: { data: StorageData | null; hasLimit: boolean; percentage: number }) {
  const label = data && !hasLimit ? "0.0%" : hasLimit ? `${percentage.toFixed(1)}%` : "—%";
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div className="space-y-0.5">
          <p className="text-xl font-bold text-main-text tracking-tight">
            {data ? formatBytes(data.usedBytes) : "— GB"}
            {hasLimit && data && (
              <span className="text-[11px] text-muted-text font-normal"> / {formatBytes(data.limitBytes!)} used</span>
            )}
          </p>
          <p className="text-xs text-muted-text">
            {data ? (data.limitBytes === null ? "Unlimited storage enabled" : `${formatBytes(data.remainingBytes ?? 0)} remaining`) : ""}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-tight">
          {label}
        </span>
      </div>

      {hasLimit && data && (
        <div className="h-2.5 w-full bg-app-bg rounded-full overflow-hidden border border-main-border/30 p-[1px]">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 bg-gradient-to-r", barColor(percentage))}
            style={{ width: `${Math.max(1.5, percentage)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ data }: { data: StorageData }) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-main-border/30">
      <div className="p-3.5 rounded-xl border border-main-border/40 bg-app-bg/40 hover:bg-app-bg/60 transition-colors flex items-center gap-3">
        <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
          <ImageIcon size={18} weight="light" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-text uppercase font-semibold tracking-wider">Images</p>
          <h5 className="text-sm font-bold text-main-text truncate">{formatBytes(data.imageBytes)}</h5>
        </div>
      </div>

      <div className="p-3.5 rounded-xl border border-main-border/40 bg-app-bg/40 hover:bg-app-bg/60 transition-colors flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-lg shrink-0">
          <Video size={18} weight="light" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-text uppercase font-semibold tracking-wider">Videos</p>
          <h5 className="text-sm font-bold text-main-text truncate">{formatBytes(data.videoBytes)}</h5>
        </div>
      </div>
    </div>
  );
}