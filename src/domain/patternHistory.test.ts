import { describe, expect, it } from "vitest";
import {
  applyPatternChange,
  describeTimeline,
  isSameSchedule,
  MAX_PATTERN_HISTORY,
  resolvePattern,
  type PatternTimeline,
} from "./patternHistory";
import { getShift } from "./schedule";
import type { WorkPattern } from "./types";

// 패턴 A: 기준일 2026-10-01, 주간·야간·휴무 (3일 주기)
const A: WorkPattern = { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] };
// 패턴 B: 오늘(2026-10-13)을 첫째 칸으로 한 주간·야간·야간·휴무 (4일 주기)
const B: WorkPattern = { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "NIGHT", "OFF"] };
const C: WorkPattern = { startDate: "2026-10-13", cycle: ["OFF", "DAY"] };
const TODAY = "2026-10-13";

const shiftOn = (date: string, timeline: PatternTimeline) => getShift(date, resolvePattern(date, timeline)!);

describe("resolvePattern", () => {
  it("이력이 없으면 현재 패턴으로 모든 날짜를 계산한다", () => {
    const timeline: PatternTimeline = { current: A, history: [] };
    expect(resolvePattern("1970-01-01", timeline)).toBe(A);
    expect(resolvePattern("2100-12-31", timeline)).toBe(A);
  });

  it("until 전날까지는 이전 패턴, until부터는 다음 패턴이다", () => {
    const timeline: PatternTimeline = { current: B, history: [{ until: "2026-10-13", pattern: A }] };
    expect(resolvePattern("2026-10-12", timeline)).toBe(A);
    expect(resolvePattern("2026-10-13", timeline)).toBe(B);
    expect(resolvePattern("2026-10-14", timeline)).toBe(B);
  });

  it("명세 예시: 10/10 주간(A), 10/12 휴무(A), 10/13 주간(B), 10/14 야간(B)", () => {
    const timeline: PatternTimeline = { current: B, history: [{ until: "2026-10-13", pattern: A }] };
    expect(shiftOn("2026-10-10", timeline)).toBe("DAY");
    expect(shiftOn("2026-10-12", timeline)).toBe("OFF");
    expect(shiftOn("2026-10-13", timeline)).toBe("DAY");
    expect(shiftOn("2026-10-14", timeline)).toBe("NIGHT");
  });

  it("이력이 여러 개여도 날짜 구간마다 맞는 패턴을 고른다", () => {
    const timeline: PatternTimeline = {
      current: C,
      history: [
        { until: "2026-09-01", pattern: A },
        { until: "2026-10-13", pattern: B },
      ],
    };
    expect(resolvePattern("2026-08-31", timeline)).toBe(A);
    expect(resolvePattern("2026-09-01", timeline)).toBe(B);
    expect(resolvePattern("2026-10-12", timeline)).toBe(B);
    expect(resolvePattern("2026-10-13", timeline)).toBe(C);
  });

  it("연말 경계에서도 문자열 날짜 비교가 맞다", () => {
    const timeline: PatternTimeline = { current: B, history: [{ until: "2027-01-01", pattern: A }] };
    expect(resolvePattern("2026-12-31", timeline)).toBe(A);
    expect(resolvePattern("2027-01-01", timeline)).toBe(B);
  });
});

describe("isSameSchedule", () => {
  it("순서와 위상이 같으면 기준일이 주기의 배수만큼 달라도 같은 일정이다", () => {
    expect(isSameSchedule(A, { ...A, startDate: "2026-10-04" })).toBe(true);
    expect(isSameSchedule(A, { ...A, startDate: "2026-09-28" })).toBe(true);
  });

  it("위상이 다르면 다른 일정이다", () => {
    expect(isSameSchedule(A, { ...A, startDate: "2026-10-02" })).toBe(false);
  });

  it("근무 순서나 길이가 다르면 다른 일정이다", () => {
    expect(isSameSchedule(A, { ...A, cycle: ["DAY", "OFF", "NIGHT"] })).toBe(false);
    expect(isSameSchedule(A, B)).toBe(false);
  });
});

