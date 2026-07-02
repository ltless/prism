"use client";

import { useState } from "react";
import { Cube, FloppyDisk, HardDrive, Spinner } from "@phosphor-icons/react";
import { SectionCard } from "@/shared/components/SectionCard";
import { StorageLimitSelector } from "@/features/settings/components/StorageLimitSelector";
import { toast } from "sonner";
import type { StorageData } from "./UsageOverviewCard";

export function AdminQuotaSection({ data, setData }: {
  data: StorageData | null;
  setData: (updater: (prev: StorageData | null) => StorageData | null) => void;
}) {
  const [selectedLimit, setSelectedLimit] = useState<number | null>(data?.limitBytes ?? null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (selectedLimit === data?.limitBytes) return;
    setIsSaving(true);
    try {
      const { updateStorageLimitAction } = await import("@/features/settings/services/storageActions");
      const result = await updateStorageLimitAction(selectedLimit);
      if (result.success) {
        toast.success("Storage limit updated");
        setData(prev => prev ? { ...prev, limitBytes: selectedLimit } : null);
      } else {
        toast.error(result.error || "Failed to update storage limit");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard icon={HardDrive} title="Storage Quota Management" bodyClassName="flex flex-col gap-4">
      <p className="text-[11px] text-muted-text">Your own storage allocation as administrator.</p>

      <div className="p-4 bg-app-bg/50 border border-main-border/40 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
          <HardDrive size={18} weight="light" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-bold text-main-text">Local Storage Allocation</h4>
          <p className="text-xs text-muted-text">Change max allowed size parameters</p>
        </div>
      </div>

      <div className="pt-2">
        <StorageLimitSelector value={selectedLimit} onChange={setSelectedLimit} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-main-border/30">
        <div className="flex items-center gap-2 px-3 py-2 bg-app-bg rounded-lg border border-main-border/40 flex-1 min-w-0">
          <Cube size={14} weight="light" className="text-muted-text shrink-0" />
          <p className="text-[11px] text-muted-text truncate font-medium">
            {selectedLimit
              ? `Quota set to ${selectedLimit / (1024 * 1024 * 1024)} GB`
              : "Unlimited quota selected"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || selectedLimit === data?.limitBytes}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
        >
          {isSaving ? <Spinner size={12} className="animate-spin" weight="light" /> : <FloppyDisk size={12} weight="light" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </SectionCard>
  );
}