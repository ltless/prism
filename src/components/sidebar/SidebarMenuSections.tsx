import { Fragment } from "react";
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
      {sections.map((section, index) => (
        <Fragment key={section.title}>
          {!isExpanded && index > 0 && (
            <div className="h-px bg-main-border/50 mx-4 my-2" />
          )}

          <div className={cn("mb-4 transition-[margin] duration-300 ease-out-expo", !isExpanded && "mb-1")}>
            {/* header collapses via grid rows — smooth height, no jump */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-out-expo"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr", opacity: isExpanded ? 1 : 0 }}
              aria-hidden={!isExpanded}
            >
              <div className="overflow-hidden min-h-0">
                <div className="flex items-center justify-between mb-2 px-3">
                  {section.isFolderSection ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFoldersExpanded(!foldersExpanded)}
                        aria-label={foldersExpanded ? "Collapse folders" : "Expand folders"}
                        className="flex items-center gap-2 group/title cursor-pointer"
                      >
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-text/70 group-hover/title:text-main-text transition-colors">{section.title}</h3>
                        <div className={cn(
                          "p-1 hover:bg-surface-bg rounded-md text-muted-text group-hover/title:text-main-text transition-transform duration-300 ease-out-expo",
                          foldersExpanded ? "rotate-0" : "-rotate-90"
                        )}>
                          <CaretDown size={12} weight="bold" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={onCreateFolder}
                        aria-label="Create Folder"
                        className="p-1 hover:bg-surface-bg rounded-md transition-colors group/add cursor-pointer"
                      >
                        <Plus size={12} weight="bold" className="text-muted-text/60 group-hover/add:text-main-text" />
                      </button>
                    </>
                  ) : (
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-text/70">{section.title}</h3>
                  )}
                </div>
              </div>
            </div>

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
        </Fragment>
      ))}
    </>
  );
}
