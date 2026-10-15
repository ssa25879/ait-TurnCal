import { describe, expect, it, vi } from "vitest";

vi.mock("@apps-in-toss/web-framework", () => ({
  partner: { addAccessoryButton: vi.fn(), removeAccessoryButton: vi.fn() },
  tdsEvent: { addEventListener: vi.fn() },
}));

import { createNavSettingsButton, NAV_SETTINGS_ID, type NavButtonState } from "./useNavSettingsButton";

function setup(overrides: Partial<Parameters<typeof createNavSettingsButton>[0]> = {}) {
  let handler: ((id: string) => void) | null = null;
  const unlisten = vi.fn();
  const timers: { fn: () => void; ms: number; cancelled: boolean }[] = [];
  const deps = {
    add: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    listen: vi.fn((h: (id: string) => void) => {
      handler = h;
      return unlisten;
    }),
    schedule: vi.fn((fn: () => void, ms: number) => {
      const timer = { fn, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    }),
    ...overrides,
  };
  const states: NavButtonState[] = [];
  const onClick = vi.fn();
  const controller = createNavSettingsButton(deps, onClick, (s) => states.push(s));
  return { deps, states, onClick, controller, unlisten, timers, click: (id: string) => handler?.(id) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createNavSettingsButton", () => {
  it("시작하면 설정 버튼을 등록하고 성공하면 registered가 된다", async () => {
    const { deps, states, controller } = setup();
    controller.start();
    expect(states).toEqual(["pending"]);
    expect(deps.add).toHaveBeenCalledWith({ id: NAV_SETTINGS_ID, title: "설정", icon: { name: "icon-setting-mono" } });
    await flush();
    expect(states).toEqual(["pending", "registered"]);
  });

  it("설정 버튼 id의 클릭만 onClick을 부른다", async () => {
    const { controller, click, onClick } = setup();
    controller.start();
    click("other");
    expect(onClick).not.toHaveBeenCalled();
    click(NAV_SETTINGS_ID);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stop은 구독과 버튼을 정리하고 이후 상태 변화를 무시한다", async () => {
    const { deps, controller, unlisten, states } = setup();
    const stop = controller.start();
    stop();
    await flush();
    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(deps.remove).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["pending"]); // 해제 뒤에는 registered도 알리지 않는다
  });

  it("등록이 거부되면 failed가 된다", async () => {
    const { states, controller } = setup({ add: vi.fn(async () => { throw new Error("unsupported"); }) });
    controller.start();
    await flush();
    expect(states).toEqual(["pending", "failed"]);
  });

  it("add가 동기 예외를 던져도 failed가 된다", () => {
    const { states, controller } = setup({ add: vi.fn(() => { throw new Error("no sdk"); }) });
    controller.start();
    expect(states).toEqual(["pending", "failed"]);
  });

  it("이벤트 구독이 실패하면 failed이고 등록하지 않는다", () => {
    const { states, controller, deps } = setup({ listen: vi.fn(() => { throw new Error("no event"); }) });
    controller.start();
    expect(states).toEqual(["pending", "failed"]);
    expect(deps.add).not.toHaveBeenCalled();
  });

  it("시간 안에 끝나지 않으면 failed, 늦게 성공하면 registered로 돌아온다", async () => {
    let resolveAdd: () => void = () => {};
    const { states, controller, timers } = setup({ add: vi.fn(() => new Promise<void>((resolve) => { resolveAdd = resolve; })) });
    controller.start();
    expect(timers[0].ms).toBe(1500);
    timers[0].fn();
    expect(states).toEqual(["pending", "failed"]);
    resolveAdd();
    await flush();
    expect(states).toEqual(["pending", "failed", "registered"]);
  });

  it("등록이 성공하면 타이머를 취소한다", async () => {
    const { controller, timers } = setup();
    controller.start();
    await flush();
    expect(timers[0].cancelled).toBe(true);
  });

  it("제거 중 예외가 나도 stop은 던지지 않는다", () => {
    const { controller } = setup({ remove: vi.fn(() => { throw new Error("gone"); }) });
    const stop = controller.start();
    expect(() => stop()).not.toThrow();
  });
});
