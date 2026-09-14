"use client";

import { useState, useEffect, useRef, useCallback, useEffectEvent } from "react";

interface UseLightboxStateArgs {
  isVideo: boolean;
  isInfoOpen: boolean;
  onClose: () => void;
  onToggleInfo: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

/**
 * Lightbox UI state: mobile detection, auto-hiding controls (3s timer),
 * keyboard navigation (Esc/arrows/i) and swipe navigation. Extracted from
 * Lightbox.tsx (F13) — pure move, no behavior change.
 */
export function useLightboxState({ isVideo, isInfoOpen, onClose, onToggleInfo, onNext, onPrev }: UseLightboxStateArgs) {
  const [isMobile, setIsMobile] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!isInfoOpen) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isInfoOpen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    scheduleHideControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scheduleHideControls]);

  const onKeyAction = useEffectEvent((e: KeyboardEvent) => {
    const active = document.activeElement;
    const isInInput = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
    if (isInInput) {
      if (e.key === "Escape") onClose();
      return;
    }
    if (e.key === "Escape") {
      if (isInfoOpen) {
        onToggleInfo();
        return;
      }
      onClose();
    }
    if (isInfoOpen) return;
    if (isVideo) return;
    if (e.key === "ArrowRight" && onNext) onNext();
    if (e.key === "ArrowLeft" && onPrev) onPrev();
    if (e.key === "i" || e.key === "I") onToggleInfo();
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => onKeyAction(e);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Swipe navigation
  const swipeState = useRef<{ startX: number; startY: number } | null>(null);
  const SWIPE_THRESHOLD = 30;

  const handleTouchStart = (e: React.TouchEvent) => {
    showControls();
    if (isVideo) return;
    const touch = e.touches[0];
    swipeState.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.current || isVideo) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - swipeState.current.startX;
    const diffY = Math.abs(touch.clientY - swipeState.current.startY);
    if (diffY > Math.abs(diffX)) {
      swipeState.current = null;
      return;
    }
    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
      if (diffX > 0 && onPrev) onPrev();
      else if (diffX < 0 && onNext) onNext();
      swipeState.current = null;
    }
  };

  const handleTouchEnd = () => {
    swipeState.current = null;
  };

  return {
    isMobile,
    controlsVisible,
    showControls,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
