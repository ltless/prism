"use client";

import { HardDrive, Cube, Users } from "@phosphor-icons/react";
import { StorageLimitSelector } from "@/features/settings/components/StorageLimitSelector";
import { formatBytes } from "@/core/utils/format";

interface StorageStepProps {
  selectedOwnLimit: number | null;
  onOwnLimitChange: (v: number | null) => void;
  selectedGlobalLimit: number | null;
  onGlobalLimitChange: (v: number | null) => void;
}

function QuotaBlock({
  icon: Icon,
  title,
  caption,
  value,
  summary,
  onChange,
}: {
  icon: typeof HardDrive;
  title: string;
  caption: string;
  value: number | null;
  summary: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-black/[0.03] p-4 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-main-text text-app-bg">
          <Icon size={16} weight="light" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium tracking-tight text-main-text">{title}</p>
          <p className="text-[12px] text-muted-text">{caption}</p>
        </div>
      </div>

      <StorageLimitSelector value={value} onChange={onChange} />

      <p className="flex items-center gap-2 text-[12px] text-muted-text">
        <Cube size={13} weight="light" />
        {summary}
      </p>
    </div>
  );
}

export function StorageStep({ selectedOwnLimit, onOwnLimitChange, selectedGlobalLimit, onGlobalLimitChange }: StorageStepProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <QuotaBlock
        icon={HardDrive}
        title="Your storage"
        caption="Your own allocation"
        value={selectedOwnLimit}
        summary={selectedOwnLimit ? `Your quota: ${formatBytes(selectedOwnLimit)}` : "Your storage: unlimited"}
        onChange={onOwnLimitChange}
      />
      <QuotaBlock
        icon={Users}
        title="Global default"
        caption="What every standard user gets"
        value={selectedGlobalLimit}
        summary={selectedGlobalLimit ? `Standard users: ${formatBytes(selectedGlobalLimit)}` : "Standard users: unlimited"}
        onChange={onGlobalLimitChange}
      />
    </div>
  );
}
