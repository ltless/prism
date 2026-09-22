"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Folder, Plus } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderModal } from "@/features/media/components/FolderModal";
import { FolderListSection } from "./FolderListSection";
import { useSidebar } from "@/components/sidebar-context";

interface SidebarFoldersProps {
  folders: FolderType[];
  isExpanded: boolean;
  onMoveMedia?: (ids: string[], folderId: string | null) => void;
}

export function SidebarFolders({ folders, isExpanded, onMoveMedia }: SidebarFoldersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('f');
  const [open, setOpen] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isCollapsed } = useSidebar();

  // Close the popover during width transitions so it never squishes.
  const [prevCollapsed, setPrevCollapsed] = useState(isCollapsed);
  if (prevCollapsed !== isCollapsed) {
    setPrevCollapsed(isCollapsed);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const isFolderRoute = pathname === "/dashboard" && !!activeFolderId;
  const highlighted = open || isFolderRoute;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={!isExpanded ? "Folders" : undefined}
        aria-expanded={open}
        className={cn(
          "group/folders relative flex items-center h-9 mx-2 gap-2.5 rounded-xl cursor-pointer",
          "transition-[padding,background-color,color] duration-300 ease-out-expo",
          isExpanded ? "pl-2 pr-2.5" : "pl-3.5 pr-0",
          highlighted
            ? "bg-surface-bg text-main-text shadow-sm"
            : "text-muted-text hover:bg-surface-bg/70 hover:text-main-text"
        )}
      >
        {isFolderRoute && (
          <span className="absolute left-0 top-1/2 -mt-2.5 w-[3px] h-5 rounded-full bg-primary" />
        )}
        <span
          className={cn(
            "flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-200",
            "group-hover/folders:scale-110",
            highlighted ? "text-main-text" : "text-muted-text group-hover/folders:text-main-text"
          )}
        >
          <Folder size={isExpanded ? 16 : 18} weight={isFolderRoute ? "fill" : "regular"} />
        </span>
        <span
          className="whitespace-nowrap overflow-hidden text-[12px] font-medium transition-[max-width,opacity] duration-300 ease-out-expo"
          style={{ maxWidth: isExpanded ? "12rem" : "0rem", opacity: isExpanded ? 1 : 0 }}
        >
          Folders
        </span>
        <span
          className="ml-auto whitespace-nowrap overflow-hidden text-[10px] font-medium text-muted-text tabular-nums transition-[max-width,opacity] duration-300 ease-out-expo"
          style={{ maxWidth: isExpanded && folders.length > 0 ? "2rem" : "0rem", opacity: isExpanded && folders.length > 0 ? 1 : 0 }}
        >
          {folders.length}
        </span>
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 rounded-xl border border-main-border/40 bg-panel-bg shadow-xl p-1.5">
          <FolderListSection
            folders={folders}
            dragOverFolderId={dragOverFolderId}
            onDragOver={setDragOverFolderId}
            onMoveMedia={onMoveMedia}
          />
          <button
            type="button"
            onClick={() => setShowFolderModal(true)}
            className="flex items-center w-[calc(100%-1rem)] mx-2 h-9 gap-2.5 pl-2 pr-2.5 rounded-xl cursor-pointer text-muted-text hover:bg-surface-bg/70 hover:text-main-text transition-colors"
          >
            <span className="flex items-center justify-center w-5 h-5 shrink-0">
              <Plus size={16} weight="regular" />
            </span>
            <span className="text-[12px] font-medium">New folder</span>
          </button>
        </div>
      )}

      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
    </div>
  );
}
