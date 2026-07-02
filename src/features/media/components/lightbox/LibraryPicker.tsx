"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, MagnifyingGlass } from "@phosphor-icons/react";
import { MediaItem } from "../../types";
import { logger } from "@/core/utils/logger";

interface LibraryPickerProps {
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
}

const PAGE_SIZE = 60;

export function LibraryPicker({ onSelect, onClose }: LibraryPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pageRef = useRef(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    try {
      const res = await fetch(`/api/media/list?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newItems: MediaItem[] = data.items || [];
      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(newItems.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      if (!append) {
        setError("Failed to load library");
        setItems([]);
      }
      logger.warn("LibraryPicker fetch failed", { error: String(err) });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media/list?page=1&limit=${PAGE_SIZE}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const newItems: MediaItem[] = data.items || [];
        setItems(newItems);
        setHasMore(newItems.length === PAGE_SIZE);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError("Failed to load library");
        setItems([]);
        logger.warn("LibraryPicker fetch failed", { error: String(err) });
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    pageRef.current++;
    fetchPage(pageRef.current, true);
  }, [fetchPage, loadingMore, hasMore]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filtered = search
    ? items.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Open from library"
        tabIndex={-1}
        className="bg-app-bg border border-main-border rounded-xl shadow-2xl w-[560px] max-h-[70vh] flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-main-border">
          <span className="text-sm font-bold text-main-text">Open from Library</span>
          <button onClick={onClose} aria-label="Close library picker" className="p-1.5 rounded-lg hover:bg-surface-bg text-muted-text cursor-pointer">
            <X size={16} weight="light" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-main-border">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text/50" weight="light" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search photos..."
              className="w-full bg-surface-bg border border-main-border rounded-lg py-2 pl-9 pr-3 text-sm text-main-text placeholder:text-muted-text/40 outline-none focus:border-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          {loading ? (
            <p className="text-sm text-muted-text text-center py-8">Loading...</p>
          ) : error ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-text">{error}</p>
              <button onClick={() => { setLoading(true); fetchPage(1, false); }} className="text-sm text-primary hover:underline cursor-pointer">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No photos found</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    aria-label={`Select ${item.title || "image"}`}
                    className="aspect-square rounded-lg overflow-hidden border border-main-border hover:border-primary hover:ring-2 hover:ring-primary/40 cursor-pointer transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/${item.filePath}?thumb=1`} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              {hasMore && !search && (
                <div className="text-center mt-4">
                  <button onClick={loadMore} disabled={loadingMore} className="text-sm text-primary hover:underline cursor-pointer disabled:opacity-50">
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
