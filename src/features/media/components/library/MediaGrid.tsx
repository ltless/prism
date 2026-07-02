"use client";

import { useMemo, memo, useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "@phosphor-icons/react";
import { MediaCard } from "../MediaCard";
import { MediaItem, Folder } from "../../types";
import { cn } from "@/core/utils/cn";
import { THUMB_URL, setDragSelection } from "../../utils/dragGhost";

// Matches MEDIA_GRID_CLASS breakpoints: cols-2 / md:3 / lg:5 / xl:6 / 2xl:7
export const MEDIA_GRID_CLASS = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2";
const COL_QUERIES: [string, number][] = [
 ["(min-width: 1536px)", 7],
 ["(min-width: 1280px)", 6],
 ["(min-width: 1024px)", 5],
 ["(min-width: 768px)", 3],
];
const GAP = 8;

function useColumnCount(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const ac = new AbortController();
    const mqls = COL_QUERIES.map(([q, n]) => {
      const m = window.matchMedia(q);
      return { m, n };
    });
    const update = () => {
      for (const { m, n } of mqls) if (m.matches) return setCols(n);
      setCols(2);
    };
    update();
    mqls.forEach(({ m }) => m.addEventListener("change", update, { signal: ac.signal }));
    return () => ac.abort();
  }, []);
  return cols;
}

interface MediaGridProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  clipboardIds: Set<string>;
  isCut: boolean;
  folders: Folder[];
  onItemClick: (item: MediaItem, e: React.MouseEvent) => void;
  onItemSelect: (id: string, isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

interface MediaCellProps {
  item: MediaItem;
  isSelected: boolean;
  isCut: boolean;
  folders: Folder[];
  priority: boolean;
  onItemClick: (item: MediaItem, e: React.MouseEvent) => void;
  onItemSelect: (id: string, isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
}

// One grid cell. Memoized with stable handler props so a selection change only
// re-renders the cells whose isSelected/isCut actually flipped — not the whole
// visible window.
const MediaCell = memo(function MediaCell({
  item, isSelected, isCut, folders, priority, onItemClick, onItemSelect, onDelete,
}: MediaCellProps) {
  const handleClick = (e: React.MouseEvent) => onItemClick(item, e);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") onItemClick(item, e as unknown as React.MouseEvent);
  };
  const handleSelect = (shift: boolean, ctrl: boolean) => onItemSelect(item.id, shift, ctrl);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-media-id={item.id}
      className="relative group"
    >
      <MediaCard
        item={item}
        priority={priority}
        isSelected={isSelected}
        isCut={isCut}
        onSelect={handleSelect}
        onDelete={onDelete}
        folders={folders}
      />
      {isSelected && (
        <div className="absolute top-3 left-3 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none ">
          <Check size={12} weight="bold" className="text-primary-foreground" />
        </div>
      )}
    </div>
  );
});

export const MediaGrid = memo(function MediaGrid({
  items, selectedIds, clipboardIds, isCut, folders, onItemClick, onItemSelect, onDelete, scrollRef
}: MediaGridProps) {
  const cols = useColumnCount();
  const fallbackRef = useRef<HTMLDivElement>(null);
  const parentRef = scrollRef ?? fallbackRef;
  const [containerWidth, setContainerWidth] = useState(0);

  // Latest multi-drag selection lives in a module-level snapshot (dragGhost) so
  // it does not have to be threaded into every card as a changing prop. Only the
  // card that actually starts the drag reads it.
  const dragSelection = useMemo(
    () => ({
      ids: Array.from(selectedIds),
      thumbs: items.filter(i => selectedIds.has(i.id)).map(i => THUMB_URL(i.filePath)),
    }),
    [items, selectedIds]
  );
  useEffect(() => {
    setDragSelection(dragSelection);
  }, [dragSelection]);

  // Track the shell (the actual row container) width, not the scroll element's
// clientWidth: the scroll element includes its horizontal padding, which would
// inflate the cell estimate and leave the vertical row gap wider than the
// horizontal gap-2.
useEffect(() => {
  const el = fallbackRef.current;
  if (!el) return;
  const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
  ro.observe(el);
  setContainerWidth(el.clientWidth);
  return () => ro.disconnect();
}, []);

  const rowCount = Math.ceil(items.length / cols);
  // React Compiler skips memoizing this hook — TanStack Virtual returns
  // functions that can't be safely memoized. Intentional: the virtualizer
  // already handles its own instance lifecycle.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => {
      const w = containerWidth || parentRef.current?.clientWidth || 800;
      // Exact track width, no flooring: the skeleton grid renders the same
      // cells in natural flow, so a rounded row step would drift the vertical
      // gap off GAP over many rows and make the grid look different from the
      // loading placeholder.
      const cellSize = (w - GAP * (cols - 1)) / cols;
      return cellSize + GAP;
    },
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [containerWidth, cols, virtualizer]);

  return (
    <div ref={fallbackRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          className={cn(MEDIA_GRID_CLASS)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${row.start}px)`,
          }}
        >
          {items.slice(row.index * cols, row.index * cols + cols).map((item, i) => (
            <MediaCell
              key={item.id}
              item={item}
              priority={row.index * cols + i === 0}
              onItemClick={onItemClick}
              onItemSelect={onItemSelect}
              onDelete={onDelete}
              folders={folders}
              isSelected={selectedIds.has(item.id)}
              isCut={clipboardIds.has(item.id) && isCut}
            />
          ))}
        </div>
      ))}
    </div>
  );
});