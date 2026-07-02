"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Warning, X } from "@phosphor-icons/react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useScrollLock } from "../hooks/useScrollLock";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface ConfirmModalProps {
 isOpen: boolean;
 title: string;
 message: string;
 confirmLabel?: string;
 cancelLabel?: string;
 onConfirm: () => void;
 onCancel: () => void;
}

export function ConfirmModal({
 isOpen,
 title,
 message,
 confirmLabel = "Confirm",
 cancelLabel = "Cancel",
 onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  useScrollLock(isOpen);
  const reduced = useReducedMotion();

  return (
  <AnimatePresence>
  {isOpen && (
  <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="fixed inset-0 z-modal flex items-center justify-center p-4">
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  onClick={onCancel}
  className="absolute inset-0 bg-black/60"
  />

  <motion.div
  initial={{ scale: reduced ? 1 : 0.95, opacity: 0, y: reduced ? 0 : 10 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: reduced ? 1 : 0.95, opacity: 0, y: reduced ? 0 : 10 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  className="relative w-full max-w-sm bg-panel-bg rounded-2xl border border-main-border shadow-xl overflow-hidden flex flex-col p-6 z-10"
 >
 <div className="flex items-center justify-between border-b border-main-border/50 pb-4 mb-4">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
 <Warning size={16} weight="fill" />
 </div>
 <h3 id="confirm-modal-title" className="text-xs text-main-text">
 {title}
 </h3>
 </div>
 <button
 type="button"
 onClick={onCancel}
 className="p-1 hover:bg-surface-bg rounded-xl text-muted-text hover:text-main-text transition-colors ease-out-expo cursor-pointer "
 >
 <X size={16} weight="light" />
 </button>
 </div>

 <p className="text-xs font-medium text-muted-text leading-relaxed mb-6 whitespace-normal">
 {message}
 </p>

 <div className="flex gap-3">
 <button
 type="button"
 onClick={onCancel}
 className="flex-1 py-2.5 rounded-xl bg-surface-bg border border-main-border text-main-text text-[11px] hover:border-muted-text/30 transition-all ease-out-expo cursor-pointer "
 >
 {cancelLabel}
 </button>
 <button
 type="button"
 onClick={onConfirm}
 className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-[11px] hover:bg-rose-600 transition-all ease-out-expo flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/20 "
 >
 {confirmLabel}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
}
