"use client";

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Rate limited, retry in ${retryAfterSeconds}s`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface UploadResponse {
  success: boolean;
  mediaId?: string;
  aiStatus?: string;
  transcodeStatus?: string;
  isDuplicate?: boolean;
  error?: string;
}

// ponytail: no AbortSignal plumbing — onStart hands the xhr to the caller for abort.
export function uploadFile(
  file: File,
  onProgress: (percent: number) => void,
  onStart?: (xhr: XMLHttpRequest) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    onStart?.(xhr);
    xhr.open("POST", "/api/v1/media", true);
    // 2 minute timeout for large file uploads
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status === 429) {
        const retryAfter = xhr.getResponseHeader("Retry-After");
        reject(new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : 60));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP Error: ${xhr.status}`));
        return;
      }
      try {
        const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (response.success) resolve(response as UploadResponse);
        else reject(new Error(response.error || "Upload failed"));
      } catch {
        reject(new Error("Invalid server response"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.ontimeout = () => reject(new Error("Upload timeout - server took too long to respond"));
    xhr.send(formData);
  });
}

export type AIStatus = { done: boolean; hasTags: boolean };
export type TranscodeStatus = { status: string | null; duration: number | null };

async function postForStatuses<T>(url: string, ids: string[]): Promise<Record<string, T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.statuses || {};
  } catch {
    return {};
  }
}

export const checkAIStatus = (ids: string[]) =>
  postForStatuses<AIStatus>("/api/v1/media/batch/ai-status", ids);

export const checkTranscodeStatus = (ids: string[]) =>
  postForStatuses<TranscodeStatus>("/api/v1/media/batch/transcode-status", ids);

// Polls a batch of ids until every status satisfies isDone, maxPolls times.
export class StatusPoller<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private polls = 0;

  constructor(
    private readonly ids: string[],
    private readonly checkFn: (ids: string[]) => Promise<Record<string, T>>,
    private readonly isDone: (s: T) => boolean,
    private readonly opts: {
      interval: number;
      maxPolls: number;
      onSettled: () => void;
      shouldStop: () => boolean;
    },
  ) {}

  start() {
    this.timer = setTimeout(this.poll, this.opts.interval);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private poll = async () => {
    this.timer = null;
    if (this.opts.shouldStop()) return;
    if (this.polls >= this.opts.maxPolls) {
      this.opts.onSettled();
      return;
    }
    this.polls++;
    const statuses = await this.checkFn(this.ids);
    const allDone = Object.keys(statuses).length > 0 && Object.values(statuses).every(this.isDone);
    if (allDone) {
      this.opts.onSettled();
    } else {
      this.timer = setTimeout(this.poll, this.opts.interval);
    }
  };
}
