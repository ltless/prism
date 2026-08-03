import { memo, useRef, useState, useEffect } from "react";
import Image from "next/image";

interface MiniPreviewProps {
  mediaUrl: string;
  pan: { x: number; y: number };
  canvasContainerSize: { width: number; height: number };
  imageWidth: number;
  imageHeight: number;
  zoom: number;
}

export const MiniPreview = memo(function MiniPreview({
  mediaUrl,
  pan,
  canvasContainerSize,
  imageWidth,
  imageHeight,
  zoom,
}: MiniPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Only show viewport rect when all dimensions are known
  const canCompute =
    containerSize.width > 0 &&
    containerSize.height > 0 &&
    canvasContainerSize.width > 0 &&
    imageWidth > 0 &&
    imageHeight > 0;

  // Image displayed inside container with object-contain
  const safeContainerW = containerSize.width || 1;
  const safeContainerH = containerSize.height || 1;
  const displayScale = Math.min(
    safeContainerW / imageWidth,
    safeContainerH / imageHeight
  );
  const displayW = imageWidth * displayScale;
  const displayH = imageHeight * displayScale;
  const offsetX = (containerSize.width - displayW) / 2;
  const offsetY = (containerSize.height - displayH) / 2;

  // Visible area in image coordinates
  // CSS transform on wrapper: translate(pan.x, pan.y) scale(zoom)
  // Default transform-origin: 50% 50% of wrapper (fills container)
  const originX = canvasContainerSize.width / 2;
  const originY = canvasContainerSize.height / 2;
  const imgVpLeft = originX * (1 - 1 / zoom) - pan.x / zoom;
  const imgVpTop = originY * (1 - 1 / zoom) - pan.y / zoom;
  const visibleW = canvasContainerSize.width / zoom;
  const visibleH = canvasContainerSize.height / zoom;

  // Map to preview coordinates
  const vpX = imgVpLeft * displayScale + offsetX;
  const vpY = imgVpTop * displayScale + offsetY;
  const vpW = visibleW * displayScale;
  const vpH = visibleH * displayScale;

  // Clamp within displayed image area, keep at least 2px visible
  const clampedX = Math.max(offsetX, Math.min(vpX, offsetX + displayW - Math.max(vpW, 2)));
  const clampedY = Math.max(offsetY, Math.min(vpY, offsetY + displayH - Math.max(vpH, 2)));
  const clampedW = Math.min(vpW, offsetX + displayW - clampedX);
  const clampedH = Math.min(vpH, offsetY + displayH - clampedY);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-surface-bg rounded border border-main-border overflow-hidden"
    >
      <Image src={mediaUrl} alt="" fill sizes="220px" className="object-contain" unoptimized />
      {canCompute && (
        <div
          className="absolute border border-primary/60 bg-primary/10 pointer-events-none"
          style={{
            width: `${clampedW}px`,
            height: `${clampedH}px`,
            left: `${clampedX}px`,
            top: `${clampedY}px`,
          }}
        />
      )}
    </div>
  );
});
