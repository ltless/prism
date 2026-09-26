"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { X, MagnifyingGlass } from "@phosphor-icons/react";
import { MediaItem } from "../../types";

interface LibraryPickerProps {
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
}

const PAGE_SIZE = 60;

type ListResponse = { items?: MediaItem[]; total?: number };

export function LibraryPicker({ onSelect, onClose }: LibraryPickerProps) {
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ["library-picker"],
    queryFn: async ({ pageParam }): Promise<ListResponse> => {
      const res = await fetch(`/api/v1/media?page=${pageParam}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.items?.length || 0), 0);
      return loaded < (lastPage.total || 0) ? allPages.length + 1 : undefined;
    },
  });

  const items = query.data ? query.data.pages.flatMap((p) => p.items || []) : [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    // No close() in cleanup: it fires the native close event, which triggers
    // onClose and unmounts the picker — StrictMode's double-invoked effects
    // turn that into an open/close loop. Unmounting removes the dialog anyway.
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = search
    ? items.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Open from library"
      className="fixed inset-0 z-50 m-auto w-[min(560px,calc(100vw-2rem))] max-h-[70vh] bg-[#101012] text-white ring-1 ring-white/12 rounded-[1.4rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_30px_80px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden outline-none backdrop:bg-black/60"
      onClose={onClose}
    >
      <header className="flex items-center justify-between px-4 h-12">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/50">Open from Library</span>
        <button type="button" onClick={onClose} aria-label="Close library picker" className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white cursor-pointer">
          <X size={16} weight="light" />
        </button>
      </header>

      <div className="px-4 pb-3">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" weight="light" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search photos"
            aria-label="Search photos"
            className="w-full rounded-full bg-white/6 py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/35 outline-none ring-1 ring-white/10 focus:ring-white/30"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-4">
        {query.isLoading ? (
          <p className="text-[13px] text-white/45 text-center py-8">Loading</p>
        ) : query.isError ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-[13px] text-white/70">Library failed to load.</p>
            <button onClick={() => query.refetch()} type="button" className="text-[13px] text-white underline decoration-white/30 underline-offset-4 cursor-pointer">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-white/45 text-center py-8">No photos found</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                aria-label={`Select ${item.title || "image"}`}
                className="relative aspect-square rounded-2xl overflow-hidden ring-1 ring-white/10 hover:ring-white/50 cursor-pointer"
              >
                <Image src={`/api/v1/media/files/${item.filePath}?thumb=1`} alt={item.title} fill loading="lazy" decoding="async" sizes="(max-width: 560px) 20vw, 96px" className="w-full h-full object-cover" unoptimized />
              </button>
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="h-px" />
        {query.isFetchingNextPage && (
          <p className="text-[12px] text-white/40 text-center py-3">Loading more</p>
        )}
      </div>
    </dialog>
  );
}
