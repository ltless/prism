"use client";

import { Play, Pause, Spinner } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { cn } from "@/core/utils/cn";
import { VideoControls } from "./video-player/VideoControls";
import { useVideoPlayer } from "../hooks/useVideoPlayer";

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
}

export function VideoPlayer({ src, autoPlay = true, className }: VideoPlayerProps) {
  const player = useVideoPlayer();
  const {
    videoRef, containerRef, progressBarRef,
    isPlaying, currentTime, duration, volume, isMuted, isFullscreen,
    showControls, setShowControls, isLoading, flashAction, isDraggingProgress, bufferedPercent,
    handlePlay, handlePause, handleTimeUpdate, handleDurationChange,
    handleWaiting, handlePlaying, updateBufferedAmount,
    handleMouseMove, togglePlay, toggleMute, toggleFullscreen,
    handleVolumeChange, handleProgressMouseDown,
  } = player;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !isDraggingProgress && setShowControls(false)}
      className={cn(
        "relative flex items-center justify-center overflow-hidden w-full h-full group/player select-none rounded-xl bg-black",
        className,
        !showControls && isPlaying ? "cursor-none" : ""
      )}
    >
      {/* Actual HTML5 Video Tag */}
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onProgress={updateBufferedAmount}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="max-w-full max-h-full object-contain cursor-pointer"
        style={{ maxHeight: "90vh" }}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
          <Spinner size={36} weight="light" className="animate-spin text-white" />
        </div>
      )}

      {/* Center Overlay Flash Animations */}
      <AnimatePresence>
        {flashAction && (
          <m.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute z-20 w-16 h-16 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white pointer-events-none"
          >
            {flashAction === "play" ? (
              <Play size={24} weight="fill" className="ml-1" />
            ) : (
              <Pause size={24} weight="fill" />
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Controls Overlay Panel */}
      <AnimatePresence>
        {(showControls || isDraggingProgress) && (
          <VideoControls
            playback={{ playing: isPlaying, muted: isMuted, fullscreen: isFullscreen }}
            isDraggingProgress={isDraggingProgress}
            volume={volume}
            currentTime={currentTime}
            duration={duration}
            bufferedPercent={bufferedPercent}
            progressPercent={progressPercent}
            progressBarRef={progressBarRef}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onToggleFullscreen={toggleFullscreen}
            onVolumeChange={handleVolumeChange}
            onProgressMouseDown={handleProgressMouseDown}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
