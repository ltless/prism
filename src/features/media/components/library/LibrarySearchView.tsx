"use client";

import { Spinner, MagnifyingGlass as SearchIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { MediaItem, Folder } from "../../types";
import { MediaGrid } from "../library/MediaGrid";
import { SearchFilters } from "../library/SearchFilters";

export type GridHandlers = {
  selectedIds: Set<string>;
  clipboardIds: Set<string>;
  isCut: boolean;
  folders: Folder[];
  onItemSelect: (id: string, isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onItemClick: (item: MediaItem, e: React.MouseEvent) => void;
};

/** The three search-mode branches: loading, no results, results list. */
export function LibrarySearchView({
  q, searchLoading, searchQuery, items, grid, onClear,
}: {
  q: string;
  searchLoading: boolean;
  searchQuery: string | null;
  items: MediaItem[];
  grid: GridHandlers;
  onClear: () => void;
}) {
  if (searchLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Spinner size={32} weight="bold" className="animate-spin text-muted-text" />
        <p className="text-sm text-muted-text font-medium">
          Searching for <span className="text-main-text font-bold">{'\u201C'}{searchQuery}{'\u201D'}</span>...
        </p>
        <div className="mt-2"><SearchFilters /></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <SearchIcon size={48} weight="light" className="text-muted-text/30" />
        <p className="text-sm text-muted-text font-medium">
          No results for <span className="text-main-text font-bold">{'\u201C'}{q}{'\u201D'}</span>
        </p>
        <div className="mb-2"><SearchFilters /></div>
        <button type="button" onClick={onClear} className="text-xs text-primary font-bold hover:underline cursor-pointer">
          Clear all
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <SearchIcon size={14} weight="light" className="text-muted-text" />
        <p className="text-xs text-muted-text font-medium">
          <span className="text-main-text font-bold">{items.length}</span> result{items.length !== 1 ? 's' : ''} for <span className="text-main-text font-bold">{'\u201C'}{q}{'\u201D'}</span>
        </p>
      </div>
      <div className="mb-4"><SearchFilters /></div>
      <MediaGrid items={items} {...grid} />
    </>
  );
}

/** Reads current params, drops the search keys, pushes the cleaned URL. */
export function useClearSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('q'); p.delete('type'); p.delete('from'); p.delete('to');
    router.push(`${window.location.pathname}?${p}`);
  };
}
