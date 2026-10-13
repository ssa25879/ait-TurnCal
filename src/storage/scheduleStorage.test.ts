import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();

const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clearItems: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", () => ({ Storage: storageMock }));

import {
  CURRENT_VERSION,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type StoredSettingsV3,
} from "./scheduleStorage";

const pattern = { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "AFTER_NIGHT", "OFF"] };

const valid: StoredSettingsV3 = {
  version: 3,
  pattern: { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "AFTER_NIGHT", "OFF"] },
  weekStart: "SUN",
  theme: "INDIGO",
  userName: "지수",
  scheduleName: "병동 3교대",
};

const v1 = { version: 1, pattern, weekStart: "MON" };
const v2 = { version: 2, pattern, weekStart: "MON", theme: "TEAL" };

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
  storageMock.getItem.mockImplementation(async (key: string) => memory.get(key) ?? null);
  storageMock.setItem.mockImplementation(async (key: string, value: string) => {
    memory.set(key, value);
  });
});

function expectNoWrites() {
  expect(storageMock.setItem).not.toHaveBeenCalled();
  expect(storageMock.removeItem).not.toHaveBeenCalled();
  expect(storageMock.clearItems).not.toHaveBeenCalled();
}

describe("saveSettings", () => {
  it("turncal.settings 키에 version 3과 여섯 값을 JSON 문자열로 저장한다", async () => {
    expect(CURRENT_VERSION).toBe(3);
    await saveSettings(valid);
    expect(SETTINGS_KEY).toBe("turncal.settings");
    expect(JSON.parse(memory.get(SETTINGS_KEY)!)).toEqual(valid);
  });

  it("쓰기 실패를 호출자에게 전달한다", async () => {
    storageMock.setItem.mockRejectedValueOnce(new Error("disk"));
    await expect(saveSettings(valid)).rejects.toThrow("disk");
  });
});

describe("loadSettings", () => {
  it("저장 후 다시 읽으면 같은 설정을 복원한다", async () => {
    await saveSettings(valid);
    vi.clearAllMocks();
    storageMock.getItem.mockImplementation(async (key: string) => memory.get(key) ?? null);
    await expect(loadSettings()).resolves.toEqual({ kind: "ok", settings: valid });
    expectNoWrites();
  });

  it("패턴 초기화 상태(pattern: null)를 복원한다", async () => {
    const reset = { ...valid, pattern: null };
    memory.set(SETTINGS_KEY, JSON.stringify(reset));
    await expect(loadSettings()).resolves.toEqual({ kind: "ok", settings: reset });
  });

  it("값이 없으면 empty를 반환한다", async () => {
    await expect(loadSettings()).resolves.toEqual({ kind: "empty" });
  });

  it("v1은 인디고·이름 없음의 v3로 복원하고 쓰지 않는다", async () => {
    const raw = JSON.stringify(v1);
    memory.set(SETTINGS_KEY, raw);
    await expect(loadSettings()).resolves.toEqual({
      kind: "ok",
      settings: { version: 3, pattern, weekStart: "MON", theme: "INDIGO", userName: null, scheduleName: null },
    });
    expect(memory.get(SETTINGS_KEY)).toBe(raw);
    expectNoWrites();
  });

  it("v2는 테마를 유지한 이름 없음의 v3로 복원하고 쓰지 않는다", async () => {
    const raw = JSON.stringify(v2);
    memory.set(SETTINGS_KEY, raw);
    await expect(loadSettings()).resolves.toEqual({
      kind: "ok",
      settings: { version: 3, pattern, weekStart: "MON", theme: "TEAL", userName: null, scheduleName: null },
    });
    expectNoWrites();
  });

  it("이전 버전에서 복원한 설정을 저장하면 v3로 기록된다", async () => {
    for (const old of [v1, v2]) {
      memory.set(SETTINGS_KEY, JSON.stringify(old));
      const result = await loadSettings();
      if (result.kind !== "ok") throw new Error("복원 실패");
      await saveSettings({ ...result.settings, scheduleName: "병동" });
      expect(JSON.parse(memory.get(SETTINGS_KEY)!)).toMatchObject({ version: 3, weekStart: "MON", scheduleName: "병동" });
    }
  });

  it.each([
    ["JSON 파싱 실패", "{not json"],
    ["알 수 없는 근무 유형", JSON.stringify({ ...valid, pattern: { ...pattern, cycle: ["DAY", "SWING"] } })],
    ["빈 패턴", JSON.stringify({ ...valid, pattern: { ...pattern, cycle: [] } })],
    ["57개 패턴", JSON.stringify({ ...valid, pattern: { ...pattern, cycle: Array(57).fill("DAY") } })],
    ["존재하지 않는 기준일", JSON.stringify({ ...valid, pattern: { ...pattern, startDate: "2026-02-31" } })],
    ["알 수 없는 주 시작 요일", JSON.stringify({ ...valid, weekStart: "TUE" })],
    ["알 수 없는 테마", JSON.stringify({ ...valid, theme: "BLUE" })],
    ["근무표 이름 21자", JSON.stringify({ ...valid, scheduleName: "가".repeat(21) })],
    ["호칭 11자", JSON.stringify({ ...valid, userName: "가".repeat(11) })],
    ["빈 문자열 이름", JSON.stringify({ ...valid, userName: "" })],
    ["앞뒤 공백 이름", JSON.stringify({ ...valid, userName: " 지수 " })],
    ["v3인데 이름 필드 누락", JSON.stringify({ version: 3, pattern, weekStart: "SUN", theme: "INDIGO" })],
    ["v1인데 패턴 null", JSON.stringify({ ...v1, pattern: null })],
    ["version 누락", JSON.stringify({ pattern, weekStart: "SUN" })],
    ["상위 version", JSON.stringify({ ...valid, version: 4 })],
    ["객체가 아님", JSON.stringify(["DAY"])],
  ])("%s이면 corrupt를 반환하고 저장값을 건드리지 않는다", async (_label, raw) => {
    memory.set(SETTINGS_KEY, raw);
    const result = await loadSettings();
    expect(result.kind).toBe("corrupt");
    expect(memory.get(SETTINGS_KEY)).toBe(raw);
    expectNoWrites();
  });

  it("읽기 예외면 error를 반환하고 쓰지 않는다", async () => {
    storageMock.getItem.mockRejectedValueOnce(new Error("bridge"));
    const result = await loadSettings();
    expect(result.kind).toBe("error");
    expectNoWrites();
  });
});
