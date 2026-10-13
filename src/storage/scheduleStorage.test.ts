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
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type StoredSettingsV1,
} from "./scheduleStorage";

const valid: StoredSettingsV1 = {
  version: 1,
  pattern: { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "AFTER_NIGHT", "OFF"] },
  weekStart: "SUN",
};

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
  it("turncal.settings 키에 version 1을 포함한 JSON 문자열로 저장한다", async () => {
    await saveSettings(valid);
    expect(storageMock.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.any(String));
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

  it("값이 없으면 empty를 반환한다", async () => {
    await expect(loadSettings()).resolves.toEqual({ kind: "empty" });
  });

  it.each([
    ["JSON 파싱 실패", "{not json"],
    ["알 수 없는 근무 유형", JSON.stringify({ ...valid, pattern: { ...valid.pattern, cycle: ["DAY", "SWING"] } })],
    ["빈 패턴", JSON.stringify({ ...valid, pattern: { ...valid.pattern, cycle: [] } })],
    ["57개 패턴", JSON.stringify({ ...valid, pattern: { ...valid.pattern, cycle: Array(57).fill("DAY") } })],
    ["존재하지 않는 기준일", JSON.stringify({ ...valid, pattern: { ...valid.pattern, startDate: "2026-02-31" } })],
    ["알 수 없는 주 시작 요일", JSON.stringify({ ...valid, weekStart: "TUE" })],
    ["version 누락", JSON.stringify({ pattern: valid.pattern, weekStart: "SUN" })],
    ["상위 version", JSON.stringify({ ...valid, version: 2 })],
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
