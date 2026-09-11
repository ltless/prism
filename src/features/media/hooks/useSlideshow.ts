import { useEffect, useRef, useState, useCallback } from "react";

export const SLIDESHOW_INTERVAL_MS = 4000;

/**
 * Auto-advance timer for the lightbox slideshow.
 * Returns [isPlaying, toggle]. Pause when `canAdvance` is false
 * (e.g. last item reached or a video is playing).
 */
export function useSlideshow(canAdvance: boolean, onAdvance: () => void): [boolean, () => void] {
  const [isPlaying, setIsPlaying] = useState(false);
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    if (!isPlaying || !canAdvance) return;
    const id = setInterval(() => onAdvanceRef.current(), SLIDESHOW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, canAdvance]);

  const toggle = useCallback(() => setIsPlaying(v => !v), []);

  // Stop at the end of the list
  useEffect(() => {
    if (isPlaying && !canAdvance) setIsPlaying(false);
  }, [isPlaying, canAdvance]);

  return [isPlaying, toggle];
}
