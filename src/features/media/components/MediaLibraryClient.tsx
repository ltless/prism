"use client";

import dynamic from "next/dynamic";
import { MediaItem, Folder as FolderType } from "../types";
import { MEDIA_GRID_CLASS } from "./library/MediaGrid";

const MediaLibrary = dynamic(() => import("./MediaLibrary"), {
  ssr: false,
  loading: () => (
    <div className="px-4 pb-6 pt-6 md:px-10 md:pt-8">
      <div className="mb-4 h-5 w-16 animate-pulse rounded-full bg-surface-bg" />
      <div className="mb-12 h-16 w-56 animate-pulse rounded-2xl bg-surface-bg" />
      <div className={MEDIA_GRID_CLASS}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-main-text/[0.045] p-1.5 ring-1 ring-main-text/[0.06]" />
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
