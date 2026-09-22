"use client";

import { useEffect } from "react";
import {
  SquaresFour,
  Clock,
  Star,
  Copy,
  Lock,
  Trash,
  X,
  CaretLeft,
  PencilSimple
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { m, AnimatePresence } from "motion/react";
import { useSidebar } from "@/components/sidebar-context";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { SidebarFolders } from "@/components/sidebar/SidebarFolders";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/components/sidebar/constants";

const mainItems = [
  { name: 'Library', icon: SquaresFour, path: '/dashboard' },
  { name: 'Recent', icon: Clock, path: '/dashboard?v=recent' },
  { name: 'Favorite', icon: Star, path: '/dashboard?v=favorite' },
  { name: 'Vault', icon: Lock, path: '/dashboard/vault' },
  { name: 'Trash', icon: Trash, path: '/dashboard/trash' }
];

const toolItems = [
  { name: 'Editor', icon: PencilSimple, path: '/editor' },
  { name: 'Duplicates', icon: Copy, path: '/dashboard/duplicates' }
];

export function Sidebar({ folders = [], onMoveMedia }: { folders?: FolderType[], onMoveMedia?: (ids: string[], folderId: string | null) => void }) {
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

      {/* Desktop rail — collapsed = icons only, toggle expands to full labels */}
      <aside
        className={cn(
          "hidden md:flex flex-col z-sidebar fixed top-0 bottom-0 left-0 border-r",
          "transition-[width] duration-300 ease-out-expo",
          "bg-panel-bg/80 border-main-border/40 shadow-[4px_0_20px_rgba(0,0,0,0.02)]"
        )}
        style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <nav className="flex-1 flex flex-col pt-3 overflow-y-auto custom-scroll overflow-x-hidden">
          {mainItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} isExpanded={isExpanded} />
          ))}

          <SidebarFolders folders={folders} isExpanded={isExpanded} onMoveMedia={onMoveMedia} />

          <div className={cn("h-px bg-main-border/50 my-2", isExpanded ? "mx-4" : "w-6 mx-auto")} />

          {toolItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} isExpanded={isExpanded} />
          ))}
        </nav>

        {/* Edge toggle — collapse to icon rail / pin open */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Pin sidebar open" : "Collapse to icon rail"}
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

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <m.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 w-72 flex flex-col bg-panel-bg z-mobile-sidebar md:hidden border-r border-main-border/40 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center rounded-md text-muted-text hover:text-main-text hover:bg-surface-bg transition-colors cursor-pointer"
            >
              <X size={14} weight="light" />
            </button>

            <div className="flex-1 overflow-y-auto px-2 pt-4 pb-3 custom-scroll">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-text/70 mb-2 px-2">Space</h3>
              {mainItems.map((item) => (
                <SidebarNavItem key={item.path} item={item} isExpanded />
              ))}

              <div className="h-px bg-main-border/50 mx-3 my-3" />
              <SidebarFolders folders={folders} isExpanded onMoveMedia={onMoveMedia} />

              <div className="h-px bg-main-border/50 mx-3 my-3" />
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-text/70 mb-2 px-2">Tools</h3>
              {toolItems.map((item) => (
                <SidebarNavItem key={item.path} item={item} isExpanded />
              ))}
            </div>
          </m.aside>
        )}
      </AnimatePresence>
    </>
  );
}
