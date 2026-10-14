import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();

const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clearItems: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", () => ({ Storage: storageMock }));

import type { PastPattern } from "../domain/patternHistory";
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

describe("patternHistory", () => {
  const pastA: PastPattern = { until: "2026-10-13", pattern: { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] } };
  const pastB: PastPattern = { until: "2026-11-02", pattern: { startDate: "2026-10-13", cycle: ["DAY", "DAY", "OFF"] } };
  const withHistory = { ...valid, patternHistory: [pastA, pastB] };

  async function loadRaw(value: unknown) {
    memory.set(SETTINGS_KEY, JSON.stringify(value));
    vi.clearAllMocks();
    storageMock.getItem.mockImplementation(async (key: string) => memory.get(key) ?? null);
    return loadSettings();
  }

  it("patternHistory 필드가 없는 기존 v3 설정은 이력 없이 복원하고 저장값을 바꾸지 않는다", async () => {
    const result = await loadRaw(valid);
    expect(result).toEqual({ kind: "ok", settings: valid });
    expect(result.kind === "ok" && result.settings.patternHistory).toBeUndefined();
    expectNoWrites();
  });

  it("이력이 있는 설정을 version 3으로 저장하고 같은 값으로 복원한다", async () => {
    await saveSettings(withHistory);
    const stored = JSON.parse(memory.get(SETTINGS_KEY)!);
    expect(stored.version).toBe(3);
    expect(stored.patternHistory).toEqual([pastA, pastB]);
    expect(stored.pattern).toEqual(valid.pattern);
    await expect(loadRaw(stored)).resolves.toEqual({ kind: "ok", settings: withHistory });
  });

  it("이력이 비어 있으면 저장할 때 필드를 생략한다", async () => {
    await saveSettings({ ...valid, patternHistory: [] });
    expect(JSON.parse(memory.get(SETTINGS_KEY)!)).toEqual(valid);
    expect("patternHistory" in JSON.parse(memory.get(SETTINGS_KEY)!)).toBe(false);
  });

  it("이전 v3 앱 관점: 이력 필드를 빼면 기존 v3 형식과 같다(현재 패턴이 그대로 있다)", async () => {
    await saveSettings(withHistory);
    const { patternHistory, ...legacyView } = JSON.parse(memory.get(SETTINGS_KEY)!);
    expect(patternHistory).toHaveLength(2);
    expect(legacyView).toEqual(valid);
  });

  it("patternHistory는 v1·v2 변환에는 영향을 주지 않는다", async () => {
    const result = await loadRaw(v2);
    expect(result.kind === "ok" && result.settings.patternHistory).toBeUndefined();
  });

  const corruptCases: Array<[string, unknown]> = [
    ["until이 날짜순으로 증가하지 않음", { ...valid, patternHistory: [pastB, pastA] }],
    ["until이 같은 항목이 둘", { ...valid, patternHistory: [pastA, { ...pastA }] }],
    ["until이 유효한 날짜가 아님", { ...valid, patternHistory: [{ ...pastA, until: "2026-02-31" }] }],
    ["until이 문자열이 아님", { ...valid, patternHistory: [{ ...pastA, until: 20261013 }] }],
    ["항목 패턴이 비어 있음", { ...valid, patternHistory: [{ ...pastA, pattern: { startDate: "2026-10-01", cycle: [] } }] }],
    ["항목 패턴에 알 수 없는 근무 유형", { ...valid, patternHistory: [{ ...pastA, pattern: { startDate: "2026-10-01", cycle: ["WEEKEND"] } }] }],
    ["항목이 객체가 아님", { ...valid, patternHistory: ["2026-10-13"] }],
    ["이력이 배열이 아님", { ...valid, patternHistory: { until: "2026-10-13" } }],
    [
      "이력이 51개",
      {
        ...valid,
        patternHistory: Array.from({ length: 51 }, (_, i) => ({
          until: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
          pattern: pastA.pattern,
        })),
      },
    ],
  ];

  it.each(corruptCases)("손상 데이터로 처리한다: %s", async (_name, value) => {
    const result = await loadRaw(value);
    expect(result.kind).toBe("corrupt");
    expectNoWrites();
  });

  it("패턴 초기화 후 현재 패턴 없이 이력만 남은 설정은 정상으로 복원한다", async () => {
    const afterReset = { ...valid, pattern: null, patternHistory: [pastA] };
    const result = await loadRaw(afterReset);
    expect(result).toEqual({ kind: "ok", settings: afterReset });
    expectNoWrites();
  });

  it("이력이 정확히 50개이면 정상이다", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      until: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      pattern: pastA.pattern,
    }));
    const result = await loadRaw({ ...valid, patternHistory: fifty });
    expect(result.kind).toBe("ok");
  });
});
