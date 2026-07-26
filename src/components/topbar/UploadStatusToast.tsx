"use client";

import { motion, AnimatePresence } from "framer-motion";
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
 ? "border-primary/30"
 : uploadResult?.success
 ? "border-emerald-500/30"
 : isPartial
 ? "border-amber-500/30"
 : "border-rose-500/30";

 const iconBgClass = isUploading
 ? "bg-primary/10 text-primary"
 : uploadResult?.success
 ? "bg-emerald-500/10 text-emerald-500"
 : isPartial
 ? "bg-amber-500/10 text-amber-500"
 : "bg-rose-500/10 text-rose-500";

 const headerText = isUploading
 ? "Processing Batch"
 : uploadResult?.success
 ? "All Done"
 : isPartial
 ? "Partial Success"
 : "Upload Failed";

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-toast w-[calc(100vw-2rem)] md:w-80 flex flex-col items-end gap-2"
      >
        {waitingCount > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.9 }}
            className="bg-primary/90 text-primary-foreground text-[11px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-white/20"
          >
            <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
            {waitingCount} Items in queue
          </motion.div>
        )}

        <div className={cn(
          "w-full p-3 rounded-2xl border shadow-lg flex flex-col gap-3 bg-panel-bg/90 overflow-hidden relative",
          borderClass
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5",
              iconBgClass
            )}>
              {isUploading ? <Spinner size={20} weight="bold" className="animate-spin" /> : uploadResult?.success ? <CheckCircle size={20} weight="fill" /> : <Warning size={20} weight="fill" />}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs text-main-text">
                {headerText}
              </p>
              <p className="text-[11px] font-bold text-muted-text mt-1 uppercase tracking-normal leading-relaxed break-words whitespace-normal">
                {isUploading ? `${Math.round(uploadProgress)}% Completed` : uploadResult?.message}
              </p>
            </div>
            {!isUploading && (
              <button onClick={onDismiss} className="p-1.5 hover:bg-surface-bg rounded-xl text-muted-text cursor-pointer self-start -mt-1">
                <X size={12} weight="light" />
              </button>
            )}
          </div>

          {isUploading && (
            <div className="h-1.5 w-full bg-surface-bg rounded-full overflow-hidden">
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: uploadProgress / 100 }}
                className="h-full bg-primary rounded-full origin-left" transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
