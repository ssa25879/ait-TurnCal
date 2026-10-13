import { beforeEach, describe, expect, it, vi } from "vitest";

const safeAreaMock = vi.hoisted(() => ({ get: vi.fn(), subscribe: vi.fn() }));
vi.mock("@apps-in-toss/web-framework", () => ({ SafeArea: safeAreaMock }));

import { startSafeAreaSync } from "./useSafeArea";

function createTarget() {
  const values = new Map<string, string>();
  return { values, style: { setProperty: (name: string, value: string) => values.set(name, value) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startSafeAreaSync", () => {
  it("현재 여백을 CSS 변수로 반영하고 변경 시 다시 반영한다", () => {
    let emit: (insets: { top: number; bottom: number }) => void = () => {};
    const unsubscribe = vi.fn();
    safeAreaMock.get.mockReturnValue({ top: 44, bottom: 34, left: 0, right: 0 });
    safeAreaMock.subscribe.mockImplementation(({ onEvent }) => {
      emit = onEvent;
      return unsubscribe;
    });

    const target = createTarget();
    const stop = startSafeAreaSync(target);
    expect(target.values.get("--safe-top")).toBe("44px");
    expect(target.values.get("--safe-bottom")).toBe("34px");

    emit({ top: 20, bottom: 0 });
    expect(target.values.get("--safe-top")).toBe("20px");
    expect(target.values.get("--safe-bottom")).toBe("0px");

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("SDK 호출이 실패해도 0으로 설정하고 중단되지 않는다", () => {
    safeAreaMock.get.mockImplementation(() => {
      throw new Error("not in toss");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const target = createTarget();
    expect(() => startSafeAreaSync(target)()).not.toThrow();
    expect(target.values.get("--safe-top")).toBe("0px");
  });
});
