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
}

export default function MediaLibraryClient({ initialItems, folders }: MediaLibraryClientProps) {
  return <MediaLibrary initialItems={initialItems} folders={folders} />;
}
