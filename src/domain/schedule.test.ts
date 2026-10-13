import { describe, expect, it } from "vitest";
import {
  deriveStartDate,
  getShift,
  getTodayIndex,
  isValidPattern,
} from "./schedule";
import type { ShiftType, WorkPattern } from "./types";

const example: WorkPattern = {
  startDate: "2026-10-13",
  cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"],
};

describe("getShift", () => {
  it.each([
    ["2026-10-13", "DAY", "기준일"],
    ["2026-10-14", "DAY", "패턴 두 번째 값"],
    ["2026-10-15", "NIGHT", "근무 유형 전환"],
    ["2026-10-18", "OFF", "패턴 마지막 값"],
    ["2026-10-19", "DAY", "6일 주기 반복"],
    ["2026-10-12", "OFF", "기준일 이전 날짜"],
    ["2026-10-07", "DAY", "역방향 1주기 반복"],
  ])("%s → %s (%s)", (date, expected) => {
    expect(getShift(date, example)).toBe(expected);
  });

  it("월말·연말 경계를 넘어도 실제 경과 일수로 계산한다", () => {
    // 2026-10-13부터 2026-11-01까지 19일 → 19 % 6 = 1
    expect(getShift("2026-11-01", example)).toBe("DAY");
    // 2026-10-13부터 2027-01-01까지 80일 → 80 % 6 = 2
    expect(getShift("2027-01-01", example)).toBe("NIGHT");
  });

  it("윤년 2월 29일을 포함한 구간을 정확히 계산한다", () => {
    const pattern: WorkPattern = { startDate: "2028-02-28", cycle: ["DAY", "OFF"] };
    expect(getShift("2028-02-29", pattern)).toBe("OFF");
    expect(getShift("2028-03-01", pattern)).toBe("DAY");
  });

  it("일광절약시간 전환일을 지나도 하루씩 진행한다", () => {
    const pattern: WorkPattern = { startDate: "2026-03-07", cycle: ["DAY", "NIGHT", "OFF"] };
    expect(getShift("2026-03-08", pattern)).toBe("NIGHT");
    expect(getShift("2026-03-09", pattern)).toBe("OFF");
    // 2026-03-07부터 2026-11-01까지 239일 → 239 % 3 = 2
    expect(getShift("2026-11-01", pattern)).toBe("OFF");
    expect(getShift("2026-11-02", pattern)).toBe("DAY");
  });

  it("하루짜리 패턴은 모든 날짜가 같은 근무다", () => {
    const pattern: WorkPattern = { startDate: "2026-10-13", cycle: ["OFF"] };
    expect(getShift("2026-10-13", pattern)).toBe("OFF");
    expect(getShift("1999-01-01", pattern)).toBe("OFF");
    expect(getShift("2099-12-31", pattern)).toBe("OFF");
  });

  it("당직·비번을 포함한 패턴을 계산한다", () => {
    const dangbihyu: WorkPattern = { startDate: "2026-10-13", cycle: ["DUTY", "AFTER_NIGHT", "OFF"] };
    expect(getShift("2026-10-14", dangbihyu)).toBe("AFTER_NIGHT");
    expect(getShift("2026-10-16", dangbihyu)).toBe("DUTY");

    const juyabihyu: WorkPattern = {
      startDate: "2026-10-13",
      cycle: ["DAY", "NIGHT", "AFTER_NIGHT", "OFF"],
    };
    expect(getShift("2026-10-15", juyabihyu)).toBe("AFTER_NIGHT");
    expect(getShift("2026-10-12", juyabihyu)).toBe("OFF");
  });

  it("빈 패턴은 오류를 던진다", () => {
    expect(() => getShift("2026-10-13", { startDate: "2026-10-13", cycle: [] })).toThrow();
  });
});

describe("isValidPattern", () => {
  const cycleOf = (length: number): ShiftType[] => Array.from({ length }, () => "DAY");

  it("1~56개 패턴과 유효한 기준일을 허용한다", () => {
    expect(isValidPattern({ startDate: "2026-10-13", cycle: cycleOf(1) })).toBe(true);
    expect(isValidPattern({ startDate: "2026-10-13", cycle: cycleOf(56) })).toBe(true);
  });

  it("빈 패턴과 57개 패턴을 거부한다", () => {
    expect(isValidPattern({ startDate: "2026-10-13", cycle: [] })).toBe(false);
    expect(isValidPattern({ startDate: "2026-10-13", cycle: cycleOf(57) })).toBe(false);
  });

  it("유효하지 않은 기준일을 거부한다", () => {
    expect(isValidPattern({ startDate: "2026-02-31", cycle: cycleOf(3) })).toBe(false);
  });
});

describe("오늘 위치와 기준일 변환", () => {
  it("오늘 위치로 기준일을 계산한다", () => {
    expect(deriveStartDate("2026-10-15", 2)).toBe("2026-10-13");
  });

  it("연도 경계를 넘어 역산한다", () => {
    expect(deriveStartDate("2026-01-01", 3)).toBe("2025-12-29");
  });

  it("기준일로 오늘 위치를 계산한다", () => {
    expect(getTodayIndex("2026-10-15", example)).toBe(2);
    expect(getTodayIndex("2026-10-12", example)).toBe(5);
  });

  it("두 변환은 서로 역관계다", () => {
    for (let index = 0; index < example.cycle.length; index += 1) {
      const startDate = deriveStartDate("2026-10-15", index);
      expect(getTodayIndex("2026-10-15", { ...example, startDate })).toBe(index);
    }
  });
});
