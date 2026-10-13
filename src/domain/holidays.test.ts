import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import {
  HOLIDAY_FIRST_YEAR,
  HOLIDAY_LAST_YEAR,
  baseHolidays,
  getHolidays,
  withSubstitutes,
} from "./holidays";

function names(date: string): string[] {
  return getHolidays(date).map((h) => h.name);
}

function substitutesOf(year: number): string[] {
  return [...withSubstitutes(baseHolidays(year))]
    .filter(([, list]) => list.some((h) => h.short === "대체"))
    .map(([date]) => date)
    .sort();
}

function sundays(year: number): string[] {
  const out: string[] = [];
  for (let date = `${year}-01-01`; date.startsWith(`${year}-`); date = addDays(date, 1)) {
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) out.push(date);
  }
  return out;
}

describe("2027년 — 우주항공청 「2027년 월력요항」(2026-06-29)과 대조", () => {
  it("대체공휴일은 7일이다", () => {
    expect(substitutesOf(2027)).toEqual([
      "2027-02-09",
      "2027-05-03",
      "2027-07-19",
      "2027-08-16",
      "2027-10-04",
      "2027-10-11",
      "2027-12-27",
    ]);
  });

  it("일요일과 겹침을 뺀 관공서 공휴일은 72일이다", () => {
    const dates = new Set([...withSubstitutes(baseHolidays(2027)).keys(), ...sundays(2027)]);
    expect(dates.size).toBe(72);
  });

  it("설 연휴·추석 연휴 날짜", () => {
    expect(names("2027-02-06")).toEqual(["설날 전날"]);
    expect(names("2027-02-07")).toEqual(["설날"]);
    expect(names("2027-02-08")).toEqual(["설날 다음 날"]);
    expect(names("2027-02-09")).toEqual(["설날 대체공휴일"]);
    expect(names("2027-09-15")).toEqual(["추석"]);
  });

  it("대체공휴일 이름에 원래 공휴일이 들어간다", () => {
    expect(names("2027-08-16")).toEqual(["광복절 대체공휴일"]);
    expect(names("2027-05-03")).toEqual(["노동절 대체공휴일"]);
    expect(names("2027-12-27")).toEqual(["기독탄신일 대체공휴일"]);
  });
});

describe("2026년", () => {
  it("대체공휴일은 03-02, 05-25, 08-17, 10-05이다", () => {
    expect(substitutesOf(2026)).toEqual(["2026-03-02", "2026-05-25", "2026-08-17", "2026-10-05"]);
  });

  it("지방선거일·노동절·제헌절·추석 연휴", () => {
    expect(names("2026-06-03")).toEqual(["지방선거일"]);
    expect(names("2026-05-01")).toEqual(["노동절"]);
    expect(names("2026-07-17")).toEqual(["제헌절"]);
    expect(names("2026-09-24")).toEqual(["추석 전날"]);
    expect(names("2026-09-25")).toEqual(["추석"]);
    expect(names("2026-09-26")).toEqual(["추석 다음 날"]);
    expect(names("2026-10-09")).toEqual(["한글날"]);
  });

  it("현충일(토)은 대체공휴일이 없다", () => {
    expect(names("2026-06-06")).toEqual(["현충일"]);
    expect(names("2026-06-08")).toEqual([]);
  });

  it("평일은 빈 배열이다", () => {
    expect(getHolidays("2026-10-14")).toEqual([]);
  });
});

describe("대체공휴일 규칙(제3조)", () => {
  it("평일에 두 공휴일이 겹치면 다음 비공휴일 하루가 대체공휴일이다", () => {
    // 2025-05-05(월) 어린이날 = 부처님 오신 날 → 05-06 대체공휴일 하나
    const result = withSubstitutes([
      { date: "2025-05-05", name: "어린이날", short: "어린이", rule: "weekend" },
      { date: "2025-05-05", name: "부처님 오신 날", short: "부처님", rule: "weekend" },
    ]);
    expect(result.get("2025-05-05")?.map((h) => h.name)).toEqual(["어린이날", "부처님 오신 날"]);
    expect(result.get("2025-05-06")?.map((h) => h.short)).toEqual(["대체"]);
    expect(result.has("2025-05-07")).toBe(false);
  });

  it("설·추석 연휴는 토요일과 겹쳐도 대체하지 않는다", () => {
    // 2029 추석 09-21(금)~09-23(일): 일요일 하루만 대체 → 09-24(월)
    expect(substitutesOf(2029).filter((d) => d.startsWith("2029-09"))).toEqual(["2029-09-24"]);
  });

  it("대체공휴일끼리 겹치면 다음 비공휴일로 미룬다", () => {
    // 일요일에 두 대체 대상이 겹치면 월·화가 대체공휴일
    const result = withSubstitutes([
      { date: "2026-10-04", name: "가", short: "가", rule: "weekend" },
      { date: "2026-10-04", name: "나", short: "나", rule: "weekend" },
    ]);
    expect(result.get("2026-10-05")?.[0].name).toBe("가 대체공휴일");
    expect(result.get("2026-10-06")?.[0].name).toBe("나 대체공휴일");
  });

  it("2030 지방선거일은 현충일 전날을 피해 06-12이다", () => {
    expect(names("2030-06-12")).toEqual(["지방선거일"]);
    expect(names("2030-06-05")).toEqual([]);
  });
});

describe("범위와 표시 이름", () => {
  it("지원 범위는 2026~2035년이다", () => {
    expect(HOLIDAY_FIRST_YEAR).toBe(2026);
    expect(HOLIDAY_LAST_YEAR).toBe(2035);
    expect(getHolidays("2025-12-25")).toEqual([]);
    expect(getHolidays("2036-01-01")).toEqual([]);
    expect(names("2035-12-25")).toEqual(["기독탄신일"]);
  });

  it("모든 축약 이름은 3자 이하이다", () => {
    for (let year = HOLIDAY_FIRST_YEAR; year <= HOLIDAY_LAST_YEAR; year++) {
      for (const list of withSubstitutes(baseHolidays(year)).values()) {
        for (const holiday of list) expect([...holiday.short].length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("매년 설·추석 연휴가 3일씩 있다", () => {
    for (let year = HOLIDAY_FIRST_YEAR; year <= HOLIDAY_LAST_YEAR; year++) {
      const list = baseHolidays(year);
      expect(list.filter((h) => h.short === "설날")).toHaveLength(3);
      expect(list.filter((h) => h.short === "추석")).toHaveLength(3);
    }
  });
});
