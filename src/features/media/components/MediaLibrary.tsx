"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner } from "@phosphor-icons/react";
import { LayoutGroup, AnimatePresence } from "motion/react";
import { Lightbox } from "./Lightbox";
import { UploadZone } from "./UploadZone";
import { MediaItem, Folder as FolderType } from "../types";
import { LibraryHeader } from "./library/LibraryHeader";
import { EmptyLibrary } from "./library/EmptyLibrary";
import { MediaGrid } from "./library/MediaGrid";
import { LibrarySearchView, useClearSearch } from "./library/LibrarySearchView";
import { SelectionBox } from "./library/SelectionBox";
import { BulkActionBar } from "./library/BulkActionBar";
import { useMediaSearch } from "../hooks/useMediaSearch";
import { useMediaSelection } from "../hooks/useMediaSelection";
import { downloadBatchAsZip } from "../utils/zipHelper";

interface MediaLibraryProps {
  initialItems: MediaItem[];
  folders: FolderType[];
  total: number;
  initialFolderId: string | null;
  initialFavorite: boolean;
  initialSmartFilter: { categories: string[]; minScore: number } | null;
}

const EMPTY_FOLDERS: FolderType[] = [];

export default function MediaLibrary({ initialItems, folders = EMPTY_FOLDERS, total, initialFolderId, initialFavorite, initialSmartFilter }: MediaLibraryProps) {
  const router = useRouter();
  const clearSearch = useClearSearch();
  const searchParams = useSearchParams();
  const view = searchParams.get('v');
  const activeFolderId = searchParams.get('f');
  const q = searchParams.get('q');
  const filterType = searchParams.get('type');
  const filterFrom = searchParams.get('from');
  const filterTo = searchParams.get('to');

  const [allItems, setAllItems] = useState<MediaItem[]>(initialItems);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);
  const [prevInitial, setPrevInitial] = useState(initialItems);

  // Reset accumulated pages when the server sends fresh page-1 data
  // (router.refresh / folder switch). Render-phase reset — the pattern
  // ImageEditor.tsx already uses — instead of set-state-in-effect.
  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    setAllItems(initialItems);
    setPage(1);
  }

  const hasMore = allItems.length < total;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const { fetchLibraryPageAction } = await import("../services/mediaSearch");
      const res = await fetchLibraryPageAction(initialFolderId, initialFavorite, initialSmartFilter, page + 1);
      if (res.success) {
        setAllItems(prev => {
          const seen = new Set(prev.map(i => i.id));
          return [...prev, ...res.items.filter((i: MediaItem) => !seen.has(i.id))];
        });
        setPage(p => p + 1);
      }
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [page, hasMore, initialFolderId, initialFavorite, initialSmartFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMore();
    }, { root: scrollContainerRef.current, rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  const removeItem = useCallback((id: string) => {
    setAllItems(prev => prev.filter(item => item.id !== id));
  }, []);

 const { searchResults, searchLoading, searchQuery } = useMediaSearch(q, activeFolderId, {
 mimeType: filterType,
 dateFrom: filterFrom,
 dateTo: filterTo,
 });

 const displayedItems = useMemo(() => {
 if (q) return searchResults ?? [];
 const items = [...allItems];
 if (view === 'recent') return items.sort((a, b) => {
 const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
 const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
 return dateB - dateA;
 });
 if (view === 'favorite') return items.filter(i => i.isFavorite);
 if (view === 'places') return items.filter(i => (i as { location?: unknown }).location);
 return items;
 }, [allItems, view, q, searchResults]);

  const {
  selectedId, setSelectedId,
  selectedIds, setSelectedIds,
  clipboard, setClipboard,
  isSelecting, selectionBoxRef,
  toggleSelect,
  handleBulkTrash,
   handleBulkFavorite,
   ConfirmDialog,
  } = useMediaSelection(displayedItems, activeFolderId, scrollContainerRef);

 const handleBulkDownload = () => {
 const itemsToDownload = displayedItems.filter((item) => selectedIds.has(item.id));
 downloadBatchAsZip(itemsToDownload);
 };

  

 useEffect(() => {
 const handler = () => router.refresh();
 window.addEventListener('prism-ai-update', handler as EventListener);
 return () => window.removeEventListener('prism-ai-update', handler as EventListener);
 }, [router]);

  return (
  <LayoutGroup>
  <div className="flex flex-col h-full w-full relative select-none overflow-hidden">

 <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
 <UploadZone className="flex-1 flex flex-col h-full">
 <div 
 ref={scrollContainerRef}
 className="flex-1 overflow-y-auto custom-scroll px-6 pb-6 pt-2 relative"
 >
 <SelectionBox ref={selectionBoxRef} />
 
  {q ? (
  <LibrarySearchView
  q={q}
  searchLoading={searchLoading}
  searchQuery={searchQuery}
  items={displayedItems}
  grid={{
  selectedIds,
  clipboardIds: clipboard?.ids || new Set(),
  isCut: !!clipboard?.isCut,
  folders,
  onItemSelect: toggleSelect,
  onDelete: removeItem,
  scrollRef: scrollContainerRef,
  onItemClick: (item, e) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); toggleSelect(item.id, e.shiftKey, e.ctrlKey || e.metaKey); }
  else setSelectedId(item.id);
  },
  }}
  onClear={clearSearch}
  />
  ) : displayedItems.length === 0 ? <EmptyLibrary isFolder={!!activeFolderId} /> : (
  <>
  <MediaGrid
  items={displayedItems} selectedIds={selectedIds} clipboardIds={clipboard?.ids || new Set()}
  isCut={!!clipboard?.isCut} folders={folders}
  onItemSelect={toggleSelect}
  onDelete={removeItem}
  scrollRef={scrollContainerRef}
  onItemClick={(item, e) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); toggleSelect(item.id, e.shiftKey, e.ctrlKey || e.metaKey); }
  else setSelectedId(item.id);
  }}
   />
  {hasMore && (
  <div ref={sentinelRef} className="flex justify-center py-6">
  {loadingMore && <Spinner size={24} weight="bold" className="animate-spin text-muted-text" />}
  </div>
  )}
  </>
  )}
  </div>
 </UploadZone>

 <LibraryHeader selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())} />
 </div>

 <BulkActionBar
 selectedIds={selectedIds}
 isSelecting={isSelecting}
 onFavorite={handleBulkFavorite}
 onCopy={() => setClipboard({ ids: new Set(selectedIds), isCut: false })}
 onCut={() => setClipboard({ ids: new Set(selectedIds), isCut: true })}
 onTrash={handleBulkTrash}
 onClear={() => setSelectedIds(new Set())}
 onDownload={handleBulkDownload}
 />

 {(() => {
 const idx = selectedId !== null ? displayedItems.findIndex(i => i.id === selectedId) : -1;
 if (idx === -1) return null;
 return (
  <AnimatePresence>
  <Lightbox
  item={displayedItems[idx]} onClose={() => setSelectedId(null)}
  onNext={idx < displayedItems.length - 1 ? () => setSelectedId(displayedItems[idx + 1].id) : undefined}
  onPrev={idx > 0 ? () => setSelectedId(displayedItems[idx - 1].id) : undefined}
  currentIndex={idx}
  totalItems={displayedItems.length}
  folders={folders}
  />
  </AnimatePresence>
 );
 })()}
  
  {ConfirmDialog}
  </div>
  </LayoutGroup>
  );
}
