"use client";

import { m, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { Spinner, CheckCircle, Warning, X } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

interface UploadStatusToastProps {
  isUploading: boolean;
  uploadProgress: number;
  uploadResult: {
    success: boolean;
    message: string;
    successCount?: number;
    errorCount?: number;
  } | null;
  waitingCount: number;
  onDismiss: () => void;
}

export function UploadStatusToast({ isUploading, uploadProgress, uploadResult, waitingCount, onDismiss }: UploadStatusToastProps) {
  const show = isUploading || uploadResult || waitingCount > 0;
  if (!show) return null;
  if (typeof window === "undefined") return null;

  const isPartial = uploadResult && !uploadResult.success && (uploadResult.successCount ?? 0) > 0;

  const borderClass = isUploading
    ? "border-primary/20"
    : uploadResult?.success
    ? "border-primary/20"
    : isPartial
    ? "border-amber-500/20"
    : "border-rose-500/20";

  const iconBgClass = isUploading
    ? "bg-primary/10 text-primary"
    : uploadResult?.success
    ? "bg-primary/10 text-primary"
    : isPartial
    ? "bg-amber-500/10 text-amber-500"
    : "bg-rose-500/10 text-rose-500";

  const headerText = isUploading
    ? "Processing"
    : uploadResult?.success
    ? "Done"
    : isPartial
    ? "Partial"
    : "Failed";

  return createPortal(
    <AnimatePresence mode="wait">
      <m.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-toast w-[calc(100vw-2rem)] md:w-72 flex flex-col items-end gap-1.5"
      >
        {waitingCount > 0 && (
          <m.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            className="bg-primary text-primary-foreground text-[10px] font-medium px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5"
          >
            <div className="w-1 h-1 bg-white/80 rounded-full animate-pulse" />
            {waitingCount} queued
          </m.div>
        )}

        <div className={cn(
          "w-full p-2.5 rounded-md border shadow-elevated flex flex-col gap-2 bg-panel-bg overflow-hidden relative",
          borderClass
        )}>
          <div className="flex items-start gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
              iconBgClass
            )}>
              {isUploading ? <Spinner size={16} weight="bold" className="animate-spin" /> : uploadResult?.success ? <CheckCircle size={16} weight="fill" /> : <Warning size={16} weight="fill" />}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-[11px] font-medium text-main-text">
                {headerText}
              </p>
              <p className="text-[10px] text-muted-text mt-0.5 leading-relaxed break-words whitespace-normal">
                {isUploading ? `${Math.round(uploadProgress)}%` : uploadResult?.message}
              </p>
            </div>
            {!isUploading && (
              <button type="button" onClick={onDismiss} aria-label="Dismiss" className="p-1 hover:bg-surface-bg rounded-md text-muted-text cursor-pointer self-start -mt-0.5">
                <X size={10} weight="light" />
              </button>
            )}
          </div>

          {isUploading && (
            <div className="h-1 w-full bg-surface-bg rounded-full overflow-hidden">
              <m.div initial={{ scaleX: 0 }} animate={{ scaleX: uploadProgress / 100 }}
                className="h-full bg-primary rounded-full origin-left" transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </m.div>
    </AnimatePresence>,
    document.body
  );
}
