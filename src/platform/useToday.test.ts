import { afterEach, describe, expect, it, vi } from "vitest";
import { watchToday } from "./useToday";

function createSource() {
  const target = new EventTarget();
  return {
    visibilityState: "visible",
    addEventListener: (type: "visibilitychange", listener: () => void) =>
      target.addEventListener(type, listener),
    removeEventListener: (type: "visibilitychange", listener: () => void) =>
      target.removeEventListener(type, listener),
    fire() {
      target.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("watchToday", () => {
  it("자정을 넘긴 뒤 화면이 다시 보이면 새 오늘을 알린다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 23, 50));
    const source = createSource();
    const onChange = vi.fn();
    watchToday(source, onChange, "2026-10-14");

    source.visibilityState = "hidden";
    source.fire();
    vi.advanceTimersByTime(20 * 60 * 1000);
    source.visibilityState = "visible";
    source.fire();

    expect(onChange).toHaveBeenCalledWith("2026-10-15");
  });

  it("날짜가 그대로면 알리지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
    const source = createSource();
    const onChange = vi.fn();
    watchToday(source, onChange, "2026-10-14");
    source.fire();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("구독 해제 후에는 알리지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 0, 10));
    const source = createSource();
    const onChange = vi.fn();
    const stop = watchToday(source, onChange, "2026-10-14");
    stop();
    source.fire();
    expect(onChange).not.toHaveBeenCalled();
  });
});
