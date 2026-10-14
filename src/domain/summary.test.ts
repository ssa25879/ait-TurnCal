import { describe, expect, it } from "vitest";
import type { DayEntry, DayRecord } from "./dayEntries";
import { resolvePattern, type PatternTimeline } from "./patternHistory";
import { buildDaySummary, buildTodaySummary } from "./summary";
import { getShift } from "./schedule";
import type { WorkPattern } from "./types";

// 2026-10-13부터 주간·오후·야간·비번·휴무 5일 주기
const pattern: WorkPattern = {
  startDate: "2026-10-13",
  cycle: ["DAY", "EVENING", "NIGHT", "AFTER_NIGHT", "OFF"],
};

const timeline: PatternTimeline = { current: pattern, history: [] };

let seq = 0;
function entry(name: string, extra: Partial<DayEntry> = {}): DayEntry {
  seq += 1;
  return { id: `s${seq}`, name, createdAt: seq, ...extra };
}

describe("buildTodaySummary", () => {
  it("오늘·내일 순서로 패턴 근무를 돌려준다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-14", timeline, {});
    expect(today).toMatchObject({ date: "2026-10-14", shift: "EVENING", overridden: false });
    expect(tomorrow).toMatchObject({ date: "2026-10-15", shift: "NIGHT", overridden: false });
  });

  it("패턴 기준일 이전 날짜도 달력과 같이 역방향으로 계산한다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-01", timeline, {});
    // 10-13 - 12일 → 12 % 5 = 2 → 인덱스 3(비번), 다음 날 인덱스 4(휴무)
    expect(today.shift).toBe("AFTER_NIGHT");
    expect(tomorrow.shift).toBe("OFF");
  });

  it("월말·연말 경계에서 내일이 다음 해 1월 1일이다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-12-31", timeline, {});
    expect(today.date).toBe("2026-12-31");
    expect(tomorrow.date).toBe("2027-01-01");
  });

  it("2월 말(윤년)에도 내일을 올바르게 구한다", () => {
    expect(buildTodaySummary("2028-02-28", timeline, {})[1].date).toBe("2028-02-29");
    expect(buildTodaySummary("2028-02-29", timeline, {})[1].date).toBe("2028-03-01");
  });

  it("지원 범위 마지막 날에는 오늘만 돌려준다", () => {
    const result = buildTodaySummary("2100-12-31", timeline, {});
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2100-12-31");
  });

  it("지원 범위 마지막 날 전날에는 둘 다 돌려준다", () => {
    expect(buildTodaySummary("2100-12-30", timeline, {})).toHaveLength(2);
  });

  it("각 날짜의 세부 내용만 해당 날짜 요약에 쓴다", () => {
    const days: Record<string, DayRecord> = {
      "2026-10-15": { items: [entry("연차", { shift: "OFF", start: "09:00", end: "18:00" })] },
    };
    const [today, tomorrow] = buildTodaySummary("2026-10-14", timeline, days);
    expect(today).toMatchObject({ overridden: false, timeRange: null });
    expect(tomorrow).toMatchObject({ shift: "OFF", overridden: true, timeRange: "09:00~18:00" });
  });
});

