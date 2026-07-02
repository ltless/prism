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

export function StorageStep({ selectedOwnLimit, onOwnLimitChange, selectedGlobalLimit, onGlobalLimitChange }: StorageStepProps) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Admin's own quota */}
      <div className="flex flex-col gap-3">
        <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shrink-0">
            <HardDrive size={16} weight="light" />
          </div>
          <div className="flex-1">
            <h4 className="text-[12px] font-medium text-main-text">Your Storage</h4>
            <p className="text-xs text-muted-text">Your own allocation as administrator</p>
          </div>
        </div>
        <StorageLimitSelector value={selectedOwnLimit} onChange={onOwnLimitChange} />
        <div className="p-2.5 bg-surface-bg rounded-lg border border-main-border/50 flex items-center gap-2.5">
          <Cube size={13} weight="light" className="text-muted-text" />
          <p className="text-[11px] text-muted-text">
            {selectedOwnLimit ? `Your quota: ${formatBytes(selectedOwnLimit)}` : "Your storage: unlimited"}
          </p>
        </div>
      </div>

      {/* Global default quota (for standard users) */}
      <div className="flex flex-col gap-3 pt-2 border-t border-main-border/30">
        <div className="p-3 bg-violet-500/5 border border-violet-500/10 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-500 text-white rounded-lg flex items-center justify-center shrink-0">
            <Users size={16} weight="light" />
          </div>
          <div className="flex-1">
            <h4 className="text-[12px] font-medium text-main-text">Global Default</h4>
            <p className="text-xs text-muted-text">What every standard user gets</p>
          </div>
        </div>
        <StorageLimitSelector value={selectedGlobalLimit} onChange={onGlobalLimitChange} />
        <div className="p-2.5 bg-surface-bg rounded-lg border border-main-border/50 flex items-center gap-2.5">
          <Cube size={13} weight="light" className="text-muted-text" />
          <p className="text-[11px] text-muted-text">
            {selectedGlobalLimit ? `Standard users: ${formatBytes(selectedGlobalLimit)}` : "Standard users: unlimited"}
          </p>
        </div>
      </div>
    </div>
  );
}
