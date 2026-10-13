import { describe, expect, it, vi } from "vitest";
import { createOverlayRegistry } from "./overlayBack";

describe("createOverlayRegistry", () => {
  it("가장 최근에 열린 오버레이부터 닫는다", () => {
    const registry = createOverlayRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.register(first);
    const unregisterSecond = registry.register(second);

    expect(registry.hasOpen()).toBe(true);
    registry.closeTop();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    unregisterSecond();
    registry.closeTop();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("모두 해제되면 열린 오버레이가 없다", () => {
    const registry = createOverlayRegistry();
    const unregister = registry.register(() => {});
    unregister();
    expect(registry.hasOpen()).toBe(false);
    expect(() => registry.closeTop()).not.toThrow();
  });
});