describe("buildDaySummary", () => {
  it("세부 내용이 없으면 패턴 근무이고 시간·바뀐 근무 표시가 없다", () => {
    expect(buildDaySummary("2026-10-13", timeline, undefined)).toEqual({
      date: "2026-10-13",
      shift: "DAY",
      overridden: false,
      holidays: [],
      timeRange: null,
    });
  });

  it("분류 세부 내용이 있으면 그날 근무가 바뀌고 바뀐 근무로 표시한다", () => {
    const day: DayRecord = { items: [entry("휴가", { shift: "OFF" })] };
    expect(buildDaySummary("2026-10-15", timeline, day)).toMatchObject({
      shift: "OFF",
      overridden: true,
    });
  });

  it("시작 시간이 있는 첫 항목의 시간을 보여 준다", () => {
    const day: DayRecord = {
      items: [
        entry("회식", { start: "19:00", end: "21:00" }),
        entry("회의", { start: "15:00", end: "23:00" }),
      ],
    };
    expect(buildDaySummary("2026-10-13", timeline, day).timeRange).toBe("15:00~23:00");
  });

  it("시작 시간만 있으면 시작 시간만 보여 준다", () => {
    const day: DayRecord = { items: [entry("병원", { start: "10:30" })] };
    expect(buildDaySummary("2026-10-13", timeline, day).timeRange).toBe("10:30");
  });

  it("다음 날 종료면 다음 날 표기를 쓴다", () => {
    const day: DayRecord = { items: [entry("야근", { start: "22:00", end: "06:00" })] };
    expect(buildDaySummary("2026-10-13", timeline, day).timeRange).toBe("22:00~다음 날 06:00");
  });

  it("시작 시간 없는 항목만 있으면 시간 줄이 없다", () => {
    const day: DayRecord = { items: [entry("택배"), entry("장보기")] };
    expect(buildDaySummary("2026-10-13", timeline, day).timeRange).toBeNull();
  });

  it("시작 시간 있는 항목이 있으면 없는 항목보다 먼저 쓴다", () => {
    const day: DayRecord = { items: [entry("택배"), entry("병원", { start: "10:00" })] };
    expect(buildDaySummary("2026-10-13", timeline, day).timeRange).toBe("10:00");
  });

  it("한글날은 공휴일 이름을 보여 주되 근무는 패턴 그대로다", () => {
    const summary = buildDaySummary("2026-10-09", timeline, undefined);
    expect(summary.holidays).toEqual(["한글날"]);
    expect(summary.shift).toBe(buildDaySummary("2026-10-09", timeline, { items: [] }).shift);
    expect(summary.overridden).toBe(false);
  });

  it("개천절 대체공휴일은 전체 이름으로 보여 준다", () => {
    expect(buildDaySummary("2026-10-05", timeline, undefined).holidays).toEqual(["개천절 대체공휴일"]);
  });

  it("공휴일이 아니면 이름이 없다", () => {
    expect(buildDaySummary("2026-10-14", timeline, undefined).holidays).toEqual([]);
  });

  it("공휴일 표 범위 밖 해에도 오류 없이 빈 목록이다", () => {
    expect(buildDaySummary("2040-05-05", timeline, undefined).holidays).toEqual([]);
  });
});

describe("패턴 이력이 있는 경우", () => {
  // A: 기준일 2026-10-01 [주간, 야간, 휴무] → 10-13부터 B: 기준일 2026-10-13 [주간, 야간, 야간, 휴무]
  const A: WorkPattern = { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] };
  const B: WorkPattern = { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "NIGHT", "OFF"] };
  const withHistory: PatternTimeline = { current: B, history: [{ until: "2026-10-13", pattern: A }] };

  it("전환 전날: 오늘은 이전 패턴, 내일은 새 패턴으로 계산한다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-12", withHistory, {});
    expect(today).toMatchObject({ date: "2026-10-12", shift: getShift("2026-10-12", A) });
    expect(today.shift).toBe("OFF");
    expect(tomorrow).toMatchObject({ date: "2026-10-13", shift: "DAY" });
    expect(tomorrow.shift).toBe(getShift("2026-10-13", B));
  });

  it("전환일: 오늘·내일 모두 새 패턴이다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-13", withHistory, {});
    expect([today.shift, tomorrow.shift]).toEqual(["DAY", "NIGHT"]);
  });

  it("지난 날짜의 요약은 그날 적용되던 이전 패턴을 쓴다", () => {
    expect(buildDaySummary("2026-10-10", withHistory, undefined).shift).toBe("DAY"); // 패턴 A
    expect(buildDaySummary("2026-10-10", { current: B, history: [] }, undefined).shift).toBe("NIGHT"); // 이력이 없었다면 B
  });

  it("요약과 날짜별 패턴 계산이 항상 같다", () => {
    for (const date of ["2026-09-30", "2026-10-12", "2026-10-13", "2026-10-20"]) {
      expect(buildDaySummary(date, withHistory, undefined).shift).toBe(getShift(date, resolvePattern(date, withHistory)));
    }
  });

  it("이력이 있어도 분류 세부 내용이 근무를 바꾸는 규칙은 같다", () => {
    const day: DayRecord = { items: [entry("연차", { shift: "OFF" })] };
    expect(buildDaySummary("2026-10-10", withHistory, day)).toMatchObject({ shift: "OFF", overridden: true });
  });
});
