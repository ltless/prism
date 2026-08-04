import { useState, useRef, useEffect, useCallback } from "react";

export function useEditorCanvas() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerSize, setCanvasContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = canvasContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const prevZoom = zoomRef.current;
      const nextZoom = Math.min(10, Math.max(0.1, prevZoom + delta));
      const ratio = nextZoom / prevZoom;

      setZoom(nextZoom);
      setPan((prevPan) => ({
        x: cx - ratio * (cx - prevPan.x),
        y: cy - ratio * (cy - prevPan.y),
      }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        setIsPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return {
    zoom, pan, isPanning, canvasContainerRef, canvasContainerSize,
    setZoom, setPan, setIsPanning, panStart,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
  };
}
