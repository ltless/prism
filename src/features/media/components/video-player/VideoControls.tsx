"use client";

import { useRef } from "react";
import { Play, Pause, SpeakerSimpleHigh, SpeakerSimpleX, ArrowsOut, ArrowsIn } from "@phosphor-icons/react";
import { m } from "motion/react";
import { cn } from "@/core/utils/cn";

interface VideoControlsProps {
  playback: { playing: boolean; muted: boolean; fullscreen: boolean };
  showControls: boolean;
  isDraggingProgress: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  progressPercent: number;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProgressMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

function formatTime(time: number) {
  if (isNaN(time)) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function VideoControls({
  playback, showControls, isDraggingProgress,
  volume, currentTime, duration, bufferedPercent, progressPercent,
  progressBarRef, onTogglePlay, onToggleMute, onToggleFullscreen,
  onVolumeChange, onProgressMouseDown,
}: VideoControlsProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-2xl bg-panel-bg border border-main-border/30 rounded-xl shadow-sm p-4 flex flex-col gap-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Custom Scrub Progress Bar */}
      <div
        ref={progressBarRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        onMouseDown={onProgressMouseDown}
        className="h-3 py-1 cursor-pointer group/progress relative w-full flex items-center"
      >
        {/* Timeline Track */}
        <div className="h-1 w-full rounded-full bg-surface-bg group-hover/progress:h-1.5 transition-[height] relative overflow-hidden">
          {/* Buffered track */}
          <div
            className="h-full bg-zinc-700/50 absolute left-0 top-0 transition-[width] duration-300"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Elapsed time progress */}
          <div
            className="h-full bg-main-text rounded-full absolute left-0 top-0"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Playback Scrub Knob */}
        <div
          className={cn(
            "w-3 h-3 rounded-full bg-main-text absolute transition-[opacity,transform] shadow border border-panel-bg",
            isDraggingProgress ? "opacity-100 scale-110" : "opacity-0 group-hover/progress:opacity-100"
          )}
          style={{
            left: `calc(${progressPercent}% - 6px)`,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Bottom Buttons Row */}
      <div className="flex items-center justify-between text-muted-text">
        {/* Left Side: Play/Pause, Volume, Timer */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playback.playing ? "Pause" : "Play"}
            className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-colors ease-out-expo cursor-pointer"
          >
            {playback.playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="ml-0.5" />}
          </button>

          {/* Volume Section */}
          <div className="flex items-center gap-2 group/volume">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={playback.muted || volume === 0 ? "Unmute" : "Mute"}
              className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-colors ease-out-expo cursor-pointer"
            >
              {playback.muted || volume === 0 ? <SpeakerSimpleX size={16} weight="light" /> : <SpeakerSimpleHigh size={16} weight="light" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={playback.muted ? 0 : volume}
              onChange={onVolumeChange}
              aria-label="Volume"
              className="w-0 opacity-0 pointer-events-none group-hover/volume:w-16 group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto h-1 bg-surface-bg accent-main-text rounded-lg appearance-none cursor-pointer transition-[width,opacity] duration-200 outline-none"
            />
          </div>

          {/* Duration Timer Text */}
          <span className="text-xs font-mono font-bold tracking-tight select-none tabular-nums text-muted-text/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right Side: Fullscreen toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={playback.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-colors ease-out-expo cursor-pointer"
        >
          {playback.fullscreen ? <ArrowsIn size={16} weight="light" /> : <ArrowsOut size={16} weight="light" />}
        </button>
      </div>
    </m.div>
  );
}
