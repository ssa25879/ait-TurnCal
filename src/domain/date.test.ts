import { describe, expect, it } from "vitest";
import {
  addDays,
  fromUtcDayNumber,
  getTodayLocal,
  isValidDateString,
  toUtcDayNumber,
} from "./date";

describe("isValidDateString", () => {
  it.each([
    ["2026-02-29", false, "평년 2월 29일"],
    ["2028-02-29", true, "윤년 2월 29일"],
    ["2026-02-31", false, "존재하지 않는 날짜"],
    ["2026-1-5", false, "형식 오류"],
    ["1969-12-31", false, "지원 범위 밖(하한)"],
    ["2101-01-01", false, "지원 범위 밖(상한)"],
    ["1970-01-01", true, "지원 범위 하한"],
    ["2100-12-31", true, "지원 범위 상한"],
    ["2026-13-01", false, "13월"],
    ["2026-10-00", false, "0일"],
    ["", false, "빈 문자열"],
  ])("%s → %s (%s)", (value, expected) => {
    expect(isValidDateString(value)).toBe(expected);
  });
});

describe("getTodayLocal", () => {
  it("기기 로컬 날짜를 반환한다(한국 시간 새벽에도 UTC 전날이 아님)", () => {
    expect(getTodayLocal(new Date(2026, 9, 14, 3, 0))).toBe("2026-10-14");
  });

  it("자정 직전과 직후를 구분한다", () => {
    expect(getTodayLocal(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(getTodayLocal(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
});

describe("UTC 일수 변환", () => {
  it("왕복 변환이 원래 날짜를 돌려준다", () => {
    for (const date of ["1970-01-01", "2026-10-13", "2028-02-29", "2100-12-31"]) {
      expect(fromUtcDayNumber(toUtcDayNumber(date))).toBe(date);
    }
  });

  it("윤년 2월을 포함한 일수 차이가 정확하다", () => {
    expect(toUtcDayNumber("2028-03-01") - toUtcDayNumber("2028-02-28")).toBe(2);
    expect(toUtcDayNumber("2026-03-01") - toUtcDayNumber("2026-02-28")).toBe(1);
  });

  it("일광절약시간 전환일을 지나도 하루 단위로 계산된다", () => {
    expect(toUtcDayNumber("2026-03-09") - toUtcDayNumber("2026-03-08")).toBe(1);
    expect(toUtcDayNumber("2026-11-02") - toUtcDayNumber("2026-11-01")).toBe(1);
  });
});

describe("addDays", () => {
  it("월말·연말 경계를 넘는다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -3)).toBe("2025-12-29");
  });
});
