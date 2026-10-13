import { describe, expect, it } from "vitest";
import { addMonths, buildMonthGrid, getWeekdayLabels, yearMonthOf } from "./calendar";

describe("buildMonthGrid", () => {
  it("일요일 시작 2026년 10월은 09-27부터 11-07까지 42칸이다", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, "SUN");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-27");
    expect(grid[41]).toBe("2026-11-07");
  });

  it("월요일 시작 2026년 10월은 09-28부터 11-08까지 42칸이다", () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 }, "MON");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-28");
    expect(grid[41]).toBe("2026-11-08");
  });

  it("1일이 주 시작 요일이면 첫 칸이 1일이다", () => {
    expect(buildMonthGrid({ year: 2026, month: 2 }, "SUN")[0]).toBe("2026-02-01");
  });

  it("칸은 하루씩 연속된다", () => {
    const grid = buildMonthGrid({ year: 2028, month: 2 }, "MON");
    expect(grid).toContain("2028-02-29");
    expect(new Set(grid).size).toBe(42);
  });
});

describe("addMonths", () => {
  it("12월에서 다음 달은 다음 해 1월이다", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("1월에서 이전 달은 전년 12월이다", () => {
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe("yearMonthOf", () => {
  it("날짜 문자열의 연월을 구한다", () => {
    expect(yearMonthOf("2026-10-15")).toEqual({ year: 2026, month: 10 });
  });
});

describe("getWeekdayLabels", () => {
  it("주 시작 요일에 맞게 요일 머리글을 돌려준다", () => {
    expect(getWeekdayLabels("SUN")).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
    expect(getWeekdayLabels("MON")).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
  });
});
