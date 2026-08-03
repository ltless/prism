"use client";

import { useState } from "react";
import { MediaCard } from "./MediaCard";
import { Lightbox } from "./Lightbox";
import { ArrowClockwise, TrashSimple, Warning, ShieldWarning, Download, Hash, Broom } from "@phosphor-icons/react";
import { emptyTrashAction, restoreFromTrashAction } from "../services/mediaTrashActions";
import { deleteMediaAction } from "../services/mediaCrud";
import { useRouter } from "next/navigation";
import { cn } from "@/core/utils/cn";
import { downloadUrl } from "@/core/utils/download";
import { MEDIA_GRID_CLASS } from "./library/MediaGrid";
import { ContextMenu } from "./ContextMenu";
import { MediaItem } from "../types";
import { toast } from "sonner";
import { useConfirm } from "../../../shared/hooks/useConfirm";

export default function TrashLibrary({ initialItems }: { initialItems: MediaItem[] }) {
 const { confirm, ConfirmDialog } = useConfirm();
 const router = useRouter();
 const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
 const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
  setIsProcessing(id);
  const result = await restoreFromTrashAction(id);
  if (!result.success) {
  toast.error(result.error || "Restore failed");
  } else {
  toast.success("Item restored from trash");
  router.refresh();
  }
  setIsProcessing(null);
  };

  const handlePermanentDelete = async (id: string) => {
  const ok = await confirm("Are you sure you want to permanently delete this file? This action cannot be undone.");
  if (!ok) return;
 
  setIsProcessing(id);
  const result = await deleteMediaAction(id);
  if (!result.success) {
  toast.error(result.error || "Delete failed");
  } else {
  toast.success("File permanently deleted");
  router.refresh();
  }
  setIsProcessing(null);
  };

 const [isEmptying, setIsEmptying] = useState(false);
 const handleEmptyTrash = async () => {
 const ok = await confirm(`Permanently delete all ${initialItems.length} items in trash? This cannot be undone.`);
 if (!ok) return;
 setIsEmptying(true);
 const res = await emptyTrashAction();
 if (res.success) {
 toast.success("Trash emptied. You are now free.");
 router.refresh();
 } else {
 toast.error("Empty trash failed: " + res.error);
 }
 setIsEmptying(false);
 };

 return (
 <div className="flex flex-col h-full w-full">
 <div className="px-4 md:px-8 mt-4 md:mt-6 mb-4 md:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <h1 className="text-xl text-main-text">Trash</h1>
 <div className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
 <span className="text-xs text-rose-500 ">{initialItems.length} Items</span>
 </div>
 </div>
 <p className="text-xs font-bold text-muted-text flex items-center gap-2">
 <Warning size={12} weight="light" className="text-amber-500" />
 Items in trash will be automatically deleted after 30 days
 </p>
 </div>

 {initialItems.length > 0 && (
 <button
 type="button"
 onClick={handleEmptyTrash}
 disabled={isEmptying}
 className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-colors ease-out-expo cursor-pointer text-xs disabled:opacity-50"
 >
 <Broom size={14} weight="light" className={cn(isEmptying && "animate-spin")} />
 {isEmptying ? "Emptying..." : "Empty Trash"}
 </button>
 )}
 </div>

 <div className="flex-1 min-h-0 px-4 md:px-8 pb-0">
 {initialItems.length === 0 ? (
 <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-bg/30 rounded-[40px] border border-dashed border-main-border">
 <div className="w-16 h-16 bg-surface-bg rounded-2xl flex items-center justify-center text-muted-text/30">
 <TrashSimple size={32} weight="light" />
 </div>
 <div className="text-center">
 <p className="text-xs text-muted-text ">Trash is empty</p>
 <p className="text-[11px] font-bold text-muted-text/50 mt-2">Deleted items will appear here</p>
 </div>
 </div>
 ) : (
  <div className={MEDIA_GRID_CLASS}>
 {initialItems.map((item, idx) => {
 const menuItems = [
 { label: "Restore", icon: ArrowClockwise, onClick: () => handleRestore(item.id), variant: "success" as const },
 { label: "Copy Hash", icon: Hash, onClick: () => navigator.clipboard.writeText(item.hash || "") },
  { label: "Download", icon: Download, onClick: () => {
  downloadUrl(`/api/v1/media/files/${item.filePath}`, item.title);
  }, divider: true },
 { label: "Delete Permanently", icon: TrashSimple, onClick: () => handlePermanentDelete(item.id), variant: "danger" as const }
 ];

 return (
 <div key={item.id} className="relative group/trash-card" onClick={() => setSelectedIdx(idx)}>
 <ContextMenu items={menuItems}>
 <MediaCard item={item} />
 </ContextMenu>
 
 <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover/trash-card:opacity-100 transition-opacity z-10">
 <button
 onClick={(e) => { e.stopPropagation(); handleRestore(item.id); }}
 disabled={!!isProcessing}
 type="button"
 className="p-2 bg-panel-bg/90 border border-main-border rounded-xl text-emerald-600 hover:bg-emerald-600 hover:text-white shadow-lg transition-colors ease-out-expo cursor-pointer disabled:opacity-50"
 title="Restore"
 >
 <ArrowClockwise size={16} weight="light" className={cn(isProcessing === item.id && "animate-spin")} />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); handlePermanentDelete(item.id); }}
 disabled={!!isProcessing}
 type="button"
 className="p-2 bg-panel-bg/90 border border-main-border rounded-xl text-rose-600 hover:bg-rose-600 hover:text-white shadow-lg transition-colors ease-out-expo cursor-pointer disabled:opacity-50"
 title="Delete Permanently"
 >
 <ShieldWarning size={16} weight="light" />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {selectedIdx !== null && (
  <Lightbox
  item={initialItems[selectedIdx]}
  onClose={() => setSelectedIdx(null)}
  onNext={selectedIdx < initialItems.length - 1 ? () => setSelectedIdx(selectedIdx + 1) : undefined}
  onPrev={selectedIdx > 0 ? () => setSelectedIdx(selectedIdx - 1) : undefined}
  currentIndex={selectedIdx}
  totalItems={initialItems.length}
  />
 )}
 {ConfirmDialog}
 </div>
 );
}