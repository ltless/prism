"use client";

import { m } from "motion/react";
import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import { SettingsGroup } from "../SettingsGroup";
import { Image as ImageIcon, Video } from "@phosphor-icons/react";

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
    <SettingsGroup title="Usage" description={data && !hasLimit ? "No limit on this account." : undefined}>
      {isLoading ? <LoadingBlock /> : (
        <>
          <UsageSummary data={data} hasLimit={hasLimit} percentage={percentage} />
          {data && <BreakdownRow data={data} />}
        </>
      )}
    </SettingsGroup>
  );
}

function LoadingBlock() {
  return (
    <div className="flex flex-col gap-3 px-5 py-5" aria-busy="true" aria-label="Loading storage">
      <div className="h-7 w-24 animate-pulse rounded-full bg-surface-bg" />
      <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-bg" />
    </div>
  );
}

function UsageSummary({ data, hasLimit, percentage }: { data: StorageData | null; hasLimit: boolean; percentage: number }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[28px] font-medium tracking-tight text-main-text tabular-nums">
          {data ? formatBytes(data.usedBytes) : "—"}
        </p>
        <p className="text-[12px] text-muted-text">
          {hasLimit && data ? `${formatBytes(data.remainingBytes ?? 0)} left` : data ? "Unlimited" : ""}
        </p>
      </div>
      {hasLimit && data && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-bg">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(1.5, percentage)}%` }}
              transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
              className={cn("h-full rounded-full bg-gradient-to-r", barColor(percentage))}
            />
          </div>
          <p className="text-[11px] tabular-nums tracking-wide text-muted-text">
            {Math.round(percentage)}% of {formatBytes(data.limitBytes ?? 0)}
          </p>
        </>
      )}
    </div>
  );
}

function BreakdownRow({ data }: { data: StorageData }) {
  return (
    <div className="grid grid-cols-2 border-t border-main-border">
      <Stat icon={ImageIcon} label="Images" value={formatBytes(data.imageBytes)} />
      <Stat icon={Video} label="Videos" value={formatBytes(data.videoBytes)} border />
    </div>
  );
}

function Stat({ icon: Icon, label, value, border }: { icon: typeof ImageIcon; label: string; value: string; border?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 px-5 py-3.5", border && "border-l border-main-border")}>
      <Icon size={15} weight="light" className="text-muted-text" />
      <div>
        <p className="text-[12px] text-muted-text">{label}</p>
        <p className="text-[14px] tabular-nums text-main-text">{value}</p>
      </div>
    </div>
  );
}