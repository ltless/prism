"use client";

import { useState } from "react";
import { ImageEditor } from "@/features/media/components/lightbox/ImageEditor";
import { LibraryPicker } from "@/features/media/components/lightbox/LibraryPicker";
import type { MediaItem } from "@/features/media/types";
import { ImageSquare } from "@phosphor-icons/react";

export default function EditorPage() {
  const [item, setItem] = useState<MediaItem | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  if (!item) {
    return (
      <div className="flex flex-col w-full h-screen bg-app-bg">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-text">
          <ImageSquare size={48} weight="light" className="opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium">No photo selected</p>
            <p className="text-xs mt-1">
              Select a photo from the library to start editing
            </p>
          </div>
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
          >
            Open Library
          </button>
        </div>

        {isLibraryOpen && (
          <LibraryPicker
            onSelect={(selected) => {
              setItem(selected);
              setIsLibraryOpen(false);
            }}
            onClose={() => setIsLibraryOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <ImageEditor
        item={item}
        onClose={() => setItem(null)}
        onSuccess={() => {}}
      />
    </div>
  );
}
