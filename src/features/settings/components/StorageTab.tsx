"use client";

import { useState, useEffect } from "react";
import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import { StorageLimitSelector } from "@/features/settings/components/StorageLimitSelector";
import { SectionCard } from "@/shared/components/SectionCard";
import { ChartPieSlice, Cube, FloppyDisk, HardDrive, Image as ImageIcon, Spinner, Video } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { GlobalQuotaSection } from "./storage/GlobalQuotaSection";
import { DangerZoneSection } from "./storage/DangerZoneSection";

interface StorageData {
  usedBytes: number;
  limitBytes: number | null;
  remainingBytes: number | null;
  imageBytes: number;
  videoBytes: number;
  globalDefaultBytes: number | null;
}

export function StorageTab() {
  const { session } = useEffectiveSession();
  const isAdmin = session?.user?.role === "admin";
  const [data, setData] = useState<StorageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLimit, setSelectedLimit] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getUserStorageUsageAction } = await import("@/features/settings/services/storageActions");
        type UsageResult = Awaited<ReturnType<typeof getUserStorageUsageAction>> & { success: true; usedBytes: number; limitBytes: number | null; remainingBytes: number | null; imageBytes: number; videoBytes: number; globalDefaultBytes: number | null };
        const result = await getUserStorageUsageAction();
        if (result.success) {
          const r = result as UsageResult;
          const storageData: StorageData = {
            usedBytes: r.usedBytes,
            limitBytes: r.limitBytes,
            remainingBytes: r.remainingBytes,
            imageBytes: r.imageBytes ?? 0,
            videoBytes: r.videoBytes ?? 0,
            globalDefaultBytes: r.globalDefaultBytes ?? null,
          };
          setData(storageData);
          setSelectedLimit(r.limitBytes);
        }
      } catch {
        toast.error("Failed to fetch storage data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const percentage = data && data.limitBytes !== null
    ? Math.min(100, (data.usedBytes / data.limitBytes) * 100)
    : 0;

  const percentageDisplay = data && data.limitBytes !== null
    ? `${percentage.toFixed(1)}%`
    : data?.limitBytes === null && data
      ? "0.0%"
      : "—%";

  return (
    <div className="flex flex-col gap-6 py-4 ">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-main-text">Storage & Quota</h3>
        <p className="text-[11px] text-muted-text">Monitor your disk usage, clean temporary cache, and configure storage quotas.</p>
      </div>

      {/* Usage & Breakdown Card */}
      <SectionCard icon={ChartPieSlice} title="Disk Usage Overview" bodyClassName="flex flex-col gap-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size={20} className="animate-spin text-muted-text" weight="light" />
          </div>
        ) : (
          <>
            {/* Progress bar container */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-main-text tracking-tight">
                    {data ? formatBytes(data.usedBytes) : "— GB"}
                    {data?.limitBytes !== null && data && (
                      <span className="text-[11px] text-muted-text font-normal"> / {formatBytes(data.limitBytes!)} used</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-text">
                    {data ? (data.limitBytes === null ? "Unlimited storage enabled" : `${formatBytes(data.remainingBytes!)} remaining`) : ""}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-tight">
                  {percentageDisplay}
                </span>
              </div>

              {data?.limitBytes !== null && (
                <div className="h-2.5 w-full bg-app-bg rounded-full overflow-hidden border border-main-border/30 p-[1px]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 bg-gradient-to-r",
                      percentage > 90
                        ? "from-rose-500 to-red-600"
                        : percentage > 70
                          ? "from-amber-500 to-orange-500"
                          : "from-emerald-400 to-primary/80"
                    )}
                    style={{ width: `${Math.max(1.5, percentage)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Grid Breakdown */}
            {data && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-main-border/30">
                {/* Images Card */}
                <div className="p-3.5 rounded-xl border border-main-border/40 bg-app-bg/40 hover:bg-app-bg/60 transition-colors flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
                    <ImageIcon size={18} weight="light" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-text uppercase font-semibold tracking-wider">Images</p>
                    <h5 className="text-sm font-bold text-main-text truncate">{formatBytes(data.imageBytes)}</h5>
                  </div>
                </div>

                {/* Videos Card */}
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
            )}
          </>
        )}
      </SectionCard>

      {/* Global Default Quota - Admin Only */}
      {isAdmin && (
        <GlobalQuotaSection data={data} isLoading={isLoading} onDataChange={setData} />
      )}

      {/* Storage Limit (admin's own) - Admin Only */}
      {isAdmin && (
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
              disabled={isSaving || selectedLimit === data?.limitBytes || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
            >
              {isSaving ? <Spinner size={12} className="animate-spin" weight="light" /> : <FloppyDisk size={12} weight="light" />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Danger Zone Card */}
      <DangerZoneSection />
    </div>
  );
}
