"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from "react";
import type { AdjustmentState } from "../state/editorState";
import { applyAdjustmentsAsync } from "../engine/workerClient";
import { hasActiveAdjustments } from "../engine/AdjustmentEngine";

interface CanvasRendererProps {
  /** URL of the image to render */
  mediaUrl: string;
  /** Adjustment state — when changed, canvas re-renders with new adjustments applied */
  adjustments: AdjustmentState;
  /** Max dimension on longest edge (preview quality). Default 1920 */
  maxPreviewSize?: number;

  /** Called once image dimensions are known */
  onDimensionsKnown?: (w: number, h: number) => void;
  /** Indicates active slider dragging for optimization */
  isDragging?: boolean;
}

export interface CanvasRendererHandle {
  /** Underlying canvas element (for external consumers like save pipeline) */
  getCanvas: () => HTMLCanvasElement | null;
  /** Current natural dimensions of loaded image */
  getOriginalDimensions: () => { width: number; height: number };
  /** Force immediate re-render (call after adjustments change) */
  forceRedraw: () => void;
  /**
   * Sample pixel color at screen coordinates.
   * Returns RGBA object or null if coordinates are outside image area.
   * Accounts for CSS transform + object-fit: contain.
   */
  sampleColor: (clientX: number, clientY: number) => {
    r: number;
    g: number;
    b: number;
    a: number;
  } | null;
}

/**
 * CanvasRenderer — renders an image onto a <canvas> element, downscaled
 * for 60fps preview performance. Max dimension capped along longest edge.
 *
 * After drawing the image, applies the adjustment engine pipeline to the
 * pixel buffer and writes the adjusted data back. When all adjustments are
 * neutral (identity), this is a no-op — just draws the image as-is.
 */
