"use client";

import {
  SquaresFour,
  Clock,
  Star,
  Copy,
  Lock,
  Trash,
  CaretLeft,
  PencilSimple,
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { useSidebar } from "@/components/sidebar-context";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { SidebarFolders, SidebarSectionLabel } from "@/components/sidebar/SidebarFolders";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_TRANSITION_MS, SIDEBAR_LABEL_MS } from "@/components/sidebar/constants";

const mainItems = [
  { name: "Library", icon: SquaresFour, path: "/dashboard" },
  { name: "Recent", icon: Clock, path: "/dashboard?v=recent" },
  { name: "Favorite", icon: Star, path: "/dashboard?v=favorite" },
  { name: "Vault", icon: Lock, path: "/dashboard/vault" },
  { name: "Trash", icon: Trash, path: "/dashboard/trash" },
];

const toolItems = [
  { name: "Editor", icon: PencilSimple, path: "/editor" },
  { name: "Duplicates", icon: Copy, path: "/dashboard/duplicates" },
];

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const ease = `width ${SIDEBAR_TRANSITION_MS}ms ${EASE} ${SIDEBAR_LABEL_MS}ms`;

export function Sidebar({ folders = [], onMoveMedia }: { folders?: FolderType[]; onMoveMedia?: (ids: string[], folderId: string | null) => void }) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const isExpanded = !isCollapsed;

  return (
    <div
      className="hidden md:block z-sidebar fixed top-0 bottom-0 left-0"
      style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH, transition: ease }}
    >
      <aside className="absolute inset-y-3 left-2.5 right-2.5 flex flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.7rem] bg-surface-bg ring-1 ring-black/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_50px_rgba(10,10,11,0.05)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.35)]">
          <nav
            aria-label="Primary"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden custom-scroll px-2 py-3"
          >
            <div className="flex flex-col gap-0.5">
              {mainItems.map((item) => (
                <SidebarNavItem key={item.path} item={item} isExpanded={isExpanded} />
              ))}
            </div>

            <SidebarFolders folders={folders} isExpanded={isExpanded} onMoveMedia={onMoveMedia} />

            <div className="mt-auto flex flex-col gap-0.5 pt-2">
              <SidebarSectionLabel label="Tools" isExpanded={isExpanded} />
              {toolItems.map((item) => (
                <SidebarNavItem key={item.path} item={item} isExpanded={isExpanded} />
              ))}
            </div>
          </nav>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Pin sidebar open" : "Collapse to icon rail"}
          title={isCollapsed ? "Pin open" : "Collapse"}
          className={cn(
            "absolute top-1/2 right-0 z-10 flex h-12 w-4 -translate-y-1/2 translate-x-[calc(100%-1px)] items-center justify-center",
            "cursor-pointer rounded-r-full bg-surface-bg text-muted-text",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),2px_0_6px_rgba(10,10,11,0.05)]",
            "hover:text-main-text",
            "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),2px_0_8px_rgba(0,0,0,0.35)]",
            "[clip-path:inset(-8px_-8px_-8px_1px)]",
          )}
          style={{ transition: `color 400ms ${EASE}` }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-r-full ring-1 ring-black/6 dark:ring-white/10 [clip-path:inset(-2px_-2px_-2px_1px)]"
          />
          <span
            className="relative inline-flex"
            style={{
              transform: isCollapsed ? "rotate(180deg)" : undefined,
              transition: `transform 500ms ${EASE}`,
            }}
          >
            <CaretLeft size={11} weight="light" className="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]" />
          </span>
        </button>
      </aside>
    </div>
  );
}
