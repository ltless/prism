"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { MediaItem, Folder as FolderType } from "../types";
import { useAIStore } from "@/features/ai/store";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { getEffectiveAIConfig } from "@/features/settings/services/aiConfig";
import { logger } from "@/core/utils/logger";

const MediaLibrary = dynamic(() => import("./MediaLibrary"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-surface-bg animate-pulse" />
      ))}
    </div>
  ),
});

interface MediaLibraryClientProps {
  initialItems: MediaItem[];
  folders: FolderType[];
}

export default function MediaLibraryClient({ initialItems, folders }: MediaLibraryClientProps) {
  const { session } = useEffectiveSession();
  const isServerSyncingRef = useRef(false);

  // Sync user + load merged AI config (global + user prefs) from server on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const store = useAIStore.getState();
    store.syncUser(session.user.id);

    (async () => {
      try {
        isServerSyncingRef.current = true;
        const res = await getEffectiveAIConfig();
        if (res.success) {
          useAIStore.getState().syncFromServer(res.config);
        }

        // Auto-reload AI model after config sync
        const { variant, loadedModels } = useAIStore.getState();
        if (!loadedModels.includes(variant)) {
          return;
        }

        const { fetchAIStatus, loadModelOnServer } = await import("@/features/ai/services/aiStatusClient");
        const { activeVariant: serverActive } = await fetchAIStatus();

        const { activeVariant, status, setActiveVariant, setStatus } = useAIStore.getState();
        if (serverActive === variant) {
          if (activeVariant !== variant || status !== "ready") {
            setActiveVariant(variant);
            setStatus("ready");
          }
        } else {
          const { success } = await loadModelOnServer(variant);
          if (success) {
            setActiveVariant(variant);
            setStatus("ready");
          } else {
            logger.warn("AI failed to load model");
          }
        }
      } catch (err) {
        logger.warn("MediaLibraryClient failed to sync AI config or reload model", { error: String(err) });
      } finally {
        isServerSyncingRef.current = false;
      }
    })();
  }, [session?.user?.id]);

  return <MediaLibrary initialItems={initialItems} folders={folders} />;
}