export const CanvasRenderer = memo(forwardRef<CanvasRendererHandle, CanvasRendererProps>(
  function CanvasRenderer(
    { mediaUrl, adjustments, maxPreviewSize = 1920, onDimensionsKnown, isDragging },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Original (un-downscaled) dimensions of the loaded image
    const originalDims = useRef<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });

    // Cache of un-adjusted pixel data, keyed by display dimensions.
    // During a slider drag, display dims are stable, so we reuse the cached
    // buffer (a cheap memcpy into the working ImageData) instead of re-running
    // drawImage + getImageData on every frame — getImageData forces a GPU→CPU
    // readback and a ~10MB alloc at 1920px, which is what pinned CPU/RAM.
    const originalImageDataRef = useRef<{
      data: Uint8ClampedArray;
      width: number;
      height: number;
    } | null>(null);


    // Compute display dimensions (downscaled) given original size
    const computeDisplayDims = (natW: number, natH: number) => {
      if (natW === 0 || natH === 0) return { width: 0, height: 0 };
      const longest = Math.max(natW, natH);
      if (longest <= maxPreviewSize) return { width: natW, height: natH };
      const scale = maxPreviewSize / longest;
      return {
        width: Math.round(natW * scale),
        height: Math.round(natH * scale),
      };
    };

    // Render current image onto canvas, applying adjustment pipeline.
    //
    // Three tricks to keep this cheap:
    //   1. No active adjustments → skip the pixel pipeline entirely.
    //      drawImage already produced the final frame; a getImageData →
    //      applyAdjustments(no-op) → putImageData round trip would be pure waste.
    //   2. Reuse a cached copy of the un-adjusted pixels (post-drawImage,
    //      pre-engine) when display dims are stable. During a drag the canvas
    //      is downscaled to DRAG_PREVIEW_SIZE, so the cache is tiny and the
    //      per-frame memcpy into the working ImageData is negligible. Cache
    //      miss (image load / maxPreviewSize change) rebuilds via getImageData.
    //   3. The working ImageData is reused across frames (no per-frame alloc)
    //      and reset from the cache each render.
    // Latest-render-wins: a render started while a previous async render is
    // still in flight must not clobber the canvas with stale pixels.
    const renderSeqRef = useRef(0);

    const render = () => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img || !img.complete) return;

      const { width: dw, height: dh } = computeDisplayDims(
        img.naturalWidth,
        img.naturalHeight
      );
      if (dw === 0 || dh === 0) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Only resize if dimensions actually changed — assigning canvas.width/height
      // unconditionally clears the canvas every call, causing a visible flash.
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }

      // Reset transforms
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, dw, dh);

      // Draw image at display size
      ctx.drawImage(img, 0, 0, dw, dh);

      // Skip the pixel pipeline entirely when no adjustments are active —
      // drawImage already produced the final frame.
      if (!adjustments || !hasActiveAdjustments(adjustments)) return;

      const seq = ++renderSeqRef.current;
      const commit = (adjusted: Uint8ClampedArray) => {
        if (seq !== renderSeqRef.current) return; // stale render
        if (canvas.width !== dw || canvas.height !== dh) return; // canvas resized meanwhile
        ctx.putImageData(new ImageData(adjusted as Uint8ClampedArray<ArrayBuffer>, dw, dh), 0, 0);
      };

      const cache = originalImageDataRef.current;
      if (cache && cache.width === dw && cache.height === dh) {
        // Cache hit: run the engine on the cached pixels in the worker.
        applyAdjustmentsAsync(adjustments, cache.data, dw, dh, !!isDragging).then(commit);
      } else {
        // Cache miss (image load / maxPreviewSize change): read back once,
        // seed the cache, and run the engine on the freshly-read buffer.
        const src = ctx.getImageData(0, 0, dw, dh);
        originalImageDataRef.current = {
          data: new Uint8ClampedArray(src.data),
          width: dw,
          height: dh,
        };
        applyAdjustmentsAsync(adjustments, src.data, dw, dh, !!isDragging).then(commit);
      }
    };

    // Load image when mediaUrl changes
    useEffect(() => {
      setLoadError(null);
      setIsLoaded(false);

      // Invalidate the pixel cache — the new image has different pixels even
      // if its display dims happen to match the previous one.
      originalImageDataRef.current = null;

      // Clear canvas before loading starts to avoid showing old images
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        imgRef.current = img;
        originalDims.current = {
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        setIsLoaded(true);
        onDimensionsKnown?.(img.naturalWidth, img.naturalHeight);
        render();
      };

      img.onerror = () => {
        setLoadError("Failed to load image");
        imgRef.current = null;
      };

      img.src = mediaUrl;

      return () => {
        img.onload = null;
        img.onerror = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mediaUrl]);

    // Re-render if maxPreviewSize or adjustments change.
    // isDragging intentionally excluded — it only affects the adjustment pipeline
    // internals (quality skip), not canvas dimensions. Including it here caused
    // a flash on drag-end because render() would re-run and clear the canvas.
    useEffect(() => {
      if (isLoaded) render();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maxPreviewSize, adjustments]);

    // Expose handle (dependencies include adjustments so forceRedraw always
    // uses the latest snapshot when called imperatively)
    useImperativeHandle(
      ref,
      () => ({
        getCanvas: () => canvasRef.current,
        getOriginalDimensions: () => originalDims.current,
        forceRedraw: render,
        sampleColor: (clientX: number, clientY: number) => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return null;

          const rect = canvas.getBoundingClientRect();
          const cssX = clientX - rect.left;
          const cssY = clientY - rect.top;

          // Image displayed within canvas via object-fit: contain
          const displayScale = Math.min(
            rect.width / canvas.width,
            rect.height / canvas.height
          );
          const displayW = canvas.width * displayScale;
          const displayH = canvas.height * displayScale;
          const offsetX = (rect.width - displayW) / 2;
          const offsetY = (rect.height - displayH) / 2;

          // Click outside image area
          if (
            cssX < offsetX ||
            cssX > offsetX + displayW ||
            cssY < offsetY ||
            cssY > offsetY + displayH
          ) {
            return null;
          }

          const bx = Math.floor((cssX - offsetX) / displayScale);
          const by = Math.floor((cssY - offsetY) / displayScale);

          if (bx < 0 || bx >= canvas.width || by < 0 || by >= canvas.height) {
            return null;
          }

          const pixel = ctx.getImageData(bx, by, 1, 1).data;
          return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isLoaded, adjustments]
    );

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <p className="rounded-full bg-[#0c0c0e] px-3 py-1.5 text-[12px] text-white/70 ring-1 ring-white/12">{loadError}</p>
          </div>
        )}
        {!isLoaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20" aria-hidden>
            <div className="h-16 w-28 rounded-2xl bg-white/6 ring-1 ring-white/10 animate-pulse" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain select-none block"
        />
      </div>
    );
  }
));

// DevTools display name (memo(forwardRef(...)) loses the function name otherwise)
CanvasRenderer.displayName = "CanvasRenderer";
