"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UploadResult {
 success: boolean;
 message: string;
 successCount?: number;
 errorCount?: number;
}

const POLL_INTERVAL = 2000;
const MAX_POLLS = 30;

async function checkAIStatus(mediaIds: string[]): Promise<Record<string, { done: boolean; hasTags: boolean }>> {
 try {
  const res = await fetch("/api/v1/media/batch/ai-status", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ids: mediaIds }),
  });
 if (!res.ok) return {};
 const data = await res.json();
 return data.statuses || {};
 } catch {
 return {};
 }
}

async function checkTranscodeStatus(mediaIds: string[]): Promise<Record<string, { status: string | null; duration: number | null }>> {
 try {
  const res = await fetch("/api/v1/media/batch/transcode-status", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ids: mediaIds }),
  });
 if (!res.ok) return {};
 const data = await res.json();
 return data.statuses || {};
 } catch {
 return {};
 }
}

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
  const pollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelledRef = useRef(false);

  const clearPollTimers = useCallback(() => {
    pollTimersRef.current.forEach(t => clearTimeout(t));
    pollTimersRef.current = [];
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
  if (!currentBatch) return;
  setWaitingCount(prev => Math.max(0, prev - currentBatch.length));

  let completed = 0;
  let failed = 0;
  let duplicatesFound = 0;
  let lastErrorMessage = "";
  const totalFiles = currentBatch.length;

  for (let i = 0; i < totalFiles; i++) {
  if (cancelledRef.current) break;
  const file = currentBatch[i];
  const formData = new FormData();
  formData.append("file", file);

  try {
  await new Promise<void>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  currentXhrRef.current = xhr;
  xhr.open("POST", "/api/v1/media", true);
  xhr.upload.onprogress = (event) => {
  if (event.lengthComputable) {
  const fileProgress = (event.loaded / event.total) * 100;
  setUploadProgress((((completed + failed) * 100) + fileProgress) / totalFiles);
  }
  };
  xhr.onload = () => {
  currentXhrRef.current = null;
  if (xhr.status >= 200 && xhr.status < 300) {
  const response = JSON.parse(xhr.responseText);
  if (response.success) {
  if (response.aiStatus === "pending" && response.mediaId) {
  pendingMediaIdsRef.current.push(response.mediaId);
  }
  if (response.transcodeStatus === "pending" && response.mediaId) {
  pendingTranscodeIdsRef.current.push(response.mediaId);
  }
  if (response.isDuplicate) duplicatesFound++;
  completed++;
  setUploadProgress(((completed + failed) / totalFiles) * 100);
  resolve();
  } else {
  reject(new Error(response.error || "Upload failed"));
  }
  } else {
  // 429 = rate limited. Stop trying — every remaining file will also 429.
  if (xhr.status === 429) {
  const retryAfter = xhr.getResponseHeader("Retry-After");
  const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
  reject(new Error(`RATE_LIMITED:${seconds}`));
  } else {
  reject(new Error(`HTTP Error: ${xhr.status}`));
  }
  }
  };
  xhr.onerror = () => {
  currentXhrRef.current = null;
  reject(new Error("Network error"));
  };
  xhr.onabort = () => {
  currentXhrRef.current = null;
  reject(new Error("Upload cancelled"));
  };
  xhr.send(formData);
  });
  } catch (error: unknown) {
  if (cancelledRef.current) break;
  const msg = error instanceof Error ? error.message : "Upload failed";
  // Rate limited — stop the loop. Every remaining file will also 429.
  if (msg.startsWith("RATE_LIMITED:")) {
  const seconds = parseInt(msg.split(":")[1] || "60", 10);
  lastErrorMessage = `Rate limited. ${completed} uploaded, ${totalFiles - completed - failed} remaining. Retry in ${seconds}s.`;
  failed = totalFiles - completed;
  break;
  }
  failed++;
  lastErrorMessage = msg;
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

  function startPolling<T>(
  ids: string[],
  checkFn: (ids: string[]) => Promise<Record<string, T>>,
  isDone: (s: T) => boolean,
  ) {
  let polls = 0;
  const poll = async () => {
  if (polls >= MAX_POLLS || cancelledRef.current) {
  if (!cancelledRef.current) router.refresh();
  return;
  }
  polls++;
  const statuses = await checkFn(ids);
  const hasStatuses = Object.keys(statuses).length > 0;
  if (hasStatuses && Object.values(statuses).every(isDone)) {
  router.refresh();
  } else {
  pollTimersRef.current.push(setTimeout(poll, POLL_INTERVAL));
  }
  };
  pollTimersRef.current.push(setTimeout(poll, POLL_INTERVAL));
  }

  if (pendingMediaIdsRef.current.length > 0) {
  startPolling([...pendingMediaIdsRef.current], checkAIStatus, s => s.done);
  pendingMediaIdsRef.current = [];
  }

  if (pendingTranscodeIdsRef.current.length > 0) {
  startPolling([...pendingTranscodeIdsRef.current], checkTranscodeStatus, s => s.status === "done" || s.status === "failed");
  pendingTranscodeIdsRef.current = [];
  }

  if (uploadQueueRef.current.length > 0) {
  processRef.current?.();
  } else {
  if (failed > 0) {
  if (completed === 0) {
  setUploadResult({
  success: false,
  message: totalFiles === 1
  ? `Upload failed: ${lastErrorMessage}`
  : `All uploads failed (${failed} files)`,
  successCount: 0,
  errorCount: failed,
  });
  } else {
  setUploadResult({
  success: false,
  message: `${completed} uploaded successfully, ${failed} failed to upload`,
  successCount: completed,
  errorCount: failed,
  });
  }
  } else {
  setUploadResult({
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
  setTimeout(() => setUploadResult(null), 5000);
  }

  if (fileInputRef.current) fileInputRef.current.value = "";
  }, [router]);

  useEffect(() => {
    processRef.current = processQueue;
  }, [processQueue]);

  // Clean up timers and abort in-flight upload on unmount.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (currentXhrRef.current) currentXhrRef.current.abort();
      pollTimersRef.current.forEach(t => clearTimeout(t));
      pollTimersRef.current = [];
    };
  }, []);

  const startUpload = useCallback((files: FileList | File[]) => {
  if (!files || files.length === 0) return;
  const fileArray = Array.from(files);
  uploadQueueRef.current.push(fileArray);
  setWaitingCount(prev => prev + fileArray.length);
  if (!isProcessingRef.current) processRef.current?.();
  }, []);

  const cancelUpload = useCallback(() => {
  cancelledRef.current = true;
  if (currentXhrRef.current) currentXhrRef.current.abort();
  clearPollTimers();
  uploadQueueRef.current = [];
  setWaitingCount(0);
  }, [clearPollTimers]);

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
