"use client";

import { useState } from "react";
import { SettingsGroup } from "../SettingsGroup";
import { StorageLimitSelector } from "@/features/settings/components/StorageLimitSelector";
import { pillPrimary } from "@/shared/components/ui/styles";
import { Spinner } from "@phosphor-icons/react";
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
    <SettingsGroup title="Default for new users" description={selectedGlobalLimit ? `${formatBytes(selectedGlobalLimit)} each.` : "No default limit."}>
      <div className="flex flex-col gap-3 px-5 py-5">
        <StorageLimitSelector value={selectedGlobalLimit} onChange={setSelectedGlobalLimit} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveGlobal}
            disabled={isSavingGlobal || selectedGlobalLimit === (data?.globalDefaultBytes ?? null) || isLoading}
            className={pillPrimary}
          >
            {isSavingGlobal ? <Spinner size={12} className="animate-spin" /> : "Save default"}
          </button>
        </div>
      </div>
    </SettingsGroup>
  );
}
