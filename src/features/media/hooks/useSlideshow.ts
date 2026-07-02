import { useEffect, useRef, useState, useCallback } from "react";

export const SLIDESHOW_INTERVAL_MS = 4000;

/**
 * Auto-advance timer for the lightbox slideshow.
 * Returns [isPlaying, toggle]. Pause when `canAdvance` is false
 * (e.g. last item reached or a video is playing).
 */
export function useSlideshow(canAdvance: boolean, onAdvance: () => void): [boolean, () => void] {
  const [isPlaying, setIsPlaying] = useState(false);
  const [prevCanAdvance, setPrevCanAdvance] = useState(canAdvance);
  const onAdvanceRef = useRef(onAdvance);

  // Render-phase adjustment (React-endorsed for prop-driven resets): when
  // advancing becomes impossible — last item reached, or a video starts
  // playing — stop the slideshow without a set-state-in-effect pass.
  if (canAdvance !== prevCanAdvance) {
    setPrevCanAdvance(canAdvance);
    if (!canAdvance) setIsPlaying(false);
  }

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    if (!isPlaying || !canAdvance) return;
    const id = setInterval(() => onAdvanceRef.current(), SLIDESHOW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, canAdvance]);

  const toggle = useCallback(() => {
    if (!canAdvance) return;
    setIsPlaying(v => !v);
  }, [canAdvance]);

  return [isPlaying, toggle];
}
