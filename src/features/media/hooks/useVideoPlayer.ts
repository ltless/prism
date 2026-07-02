"use client";

import { useState, useRef, useEffect, useCallback, useEffectEvent } from "react";

/**
 * All playback state and actions for VideoPlayer: play/pause, seek, volume,
 * mute, fullscreen, buffering, keyboard shortcuts, auto-hide controls.
 * The component stays a thin JSX shell over this hook.
 */
export function useVideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [flashAction, setFlashAction] = useState<"play" | "pause" | null>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const hideControlsSoon = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  // Auto-hide controls when mouse is idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (isPlaying && !isDraggingProgress) hideControlsSoon();
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      if (isPlaying && !isDraggingProgress) {
        hideControlsSoon();
      } else {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
    });
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isDraggingProgress, hideControlsSoon]);

  // Video Event Handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      updateBufferedAmount();
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const updateBufferedAmount = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) return;
    const dur = video.duration;
    if (dur > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBufferedPercent((bufferedEnd / dur) * 100);
    }
  }, []);

  const handleWaiting = () => setIsLoading(true);
  const handlePlaying = () => setIsLoading(false);

  // Play/Pause Action
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setFlashAction("play");
    } else {
      videoRef.current.pause();
      setFlashAction("pause");
    }
    setTimeout(() => setFlashAction(null), 500);
  }, []);

  // Drag and Seek Progress
  const handleProgressMove = (clientX: number) => {
    if (!videoRef.current || !progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration === 0) return;
    setIsDraggingProgress(true);
    handleProgressMove(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleProgressMove(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Volume Action
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    videoRef.current.volume = newVol;
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    } else if (newVol === 0 && !isMuted) {
      setIsMuted(true);
      videoRef.current.muted = true;
    }
  };

  // Fullscreen Action
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const onKeyAction = useEffectEvent((e: KeyboardEvent) => {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      }
    }
  });

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => onKeyAction(e);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    // refs
    videoRef, containerRef, progressBarRef,
    // state
    isPlaying, currentTime, duration, volume, isMuted, isFullscreen,
    showControls, isLoading, flashAction, isDraggingProgress, bufferedPercent,
    setShowControls,
    // handlers
    handlePlay, handlePause, handleTimeUpdate, handleDurationChange,
    handleWaiting, handlePlaying, updateBufferedAmount,
    handleMouseMove, togglePlay, toggleMute, toggleFullscreen,
    handleVolumeChange, handleProgressMouseDown,
  };
}
