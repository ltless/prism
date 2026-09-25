"use client";

import { useState } from "react";
import { NukeButton } from "@/features/media/components/NukeButton";
import { Spinner } from "@phosphor-icons/react";
import { SettingsGroup } from "../SettingsGroup";
import { toast } from "sonner";

export function DangerZoneSection() {
  const [isCleaning, setIsCleaning] = useState(false);

  const handleClearTrashAndCache = async () => {
    setIsCleaning(true);
    try {
      const { runAutoCleanupAction, emptyTrashAction } = await import("@/features/media/services/mediaTrashActions");
      const [cleanupRes, emptyRes] = await Promise.all([runAutoCleanupAction(), emptyTrashAction()]);
      const total = ((cleanupRes as { cleanedCount?: number }).cleanedCount ?? 0) + ((emptyRes as { count?: number }).count ?? 0);
      toast.success(`Cleared ${total} item${total !== 1 ? "s" : ""} from trash`);
    } catch {
      toast.error("Failed to clear trash & cache");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <SettingsGroup title="Cleanup" description="Emptying trash removes those files. Resetting the library removes everything.">
      <div className="flex items-center justify-between gap-4 border-b border-main-border px-5 py-4">
        <div>
          <p className="text-[13px] text-main-text">Trash</p>
          <p className="text-[12px] text-muted-text">Delete everything already in trash</p>
        </div>
        <button
          type="button"
          onClick={handleClearTrashAndCache}
          disabled={isCleaning}
          className="shrink-0 rounded-full border border-main-border px-4 py-1.5 text-[13px] text-main-text hover:bg-surface-bg disabled:opacity-40 cursor-pointer"
        >
          {isCleaning ? <Spinner size={12} className="animate-spin" /> : "Empty trash"}
        </button>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] text-rose-500">Reset library</p>
          <p className="text-[12px] text-muted-text">Deletes all of your media</p>
        </div>
        <NukeButton disabled={false} />
      </div>
    </SettingsGroup>
  );
}
