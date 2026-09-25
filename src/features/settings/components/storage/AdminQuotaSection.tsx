"use client";

import { useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import { SettingsGroup } from "../SettingsGroup";
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
    <SettingsGroup title="Your limit" description={selectedLimit ? `${selectedLimit / (1024 * 1024 * 1024)} GB on this account.` : "No limit on this account."}>
      <div className="flex flex-col gap-3 p-4">
        <StorageLimitSelector value={selectedLimit} onChange={setSelectedLimit} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedLimit === data?.limitBytes}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? <Spinner size={12} className="animate-spin" /> : "Save limit"}
          </button>
        </div>
      </div>
    </SettingsGroup>
  );
}