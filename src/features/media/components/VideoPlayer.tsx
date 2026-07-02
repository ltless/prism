"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SpeakerSimpleHigh, SpeakerSimpleX, ArrowsOut, ArrowsIn, Spinner } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/core/utils/cn";

interface VideoPlayerProps {
 src: string;
 autoPlay?: boolean;
 className?: string;
}

export function VideoPlayer({ src, autoPlay = true, className }: VideoPlayerProps) {
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

 // Auto-hide controls when mouse is idle
 const handleMouseMove = () => {
 setShowControls(true);
 if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

 if (isPlaying && !isDraggingProgress) {
 controlsTimeoutRef.current = setTimeout(() => {
 setShowControls(false);
 }, 2500);
 }
 };

 useEffect(() => {
 requestAnimationFrame(() => {
 if (isPlaying && !isDraggingProgress) {
 if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
 controlsTimeoutRef.current = setTimeout(() => {
 setShowControls(false);
 }, 2500);
 } else {
 setShowControls(true);
 if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
 }
 });
 return () => {
 if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
 };
 }, [isPlaying, isDraggingProgress]);

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

 // Keyboard listeners
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
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
 };

 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [duration, isMuted, volume, togglePlay, toggleFullscreen, toggleMute]);

 // Format Helper
 const formatTime = (time: number) => {
 if (isNaN(time)) return "00:00";
 const minutes = Math.floor(time / 60);
 const seconds = Math.floor(time % 60);
 return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
 };

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
 <motion.div
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
 </motion.div>
 )}
 </AnimatePresence>

 {/* Controls Overlay Panel */}
 <AnimatePresence>
 {(showControls || isDraggingProgress) && (
 <motion.div
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
 onMouseDown={handleProgressMouseDown}
 className="h-3 py-1 cursor-pointer group/progress relative w-full flex items-center"
 >
 {/* Timeline Track */}
 <div className="h-1 w-full rounded-full bg-surface-bg group-hover/progress:h-1.5 transition-all relative overflow-hidden">
 {/* Buffered track */}
 <div
 className="h-full bg-zinc-700/50 absolute left-0 top-0 transition-all duration-300"
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
 "w-3 h-3 rounded-full bg-main-text absolute transition-all shadow border border-panel-bg",
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
 onClick={togglePlay}
 className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-all ease-out-expo cursor-pointer"
 >
 {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="ml-0.5" />}
 </button>

 {/* Volume Section */}
 <div className="flex items-center gap-2 group/volume">
 <button
 onClick={toggleMute}
 className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-all ease-out-expo cursor-pointer"
 >
 {isMuted || volume === 0 ? <SpeakerSimpleX size={16} weight="light" /> : <SpeakerSimpleHigh size={16} weight="light" />}
 </button>
 <input
 type="range"
 min="0"
 max="1"
 step="0.05"
 value={isMuted ? 0 : volume}
 onChange={handleVolumeChange}
 className="w-0 opacity-0 pointer-events-none group-hover/volume:w-16 group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto h-1 bg-surface-bg accent-main-text rounded-lg appearance-none cursor-pointer transition-all duration-200 outline-none"
 />
 </div>

 {/* Duration Timer Text */}
 <span className="text-xs font-mono font-bold tracking-tight select-none tabular-nums text-muted-text/80">
 {formatTime(currentTime)} / {formatTime(duration)}
 </span>
 </div>

 {/* Right Side: Fullscreen toggle */}
 <button
 onClick={toggleFullscreen}
 className="p-1.5 hover:text-main-text hover:bg-surface-bg rounded-lg transition-all ease-out-expo cursor-pointer"
 >
 {isFullscreen ? <ArrowsIn size={16} weight="light" /> : <ArrowsOut size={16} weight="light" />}
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}