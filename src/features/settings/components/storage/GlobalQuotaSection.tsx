"use client";

import { useState } from "react";
import { SectionCard } from "@/shared/components/SectionCard";
import { StorageLimitSelector } from "@/features/settings/components/StorageLimitSelector";
import { Cube, FloppyDisk, Spinner, Users } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatBytes } from "@/core/utils/format";

interface StorageData {
  usedBytes: number;
  limitBytes: number | null;
  remainingBytes: number | null;
  imageBytes: number;
  videoBytes: number;
  globalDefaultBytes: number | null;
}

interface GlobalQuotaSectionProps {
  data: StorageData | null;
  isLoading: boolean;
  onDataChange: (updater: (prev: StorageData | null) => StorageData | null) => void;
}

export function GlobalQuotaSection({ data, isLoading, onDataChange }: GlobalQuotaSectionProps) {
  const [selectedGlobalLimit, setSelectedGlobalLimit] = useState<number | null>(data?.globalDefaultBytes ?? null);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  const handleSaveGlobal = async () => {
    if (selectedGlobalLimit === (data?.globalDefaultBytes ?? null)) return;
    setIsSavingGlobal(true);
    try {
      const { updateGlobalStorageDefaultAction } = await import("@/features/settings/services/storageActions");
      const result = await updateGlobalStorageDefaultAction(selectedGlobalLimit === null ? "unlimited" : selectedGlobalLimit);
      if (result.success) {
        toast.success("Global default quota updated");
        onDataChange(prev => prev ? { ...prev, globalDefaultBytes: selectedGlobalLimit } : null);
      } else {
        toast.error(result.error || "Failed to update global default");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSavingGlobal(false);
    }
  };

  return (
    <SectionCard icon={Users} title="Global Default Quota" bodyClassName="flex flex-col gap-4">
      <p className="text-[11px] text-muted-text">Default storage quota applied to all standard users. Set to ∞ for unlimited. Per-user overrides arrive in a future admin panel.</p>

      <div className="p-4 bg-app-bg/50 border border-main-border/40 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <Users size={18} weight="light" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-bold text-main-text">Standard User Allocation</h4>
          <p className="text-xs text-muted-text">What every non-admin user gets by default</p>
        </div>
      </div>

      <div className="pt-2">
        <StorageLimitSelector value={selectedGlobalLimit} onChange={setSelectedGlobalLimit} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-main-border/30">
        <div className="flex items-center gap-2 px-3 py-2 bg-app-bg rounded-lg border border-main-border/40 flex-1 min-w-0">
          <Cube size={14} weight="light" className="text-muted-text shrink-0" />
          <p className="text-[11px] text-muted-text truncate font-medium">
            {selectedGlobalLimit
              ? `Default ${formatBytes(selectedGlobalLimit)} per user`
              : "Unlimited (no default quota)"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveGlobal}
          disabled={isSavingGlobal || selectedGlobalLimit === (data?.globalDefaultBytes ?? null) || isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
        >
          {isSavingGlobal ? <Spinner size={12} className="animate-spin" weight="light" /> : <FloppyDisk size={12} weight="light" />}
          {isSavingGlobal ? "Saving..." : "Save Default"}
        </button>
      </div>
    </SectionCard>
  );
}
