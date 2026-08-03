"use client";

import { useState } from "react";
import { Lightning, Spinner, Warning, X } from "@phosphor-icons/react";
import { nukeLibraryAction } from "../services/mediaCrud";
import { m, AnimatePresence } from "motion/react";
import { SECURITY } from "@/core/constants";
import { toast } from "sonner";

export function NukeButton({ disabled }: { disabled: boolean }) {
 const [isConfirming, setIsConfirming] = useState(false);
 const [isNuking, setIsNuking] = useState(false);

 if (!SECURITY.NUKE_CONFIRMATION_TOKEN) return null;

 const handleNuke = async () => {
 setIsNuking(true);
 try {
 const res = await nukeLibraryAction(SECURITY.NUKE_CONFIRMATION_TOKEN);
 if (res.success) {
 setIsConfirming(false);
 toast.success("Library nuked. It's over, you monster.");
 } else {
 toast.error("Nuke failed: " + res.error);
 }
 } catch {
 toast.error("Nuke failed unexpectedly");
 } finally {
 setIsNuking(false);
 }
 };

 return (
 <div className="relative">
 <button
 type="button"
 onClick={() => setIsConfirming(true)}
 disabled={disabled || isConfirming || isNuking}
 className="group w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-xs transition-colors duration-300 ease-out-expo disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
 >
 <Lightning size={14} weight="light" className="group-hover:animate-pulse" />
 Nuke Entire Library
 </button>

 {/* Confirmation Popover */}
 <AnimatePresence>
 {isConfirming && (
 <m.div
 initial={{ opacity: 0, y: 10, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 10, scale: 0.95 }}
 className="absolute bottom-full mb-3 right-0 w-72 max-w-[calc(100vw-2rem)] md:w-72 bg-panel-bg border border-rose-500/30 shadow-2xl rounded-2xl p-4 z-50 overflow-hidden"
 >
 <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />
 <div className="relative flex items-start gap-3">
 <div className="p-2 bg-rose-500/20 text-rose-500 rounded-xl">
 <Warning size={20} weight="light" />
 </div>
 <div className="flex-1">
 <h4 className="text-[11px] text-main-text mb-1">TOTAL ANNIHILATION</h4>
 <p className="text-[11px] font-bold text-rose-500/80 mb-4 leading-relaxed">
 This will PERMANENTLY DELETE every single photo and video in your library. This action cannot be undone. You will lose everything.
 </p>
 <div className="flex items-center gap-2">
 <button 
 type="button"
 onClick={handleNuke}
 disabled={isNuking}
 className="flex-1 bg-rose-500 text-white text-[11px] py-2 rounded-xl hover:bg-rose-600 transition-colors ease-out-expo flex items-center justify-center gap-2 cursor-pointer"
 >
 {isNuking ? <Spinner size={12} weight="light" className="animate-spin" /> : "Confirm Nuke"}
 </button>
 <button 
 type="button"
 onClick={() => setIsConfirming(false)}
 disabled={isNuking}
 className="p-2 bg-surface-bg text-muted-text rounded-xl hover:bg-main-border hover:text-main-text transition-colors ease-out-expo cursor-pointer"
 >
 <X size={14} weight="light" />
 </button>
 </div>
 </div>
 </div>
 </m.div>
 )}
 </AnimatePresence>
 </div>
 );
}