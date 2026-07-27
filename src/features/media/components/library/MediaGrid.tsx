"use client";

import { useMemo, memo, useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "@phosphor-icons/react";
import { MediaCard } from "../MediaCard";
import { MediaItem, Folder } from "../../types";
import { cn } from "@/core/utils/cn";

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
    const mqls = COL_QUERIES.map(([q, n]) => {
      const m = window.matchMedia(q);
      return { m, n };
    });
    const update = () => {
      for (const { m, n } of mqls) if (m.matches) return setCols(n);
      setCols(2);
    };
    update();
    mqls.forEach(({ m }) => m.addEventListener("change", update));
    return () => mqls.forEach(({ m }) => m.removeEventListener("change", update));
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

export const MediaGrid = memo(function MediaGrid({
  items, selectedIds, clipboardIds, isCut, folders, onItemClick, onItemSelect, onDelete, scrollRef
}: MediaGridProps) {
  const allSelectedIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const cols = useColumnCount();
  const fallbackRef = useRef<HTMLDivElement>(null);
  const parentRef = scrollRef ?? fallbackRef;

  const rowCount = Math.ceil(items.length / cols);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => {
      const el = parentRef.current;
      const w = el ? el.clientWidth : 800;
      return Math.floor((w - GAP * (cols - 1)) / cols) + GAP; // square cells + gap
    },
    overscan: 3,
  });

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
          {items.slice(row.index * cols, row.index * cols + cols).map((item, i) => {
            const index = row.index * cols + i;
            const selected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={(e) => onItemClick(item, e)}
                data-media-id={item.id}
                className="relative group"
              >
                <MediaCard
                  item={item}
                  priority={index === 0}
                  isSelected={selected}
                  isCut={clipboardIds.has(item.id) && isCut}
                  allSelectedIds={allSelectedIds}
                  onSelect={(shift, ctrl) => onItemSelect(item.id, shift, ctrl)}
                  onDelete={onDelete}
                  folders={folders}
                />
                {selected && (
                  <div className="absolute top-3 left-3 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none animate-in zoom-in-50 duration-150">
                    <Check size={12} weight="bold" className="text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
