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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-text">
          <ImageSquare size={32} weight="light" className="opacity-20" />
          <div className="text-center">
            <p className="text-[12px] font-medium">No photo selected</p>
            <p className="text-[11px] mt-0.5">
              Select a photo from the library to start editing
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="mt-1 px-3.5 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-medium cursor-pointer hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]"
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
