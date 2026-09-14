"use client";

import dynamic from "next/dynamic";
import { MediaItem, Folder as FolderType } from "../types";

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
