import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatusPoller, RateLimitError } from "../uploadApi";

describe("RateLimitError", () => {
  it("carries retry seconds", () => {
    const err = new RateLimitError(30);
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.message).toContain("30");
  });
});

describe("StatusPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const interval = 100;
  const maxPolls = 3;

  it("settles immediately when all statuses are done", async () => {
    const checkFn = vi.fn().mockResolvedValue({ a: { done: true }, b: { done: true } });
    const onSettled = vi.fn();
    new StatusPoller(["a", "b"], checkFn, (s: { done: boolean }) => s.done, {
      interval, maxPolls, onSettled, shouldStop: () => false,
    }).start();

    await vi.advanceTimersByTimeAsync(interval);
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("keeps polling until done", async () => {
    const checkFn = vi.fn()
      .mockResolvedValueOnce({ a: { done: false } })
      .mockResolvedValueOnce({ a: { done: true } });
    const onSettled = vi.fn();
    new StatusPoller(["a"], checkFn, (s: { done: boolean }) => s.done, {
      interval, maxPolls, onSettled, shouldStop: () => false,
    }).start();

    await vi.advanceTimersByTimeAsync(interval);
    expect(onSettled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(interval);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(checkFn).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxPolls", async () => {
    const checkFn = vi.fn().mockResolvedValue({ a: { done: false } });
    const onSettled = vi.fn();
    new StatusPoller(["a"], checkFn, (s: { done: boolean }) => s.done, {
      interval, maxPolls, onSettled, shouldStop: () => false,
    }).start();

    await vi.advanceTimersByTimeAsync(interval * (maxPolls + 1));
    expect(checkFn).toHaveBeenCalledTimes(maxPolls);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("stops without settling when shouldStop is true", async () => {
    const checkFn = vi.fn().mockResolvedValue({ a: { done: false } });
    const onSettled = vi.fn();
    const poller = new StatusPoller(["a"], checkFn, (s: { done: boolean }) => s.done, {
      interval, maxPolls, onSettled, shouldStop: () => true,
    });
    poller.start();

    await vi.advanceTimersByTimeAsync(interval);
    expect(onSettled).not.toHaveBeenCalled();
    poller.stop();
  });

  it("survives empty status response (polls again)", async () => {
    const checkFn = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ a: { done: true } });
    const onSettled = vi.fn();
    new StatusPoller(["a"], checkFn, (s: { done: boolean }) => s.done, {
      interval, maxPolls, onSettled, shouldStop: () => false,
    }).start();

    await vi.advanceTimersByTimeAsync(interval);
    expect(onSettled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(interval);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
