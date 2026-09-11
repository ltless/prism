import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSlideshow } from "@/features/media/hooks/useSlideshow";

describe("useSlideshow", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("is off by default and toggle starts it", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useSlideshow(true, onAdvance));
    expect(result.current[0]).toBe(false);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });

  it("advances on interval while playing", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useSlideshow(true, onAdvance));
    act(() => result.current[1]());

    act(() => { vi.advanceTimersByTime(4000); });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  it("does not advance when not playing", () => {
    const onAdvance = vi.fn();
    renderHook(() => useSlideshow(true, onAdvance));
    act(() => { vi.advanceTimersByTime(12000); });
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("stops when canAdvance becomes false", () => {
    const onAdvance = vi.fn();
    const { result, rerender } = renderHook(
      ({ can }: { can: boolean }) => useSlideshow(can, onAdvance),
      { initialProps: { can: true } },
    );
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);

    rerender({ can: false });
    expect(result.current[0]).toBe(false);

    act(() => { vi.advanceTimersByTime(8000); });
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("toggle stops playback", () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useSlideshow(true, onAdvance));
    act(() => result.current[1]()); // on
    act(() => result.current[1]()); // off
    act(() => { vi.advanceTimersByTime(8000); });
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
