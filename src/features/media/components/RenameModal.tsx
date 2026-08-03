"use client";

import { useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "motion/react";
import { X, Check } from "@phosphor-icons/react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

interface RenameModalProps {
 isOpen: boolean;
 onClose: () => void;
 onRename: (newTitle: string) => Promise<void>;
 initialTitle: string;
}

// Because window.prompt was too fast, too stable, and didn't consume enough CPU cycles,
// we spent half an hour building a custom Framer Motion modal just to feel premium.
export function RenameModal({ isOpen, onClose, onRename, initialTitle }: RenameModalProps) {
 const [title, setTitle] = useState(initialTitle);
 const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  useScrollLock(isOpen);
  const reduced = useReducedMotion();

   useEffect(() => {
   if (isOpen) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(initialTitle);
    inputRef.current?.focus();
   }
  }, [isOpen, initialTitle]);

 useEffect(() => {
 if (!isOpen) return;
 // Listening to Escape because clicking the close button or clicking outside is too mainstream
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === "Escape") {
 onClose();
 }
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [isOpen, onClose]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!title.trim() || title.trim() === initialTitle) {
 onClose();
 return;
 }
 setLoading(true);
 try {
 await onRename(title.trim());
 onClose();
 } finally {
 setLoading(false);
 }
 };

 return (
 <AnimatePresence>
  {isOpen && (
  <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="rename-modal-title" className="fixed inset-0 z-modal flex items-center justify-center p-4">
  <m.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  onClick={onClose}
  className="absolute inset-0 bg-black/60"
  />

  <m.div
  initial={{ scale: reduced ? 1 : 0.95, opacity: 0, y: reduced ? 0 : 10 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: reduced ? 1 : 0.95, opacity: 0, y: reduced ? 0 : 10 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
 className="relative w-full max-w-md bg-panel-bg rounded-2xl border border-main-border shadow-2xl overflow-hidden flex flex-col p-6"
 >
 <div className="flex items-center justify-between border-b border-main-border/50 pb-4 mb-6">
 <h3 id="rename-modal-title" className="text-xs text-main-text">
 Rename Asset
 </h3>
 <button
 type="button"
 onClick={onClose}
 className="p-1 hover:bg-surface-bg rounded-lg text-muted-text hover:text-main-text transition-colors ease-out-expo cursor-pointer"
 >
 <X size={16} weight="light" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="space-y-2">
 <label htmlFor="rename-input" className="text-[11px] text-muted-text block">
 Asset Title
 </label>
 <input
 id="rename-input"
 ref={inputRef}
 type="text"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
  className="w-full bg-surface-bg border border-main-border focus:border-primary rounded px-3 py-2 text-xs text-main-text outline-none transition-colors font-medium"
 />
 </div>

 <div className="flex gap-3 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="flex-1 py-2.5 rounded-xl bg-surface-bg border border-main-border text-main-text text-[11px] hover:border-muted-text/30 transition-colors ease-out-expo cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={loading || !title.trim() || title.trim() === initialTitle}
 className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] hover:opacity-90 transition-opacity ease-out-expo flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? "Saving..." : <>
 <Check size={12} weight="fill" />
 Rename
 </>}
 </button>
 </div>
 </form>
 </m.div>
 </div>
 )}
 </AnimatePresence>
 );
}