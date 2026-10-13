import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clearItems: vi.fn(),
}));
vi.mock("@apps-in-toss/web-framework", () => ({ Storage: storageMock }));

import { ENTRIES_KEY, loadEntries, removeEntries, saveEntries, type EntriesByDate } from "./entriesStorage";

const days: EntriesByDate = {
  "2026-10-20": {
    items: [
      { id: "a", name: "연차", shift: "OFF", createdAt: 1 },
      { id: "b", name: "병원", start: "10:00", end: "11:00", memo: "치과", createdAt: 2 },
    ],
    shiftSourceId: "a",
  },
};

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
  storageMock.getItem.mockImplementation(async (key: string) => memory.get(key) ?? null);
  storageMock.setItem.mockImplementation(async (key: string, value: string) => void memory.set(key, value));
  storageMock.removeItem.mockImplementation(async (key: string) => void memory.delete(key));
});

describe("saveEntries / loadEntries", () => {
  it("turncal.entries에 version 1로 저장하고 그대로 복원한다", async () => {
    await saveEntries(days);
    expect(JSON.parse(memory.get(ENTRIES_KEY)!)).toEqual({ version: 1, days });
    await expect(loadEntries()).resolves.toEqual({ kind: "ok", days });
  });

  it("항목이 없는 날짜는 지우고 저장한다", async () => {
    const saved = await saveEntries({ ...days, "2026-10-21": { items: [] } });
    expect(Object.keys(saved)).toEqual(["2026-10-20"]);
    expect(Object.keys(JSON.parse(memory.get(ENTRIES_KEY)!).days)).toEqual(["2026-10-20"]);
  });

  it("값이 없으면 empty", async () => {
    await expect(loadEntries()).resolves.toEqual({ kind: "empty" });
  });

  it("쓰기 실패를 전달한다", async () => {
    storageMock.setItem.mockRejectedValueOnce(new Error("quota"));
    await expect(saveEntries(days)).rejects.toThrow("quota");
  });

  it("removeEntries는 키를 지운다", async () => {
    await saveEntries(days);
    await removeEntries();
    expect(memory.has(ENTRIES_KEY)).toBe(false);
  });

  const entry = days["2026-10-20"].items[0];
  it.each([
    ["JSON 파싱 실패", "{bad"],
    ["버전 다름", JSON.stringify({ version: 2, days })],
    ["잘못된 날짜 키", JSON.stringify({ version: 1, days: { "2026-02-31": { items: [entry] } } })],
    ["이름 21자", JSON.stringify({ version: 1, days: { "2026-10-20": { items: [{ ...entry, name: "가".repeat(21) }] } } })],
    ["종료만 있음", JSON.stringify({ version: 1, days: { "2026-10-20": { items: [{ ...entry, end: "10:00" }] } } })],
    ["잘못된 시간", JSON.stringify({ version: 1, days: { "2026-10-20": { items: [{ ...entry, start: "25:00" }] } } })],
    ["알 수 없는 분류", JSON.stringify({ version: 1, days: { "2026-10-20": { items: [{ ...entry, shift: "SWING" }] } } })],
    ["items 아님", JSON.stringify({ version: 1, days: { "2026-10-20": { items: "x" } } })],
  ])("%s이면 corrupt를 반환하고 쓰지 않는다", async (_label, raw) => {
    memory.set(ENTRIES_KEY, raw);
    const result = await loadEntries();
    expect(result.kind).toBe("corrupt");
    expect(memory.get(ENTRIES_KEY)).toBe(raw);
    expect(storageMock.setItem).not.toHaveBeenCalled();
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it("읽기 예외면 error", async () => {
    storageMock.getItem.mockRejectedValueOnce(new Error("bridge"));
    await expect(loadEntries()).resolves.toMatchObject({ kind: "error" });
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });
});
