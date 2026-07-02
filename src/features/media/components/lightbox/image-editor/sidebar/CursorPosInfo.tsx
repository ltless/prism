"use client";

import { useState, useEffect, useRef } from "react";
import { InfoRow } from "../../EditorSidebar";

/**
 * Cursor X/Y display, driven by its own mousemove listener on the canvas
 * container + rAF-coalesced local state. Isolated so that mouse movement over
 * the canvas never re-renders ImageEditor or the rest of the sidebar — only
 * these two InfoRows update. Previously cursorPos lived in ImageEditor state,
 * which re-rendered the entire editor tree (CanvasRenderer, AdjustPanel, 47
 * SliderRows) on every pointermove (~100% CPU while the mouse was over the
 * canvas).
 */
export function CursorPosInfo({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      pendingRef.current = {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
      };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) setPos(pendingRef.current);
      });
    };
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousemove", onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return (
    <>
      <InfoRow label="Cursor X" value={String(pos.x)} />
      <InfoRow label="Cursor Y" value={String(pos.y)} />
    </>
  );
}
