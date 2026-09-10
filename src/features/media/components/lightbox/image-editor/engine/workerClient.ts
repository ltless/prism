import type { AdjustmentState } from "../state/editorState";
import type { ApplyRequestMessage, ApplyResponseMessage } from "./worker";

/**
 * Client for the adjustment Web Worker. Offloads the pixel pipeline
 * (blur/sharpen/etc. per-pixel loops) off the main thread.
 *
 * Concurrency: latest request wins. If a new request arrives while the
 * worker is busy, the previous one is dropped — its result is stale the
 * moment the slider moved again. This keeps drag latency at (at most) one
 * pipeline run, matching the old synchronous feel without jank.
 */

let worker: Worker | null = null;
let requestId = 0;
let pendingResolve: ((m: ApplyResponseMessage) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<ApplyResponseMessage>) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(e.data);
  };
  return worker;
}

/**
 * Runs the adjustment pipeline on a copy of `data` in the worker.
 * The returned buffer is transferred back (zero-copy) and may be
 * used to build the next request's input.
 */
export function applyAdjustmentsAsync(
  state: AdjustmentState,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  isDragging: boolean,
): Promise<Uint8ClampedArray> {
  // Copy so the caller's buffer is never detached by the transfer.
  const copy = new Uint8ClampedArray(data);
  const msg: ApplyRequestMessage = {
    type: "apply",
    id: ++requestId,
    buffer: copy.buffer as ArrayBuffer,
    width,
    height,
    state,
    isDragging,
  };
  const w = getWorker();
  const promise = new Promise<ApplyResponseMessage>((resolve) => {
    // Latest-wins: if a request is still in flight, its result is stale.
    pendingResolve = resolve;
  });
  w.postMessage(msg, [msg.buffer]);
  return promise.then((m) => new Uint8ClampedArray(m.buffer));
}
