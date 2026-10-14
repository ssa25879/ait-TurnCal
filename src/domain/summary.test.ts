import { describe, expect, it } from "vitest";
import type { DayEntry, DayRecord } from "./dayEntries";
import { buildDaySummary, buildTodaySummary } from "./summary";
import type { WorkPattern } from "./types";

// 2026-10-13부터 주간·오후·야간·비번·휴무 5일 주기
const pattern: WorkPattern = {
  startDate: "2026-10-13",
  cycle: ["DAY", "EVENING", "NIGHT", "AFTER_NIGHT", "OFF"],
};

let seq = 0;
function entry(name: string, extra: Partial<DayEntry> = {}): DayEntry {
  seq += 1;
  return { id: `s${seq}`, name, createdAt: seq, ...extra };
}

describe("buildTodaySummary", () => {
  it("오늘·내일 순서로 패턴 근무를 돌려준다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-14", pattern, {});
    expect(today).toMatchObject({ date: "2026-10-14", shift: "EVENING", overridden: false });
    expect(tomorrow).toMatchObject({ date: "2026-10-15", shift: "NIGHT", overridden: false });
  });

  it("패턴 기준일 이전 날짜도 달력과 같이 역방향으로 계산한다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-10-01", pattern, {});
    // 10-13 - 12일 → 12 % 5 = 2 → 인덱스 3(비번), 다음 날 인덱스 4(휴무)
    expect(today.shift).toBe("AFTER_NIGHT");
    expect(tomorrow.shift).toBe("OFF");
  });

  it("월말·연말 경계에서 내일이 다음 해 1월 1일이다", () => {
    const [today, tomorrow] = buildTodaySummary("2026-12-31", pattern, {});
    expect(today.date).toBe("2026-12-31");
    expect(tomorrow.date).toBe("2027-01-01");
  });

  it("2월 말(윤년)에도 내일을 올바르게 구한다", () => {
    expect(buildTodaySummary("2028-02-28", pattern, {})[1].date).toBe("2028-02-29");
    expect(buildTodaySummary("2028-02-29", pattern, {})[1].date).toBe("2028-03-01");
  });

  it("지원 범위 마지막 날에는 오늘만 돌려준다", () => {
    const result = buildTodaySummary("2100-12-31", pattern, {});
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2100-12-31");
  });

  it("지원 범위 마지막 날 전날에는 둘 다 돌려준다", () => {
    expect(buildTodaySummary("2100-12-30", pattern, {})).toHaveLength(2);
  });

  it("각 날짜의 세부 내용만 해당 날짜 요약에 쓴다", () => {
    const days: Record<string, DayRecord> = {
      "2026-10-15": { items: [entry("연차", { shift: "OFF", start: "09:00", end: "18:00" })] },
    };
    const [today, tomorrow] = buildTodaySummary("2026-10-14", pattern, days);
    expect(today).toMatchObject({ overridden: false, timeRange: null });
    expect(tomorrow).toMatchObject({ shift: "OFF", overridden: true, timeRange: "09:00~18:00" });
  });
});

describe("buildDaySummary", () => {
  it("세부 내용이 없으면 패턴 근무이고 시간·바뀐 근무 표시가 없다", () => {
    expect(buildDaySummary("2026-10-13", pattern, undefined)).toEqual({
      date: "2026-10-13",
      shift: "DAY",
      overridden: false,
      holidays: [],
      timeRange: null,
    });
  });

  it("분류 세부 내용이 있으면 그날 근무가 바뀌고 바뀐 근무로 표시한다", () => {
    const day: DayRecord = { items: [entry("휴가", { shift: "OFF" })] };
    expect(buildDaySummary("2026-10-15", pattern, day)).toMatchObject({
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
    expect(buildDaySummary("2026-10-13", pattern, day).timeRange).toBe("15:00~23:00");
  });

  it("시작 시간만 있으면 시작 시간만 보여 준다", () => {
    const day: DayRecord = { items: [entry("병원", { start: "10:30" })] };
    expect(buildDaySummary("2026-10-13", pattern, day).timeRange).toBe("10:30");
  });

  it("다음 날 종료면 다음 날 표기를 쓴다", () => {
    const day: DayRecord = { items: [entry("야근", { start: "22:00", end: "06:00" })] };
    expect(buildDaySummary("2026-10-13", pattern, day).timeRange).toBe("22:00~다음 날 06:00");
  });

  it("시작 시간 없는 항목만 있으면 시간 줄이 없다", () => {
    const day: DayRecord = { items: [entry("택배"), entry("장보기")] };
    expect(buildDaySummary("2026-10-13", pattern, day).timeRange).toBeNull();
  });

  it("시작 시간 있는 항목이 있으면 없는 항목보다 먼저 쓴다", () => {
    const day: DayRecord = { items: [entry("택배"), entry("병원", { start: "10:00" })] };
    expect(buildDaySummary("2026-10-13", pattern, day).timeRange).toBe("10:00");
  });

  it("한글날은 공휴일 이름을 보여 주되 근무는 패턴 그대로다", () => {
    const summary = buildDaySummary("2026-10-09", pattern, undefined);
    expect(summary.holidays).toEqual(["한글날"]);
    expect(summary.shift).toBe(buildDaySummary("2026-10-09", pattern, { items: [] }).shift);
    expect(summary.overridden).toBe(false);
  });

  it("개천절 대체공휴일은 전체 이름으로 보여 준다", () => {
    expect(buildDaySummary("2026-10-05", pattern, undefined).holidays).toEqual(["개천절 대체공휴일"]);
  });

  it("공휴일이 아니면 이름이 없다", () => {
    expect(buildDaySummary("2026-10-14", pattern, undefined).holidays).toEqual([]);
  });

  it("공휴일 표 범위 밖 해에도 오류 없이 빈 목록이다", () => {
    expect(buildDaySummary("2040-05-05", pattern, undefined).holidays).toEqual([]);
  });
});
