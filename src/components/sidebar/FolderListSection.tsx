import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, Trash, Pencil, Sparkle } from "@phosphor-icons/react";
import { m } from "motion/react";
import { cn } from "@/core/utils/cn";
import { FOLDER_COLORS } from "@/core/constants";
import type { Folder as FolderType } from "@/features/media/types";
import { moveMediaToFolderAction, deleteFolderAction, renameFolderAction } from "@/features/media/services/mediaFolderActions";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { toast } from "sonner";

interface FolderListSectionProps {
  folders: FolderType[];
  dragOverFolderId: string | null;
  onDragOver: (id: string | null) => void;
  onMoveMedia: ((ids: string[], folderId: string | null) => void) | undefined;
  /** Desktop rail is collapsed — icon only, actions live in the title menu. */
  compact?: boolean;
}

export function FolderListSection({ folders, dragOverFolderId, onDragOver, onMoveMedia, compact = false }: FolderListSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get("f");
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
          !compact && <p className="text-[11px] text-muted-text/50 px-2.5 py-1.5">No folders yet</p>
        ) : (
          folders.map((folder) => {
            const color = FOLDER_COLORS[folder.color || "zinc"];
            const isSelected = activeFolderId === folder.id;
            const isSmart = !!folder.smartFilter;
            const isOver = dragOverFolderId === folder.id && !isSmart;
            const isActive = isSelected || isOver;
            const isEditing = editingFolderId === folder.id && !compact;

            if (isEditing) {
              return (
                <div key={folder.id} className="relative flex h-11 items-center overflow-hidden">
                  <span
                    className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-main-text/6"
                    style={{ color }}
                  >
                    {isSmart ? <Sparkle size={15} weight="fill" /> : <Folder size={15} weight="fill" />}
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
                    className="ml-10 mr-2 min-w-0 flex-1 rounded-full bg-transparent px-2.5 py-1 text-[13px] text-main-text outline-none ring-1 ring-main-text/12 focus:ring-main-text/35"
                  />
                </div>
              );
            }

            return (
              <div key={folder.id} className="group/folder relative flex h-11 items-center">
                <Link
                  href={`/dashboard?f=${folder.id}`}
                  onDragOver={(e) => { if (isSmart) return; e.preventDefault(); onDragOver(folder.id); }}
                  onDragLeave={() => onDragOver(null)}
                  onDrop={(e) => { if (isSmart) return; handleDrop(e, folder.id); }}
                  aria-label={isSmart ? `${folder.name} (smart folder)` : folder.name}
                  title={compact ? folder.name : isSmart ? `${folder.name} (smart folder)` : undefined}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 w-full min-w-0 items-center overflow-hidden rounded-full",
                    isActive ? "text-main-text" : "text-muted-text hover:text-main-text",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full",
                      isActive && "ring-1 ring-main-text/10",
                      !isActive && "group-hover/folder:bg-main-text/6",
                    )}
                    style={{ color }}
                  >
                    {isActive && (
                      <m.span
                        layoutId={`folder-disc-${folder.id}`}
                        transition={{ type: "spring", stiffness: 480, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-main-text/8"
                      />
                    )}
                    {isSmart
                      ? <Sparkle size={15} weight={isActive ? "fill" : "light"} className="relative" />
                      : <Folder size={15} weight={isActive ? "fill" : "light"} className="relative" />}
                  </span>
                  <span className={cn(
                    "min-w-0 flex-1 overflow-hidden whitespace-nowrap pl-10 pr-12 text-[13px] tracking-[-0.01em]",
                    isActive ? "font-medium text-main-text" : "text-main-text/75",
                    compact ? "pointer-events-none -translate-x-1 opacity-0" : "translate-x-0 opacity-100",
                  )}
                  style={{
                    transition: `opacity 140ms cubic-bezier(0.32,0.72,0,1) ${compact ? "0ms" : "500ms"}, transform 140ms cubic-bezier(0.32,0.72,0,1) ${compact ? "0ms" : "500ms"}`,
                  }}
                  >
                    {folder.name}
                  </span>
                </Link>
                <div className={cn(
                  "absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-px transition-opacity duration-200",
                  compact ? "pointer-events-none opacity-0" : "opacity-0 group-hover/folder:opacity-100 focus-within:opacity-100",
                )}>
                    <button
                      type="button"
                      aria-label={`Rename ${folder.name}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(folder); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-text hover:bg-main-text/6 hover:text-main-text cursor-pointer"
                    >
                      <Pencil size={12} weight="light" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${folder.name}`}
                      onClick={(e) => handleDelete(folder.id, e)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-text hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash size={12} weight="light" />
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
