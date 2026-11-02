import type { YearMonth } from "./calendar";
import { getEffectiveShift, type DayRecord } from "./dayEntries";
import { resolvePattern, type PatternTimeline } from "./patternHistory";
import { SHIFT_TYPES, type ShiftType } from "./types";

export interface MonthStats {
  /** 유형별 일수. 6종 키가 모두 있다. */
  counts: Record<ShiftType, number>;
  /** 근무를 정할 수 있었던 날 수. 0이면 통계를 보여 줄 근거가 없다. */
  decided: number;
}

/**
 * 보고 있는 달(앞뒤 달 칸 제외)의 근무 유형별 일수.
 * 달력 칸과 같은 규칙(그날 적용 패턴 + 세부 내용으로 바뀐 근무)으로 판정하며, 근무를 정할 수 없는 날은 세지 않는다.
 */
export function buildMonthStats(
  { year, month }: YearMonth,
  timeline: PatternTimeline,
  days: Record<string, DayRecord>,
): MonthStats {
  const counts = Object.fromEntries(SHIFT_TYPES.map((type) => [type, 0])) as Record<ShiftType, number>;
  let decided = 0;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${prefix}${String(day).padStart(2, "0")}`;
    const { shift } = getEffectiveShift(date, resolvePattern(date, timeline), days[date]);
    if (shift === null) continue;
    counts[shift] += 1;
    decided += 1;
  }
  return { counts, decided };
}
