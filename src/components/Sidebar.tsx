"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  SquaresFour,
  Clock,
  Star,
  Copy,
  Lock,
  Trash,
  X,
  CaretLeft
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderModal } from "@/features/media/components/FolderModal";
import { m, AnimatePresence } from "motion/react";
import { useSidebar } from "@/components/sidebar-context";
import { SidebarMenuSections } from "@/components/sidebar/SidebarMenuSections";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/components/sidebar/constants";

const menuSections = [
  {
    title: 'Space',
    items: [
      { name: 'Library', icon: SquaresFour, path: '/dashboard' },
      { name: 'Recent', icon: Clock, path: '/dashboard?v=recent' },
      { name: 'Favorite', icon: Star, path: '/dashboard?v=favorite' },
      { name: 'Vault', icon: Lock, path: '/dashboard/vault' },
      { name: 'Trash', icon: Trash, path: '/dashboard/trash' }
    ]
  },
  {
    title: 'Folders',
    isFolderSection: true,
    items: []
  },
  {
    title: 'Tools',
    items: [
      { name: 'Duplicates', icon: Copy, path: '/dashboard/duplicates' }
    ]
  }
];

export function Sidebar({ folders = [], onMoveMedia }: { folders?: FolderType[], onMoveMedia?: (ids: string[], folderId: string | null) => void }) {
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('f');
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);

  const { isMobileOpen, setMobileOpen, isCollapsed, toggleCollapsed } = useSidebar();

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isMobileOpen, setMobileOpen]);

  const isExpanded = !isCollapsed;

  const sharedProps = {
    sections: menuSections,
    activeFolderId,
    folders,
    foldersExpanded,
    setFoldersExpanded,
    dragOverFolderId,
    setDragOverFolderId,
    onMoveMedia,
    onCreateFolder: () => setShowFolderModal(true),
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-sidebar md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col z-sidebar fixed top-0 bottom-0 left-0",
          "bg-app-bg border-r border-main-border/30",
          "transition-[width] duration-300 ease-out-expo"
        )}
        style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <div className="flex-1 overflow-y-auto custom-scroll overflow-x-hidden pt-4">
          <SidebarMenuSections {...sharedProps} isExpanded={isExpanded} />
        </div>

        {/* Edge toggle — right side, vertically centered */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Pin sidebar open" : "Collapse to rail"}
          title={isCollapsed ? "Pin open" : "Collapse"}
          className={cn(
            "absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10",
            "w-6 h-6 flex items-center justify-center rounded-full cursor-pointer",
            "border border-main-border/60 bg-panel-bg text-muted-text shadow-sm",
            "transition-colors duration-150 hover:text-main-text hover:border-main-border"
          )}
        >
          <span
            className="inline-flex transition-transform duration-300 ease-out-expo"
            style={{ transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <CaretLeft size={12} weight="bold" />
          </span>
        </button>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <m.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 w-64 flex flex-col bg-app-bg z-mobile-sidebar md:hidden"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center rounded-md text-muted-text hover:text-main-text hover:bg-surface-bg transition-colors cursor-pointer"
            >
              <X size={14} weight="light" />
            </button>

            <div className="flex-1 overflow-y-auto px-2 pt-4 custom-scroll">
              <SidebarMenuSections {...sharedProps} isExpanded={true} />
            </div>
          </m.aside>
        )}
      </AnimatePresence>

      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
    </>
  );
}
