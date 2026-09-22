import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, Trash, Pencil, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { FOLDER_COLORS } from "@/core/constants";
import type { Folder as FolderType } from "@/features/media/types";
import { moveMediaToFolderAction, deleteFolderAction, renameFolderAction } from "@/features/media/services/mediaFolderActions";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { toast } from "sonner";
import { m } from "motion/react";

interface FolderListSectionProps {
  folders: FolderType[];
  dragOverFolderId: string | null;
  onDragOver: (id: string | null) => void;
  onMoveMedia: ((ids: string[], folderId: string | null) => void) | undefined;
}

export function FolderListSection({ folders, dragOverFolderId, onDragOver, onMoveMedia }: FolderListSectionProps) {
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

  return (
    <>
      <div className="space-y-0.5">
            {folders.length === 0 ? (
              <p className="text-[11px] text-muted-text/50 px-3.5 py-2">No folders yet</p>
            ) : (
              folders.map(folder => {
                const color = FOLDER_COLORS[folder.color || 'zinc'];
                const isSelected = activeFolderId === folder.id;
                const isSmart = !!folder.smartFilter;
                const isOver = dragOverFolderId === folder.id && !isSmart;
                const isActive = isSelected || isOver;
                const isEditing = editingFolderId === folder.id;

                if (isEditing) {
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center h-9 mx-2 gap-2.5 pl-2 pr-2.5 rounded-xl"
                      style={{ backgroundColor: `${color}08`, color }}
                    >
                      <span className="flex items-center justify-center w-5 h-5 shrink-0" style={{ color }}>
                        {isSmart ? <Sparkle size={16} weight="fill" /> : <Folder size={16} weight="fill" />}
                      </span>
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
                        className="flex-1 min-w-0 bg-transparent border border-main-border/40 rounded-md px-1.5 py-0.5 text-[12px] text-main-text outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  );
                }

                return (
                  <div key={folder.id} className="group/folder relative flex items-center">
                    <Link
                      href={`/dashboard?f=${folder.id}`}
                      onDragOver={(e) => { if (isSmart) return; e.preventDefault(); onDragOver(folder.id); }}
                      onDragLeave={() => onDragOver(null)}
                      onDrop={(e) => { if (isSmart) return; handleDrop(e, folder.id); }}
                      aria-label={isSmart ? `${folder.name} (smart folder)` : folder.name}
                      title={isSmart ? `${folder.name} (smart folder)` : folder.name}
                      aria-current={isSelected ? "page" : undefined}
                      className={cn(
                        "relative flex items-center w-full h-9 gap-2.5 pl-2 pr-2.5 rounded-xl cursor-pointer min-w-0",
                        "transition-[background-color,color] duration-150",
                        isActive
                          ? "bg-surface-bg text-main-text shadow-sm"
                          : "text-muted-text hover:bg-surface-bg/70 hover:text-main-text"
                      )}
                    >
                      {isSelected && (
                        <m.span
                          layoutId="sidebar-active-indicator"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          className="absolute left-0 top-1/2 -mt-2.5 w-[3px] h-5 rounded-full bg-primary"
                        />
                      )}
                      <span
                        className="flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-200 group-hover/folder:scale-110"
                        style={{ color }}
                      >
                        {isSmart
                          ? <Sparkle size={16} weight={isActive ? "fill" : "light"} />
                          : <Folder size={16} weight={isActive ? "fill" : "light"} />}
                      </span>
                      <span className="overflow-hidden whitespace-nowrap font-medium truncate flex-1 text-[12px]">
                        {folder.name}
                      </span>
                    </Link>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-px opacity-0 group-hover/folder:opacity-100 focus-within:opacity-100 transition-opacity duration-100">
                      <button
                        type="button"
                        aria-label={`Rename ${folder.name}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(folder); }}
                        className="p-0.5 rounded-md text-muted-text hover:text-main-text hover:bg-surface-bg cursor-pointer"
                      >
                        <Pencil size={11} weight="light" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${folder.name}`}
                        onClick={(e) => handleDelete(folder.id, e)}
                        className="p-0.5 rounded-md text-muted-text hover:text-rose-500 hover:bg-surface-bg cursor-pointer"
                      >
                        <Trash size={11} weight="light" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
      </div>
      {ConfirmDialog}
    </>
  );
}
