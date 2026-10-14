import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clearItems: vi.fn(),
}));
vi.mock("@apps-in-toss/web-framework", () => ({ Storage: storageMock }));

import { ENTRIES_KEY } from "./entriesStorage";
import { resetAll, resetDisplay, resetPattern } from "./reset";
import { SETTINGS_KEY, type StoredSettingsV3 } from "./scheduleStorage";
import { USER_KEY } from "./userKeyStorage";

const settings: StoredSettingsV3 = {
  version: 3,
  pattern: { startDate: "2026-10-13", cycle: ["DAY", "OFF"] },
  weekStart: "MON",
  theme: "TEAL",
  userName: "지수",
  scheduleName: "병동",
};

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
  storageMock.setItem.mockImplementation(async (key: string, value: string) => void memory.set(key, value));
  storageMock.removeItem.mockImplementation(async (key: string) => void memory.delete(key));
  memory.set(SETTINGS_KEY, JSON.stringify(settings));
  memory.set(ENTRIES_KEY, JSON.stringify({ version: 1, days: {} }));
  memory.set(USER_KEY, JSON.stringify({ version: 1, anonymousKey: "k" }));
});

describe("초기화", () => {
  it("resetPattern은 패턴만 지운다", async () => {
    const next = await resetPattern(settings);
    expect(next).toEqual({ ...settings, pattern: null });
    expect(JSON.parse(memory.get(SETTINGS_KEY)!)).toEqual({ ...settings, pattern: null });
    expect(memory.has(ENTRIES_KEY)).toBe(true);
  });

  it("resetPattern은 현재 패턴만 지우고 패턴 이력은 유지한다", async () => {
    const withHistory: StoredSettingsV3 = {
      ...settings,
      patternHistory: [{ until: "2026-10-13", pattern: { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] } }],
    };
    memory.set(SETTINGS_KEY, JSON.stringify(withHistory));
    const next = await resetPattern(withHistory);
    expect(next.pattern).toBeNull();
    expect(next.patternHistory).toEqual(withHistory.patternHistory);
    const stored = JSON.parse(memory.get(SETTINGS_KEY)!);
    expect(stored).toEqual({ ...withHistory, pattern: null });
    expect(memory.has(ENTRIES_KEY)).toBe(true);
  });

  it("resetDisplay는 패턴 이력을 건드리지 않는다", async () => {
    const withHistory: StoredSettingsV3 = {
      ...settings,
      patternHistory: [{ until: "2026-10-13", pattern: { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] } }],
    };
    const next = await resetDisplay(withHistory);
    expect(next.patternHistory).toEqual(withHistory.patternHistory);
    expect(JSON.parse(memory.get(SETTINGS_KEY)!).patternHistory).toEqual(withHistory.patternHistory);
  });

  it("resetDisplay는 테마·주 시작 요일만 기본값으로", async () => {
    const next = await resetDisplay(settings);
    expect(next).toEqual({ ...settings, theme: "INDIGO", weekStart: "SUN" });
    expect(memory.has(ENTRIES_KEY)).toBe(true);
  });

  it("resetAll은 세부 내용 → 설정 → 식별키 순서로 지운다", async () => {
    await resetAll();
    expect(storageMock.removeItem.mock.calls.map((c) => c[0])).toEqual([ENTRIES_KEY, SETTINGS_KEY, USER_KEY]);
    expect(memory.size).toBe(0);
  });

  it("중간 실패를 전달한다", async () => {
    storageMock.removeItem.mockImplementationOnce(async (key: string) => void memory.delete(key));
    storageMock.removeItem.mockRejectedValueOnce(new Error("io"));
    await expect(resetAll()).rejects.toThrow("io");
    expect(memory.has(ENTRIES_KEY)).toBe(false);
    expect(memory.has(SETTINGS_KEY)).toBe(true);
  });

  it("저장 실패를 전달한다", async () => {
    storageMock.setItem.mockRejectedValueOnce(new Error("io"));
    await expect(resetDisplay(settings)).rejects.toThrow("io");
  });
});

describe("전체 초기화의 식별키", () => {
  it("식별키 삭제 실패를 전달한다", async () => {
    storageMock.removeItem.mockImplementationOnce(async (key: string) => void memory.delete(key));
    storageMock.removeItem.mockImplementationOnce(async (key: string) => void memory.delete(key));
    storageMock.removeItem.mockRejectedValueOnce(new Error("io"));
    await expect(resetAll()).rejects.toThrow("io");
    expect(memory.has(USER_KEY)).toBe(true);
  });
});
