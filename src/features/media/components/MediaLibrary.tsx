"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner, MagnifyingGlass as SearchIcon } from "@phosphor-icons/react";
import { LayoutGroup, AnimatePresence } from "motion/react";
import { Lightbox } from "./Lightbox";
import { UploadZone } from "./UploadZone";
import { MediaItem, Folder as FolderType } from "../types";
import { LibraryHeader } from "./library/LibraryHeader";
import { EmptyLibrary } from "./library/EmptyLibrary";
import { MediaGrid } from "./library/MediaGrid";
import { SearchFilters } from "./library/SearchFilters";
import { SelectionBox } from "./library/SelectionBox";
import { BulkActionBar } from "./library/BulkActionBar";
import { useMediaSearch } from "../hooks/useMediaSearch";
import { useMediaSelection } from "../hooks/useMediaSelection";
import { downloadBatchAsZip } from "../utils/zipHelper";

interface MediaLibraryProps {
  initialItems: MediaItem[];
  folders: FolderType[];
}

const EMPTY_FOLDERS: FolderType[] = [];

export default function MediaLibrary({ initialItems, folders = EMPTY_FOLDERS }: MediaLibraryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('v');
  const activeFolderId = searchParams.get('f');
  const q = searchParams.get('q');
  const filterType = searchParams.get('type');
  const filterFrom = searchParams.get('from');
  const filterTo = searchParams.get('to');

  const [allItems, setAllItems] = useState<MediaItem[]>(initialItems);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAllItems(initialItems);
  }, [initialItems]);

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
 <div className="sticky top-0 z-30 bg-app-bg px-6 pt-4 pb-1">
  <LibraryHeader selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())} />
 </div>

 <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
 <UploadZone className="flex-1 flex flex-col h-full">
 <div 
 ref={scrollContainerRef}
 className="flex-1 overflow-y-auto custom-scroll px-6 pb-6 pt-2 relative"
 >
 <SelectionBox ref={selectionBoxRef} />
 
 {searchLoading ? (
 <div className="flex flex-col items-center justify-center py-32 gap-4">
 <Spinner size={32} weight="bold" className="animate-spin text-muted-text" />
 <p className="text-sm text-muted-text font-medium">
 Searching for <span className="text-main-text font-bold">{'\u201C'}{searchQuery}{'\u201D'}</span>...
 </p>
 <div className="mt-2">
 <SearchFilters />
 </div>
 </div>
 ) : q && displayedItems.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-32 gap-4">
 <SearchIcon size={48} weight="light" className="text-muted-text/30" />
 <p className="text-sm text-muted-text font-medium">
 No results for <span className="text-main-text font-bold">{'\u201C'}{q}{'\u201D'}</span>
 </p>
 <div className="mb-2">
 <SearchFilters />
 </div>
 <button
 type="button"
 onClick={() => { const p = new URLSearchParams(searchParams.toString()); p.delete('q'); p.delete('type'); p.delete('from'); p.delete('to'); router.push(`${window.location.pathname}?${p}`); }}
 className="text-xs text-primary font-bold hover:underline cursor-pointer"
 >
 Clear all
 </button>
 </div>
 ) : q && !searchLoading ? (
 <>
 <div className="flex items-center gap-3 mb-2">
 <SearchIcon size={14} weight="light" className="text-muted-text" />
 <p className="text-xs text-muted-text font-medium">
 <span className="text-main-text font-bold">{displayedItems.length}</span> result{displayedItems.length !== 1 ? 's' : ''} for <span className="text-main-text font-bold">{'\u201C'}{q}{'\u201D'}</span>
 </p>
 </div>
 <div className="mb-4">
 <SearchFilters />
 </div>
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
 </>
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
  </>
  )}
  </div>
 </UploadZone>
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
