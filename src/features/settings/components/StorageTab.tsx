"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { GlobalQuotaSection } from "./storage/GlobalQuotaSection";
import { DangerZoneSection } from "./storage/DangerZoneSection";
import { UsageOverviewCard, type StorageData } from "./storage/UsageOverviewCard";
import { AdminQuotaSection } from "./storage/AdminQuotaSection";

export function StorageTab() {
  const { session } = useEffectiveSession();
  const isAdmin = session?.user?.role === "admin";
  const [data, setData] = useState<StorageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getUserStorageUsageAction } = await import("@/features/settings/services/storageActions");
        type UsageResult = Awaited<ReturnType<typeof getUserStorageUsageAction>> & Pick<StorageData, "usedBytes" | "limitBytes" | "remainingBytes" | "imageBytes" | "videoBytes" | "globalDefaultBytes">;
        const result = await getUserStorageUsageAction();
        if (result.success) {
          const r = result as UsageResult;
          setData({
            usedBytes: r.usedBytes,
            limitBytes: r.limitBytes,
            remainingBytes: r.remainingBytes,
            imageBytes: r.imageBytes ?? 0,
            videoBytes: r.videoBytes ?? 0,
            globalDefaultBytes: r.globalDefaultBytes ?? null,
          });
        }
      } catch {
        toast.error("Failed to fetch storage data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <UsageOverviewCard data={data} isLoading={isLoading} />

      {isAdmin && (
        <GlobalQuotaSection data={data} isLoading={isLoading} onDataChange={setData} />
      )}

      {isAdmin && (
        <AdminQuotaSection data={data} setData={setData} />
      )}

      <DangerZoneSection />
    </div>
  );
}