"use client";

import { useState } from "react";
import { NukeButton } from "@/features/media/components/NukeButton";
import { ShieldWarning, Spinner, Trash } from "@phosphor-icons/react";
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
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.01] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-rose-500/20 bg-rose-500/[0.03] flex items-center gap-2">
        <ShieldWarning size={15} weight="light" className="text-rose-500" />
        <h4 className="text-[12px] font-semibold text-rose-500">System Cleanup & Danger Zone</h4>
      </div>

      <div className="p-4 md:p-5 flex flex-col gap-4">
        <p className="text-[11px] text-muted-text">Perform file cleanup operations. Clearing trash and cache is safe, but resetting database deletes all files.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Clear Trash */}
          <div className="p-4 rounded-xl bg-panel-bg border border-main-border/50 flex flex-col gap-3 justify-between">
            <div>
              <h5 className="text-[12px] font-bold text-main-text mb-1">Clear Trash & Temporary Cache</h5>
              <p className="text-xs text-muted-text">Safely purge files scheduled for deletion and regenerate transient system data.</p>
            </div>
            <button
              type="button"
              onClick={handleClearTrashAndCache}
              disabled={isCleaning}
              className="w-full py-2 rounded-lg border border-dashed border-rose-500/30 text-rose-500 text-[11px] font-semibold hover:bg-rose-500/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCleaning ? <Spinner size={13} className="inline mr-1.5 animate-spin" weight="light" /> : <Trash size={13} className="inline mr-1.5" weight="light" />}
              {isCleaning ? "Clearing..." : "Purge Trash & Cache"}
            </button>
          </div>

          {/* Nuke Database */}
          <div className="p-4 rounded-xl bg-panel-bg border border-main-border/50 flex flex-col gap-3 justify-between">
            <div>
              <h5 className="text-[12px] font-bold text-rose-500 mb-1">Permanent Factory Reset</h5>
              <p className="text-xs text-muted-text">Destructive. This operation wipes all media, configurations, face signatures, and user records.</p>
            </div>
            <div className="w-full">
              <NukeButton disabled={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
