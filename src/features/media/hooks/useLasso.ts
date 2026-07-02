import { useState, useCallback, useRef, useEffect } from "react";

interface Point {
 x: number;
 y: number;
}

interface CachedItem {
 id: string;
 left: number;
 top: number;
 right: number;
 bottom: number;
}

const AUTO_SCROLL_ZONE = 60;
const AUTO_SCROLL_SPEED = 12;

export function useLasso(
 containerRef: React.RefObject<HTMLElement | null>,
 itemSelector: string,
 onSelectionChange: (selectedIds: string[]) => void
) {
 const [isSelecting, setIsSelecting] = useState(false);
 const selectionBoxRef = useRef<HTMLDivElement | null>(null);

 const isSelectingRef = useRef(false);
 const startDoc = useRef<Point | null>(null);
 const startViewY = useRef(0);
 const cachedItems = useRef<CachedItem[]>([]); 
 const cachedItemCount = useRef(0);
 const rafId = useRef<number | null>(null);
 const autoScrollId = useRef<number | null>(null);
 const onSelectionChangeRef = useRef(onSelectionChange);
 const lastSelectedRef = useRef<string>("");
 const lastMouseEvent = useRef<MouseEvent | null>(null);

 const cacheItems = useCallback((container: HTMLElement) => {
 const rect = container.getBoundingClientRect();
 const items = container.querySelectorAll("[data-media-id]");
 const cached: CachedItem[] = [];
 for (const item of items) {
 const el = item as HTMLElement;
 const r = el.getBoundingClientRect();
 const id = el.dataset.mediaId;
 if (!id) continue;
 cached.push({
 id,
 left: r.left - rect.left + container.scrollLeft,
 top: r.top - rect.top + container.scrollTop,
 right: r.right - rect.left + container.scrollLeft,
 bottom: r.bottom - rect.top + container.scrollTop,
 });
 }
 cachedItems.current = cached;
 cachedItemCount.current = items.length;
 }, []);

 const refreshCacheIfNeeded = useCallback((container: HTMLElement) => {
 const currentCount = container.querySelectorAll("[data-media-id]").length;
 if (currentCount !== cachedItemCount.current) {
 cacheItems(container);
 }
 }, [cacheItems]);

 const handleMouseDown = useCallback((e: MouseEvent) => {
 if (e.button !== 0) return;
 const target = e.target as HTMLElement;
 if (target.closest("button") || target.closest("input") || target.closest("a") || target.closest("[data-ignore-lasso]")) {
 return;
 }

 const container = containerRef.current;
 if (!container) return;

 if (target.closest("[data-media-id]")) {
 return;
 }

 onSelectionChangeRef.current([]);

 const rect = container.getBoundingClientRect();
 startDoc.current = {
 x: e.clientX - rect.left + container.scrollLeft,
 y: e.clientY - rect.top + container.scrollTop,
 };
 startViewY.current = e.clientY - rect.top;

 isSelectingRef.current = true;
 setIsSelecting(true);

 cacheItems(container);

 if (selectionBoxRef.current) {
 selectionBoxRef.current.style.display = "block";
 selectionBoxRef.current.style.top = `${startDoc.current.y}px`;
 selectionBoxRef.current.style.left = `${startDoc.current.x}px`;
 selectionBoxRef.current.style.width = "0px";
 selectionBoxRef.current.style.height = "0px";
 }
 }, [containerRef, cacheItems]);

 const computeSelection = useCallback(() => {
 const container = containerRef.current;
 const box = selectionBoxRef.current;
 const e = lastMouseEvent.current;
 if (!isSelectingRef.current || !startDoc.current || !container || !box || !e) return;

 const rect = container.getBoundingClientRect();
 const curDocX = e.clientX - rect.left + container.scrollLeft;
 const curDocY = e.clientY - rect.top + container.scrollTop;

 // Box is position:absolute inside scroll container — use document-space coords
 box.style.left = `${Math.min(startDoc.current.x, curDocX)}px`;
 box.style.top = `${Math.min(startDoc.current.y, curDocY)}px`;
 box.style.width = `${Math.abs(startDoc.current.x - curDocX)}px`;
 box.style.height = `${Math.abs(startDoc.current.y - curDocY)}px`;

 refreshCacheIfNeeded(container);

 const selLeft = Math.min(startDoc.current.x, curDocX);
 const selTop = Math.min(startDoc.current.y, curDocY);
 const selRight = Math.max(startDoc.current.x, curDocX);
 const selBottom = Math.max(startDoc.current.y, curDocY);

 const selected: string[] = [];
 for (const item of cachedItems.current) {
 if (selLeft < item.right && selRight > item.left && selTop < item.bottom && selBottom > item.top) {
 selected.push(item.id);
 }
 }

 const key = selected.join(",");
 if (key === lastSelectedRef.current) return;
 lastSelectedRef.current = key;
 onSelectionChangeRef.current(selected);
 }, [containerRef, refreshCacheIfNeeded]);

 const handleMouseMove = useCallback((e: MouseEvent) => {
 if (!isSelectingRef.current || !startDoc.current || !containerRef.current) return;

 const container = containerRef.current;
 const rect = container.getBoundingClientRect();

 const curViewY = e.clientY - rect.top;

 // Minimum drag distance check (viewport-space, physical mouse movement)
 const curViewX = e.clientX - rect.left;
 const dx = curViewX - (startDoc.current.x - container.scrollLeft);
 const dy = curViewY - startViewY.current;
 if (dx * dx + dy * dy < 25) return;

 lastMouseEvent.current = e;

 // Start auto-scroll loop if not already running, which dynamically reads lastMouseEvent.current
 if (!autoScrollId.current) {
 const scrollStep = () => {
 const c = containerRef.current;
 const ev = lastMouseEvent.current;
 if (!isSelectingRef.current || !c || !ev) {
 autoScrollId.current = null;
 return;
 }

 const r = c.getBoundingClientRect();
 const distFromBottom = r.bottom - ev.clientY;
 const distFromTop = ev.clientY - r.top;

 let scrolled = false;
 if (distFromBottom < AUTO_SCROLL_ZONE) {
 const intensity = (AUTO_SCROLL_ZONE - Math.max(0, distFromBottom)) / AUTO_SCROLL_ZONE;
 c.scrollTop += Math.round(AUTO_SCROLL_SPEED * intensity);
 scrolled = true;
 } else if (distFromTop < AUTO_SCROLL_ZONE) {
 const intensity = (AUTO_SCROLL_ZONE - Math.max(0, distFromTop)) / AUTO_SCROLL_ZONE;
 c.scrollTop -= Math.round(AUTO_SCROLL_SPEED * intensity);
 scrolled = true;
 }

 if (scrolled) {
 computeSelection();
 autoScrollId.current = requestAnimationFrame(scrollStep);
 } else {
 autoScrollId.current = null;
 }
 };

 const distFromBottom = rect.bottom - e.clientY;
 const distFromTop = e.clientY - rect.top;
 if (distFromBottom < AUTO_SCROLL_ZONE || distFromTop < AUTO_SCROLL_ZONE) {
 autoScrollId.current = requestAnimationFrame(scrollStep);
 }
 }

 if (rafId.current) cancelAnimationFrame(rafId.current);
 rafId.current = requestAnimationFrame(computeSelection);
 }, [containerRef, computeSelection]);

 const handleMouseUp = useCallback(() => {
 if (!isSelectingRef.current) return;

 isSelectingRef.current = false;
 setIsSelecting(false);
 startDoc.current = null;
 startViewY.current = 0;
 cachedItems.current = [];
 cachedItemCount.current = 0;
 lastSelectedRef.current = "";
 lastMouseEvent.current = null;
 if (rafId.current) cancelAnimationFrame(rafId.current);
 if (autoScrollId.current) cancelAnimationFrame(autoScrollId.current);
 if (selectionBoxRef.current) {
 selectionBoxRef.current.style.display = "none";
 }
 }, []);

 useEffect(() => {
 onSelectionChangeRef.current = onSelectionChange;
 }, [onSelectionChange]);

  const handleMouseDownRef = useRef(handleMouseDown);
  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleMouseUpRef = useRef(handleMouseUp);

  useEffect(() => {
    handleMouseDownRef.current = handleMouseDown;
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => handleMouseDownRef.current(e);
    const onMouseMove = (e: MouseEvent) => handleMouseMoveRef.current(e);
    const onMouseUp = () => handleMouseUpRef.current();

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [containerRef]);

 return { selectionBoxRef, isSelecting };
}
