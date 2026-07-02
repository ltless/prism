import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MediaItem } from "../types";
import { toast } from "sonner";
import { useLasso } from "./useLasso";
import { useConfirm } from "../../../shared/hooks/useConfirm";
import { bulkMoveToTrashAction } from "../services/mediaTrashActions";
import { bulkSetFavoriteAction } from "../services/mediaFavoriteActions";
import { moveMediaToFolderAction } from "../services/mediaFolderActions";

export function useMediaSelection(
  displayedItems: MediaItem[],
  activeFolderId: string | null,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);
  const [clipboard, setClipboard] = useState<{ ids: Set<string>; isCut: boolean } | null>(null);
  const isProcessingRef = useRef(false);

  const onSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const { selectionBoxRef, isSelecting } = useLasso(
    scrollContainerRef,
    "[data-media-id]",
    onSelectionChange
  );

  // Stable handler: identity only changes when the underlying items change, so
  // the grid's cell memoization actually holds across selection toggles.
  const toggleSelect = useCallback((id: string, isShift: boolean, isCtrl: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedIdRef.current) {
        const start = displayedItems.findIndex(i => i.id === lastSelectedIdRef.current);
        const end = displayedItems.findIndex(i => i.id === id);
        if (start !== -1 && end !== -1) {
          displayedItems.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(i => next.add(i.id));
        }
      } else if (isCtrl) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      // Written inside the updater: React runs it lazily after the handler
      // returns, so a write after setSelectedIds would already overwrite the
      // anchor the shift branch above reads, collapsing the range to one item.
      lastSelectedIdRef.current = id;
      return next;
    });
  }, [displayedItems]);

  const handleBulkTrash = useCallback(async () => {
    const count = selectedIds.size;
    if (count === 0 || isProcessingRef.current) return;
    const ok = await confirm(`Move ${count} ${count === 1 ? "item" : "items"} to Trash?`);
    if (!ok) return;
    isProcessingRef.current = true;
    const result = await bulkMoveToTrashAction(Array.from(selectedIds));
    if (!result.success) {
      toast.error(result.error || "Failed to move items to trash");
    } else {
      toast.success(`${count} items moved to trash`);
      setSelectedIds(new Set());
      router.refresh();
    }
    isProcessingRef.current = false;
  }, [selectedIds, router, confirm]);

  const handleBulkFavorite = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || isProcessingRef.current) return;
    isProcessingRef.current = true;
    const result = await bulkSetFavoriteAction(ids, true);
    if (!result.success) {
      toast.error(result.error || "Failed to favorite items");
    } else {
      toast.success(`${ids.length} items added to favorites`);
      setSelectedIds(new Set());
    }
    isProcessingRef.current = false;
  }, [selectedIds]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    const result = await moveMediaToFolderAction(Array.from(clipboard.ids), activeFolderId);
    if (!result.success) {
      toast.error(result.error || "Unable to relocate records");
      return;
    }
    if (clipboard.isCut) setClipboard(null);
    setSelectedIds(new Set());
    toast.success("Items moved");
    router.refresh();
  }, [clipboard, activeFolderId, router]);

  const handleMoveMedia = useCallback(async (ids: string[], folderId: string | null) => {
    const result = await moveMediaToFolderAction(ids, folderId);
    if (!result.success) {
      toast.error(result.error || "Failed to move items");
      return;
    }
    toast.success(`${ids.length} items moved successfully`);
    setSelectedIds(new Set());
    router.refresh();
  }, [router]);

  const displayedItemsRef = useRef(displayedItems);
  const selectedIdsRef = useRef(selectedIds);
  const clipboardRef = useRef(clipboard);
  const handleBulkTrashRef = useRef(handleBulkTrash);
  const handlePasteRef = useRef(handlePaste);

  useEffect(() => {
    displayedItemsRef.current = displayedItems;
    selectedIdsRef.current = selectedIds;
    clipboardRef.current = clipboard;
    handleBulkTrashRef.current = handleBulkTrash;
    handlePasteRef.current = handlePaste;
  }, [displayedItems, selectedIds, clipboard, handleBulkTrash, handlePaste]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack shortcuts when the user is typing in a field.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === 'a') { e.preventDefault(); setSelectedIds(new Set(displayedItemsRef.current.map(i => i.id))); }
      if (isCtrl && e.key === 'c' && selectedIdsRef.current.size > 0) setClipboard({ ids: new Set(selectedIdsRef.current), isCut: false });
      if (isCtrl && e.key === 'x' && selectedIdsRef.current.size > 0) setClipboard({ ids: new Set(selectedIdsRef.current), isCut: true });
      if (isCtrl && e.key === 'v' && clipboardRef.current) handlePasteRef.current();
      if (e.key === 'Delete' || (isCtrl && e.key === 'Backspace')) handleBulkTrashRef.current();
      if (e.key === 'Escape') { setSelectedIds(new Set()); setSelectedId(null); setClipboard(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    selectedId, setSelectedId,
    selectedIds, setSelectedIds,
    clipboard, setClipboard,
    isSelecting, selectionBoxRef,
    toggleSelect,
    handleBulkTrash,
    handleBulkFavorite,
    handlePaste,
    handleMoveMedia,
    ConfirmDialog,
  };
}