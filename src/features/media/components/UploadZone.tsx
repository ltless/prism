"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/core/utils/cn";

interface UploadZoneProps {
 children: React.ReactNode;
 className?: string;
}

export function UploadZone({ children, className }: UploadZoneProps) {
 const [isDragging, setIsDragging] = useState(false);
 const dragCounter = useRef(0);

 const handleDragEnter = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 // Only show upload UI if dragging files from outside
 if (!e.dataTransfer.types.includes("Files")) return;
 
 dragCounter.current += 1;
 if (dragCounter.current === 1) {
   setIsDragging(true);
 }
 }, []);

 const handleDragLeave = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 dragCounter.current -= 1;
 if (dragCounter.current <= 0) {
   dragCounter.current = 0;
   setIsDragging(false);
 }
 }, []);

 const handleDragOver = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 }, []);

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 dragCounter.current = 0;
 
 const files = Array.from(e.dataTransfer.files);
 if (files.length > 0) {
 // Dispatch global upload event to be handled by TopBar
 window.dispatchEvent(new CustomEvent('prism-upload', { 
 detail: { files } 
 }));
 }
 }, []);

 return (
 <div
 onDragEnter={handleDragEnter}
 onDragLeave={handleDragLeave}
 onDragOver={handleDragOver}
 onDrop={handleDrop}
 className={cn("relative group/upload-zone min-h-[300px] flex-1", className)}
 >
 {children}

 <AnimatePresence>
 {isDragging && (
 <motion.div
 key="overlay"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="absolute inset-0 z-[100] bg-panel-bg/85 rounded-xl border-2 border-dashed border-primary/20 flex items-center justify-center pointer-events-none"
 >
 <motion.div
 initial={{ scale: 0.9, y: 10 }}
 animate={{ scale: 1, y: 0 }}
 className="px-8 py-6 bg-panel-bg border border-main-border/30 rounded-xl shadow-sm flex flex-col items-center gap-3"
 >
 <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
 <ArrowUp size={20} weight="light" />
 </div>
 <div className="text-center">
 <h3 className="text-xs text-main-text">Drop to Upload</h3>
 <p className="text-[11px] font-bold text-muted-text mt-1 opacity-50">Release to add items</p>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}