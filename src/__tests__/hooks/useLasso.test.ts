import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLasso } from "@/features/media/hooks/useLasso";

function createMockContainer(items: string[]) {
 const container = document.createElement("div");
 container.style.position = "relative";
 container.style.width = "1000px";
 container.style.height = "1000px";
 container.getBoundingClientRect = () => ({
 top: 0, left: 0, bottom: 1000, right: 1000,
 width: 1000, height: 1000,
 x: 0, y: 0,
 toJSON: () => ({}),
 });
 Object.defineProperty(container, "scrollWidth", { value: 1000 });
 Object.defineProperty(container, "scrollHeight", { value: 1000 });
 Object.defineProperty(container, "scrollLeft", { value: 0, writable: true });
 Object.defineProperty(container, "scrollTop", { value: 0, writable: true });

 for (const id of items) {
 const el = document.createElement("div");
 el.setAttribute("data-media-id", id);
 el.style.position = "absolute";
 el.style.width = "100px";
 el.style.height = "100px";
 container.appendChild(el);
 }

 return container;
}

describe("useLasso", () => {
 let container: HTMLElement;
 let onSelectionChange: Mock<(selectedIds: string[]) => void>;
 let ref: { current: HTMLElement | null };

 beforeEach(() => {
 container = createMockContainer(["item-1", "item-2", "item-3"]);
 document.body.appendChild(container);
 onSelectionChange = vi.fn();
 ref = { current: container };
 document.elementsFromPoint = () => [];
 });

 afterEach(() => {
 document.body.removeChild(container);
 vi.restoreAllMocks();
 });

 it("returns ref and isSelecting state", () => {
 const { result } = renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));
 expect(result.current.selectionBoxRef).toBeDefined();
 expect(result.current.isSelecting).toBe(false);
 });

 it("clears selection on mousedown to empty area", () => {
 renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 act(() => {
 container.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 100,
 clientY: 100,
 button: 0,
 }));
 });

 expect(onSelectionChange).toHaveBeenCalledWith([]);
 });

it("sets isSelecting state correctly", () => {
 const { result } = renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 expect(result.current.isSelecting).toBe(false);

 act(() => {
 container.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 100, clientY: 100, button: 0,
 }));
 });

 expect(result.current.isSelecting).toBe(true);

 act(() => {
 window.dispatchEvent(new MouseEvent("mouseup"));
 });

 expect(result.current.isSelecting).toBe(false);
 });

 it("does not select when dragging less than 5px threshold", () => {
 renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 act(() => {
 container.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 100, clientY: 100, button: 0,
 }));
 });

 onSelectionChange.mockClear();

 act(() => {
 window.dispatchEvent(new MouseEvent("mousemove", {
 clientX: 102, clientY: 102,
 }));
 });

 expect(onSelectionChange).not.toHaveBeenCalled();
 });

 it("ignores right-click", () => {
 renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 act(() => {
 container.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 100, clientY: 100, button: 2,
 }));
 });

 act(() => {
 window.dispatchEvent(new MouseEvent("mousemove", {
 clientX: 300, clientY: 300,
 }));
 });

 expect(onSelectionChange).not.toHaveBeenCalled();
 });

 it("does not start lasso on media items", () => {
 const mediaEl = container.querySelector("[data-media-id='item-1']")!;

 renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 act(() => {
 mediaEl.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 0, clientY: 0, button: 0,
 bubbles: true,
 }));
 });

 expect(onSelectionChange).not.toHaveBeenCalled();
 });

 it("clears selection when clicking empty area", () => {
 renderHook(() => useLasso(ref, "[data-media-id]", onSelectionChange));

 act(() => {
 container.dispatchEvent(new MouseEvent("mousedown", {
 clientX: 100, clientY: 100, button: 0,
 }));
 });

 expect(onSelectionChange).toHaveBeenCalledWith([]);
 });
});