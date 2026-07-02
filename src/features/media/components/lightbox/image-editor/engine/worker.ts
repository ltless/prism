/// <reference lib="webworker" />
import { applyAdjustments } from "./AdjustmentEngine";
import type { AdjustmentState } from "../state/editorState";

export interface ApplyRequestMessage {
  type: "apply";
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  state: AdjustmentState;
  isDragging: boolean;
}

export interface ApplyResponseMessage {
  type: "applied";
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<ApplyRequestMessage>) => {
  const { type, id, buffer, width, height, state, isDragging } = e.data;
  if (type !== "apply") return;
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
  const adjusted = applyAdjustments(state, imageData, isDragging);
  const msg: ApplyResponseMessage = {
    type: "applied",
    id,
    buffer: adjusted.data.buffer as ArrayBuffer,
    width: adjusted.width,
    height: adjusted.height,
  };
  (self as unknown as Worker).postMessage(msg, [msg.buffer]);
};
