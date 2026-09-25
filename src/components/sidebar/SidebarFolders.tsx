"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderModal } from "@/features/media/components/FolderModal";
import { FolderListSection } from "./FolderListSection";

interface SidebarFoldersProps {
  folders: FolderType[];
  isExpanded: boolean;
  onMoveMedia?: (ids: string[], folderId: string | null) => void;
}

/** Same height open or collapsed, so the gap between groups stays even. */
export function SidebarSectionLabel({
  label,
  isExpanded,
  children,
}: {
  label: string;
  isExpanded: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative mt-4 flex h-6 items-center overflow-hidden">
      <span
        aria-hidden
        className={cn(
          "absolute left-4 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-main-text/15",
          isExpanded ? "opacity-0" : "opacity-100",
        )}
        style={{ transition: `opacity 180ms cubic-bezier(0.32,0.72,0,1) ${isExpanded ? "0ms" : "500ms"}` }}
      />
      <span
        className={cn(
          "pl-10 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-text/80 whitespace-nowrap",
          isExpanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-1 opacity-0",
        )}
        style={{
          transition: `opacity 140ms cubic-bezier(0.32,0.72,0,1) ${isExpanded ? "500ms" : "0ms"}, transform 140ms cubic-bezier(0.32,0.72,0,1) ${isExpanded ? "500ms" : "0ms"}`,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function SidebarFolders({ folders, isExpanded, onMoveMedia }: SidebarFoldersProps) {
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  return (
    <div>
      <SidebarSectionLabel label="Folders" isExpanded={isExpanded}>
        <button
          type="button"
          onClick={() => setShowFolderModal(true)}
          aria-label="New folder"
          title="New folder"
          className={cn(
            "absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full",
            "cursor-pointer text-muted-text hover:bg-main-text/6 hover:text-main-text active:scale-[0.96]",
            isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <Plus size={12} weight="light" />
        </button>
      </SidebarSectionLabel>

      {folders.length === 0 && isExpanded ? (
        <p className="overflow-hidden whitespace-nowrap py-1 pl-10 text-[12px] text-muted-text">None yet</p>
      ) : (
        <FolderListSection
          folders={folders}
          dragOverFolderId={dragOverFolderId}
          onDragOver={setDragOverFolderId}
          onMoveMedia={onMoveMedia}
          compact={!isExpanded}
        />
      )}

      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
    </div>
  );
}
