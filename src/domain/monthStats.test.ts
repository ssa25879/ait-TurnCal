import { describe, expect, it } from "vitest";
import type { DayEntry, DayRecord } from "./dayEntries";
import { buildMonthStats } from "./monthStats";
import type { PatternTimeline } from "./patternHistory";
import { SHIFT_TYPES, type WorkPattern } from "./types";

// 1일부터 주간·오후·야간·비번·휴무 5일 주기
const pattern = (startDate: string): WorkPattern => ({
  startDate,
  cycle: ["DAY", "EVENING", "NIGHT", "AFTER_NIGHT", "OFF"],
});

const timelineOf = (startDate: string): PatternTimeline => ({ current: pattern(startDate), history: [] });
const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

let seq = 0;
function entry(name: string, extra: Partial<DayEntry> = {}): DayEntry {
  seq += 1;
  return { id: `m${seq}`, name, createdAt: seq, ...extra };
}

describe("buildMonthStats", () => {
  it("모든 유형 키를 0 이상으로 돌려준다", () => {
    const { counts } = buildMonthStats({ year: 2026, month: 10 }, { current: { startDate: "2026-10-01", cycle: ["DAY"] }, history: [] }, {});
    expect(Object.keys(counts)).toEqual([...SHIFT_TYPES]);
    expect(counts.DAY).toBe(31);
    expect(counts.DUTY).toBe(0);
  });

  it.each([
    [{ year: 2026, month: 10 }, 31],
    [{ year: 2026, month: 11 }, 30],
    [{ year: 2026, month: 2 }, 28],
    [{ year: 2028, month: 2 }, 29],
    [{ year: 2026, month: 12 }, 31],
  ])("%j: 합계가 그달 일수와 같다", (month, days) => {
    const stats = buildMonthStats(month, timelineOf("2026-10-01"), {});
    expect(total(stats.counts)).toBe(days);
    expect(stats.decided).toBe(days);
  });

  it("5일 주기를 31일에 돌려 유형별 일수를 센다", () => {
    // 1일=주간 … 31일은 6주기째 첫날(주간)
    const { counts } = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), {});
    expect(counts).toMatchObject({ DAY: 7, EVENING: 6, NIGHT: 6, AFTER_NIGHT: 6, OFF: 6, DUTY: 0 });
  });

  it("앞뒤 달 칸은 세지 않는다", () => {
    // 10월만 세므로 9월 말·11월 초 패턴이 달라도 합계는 10월 일수
    const stats = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-09-20"), {});
    expect(stats.decided).toBe(31);
  });

  it("패턴 기준일 이전 달도 역방향으로 계산한다", () => {
    const stats = buildMonthStats({ year: 2026, month: 9 }, timelineOf("2026-10-13"), {});
    expect(stats.decided).toBe(30);
  });

  it("세부 내용으로 바뀐 근무를 반영한다", () => {
    const base = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), {});
    // 10-03은 패턴상 야간 → 휴무로 변경
    const days: Record<string, DayRecord> = { "2026-10-03": { items: [entry("연차", { shift: "OFF" })] } };
    const changed = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), days);
    expect(changed.counts.NIGHT).toBe(base.counts.NIGHT - 1);
    expect(changed.counts.OFF).toBe(base.counts.OFF + 1);
    expect(total(changed.counts)).toBe(31);
  });

  it("근무를 바꾸지 않는 세부 내용은 무시한다", () => {
    const base = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), {});
    const days: Record<string, DayRecord> = { "2026-10-03": { items: [entry("회의")] } };
    expect(buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), days).counts).toEqual(base.counts);
  });

  it("다른 달의 세부 내용은 영향이 없다", () => {
    const base = buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), {});
    const days: Record<string, DayRecord> = { "2026-11-03": { items: [entry("연차", { shift: "OFF" })] } };
    expect(buildMonthStats({ year: 2026, month: 10 }, timelineOf("2026-10-01"), days).counts).toEqual(base.counts);
  });

  it("패턴 이력 경계에서 각 날짜에 그날 적용되던 패턴을 쓴다", () => {
    const timeline: PatternTimeline = {
      current: { startDate: "2026-10-16", cycle: ["OFF"] },
      history: [{ until: "2026-10-16", pattern: { startDate: "2026-10-01", cycle: ["DAY"] } }],
    };
    const { counts, decided } = buildMonthStats({ year: 2026, month: 10 }, timeline, {});
    // 1~15일 주간(15일), 16~31일 휴무(16일)
    expect(counts).toMatchObject({ DAY: 15, OFF: 16 });
    expect(decided).toBe(31);
  });

  it("패턴이 없으면 정해진 날이 0이다", () => {
    const stats = buildMonthStats({ year: 2026, month: 10 }, { current: null, history: [] }, {});
    expect(stats.decided).toBe(0);
    expect(total(stats.counts)).toBe(0);
  });

  it("패턴이 없어도 근무를 바꾸는 세부 내용이 있는 날만 센다", () => {
    const days: Record<string, DayRecord> = {
      "2026-10-05": { items: [entry("연차", { shift: "OFF" })] },
      "2026-10-06": { items: [entry("당직", { shift: "DUTY" })] },
    };
    const stats = buildMonthStats({ year: 2026, month: 10 }, { current: null, history: [] }, days);
    expect(stats.decided).toBe(2);
    expect(stats.counts).toMatchObject({ OFF: 1, DUTY: 1 });
  });

  it("이력의 적용 기간만 정해지고 나머지는 패턴이 없는 달을 부분 집계한다", () => {
    const timeline: PatternTimeline = {
      current: null,
      history: [{ until: "2026-10-13", pattern: { startDate: "2026-10-01", cycle: ["DAY"] } }],
    };
    const stats = buildMonthStats({ year: 2026, month: 10 }, timeline, {});
    expect(stats.decided).toBe(12);
    expect(stats.counts.DAY).toBe(12);
  });

  it("지원 범위 끝 달(1970-01, 2100-12)도 계산한다", () => {
    expect(buildMonthStats({ year: 1970, month: 1 }, timelineOf("2026-10-01"), {}).decided).toBe(31);
    expect(buildMonthStats({ year: 2100, month: 12 }, timelineOf("2026-10-01"), {}).decided).toBe(31);
  });
});
