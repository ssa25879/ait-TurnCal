import { addDays, isValidDateString } from "./date";
import { formatTimeRange, getEffectiveShift, sortEntries, type DayRecord } from "./dayEntries";
import { getHolidays } from "./holidays";
import type { ShiftType, WorkPattern } from "./types";

/** 달력 화면 위쪽 오늘·내일 카드 하나에 필요한 값 */
export interface DaySummary {
  /** YYYY-MM-DD */
  date: string;
  shift: ShiftType;
  /** 세부 내용 분류로 패턴 근무가 바뀐 날 */
  overridden: boolean;
  /** 공휴일 전체 이름(여러 개면 모두). 근무 계산에는 영향이 없다. */
  holidays: string[];
  /** 시간순 첫 세부 내용이 시작 시간을 가질 때만. 없으면 null */
  timeRange: string | null;
}

/** 달력 칸과 같은 규칙(getEffectiveShift)으로 그날 요약 값을 만든다. */
export function buildDaySummary(
  date: string,
  pattern: WorkPattern,
  day: DayRecord | undefined,
): DaySummary {
  const { shift, overridden } = getEffectiveShift(date, pattern, day);
  const [first] = sortEntries(day?.items ?? []);
  return {
    date,
    shift,
    overridden,
    holidays: getHolidays(date).map((holiday) => holiday.name),
    timeRange: first ? formatTimeRange(first.start, first.end) : null,
  };
}

/**
 * [오늘, 내일] 요약. 내일이 지원 날짜 범위(~2100-12-31)를 벗어나면 오늘만 돌려준다.
 * 보고 있는 달과 무관하게 항상 오늘 기준이다.
 */
export function buildTodaySummary(
  today: string,
  pattern: WorkPattern,
  days: Record<string, DayRecord>,
): DaySummary[] {
  const dates = [today];
  const tomorrow = addDays(today, 1);
  if (isValidDateString(tomorrow)) dates.push(tomorrow);
  return dates.map((date) => buildDaySummary(date, pattern, days[date]));
}
