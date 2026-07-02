"use client";

import { cn } from "@/core/utils/cn";

function getStatusColor(val: number) {
  if (val < 50) return "text-primary";
  if (val < 80) return "text-amber-500";
  return "text-rose-500";
}

interface TopBarStatsProps {
  stats: { cpu: number; ram: number; ramText: string };
}

export function TopBarStats({ stats }: TopBarStatsProps) {
  const cpu = stats?.cpu ?? 0;
  const ram = stats?.ram ?? 0;
  const ramText = stats?.ramText || "0/0GB";

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium tabular-nums text-muted-text">
      <span className={cn("transition-colors duration-500", getStatusColor(cpu))}>
        {cpu}<span className="text-muted-text/60 ml-0.5">cpu</span>
      </span>
      <span className="text-main-border/50">·</span>
      <span className={cn("transition-colors duration-500", getStatusColor(ram))}>
        {ramText.split('/')[0]}<span className="text-muted-text/60 ml-0.5">ram</span>
      </span>
    </div>
  );
}
