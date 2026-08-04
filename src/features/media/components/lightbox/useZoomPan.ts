import { useState, useRef, useCallback } from "react";

export function useZoomPan() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => {
    setIsZoomed(false);
    setPanPos({ x: 0, y: 0 });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isZoomed) {
      resetZoom();
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 50;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 50;
        setPanPos({ x: -x, y: -y });
      }
      setIsZoomed(true);
    }
  }, [isZoomed, resetZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isZoomed) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y };
    setIsDragging(true);
  }, [isZoomed, panPos.x, panPos.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isZoomed || !dragStart.current) return;
    setPanPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, [isZoomed]);

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
    setIsDragging(false);
  }, []);

  const zoomStyle = isZoomed
    ? { transform: `scale(2) translate(${panPos.x / 2}px, ${panPos.y / 2}px)`, cursor: isDragging ? "grabbing" : "grab" }
    : { cursor: "zoom-in" };

  return {
    isZoomed, panPos, isDragging, zoomStyle, containerRef,
    setIsZoomed, setPanPos, resetZoom,
    handleDoubleClick, handleMouseDown, handleMouseMove, handleMouseUp,
  };
}
