"use client";

import { useState } from "react";
import { CaretDown, Plus } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { SidebarNavItem } from "./SidebarNavItem";
import { FolderListSection } from "./FolderListSection";

type MenuItem = {
  name: string;
  icon: React.ComponentType<Record<string, unknown>>;
  path: string;
};

type MenuSection = {
  title: string;
  isFolderSection?: boolean;
  items: MenuItem[];
};

interface SidebarMenuSectionsProps {
  sections: MenuSection[];
  isExpanded: boolean;
  activeFolderId: string | null;
  folders: FolderType[];
  foldersExpanded: boolean;
  setFoldersExpanded: (v: boolean) => void;
  dragOverFolderId: string | null;
  setDragOverFolderId: (v: string | null) => void;
  onMoveMedia?: (ids: string[], folderId: string | null) => void;
  onCreateFolder?: () => void;
}

export function SidebarMenuSections({
  sections,
  isExpanded,
  activeFolderId,
  folders,
  foldersExpanded,
  setFoldersExpanded,
  dragOverFolderId,
  setDragOverFolderId,
  onMoveMedia,
  onCreateFolder,
}: SidebarMenuSectionsProps) {
  return (
    <>
      {sections.map((section, idx) => (
        <div key={idx} className={cn("mb-4", !isExpanded && "mb-2")}>
          {isExpanded && (
            <div className="flex items-center justify-between mb-2 px-3">
              {section.isFolderSection ? (
                <>
                  <button
                    onClick={() => setFoldersExpanded(!foldersExpanded)}
                    aria-label={foldersExpanded ? "Collapse folders" : "Expand folders"}
                    className="flex items-center gap-2 group/title cursor-pointer"
                  >
                    <h3 className="text-xs font-bold text-muted-text group-hover/title:text-main-text transition-colors">{section.title}</h3>
                    <div className={cn(
                      "p-1 hover:bg-surface-bg rounded-md text-muted-text group-hover/title:text-main-text transition-transform duration-300 ease-out-expo",
                      foldersExpanded ? "rotate-0" : "-rotate-90"
                    )}>
                      <CaretDown size={12} weight="bold" />
                    </div>
                  </button>
                  <button
                    onClick={onCreateFolder}
                    aria-label="Create Folder"
                    className="p-1 hover:bg-surface-bg rounded-md transition-colors group/add cursor-pointer"
                  >
                    <Plus size={12} weight="bold" className="text-muted-text/60 group-hover/add:text-primary" />
                  </button>
                </>
              ) : (
                <h3 className="text-xs font-bold text-muted-text">{section.title}</h3>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            {section.isFolderSection ? (
              <FolderListSection
                folders={folders}
                foldersExpanded={foldersExpanded}
                dragOverFolderId={dragOverFolderId}
                onDragOver={setDragOverFolderId}
                onMoveMedia={onMoveMedia}
                isExpanded={isExpanded}
              />
            ) : (
              section.items.map((item) => (
                <SidebarNavItem
                  key={item.path}
                  item={item}
                  activeFolderId={activeFolderId}
                  isExpanded={isExpanded}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </>
  );
}
