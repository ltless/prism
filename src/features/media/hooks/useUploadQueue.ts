"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  RateLimitError,
  StatusPoller,
  checkAIStatus,
  checkTranscodeStatus,
  uploadFile,
} from "./uploadApi";

import type { UploadResult } from "./uploadTypes";

const POLL_INTERVAL = 2000;
const MAX_POLLS = 30;

export function useUploadQueue() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<File[][]>([]);
  const isProcessingRef = useRef(false);
  const processRef = useRef<() => void>(undefined);
  const pendingMediaIdsRef = useRef<string[]>([]);
  const pendingTranscodeIdsRef = useRef<string[]>([]);
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const pollersRef = useRef<StatusPoller<unknown>[]>([]);
  const cancelledRef = useRef(false);
  const rateLimitWaitRef = useRef<(() => void) | null>(null);

  const stopPollers = useCallback(() => {
    pollersRef.current.forEach(p => p.stop());
    pollersRef.current = [];
  }, []);

  const startPolling = useCallback(
    <T,>(ids: string[], checkFn: (ids: string[]) => Promise<Record<string, T>>, isDone: (s: T) => boolean) => {
      const poller = new StatusPoller<T>(ids, checkFn, isDone, {
        interval: POLL_INTERVAL,
        maxPolls: MAX_POLLS,
        onSettled: () => router.refresh(),
        shouldStop: () => cancelledRef.current,
      });
      pollersRef.current.push(poller as StatusPoller<unknown>);
      poller.start();
    },
    [router],
  );

  const reportResult = useCallback((result: UploadResult) => {
    setUploadResult(result);
    setTimeout(() => setUploadResult(null), 5000);
  }, []);

  const processQueue = useCallback(async () => {
    if (uploadQueueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsUploading(false);
      return;
    }

    isProcessingRef.current = true;
    cancelledRef.current = false;
    setIsUploading(true);
    setUploadResult(null);

    const currentBatch = uploadQueueRef.current.shift();
    if (!currentBatch) {
      setIsUploading(false);
      isProcessingRef.current = false;
      return;
    }
    setWaitingCount(prev => Math.max(0, prev - currentBatch.length));

    let completed = 0;
    let failed = 0;
    let duplicatesFound = 0;
    let lastErrorMessage = "";
    const totalFiles = currentBatch.length;

    for (const file of currentBatch) {
      if (cancelledRef.current) break;
      try {
        const response = await uploadFile(
          file,
          fileProgress =>
            setUploadProgress((((completed + failed) * 100) + fileProgress) / totalFiles),
          xhr => { currentXhrRef.current = xhr; },
        );
        if (response.aiStatus === "pending" && response.mediaId) {
          pendingMediaIdsRef.current.push(response.mediaId);
        }
        if (response.transcodeStatus === "pending" && response.mediaId) {
          pendingTranscodeIdsRef.current.push(response.mediaId);
        }
        if (response.isDuplicate) duplicatesFound++;
        completed++;
        setUploadProgress(((completed + failed) / totalFiles) * 100);
      } catch (error: unknown) {
        if (cancelledRef.current) break;
        if (error instanceof RateLimitError) {
          // Rate limited — wait out the window, then resume with this same
          // file. The server sends Retry-After; the default covers older
          // responses without the header.
          const remaining = totalFiles - completed - failed;
          reportResult({
            success: false,
            message: `Rate limited. Waiting ${error.retryAfterSeconds}s to resume ${remaining} file${remaining !== 1 ? "s" : ""}...`,
            successCount: completed,
            errorCount: failed,
          });
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, error.retryAfterSeconds * 1000);
            rateLimitWaitRef.current = () => { clearTimeout(timer); resolve(); };
          });
          rateLimitWaitRef.current = null;
          if (cancelledRef.current) break;
          // Re-queue the rest of the batch, including this file.
          const idx = currentBatch.indexOf(file);
          const remainingFiles = currentBatch.slice(idx);
          uploadQueueRef.current.unshift(remainingFiles);
          setWaitingCount(prev => prev + remainingFiles.length);
          break;
        }
        failed++;
        lastErrorMessage = error instanceof Error ? error.message : "Upload failed";
        setUploadProgress(((completed + failed) / totalFiles) * 100);
      }
    }

    if (cancelledRef.current) {
      setIsUploading(false);
      isProcessingRef.current = false;
      uploadQueueRef.current = [];
      setWaitingCount(0);
      setUploadResult({ success: false, message: "Upload cancelled", successCount: completed, errorCount: failed });
      return;
    }

    router.refresh();

    if (pendingMediaIdsRef.current.length > 0) {
      startPolling([...pendingMediaIdsRef.current], checkAIStatus, s => s.done);
      pendingMediaIdsRef.current = [];
    }
    if (pendingTranscodeIdsRef.current.length > 0) {
      startPolling(
        [...pendingTranscodeIdsRef.current],
        checkTranscodeStatus,
        s => s.status === "done" || s.status === "failed",
      );
      pendingTranscodeIdsRef.current = [];
    }

    if (uploadQueueRef.current.length > 0) {
      processRef.current?.();
      return;
    }

    if (failed > 0) {
      reportResult({
        success: false,
        message: completed === 0
          ? (totalFiles === 1 ? `Upload failed: ${lastErrorMessage}` : `All uploads failed (${failed} files)`)
          : `${completed} uploaded successfully, ${failed} failed to upload`,
        successCount: completed,
        errorCount: failed,
      });
    } else {
      reportResult({
        success: true,
        message: duplicatesFound > 0
          ? `Completed with ${duplicatesFound} duplicates detected`
          : "All uploads completed successfully",
        successCount: completed,
        errorCount: 0,
      });
    }
    setIsUploading(false);
    isProcessingRef.current = false;

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [router, startPolling, reportResult]);

  useEffect(() => {
    processRef.current = processQueue;
  }, [processQueue]);

  // Clean up pollers and abort in-flight upload on unmount.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      rateLimitWaitRef.current?.();
      if (currentXhrRef.current) currentXhrRef.current.abort();
      stopPollers();
    };
  }, [stopPollers]);

  const startUpload = useCallback((files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    uploadQueueRef.current.push(fileArray);
    setWaitingCount(prev => prev + fileArray.length);
    if (!isProcessingRef.current) processRef.current?.();
  }, []);

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true;
    rateLimitWaitRef.current?.();
    if (currentXhrRef.current) currentXhrRef.current.abort();
    stopPollers();
    uploadQueueRef.current = [];
    setWaitingCount(0);
  }, [stopPollers]);

  return {
    isUploading,
    uploadProgress,
    uploadResult,
    waitingCount,
    fileInputRef,
    startUpload,
    setUploadResult,
    cancelUpload,
  };
}
