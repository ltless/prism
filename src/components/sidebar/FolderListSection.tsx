"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, Trash, Pencil } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { FOLDER_COLORS } from "@/core/constants";
import type { Folder as FolderType } from "@/features/media/types";
import { moveMediaToFolderAction, deleteFolderAction, renameFolderAction } from "@/features/media/services/mediaFolderActions";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { toast } from "sonner";
import { m, AnimatePresence } from "motion/react";

const containerVariants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: "auto",
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      height: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 0.2 }
    }
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
      opacity: { duration: 0.1 },
      staggerChildren: 0.02,
      staggerDirection: -1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 3 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }
  },
  exit: {
    opacity: 0,
    y: -3,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const }
  }
};

interface FolderListSectionProps {
  folders: FolderType[];
  foldersExpanded: boolean;
  dragOverFolderId: string | null;
  onDragOver: (id: string | null) => void;
  onMoveMedia: ((ids: string[], folderId: string | null) => void) | undefined;
  isExpanded: boolean;
}

export function FolderListSection({ folders, foldersExpanded, dragOverFolderId, onDragOver, onMoveMedia, isExpanded }: FolderListSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('f');
  const { confirm, ConfirmDialog } = useConfirm();
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const committingRef = useRef(false);

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    onDragOver(null);
    const data = e.dataTransfer.getData("application/prism-media-ids");
    if (data) {
      const ids = JSON.parse(data);
      if (onMoveMedia) {
        onMoveMedia(ids, folderId);
      } else {
        const result = await moveMediaToFolderAction(ids, folderId);
        if (!result.success) {
          toast.error(result.error || "Failed to move items");
        } else {
          toast.success(`${ids.length} items moved`);
          router.refresh();
        }
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete folder",
      message: "Delete this folder? Items inside move back to Library.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const result = await deleteFolderAction(id);
    if (!result.success) {
      toast.error(result.error || "Failed to delete folder");
      return;
    }
    if (activeFolderId === id) router.push("/dashboard");
    toast.success("Folder deleted");
    router.refresh();
  };

  const startRename = (folder: FolderType) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  };

  const cancelRename = () => {
    setEditingFolderId(null);
    setEditingName("");
  };

  const commitRename = async () => {
    if (committingRef.current) return;
    const id = editingFolderId;
    const name = editingName.trim();
    if (!id) return;
    if (!name) { cancelRename(); return; }
    if (name.length > 100) {
      toast.error("Folder name must be 1-100 characters");
      return;
    }
    const original = folders.find((f) => f.id === id);
    if (original?.name === name) { cancelRename(); return; }
    committingRef.current = true;
    const result = await renameFolderAction(id, name);
    committingRef.current = false;
    if (!result.success) {
      toast.error(result.error || "Failed to rename folder");
      return;
    }
    toast.success("Folder renamed");
    setEditingFolderId(null);
    setEditingName("");
    router.refresh();
  };

  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-1">
        {folders.map(folder => {
          const color = FOLDER_COLORS[folder.color || 'zinc'];
          const isSelected = activeFolderId === folder.id;
          const isOver = dragOverFolderId === folder.id;
          return (
            <Link
              key={folder.id}
              href={`/dashboard?f=${folder.id}`}
              onDragOver={(e) => { e.preventDefault(); onDragOver(folder.id); }}
              onDragLeave={() => onDragOver(null)}
              onDrop={(e) => handleDrop(e, folder.id)}
              title={folder.name}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-transform duration-200",
                (isSelected || isOver) && "scale-150"
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {foldersExpanded && (
          <m.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="pb-1 overflow-hidden space-y-px"
          >
            {folders.length === 0 ? (
              <m.p variants={itemVariants} className="text-[10px] text-muted-text/50 px-2 italic py-2 text-center">No folders yet</m.p>
            ) : (
              folders.map(folder => {
                const color = FOLDER_COLORS[folder.color || 'zinc'];
                const isSelected = activeFolderId === folder.id;
                const isOver = dragOverFolderId === folder.id;
                const isEditing = editingFolderId === folder.id;

                if (isEditing) {
                  return (
                    <m.div key={folder.id} variants={itemVariants}>
                      <div
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded"
                        style={{ backgroundColor: `${color}08`, color }}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color }}>
                          <Folder size={12} weight="fill" />
                        </div>
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                            if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                          }}
                          onBlur={commitRename}
                          placeholder="Folder name"
                          aria-label="Folder name"
                          className="flex-1 bg-transparent border border-main-border/40 rounded px-1.5 py-0.5 text-[11px] text-main-text outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </m.div>
                  );
                }

                return (
                  <m.div key={folder.id} variants={itemVariants} className="group relative flex items-center">
                    <Link
                      href={`/dashboard?f=${folder.id}`}
                      onDragOver={(e) => { e.preventDefault(); onDragOver(folder.id); }}
                      onDragLeave={() => onDragOver(null)}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors duration-150 cursor-pointer min-w-0",
                        (isSelected || isOver)
                          ? ""
                          : "text-muted-text hover:bg-surface-bg"
                      )}
                      style={(isSelected || isOver) ? {
                        backgroundColor: `${color}08`,
                        color: color
                      } : {}}
                    >
                      <div
                        className="w-5 h-5 flex items-center justify-center transition-colors duration-150 shrink-0"
                        style={{ color }}
                      >
                        <Folder size={12} weight={(isSelected || isOver) ? "fill" : "light"} />
                      </div>
                      <span className="text-[11px] font-medium truncate flex-1">
                        {folder.name}
                      </span>
                    </Link>
                    <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center gap-px opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-100">
                      <button
                        type="button"
                        aria-label={`Rename ${folder.name}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(folder); }}
                        className="p-0.5 rounded text-muted-text hover:text-main-text hover:bg-surface-bg cursor-pointer"
                      >
                        <Pencil size={10} weight="light" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${folder.name}`}
                        onClick={(e) => handleDelete(folder.id, e)}
                        className="p-0.5 rounded text-muted-text hover:text-rose-500 hover:bg-surface-bg cursor-pointer"
                      >
                        <Trash size={10} weight="light" />
                      </button>
                    </div>
                  </m.div>
                );
              })
            )}
          </m.div>
        )}
      </AnimatePresence>
      {ConfirmDialog}
    </>
  );
}
