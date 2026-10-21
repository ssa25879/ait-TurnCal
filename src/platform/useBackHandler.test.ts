import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  closeView: vi.fn(async () => {}),
  addEventListener: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  closeView: sdk.closeView,
  graniteEvent: { addEventListener: sdk.addEventListener },
}));

import {
  decideBackAction,
  registerBackHandler,
  type BackState,
  type Screen,
} from "./useBackHandler";

beforeEach(() => {
  vi.clearAllMocks();
});

function state(screen: Screen, hasSavedSettings: boolean, isDirty = false, hasOverlay = false): BackState {
  return { screen, hasSavedSettings, isDirty, hasOverlay };
}

describe("decideBackAction", () => {
  it.each<[Screen, boolean, boolean, string]>([
    ["calendar", true, false, "close"],
    ["load-error", false, false, "close"],
    ["loading", false, false, "close"],
    ["pattern", false, false, "close"],
    ["pattern", false, true, "close"],
    ["pattern", true, false, "to-settings-menu"],
    ["pattern", true, true, "confirm-discard"],
    ["display", true, false, "to-settings-menu"],
    ["reminder", true, false, "to-settings-menu"],
    ["settings-menu", true, false, "to-calendar"],
    ["names", true, false, "to-settings-menu"],
    ["names", true, true, "confirm-discard"],
    ["shift-labels", true, false, "to-settings-menu"],
    ["shift-labels", true, true, "confirm-discard"],
    ["reset", true, false, "to-settings-menu"],
    ["day", true, false, "to-calendar"],
    ["entry", true, false, "to-day"],
    ["entry", true, true, "confirm-discard"],
    ["names", false, false, "close"],
    ["day", false, false, "close"],
  ])("%s (저장됨=%s, 변경=%s) → %s", (screen, hasSavedSettings, isDirty, expected) => {
    expect(decideBackAction(state(screen, hasSavedSettings, isDirty))).toBe(expected);
  });

  // 패턴 초기화 뒤에도 저장된 설정이 있으므로 hasSavedSettings는 true이고 패턴 유무와 무관하게 같은 계층을 쓴다.
  it("패턴이 없는 설정(저장된 설정 있음): 달력은 종료, 설정 계층은 한 단계씩 올라간다", () => {
    expect(decideBackAction(state("calendar", true))).toBe("close");
    expect(decideBackAction(state("settings-menu", true))).toBe("to-calendar");
    expect(decideBackAction(state("pattern", true))).toBe("to-settings-menu");
    expect(decideBackAction(state("names", true))).toBe("to-settings-menu");
    expect(decideBackAction(state("display", true))).toBe("to-settings-menu");
    expect(decideBackAction(state("day", true))).toBe("to-calendar");
  });

  it("첫 실행(저장된 설정 없음)은 어느 화면에서든 종료한다", () => {
    for (const screen of ["pattern", "load-error", "loading"] as Screen[]) {
      expect(decideBackAction(state(screen, false))).toBe("close");
    }
  });

  it("오버레이가 열려 있으면 화면과 무관하게 오버레이를 먼저 닫는다", () => {
    for (const screen of ["calendar", "pattern", "display", "settings-menu", "names", "reset", "day", "entry"] as Screen[]) {
      expect(decideBackAction(state(screen, true, true, true))).toBe("close-overlay");
    }
  });
});

describe("registerBackHandler", () => {
  function setup(initial: BackState) {
    let fire: () => void = () => {};
    const unsubscribe = vi.fn();
    sdk.addEventListener.mockImplementation(
      (_event: string, { onEvent }: { onEvent: () => void }) => {
        fire = onEvent;
        return unsubscribe;
      },
    );
    const handlers = {
      closeOverlay: vi.fn(),
      toCalendar: vi.fn(),
      toSettingsMenu: vi.fn(),
      toDay: vi.fn(),
      confirmDiscard: vi.fn(),
    };
    let current = initial;
    const stop = registerBackHandler(() => current, () => handlers);
    return {
      handlers,
      unsubscribe,
      stop,
      fire: () => fire(),
      setState: (next: BackState) => {
        current = next;
      },
    };
  }

  it("backEvent를 구독하고 최초 화면에서는 closeView를 호출한다", () => {
    const { fire, handlers } = setup(state("calendar", true));
    expect(sdk.addEventListener).toHaveBeenCalledWith("backEvent", expect.any(Object));
    fire();
    expect(sdk.closeView).toHaveBeenCalledTimes(1);
    expect(handlers.toCalendar).not.toHaveBeenCalled();
  });

  it("이벤트 시점의 최신 상태로 동작한다", () => {
    const { fire, handlers, setState } = setup(state("calendar", true));
    setState(state("pattern", true));
    fire();
    expect(handlers.toSettingsMenu).toHaveBeenCalledTimes(1);
    setState(state("settings-menu", true));
    fire();
    expect(handlers.toCalendar).toHaveBeenCalledTimes(1);
    setState(state("entry", true));
    fire();
    expect(handlers.toDay).toHaveBeenCalledTimes(1);
    setState(state("pattern", true, true));
    fire();
    expect(handlers.confirmDiscard).toHaveBeenCalledTimes(1);
    setState(state("calendar", true, false, true));
    fire();
    expect(handlers.closeOverlay).toHaveBeenCalledTimes(1);
    expect(sdk.closeView).not.toHaveBeenCalled();
  });

  it("해제 함수가 구독을 해제한다", () => {
    const { stop, unsubscribe } = setup(state("calendar", true));
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
