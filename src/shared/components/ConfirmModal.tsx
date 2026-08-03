"use client";

import { useRef } from "react";
import { m, AnimatePresence } from "motion/react";
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
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.15 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/50"
          />

          <m.div
            initial={{ scale: reduced ? 1 : 0.97, opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: reduced ? 1 : 0.97, opacity: 0, y: reduced ? 0 : 6 }}
            transition={{ duration: reduced ? 0 : 0.15 }}
            className="relative w-full max-w-sm bg-panel-bg rounded border border-main-border/50 shadow-modal overflow-hidden flex flex-col p-5 z-10"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-rose-500/8 flex items-center justify-center text-rose-500">
                  <Warning size={14} weight="fill" />
                </div>
                <h3 id="confirm-modal-title" className="text-[12px] font-medium text-main-text">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="p-1 hover:bg-surface-bg rounded text-muted-text hover:text-main-text transition-colors cursor-pointer"
              >
                <X size={12} weight="light" />
              </button>
            </div>

            <p className="text-[11px] text-muted-text leading-relaxed mb-5 whitespace-normal">
              {message}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 rounded bg-surface-bg border border-main-border/50 text-main-text text-[11px] font-medium hover:border-muted-text/20 transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-2 rounded bg-rose-500 text-white text-[11px] font-medium hover:bg-rose-600 active:scale-[0.98] transition-[background-color,transform] cursor-pointer"
              >
                {confirmLabel}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
