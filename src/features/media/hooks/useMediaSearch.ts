import { useState, useEffect } from "react";
import { MediaItem } from "../types";
import { toast } from "sonner";

interface SearchFilters {
 mimeType?: string | null;
 dateFrom?: string | null;
 dateTo?: string | null;
}

export function useMediaSearch(q: string | null, activeFolderId: string | null, filters?: SearchFilters) {
 const [searchState, setSearchState] = useState<{
 query: string | null;
 folderId: string | null;
 filterKey: string | null;
 items: MediaItem[] | null;
 }>({
 query: null,
 folderId: null,
 filterKey: null,
 items: null,
 });

 const filterKey = JSON.stringify(filters ?? null);

 // if the query changed, we are busy loading it
 const isNewSearch = q !== null && (
 searchState.query !== q ||
 searchState.folderId !== activeFolderId ||
 searchState.filterKey !== filterKey
 );

 const searchResults = (q === null || isNewSearch) ? null : searchState.items;
 const searchLoading = isNewSearch;

  // fetch search results when the query changes and try not to explode
useEffect(() => {
	if (!q) return;

	let cancelled = false;

	const doSearch = async () => {
	try {
	const { searchMediaAction } = await import("../services/mediaSearch");
	const res = await searchMediaAction(q, activeFolderId, filters);
	if (cancelled) return;
  if (res.success) {
  setSearchState({
  query: q,
  folderId: activeFolderId,
  filterKey,
  items: res.items as MediaItem[],
  });
  } else {
  toast.error("Search failed: " + (res as { error?: string }).error);
  setSearchState(prev => ({
  ...prev,
  query: q,
  folderId: activeFolderId,
  filterKey,
  items: null,
  }));
  }
  } catch {
  if (!cancelled) {
  toast.error("Search failed");
  setSearchState(prev => ({
  ...prev,
  query: q,
  folderId: activeFolderId,
  filterKey,
  items: null,
  }));
  }
  }
  };

doSearch();
	return () => {
	cancelled = true;
	};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeFolderId, filterKey]);

 return { searchResults, searchLoading, searchQuery: q };
}
