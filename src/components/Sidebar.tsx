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
  CaretLeft,
  CaretRight
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderModal } from "@/features/media/components/FolderModal";
import { motion, AnimatePresence } from "motion/react";
import { useSidebar } from "@/components/sidebar-context";
import { SidebarLogo } from "@/components/sidebar/SidebarLogo";
import { SidebarMenuSections } from "@/components/sidebar/SidebarMenuSections";

const SIDEBAR_WIDTH = 240;

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

  const { isMobileOpen, setMobileOpen, isCollapsed, setIsCollapsed } = useSidebar();

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isMobileOpen, setMobileOpen]);

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-sidebar md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col z-sidebar relative",
          "fixed top-0 bottom-0 left-0",
          "bg-app-bg border-r border-main-border/30",
          "transition-[width] duration-200 ease-out-expo"
        )}
        style={{ width: isCollapsed ? 56 : SIDEBAR_WIDTH }}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute inset-y-0 my-auto right-0 translate-x-1/2 z-40 flex items-center justify-center w-4 h-8 rounded-full bg-panel-bg text-muted-text hover:text-main-text hover:bg-surface-bg transition-all duration-200 cursor-pointer border border-main-border/50"
        >
          {isCollapsed ? <CaretRight size={10} weight="bold" /> : <CaretLeft size={10} weight="bold" />}
        </button>

        <div className="relative flex flex-col h-full">
          <SidebarLogo isExpanded={!isCollapsed} />

          <div className={cn("flex-1 overflow-y-auto custom-scroll py-1", isCollapsed ? "px-1" : "px-2")}>
            <SidebarMenuSections {...sharedProps} isExpanded={!isCollapsed} />
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 w-64 flex flex-col bg-app-bg z-mobile-sidebar md:hidden shadow-xl"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              className="absolute top-5 right-5 z-10 p-1.5 bg-surface-bg rounded text-muted-text hover:text-main-text transition-colors cursor-pointer"
            >
              <X size={14} weight="light" />
            </button>

            <SidebarLogo isExpanded={true} />

            <div className="flex-1 overflow-y-auto px-3 space-y-5 custom-scroll">
              <SidebarMenuSections {...sharedProps} isExpanded={true} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
    </>
  );
}
