"use client";

import { Spinner, MagnifyingGlass as SearchIcon } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { MediaItem, Folder } from "../../types";
import { MediaGrid } from "../library/MediaGrid";
import { SearchFilters, SearchModeToggle } from "../library/SearchFilters";

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
  q, mode = "describe", searchLoading, searchQuery, items, grid, onClear,
}: {
  q: string;
  mode?: "name" | "describe";
  searchLoading: boolean;
  searchQuery: string | null;
  items: MediaItem[];
  grid: GridHandlers;
  onClear: () => void;
}) {
  if (searchLoading) {
    return (
      <div className="flex flex-col items-start gap-4 py-24">
        <Spinner size={16} weight="light" className="animate-spin text-muted-text" />
        <p className="text-[2rem] font-medium leading-none tracking-[-0.04em] text-main-text">
          Searching <span className="text-muted-text">{searchQuery}</span>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-24">
        <SearchIcon size={22} weight="light" className="text-muted-text" />
        <p className="text-[2rem] font-medium leading-none tracking-[-0.04em] text-main-text">
          Nothing for <span className="text-muted-text">{q}</span>
        </p>
        <SearchModeToggle mode={mode} />
        <SearchFilters />
        <button type="button" onClick={onClear} className="text-[12px] text-muted-text hover:text-main-text cursor-pointer">
          Clear search
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="text-[15px] tracking-[-0.01em] text-muted-text">
          <span className="font-medium text-main-text">{items.length}</span>
          {" "}result{items.length !== 1 ? "s" : ""} for{" "}
          <span className="font-medium text-main-text">{q}</span>
        </p>
        <SearchModeToggle mode={mode} />
      </div>
      <div className="mb-8"><SearchFilters /></div>
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
    p.delete("q"); p.delete("type"); p.delete("from"); p.delete("to"); p.delete("mode");
    router.push(`${window.location.pathname}?${p}`);
  };
}
