"use client";

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
    <div className="flex items-center gap-2 text-[11px] font-medium tabular-nums tracking-[-0.01em] text-muted-text">
      <span className={getStatusColor(cpu)}>
        {cpu}<span className="ml-1 text-[10px] font-normal uppercase tracking-[0.12em] text-muted-text/70">cpu</span>
      </span>
      <span className="h-3 w-px bg-main-text/10" />
      <span className={getStatusColor(ram)}>
        {ramText.split("/")[0]}<span className="ml-1 text-[10px] font-normal uppercase tracking-[0.12em] text-muted-text/70">ram</span>
      </span>
    </div>
  );
}