describe("applyPatternChange", () => {
  const base: PatternTimeline = { current: A, history: [] };

  it("저장된 패턴이 없으면 이력 없이 새 패턴 하나로 만든다(첫 등록)", () => {
    expect(applyPatternChange(null, B, "FROM_TODAY", TODAY)).toEqual({ current: B, history: [] });
    expect(applyPatternChange(null, B, "ALL", TODAY)).toEqual({ current: B, history: [] });
  });

  it("오늘부터 적용: 이전 패턴을 오늘 전까지로 남긴다", () => {
    const next = applyPatternChange(base, B, "FROM_TODAY", TODAY);
    expect(next.current).toBe(B);
    expect(next.history).toEqual([{ until: TODAY, pattern: A }]);
    expect(shiftOn("2026-10-10", next)).toBe("DAY"); // 패턴 A 유지
    expect(shiftOn("2026-10-12", next)).toBe("OFF"); // 패턴 A 유지
    expect(shiftOn("2026-10-13", next)).toBe("DAY"); // 패턴 B
  });

  it("전체 기간 적용: 이력을 모두 지우고 모든 날짜를 새 패턴으로 계산한다", () => {
    const withHistory: PatternTimeline = { current: B, history: [{ until: TODAY, pattern: A }] };
    const next = applyPatternChange(withHistory, C, "ALL", TODAY);
    expect(next).toEqual({ current: C, history: [] });
    expect(shiftOn("2026-10-10", next)).toBe(getShift("2026-10-10", C));
  });

  it("전체 기간 적용 예시: 10/10이 새 패턴(야간)으로 바뀐다", () => {
    const next = applyPatternChange(base, B, "ALL", TODAY);
    expect(shiftOn("2026-10-10", next)).toBe("NIGHT");
  });

  it("변경 없이 저장하면 이력이 늘지 않고 타임라인이 그대로이다", () => {
    expect(applyPatternChange(base, { ...A, startDate: "2026-10-13" }, "FROM_TODAY", TODAY)).toBe(base);
  });

  it("같은 날 다시 저장하면 그날 시작한 패턴을 덮어쓰고 이력은 하나만 남는다", () => {
    const once = applyPatternChange(base, B, "FROM_TODAY", TODAY);
    const twice = applyPatternChange(once, C, "FROM_TODAY", TODAY);
    expect(twice.current).toBe(C);
    expect(twice.history).toEqual([{ until: TODAY, pattern: A }]);
    expect(shiftOn("2026-10-12", twice)).toBe("OFF"); // 여전히 패턴 A
  });

  it("다른 날 또 바꾸면 이력이 날짜순으로 쌓인다", () => {
    const once = applyPatternChange(base, B, "FROM_TODAY", "2026-10-13");
    const twice = applyPatternChange(once, C, "FROM_TODAY", "2026-11-02");
    expect(twice.history).toEqual([
      { until: "2026-10-13", pattern: A },
      { until: "2026-11-02", pattern: B },
    ]);
    expect(twice.current).toBe(C);
    expect(resolvePattern("2026-10-20", twice)).toBe(B);
  });

  it("전체 기간 적용 뒤 오늘부터 적용하면 새 이력이 처음부터 쌓인다", () => {
    const merged = applyPatternChange(applyPatternChange(base, B, "FROM_TODAY", TODAY), C, "ALL", "2026-11-02");
    const next = applyPatternChange(merged, A, "FROM_TODAY", "2026-11-02");
    expect(next.history).toEqual([{ until: "2026-11-02", pattern: C }]);
  });

  it("기기 날짜가 과거로 바뀌면 오늘 이후 기록을 버리고 날짜순을 유지한다", () => {
    const timeline: PatternTimeline = {
      current: C,
      history: [
        { until: "2026-10-13", pattern: A },
        { until: "2026-10-20", pattern: B },
      ],
    };
    const next = applyPatternChange(timeline, { startDate: "2026-10-05", cycle: ["OFF", "OFF", "DAY"] }, "FROM_TODAY", "2026-10-05");
    expect(next.history.map((past) => past.until)).toEqual(["2026-10-05"]);
    expect(next.history[0].pattern).toBe(A); // 10/05에 적용 중이던 패턴
    expect(shiftOn("2026-10-04", next)).toBe(getShift("2026-10-04", A));
    expect(shiftOn("2026-10-05", next)).toBe("OFF");
  });

  it("오늘 시작된 이력이 있는 날짜가 과거로 바뀐 경우에도 빈 기간을 만들지 않는다", () => {
    const timeline: PatternTimeline = {
      current: C,
      history: [
        { until: "2026-10-05", pattern: A },
        { until: "2026-10-20", pattern: B },
      ],
    };
    const next = applyPatternChange(timeline, { startDate: "2026-10-05", cycle: ["DAY", "OFF", "OFF", "OFF"] }, "FROM_TODAY", "2026-10-05");
    expect(next.history).toEqual([{ until: "2026-10-05", pattern: A }]);
  });

  it("이력이 50개를 넘으면 가장 오래된 기록부터 버린다", () => {
    const history = Array.from({ length: MAX_PATTERN_HISTORY }, (_, i) => ({
      until: `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      pattern: i % 2 === 0 ? A : B,
    }));
    const full: PatternTimeline = { current: C, history };
    const next = applyPatternChange(full, A, "FROM_TODAY", "2027-06-01");
    expect(next.history).toHaveLength(MAX_PATTERN_HISTORY);
    expect(next.history[0]).toEqual(history[1]); // 가장 오래된 기록이 사라짐
    expect(next.history[MAX_PATTERN_HISTORY - 1]).toEqual({ until: "2027-06-01", pattern: C });
    // 사라진 기간은 다음으로 오래된 패턴으로 계산된다
    expect(resolvePattern(history[0].until, next)).toBe(history[1].pattern);
  });

  it("연말 경계 저장: 12/31 전까지 이전 패턴, 새해 첫날부터 새 패턴", () => {
    const next = applyPatternChange(base, B, "FROM_TODAY", "2027-01-01");
    expect(next.history).toEqual([{ until: "2027-01-01", pattern: A }]);
    expect(resolvePattern("2026-12-31", next)).toBe(A);
    expect(resolvePattern("2027-01-01", next)).toBe(B);
  });

  it("입력 타임라인을 변경하지 않는다", () => {
    const history = [{ until: "2026-10-13", pattern: A }];
    const timeline: PatternTimeline = { current: B, history };
    applyPatternChange(timeline, C, "FROM_TODAY", "2026-11-02");
    expect(timeline.history).toEqual([{ until: "2026-10-13", pattern: A }]);
    expect(history).toHaveLength(1);
  });
});

describe("describeTimeline", () => {
  it("이력이 없으면 현재 패턴 한 행(처음부터 계속)이다", () => {
    expect(describeTimeline({ current: A, history: [] })).toEqual([
      { from: null, to: null, current: true, cycle: A.cycle },
    ]);
  });

  it("현재 패턴이 맨 위, 이전 패턴이 최신순이며 기간이 이어진다", () => {
    const rows = describeTimeline({
      current: C,
      history: [
        { until: "2026-09-01", pattern: A },
        { until: "2026-10-13", pattern: B },
      ],
    });
    expect(rows).toEqual([
      { from: "2026-10-13", to: null, current: true, cycle: C.cycle },
      { from: "2026-09-01", to: "2026-10-12", current: false, cycle: B.cycle },
      { from: null, to: "2026-08-31", current: false, cycle: A.cycle },
    ]);
  });

  it("명세 예시: A는 처음부터 10/12까지, B는 10/13부터 현재", () => {
    const rows = describeTimeline({ current: B, history: [{ until: "2026-10-13", pattern: A }] });
    expect(rows[0]).toMatchObject({ from: "2026-10-13", to: null, current: true });
    expect(rows[1]).toMatchObject({ from: null, to: "2026-10-12", current: false });
  });

  it("연초 until의 마지막 적용일은 전년 12월 31일이다", () => {
    const rows = describeTimeline({ current: B, history: [{ until: "2027-01-01", pattern: A }] });
    expect(rows[1].to).toBe("2026-12-31");
  });
});

describe("패턴이 없는 날짜", () => {
  it("이력도 현재 패턴도 없으면 모든 날짜가 패턴 없음이다", () => {
    const none: PatternTimeline = { current: null, history: [] };
    for (const date of ["2026-01-01", "2026-10-13", "2030-12-31"]) {
      expect(resolvePattern(date, none)).toBeNull();
    }
  });

  it("이력 종료일 경계: until 전날은 이력 패턴, until부터 패턴 없음", () => {
    const timeline: PatternTimeline = { current: null, history: [{ until: "2026-10-13", pattern: A }] };
    expect(resolvePattern("2026-10-12", timeline)).toBe(A);
    expect(resolvePattern("2026-10-13", timeline)).toBeNull();
    expect(resolvePattern("2027-01-01", timeline)).toBeNull();
  });

  it("다시 등록하면 이력을 유지하고 마지막 이력 이후는 새 패턴이다", () => {
    const none: PatternTimeline = { current: null, history: [{ until: "2026-10-13", pattern: A }] };
    const next = applyPatternChange(none, B, "FROM_TODAY", "2026-10-20");
    expect(next).toEqual({ current: B, history: [{ until: "2026-10-13", pattern: A }] });
    expect(resolvePattern("2026-10-12", next)).toBe(A);
    expect(resolvePattern("2026-10-13", next)).toBe(B);
  });

  it("이력이 없는 패턴 없음에서 등록하면 새 패턴 하나다", () => {
    expect(applyPatternChange({ current: null, history: [] }, B, "FROM_TODAY", TODAY)).toEqual({
      current: B,
      history: [],
    });
  });

  it("describeTimeline은 현재 패턴 행을 생략한다", () => {
    const rows = describeTimeline({ current: null, history: [{ until: "2026-10-13", pattern: A }] });
    expect(rows).toEqual([{ from: null, to: "2026-10-12", current: false, cycle: A.cycle }]);
    expect(describeTimeline({ current: null, history: [] })).toEqual([]);
  });
});
