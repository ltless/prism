"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Search state for the top bar: query mirrored from the URL param, debounced
 * push to the router, and timer cleanup. Extracted from TopBarClient (F13) —
 * pure move, no behavior change.
 */
export function useTopBarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (!q) {
        pushSearch("");
      } else {
        searchTimerRef.current = setTimeout(() => pushSearch(q), 250);
      }
    },
    [pushSearch],
  );

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      pushSearch(searchQuery);
    },
    [pushSearch, searchQuery],
  );

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return { searchQuery, handleSearchChange, handleSearchSubmit };
}
