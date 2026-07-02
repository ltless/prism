"use client";

import dynamic from "next/dynamic";
import { MediaItem, Folder as FolderType } from "../types";
import { MEDIA_GRID_CLASS } from "./library/MediaGrid";

const MediaLibrary = dynamic(() => import("./MediaLibrary"), {
  ssr: false,
  loading: () => (
    <div className="px-6 pb-6 pt-2">
      <div className={MEDIA_GRID_CLASS}>
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-surface-bg animate-pulse" />
        ))}
      </div>
    </div>
  ),
});

interface MediaLibraryClientProps {
  initialItems: MediaItem[];
  folders: FolderType[];
  total?: number;
  initialFolderId?: string | null;
  initialFavorite?: boolean;
  initialSmartFilter?: { categories: string[]; minScore: number } | null;
}

export default function MediaLibraryClient({
  initialItems,
  folders,
  total = initialItems.length,
  initialFolderId = null,
  initialFavorite = false,
  initialSmartFilter = null,
}: MediaLibraryClientProps) {
  return (
    <MediaLibrary
      initialItems={initialItems}
      total={total}
      initialFolderId={initialFolderId === "" ? null : initialFolderId}
      initialFavorite={initialFavorite}
      initialSmartFilter={initialSmartFilter}
      folders={folders}
    />
  );
}
