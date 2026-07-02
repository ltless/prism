/* eslint-disable react-hooks/refs */
import { useState, useEffect, useCallback, useRef } from "react";
import type { MediaItem, MediaMetadata } from "../types";
import { toast } from "sonner";

export function useInfiniteScroll(
 initialItems: MediaItem[],
 totalCount: number,
 pageSize: number,
 activeFolderId: string | null,
 view: string | null,
 q: string | null,
) {
 const [allItems, setAllItems] = useState<MediaItem[]>(initialItems);
 const [isLoadingMore, setIsLoadingMore] = useState(false);
 const isLoadingRef = useRef(false);
 const generationRef = useRef(0);
 const prevInitialRef = useRef(initialItems);
 const exhaustedRef = useRef(false);
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const sentinelRef = useRef<HTMLDivElement>(null);
 const prevViewRef = useRef(view);
 const prevFolderIdRef = useRef(activeFolderId);

 if (view !== prevViewRef.current || activeFolderId !== prevFolderIdRef.current) {
 prevViewRef.current = view;
 prevFolderIdRef.current = activeFolderId;
 exhaustedRef.current = false;
 generationRef.current += 1;
 }

  // sync server-provided initial items if they change to make react 19 happy
  useEffect(() => {
  const prev = prevInitialRef.current;
  prevInitialRef.current = initialItems;

  // Detect changes: length differs, items removed, or content updated
  const prevIds = new Set(prev.map(i => i.id));
  const newIds = new Set(initialItems.map(i => i.id));

  const hasChanged =
    initialItems.length !== prev.length ||
    initialItems.some(item => !prevIds.has(item.id)) ||
    prev.some(item => !newIds.has(item.id)) ||
    initialItems.some((item, i) => {
      const cur = prev[i];
      if (!cur || item.id !== cur.id) return true;
      const timeA = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const timeB = cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
      return timeA !== timeB;
    });

  if (hasChanged) {
    generationRef.current += 1;
    setAllItems(initialItems);
  }
  // allItems intentionally excluded — we only react to initialItems changing
   
  }, [initialItems]);

 const hasMore = allItems.length < totalCount && !exhaustedRef.current;

 const handleLoadMore = useCallback(async (folderIdOverride?: string | null) => {
 if (isLoadingRef.current) return;
 const gen = generationRef.current;
 isLoadingRef.current = true;
 setIsLoadingMore(true);
 const fId = folderIdOverride !== undefined ? folderIdOverride : (view === 'recent' ? undefined : activeFolderId);
 const lastItem = allItems[allItems.length - 1];
 const cursor = lastItem?.createdAt ? { createdAt: lastItem.createdAt, id: lastItem.id } : null;
 try {
 const { loadMoreMediaAction } = await import("../services/mediaSearch");
 const res = await loadMoreMediaAction(cursor, pageSize, fId, view === 'favorite' || undefined);
 if (res.success) {
 if (gen !== generationRef.current) return;
 const newItems = res.items ?? [];
 const castItems = newItems.map(item => ({
 ...item,
 metadata: item.metadata as MediaMetadata | undefined,
 isFavorite: item.isFavorite ?? undefined,
 isTrash: item.isTrash ?? undefined,
 })) as MediaItem[];
 if (newItems.length === 0 || newItems.length < pageSize) {
 exhaustedRef.current = true;
 }
 setAllItems(prev => {
 const existingIds = new Set(prev.map(i => i.id));
 const filteredNew = castItems.filter(i => !existingIds.has(i.id));
 return [...prev, ...filteredNew];
 });
 } else {
 toast.error(res.error || "Failed to load more");
 }
 } catch {
 toast.error("Failed to load more items");
 } finally {
 setIsLoadingMore(false);
 isLoadingRef.current = false;
 }
 }, [pageSize, activeFolderId, allItems, view]);

 useEffect(() => {
 const container = scrollContainerRef.current;
 if (!container || !hasMore || isLoadingMore || q) return;

 const onScroll = () => {
 const { scrollTop, scrollHeight, clientHeight } = container;
 if (scrollHeight - scrollTop - clientHeight < 800) {
 handleLoadMore();
 }
 };

 container.addEventListener("scroll", onScroll, { passive: true });
 return () => container.removeEventListener("scroll", onScroll);
 }, [hasMore, isLoadingMore, handleLoadMore, q]);

 const removeItem = useCallback((id: string) => {
 setAllItems(prev => prev.filter(item => item.id !== id));
 }, []);

 return {
 allItems,
 setAllItems,
 removeItem,
 isLoadingMore,
 hasMore,
 scrollContainerRef,
 sentinelRef,
 handleLoadMore,
 };
}
