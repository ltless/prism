"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/media?page=1&limit=${PAGE_SIZE}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
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
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);

  const filtered = search
    ? items.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Open from library"
      className="fixed inset-0 z-50 m-auto w-[560px] max-h-[70vh] bg-app-bg border border-main-border rounded-xl shadow-2xl flex flex-col overflow-hidden outline-none backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onClose={onClose}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-main-border">
        <span className="text-sm font-bold text-main-text">Open from Library</span>
        <button type="button" onClick={onClose} aria-label="Close library picker" className="p-1.5 rounded-lg hover:bg-surface-bg text-muted-text cursor-pointer">
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
            aria-label="Search photos"
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
            <button onClick={() => { setLoading(true); fetch(`/api/v1/media?page=1&limit=${PAGE_SIZE}`).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))).then(d => { setItems(d.items || []); setError(null); }).catch(() => setError("Failed to load library")).finally(() => setLoading(false)); }} type="button" className="text-sm text-primary hover:underline cursor-pointer">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-text text-center py-8">No photos found</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                aria-label={`Select ${item.title || "image"}`}
                className="aspect-square rounded-lg overflow-hidden border border-main-border hover:border-primary hover:ring-2 hover:ring-primary/40 cursor-pointer transition-[border-color,box-shadow]"
              >
                <Image src={`/api/v1/media/files/${item.filePath}?thumb=1`} alt={item.title} fill loading="lazy" decoding="async" sizes="(max-width: 560px) 20vw, 96px" className="w-full h-full object-cover" unoptimized />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
