import { fromUtcDayNumber, toUtcDayNumber } from "./date";
import type { WeekStart } from "./types";

export interface YearMonth {
  year: number;
  /** 1~12 */
  month: number;
}

export const GRID_CELL_COUNT = 42;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 0=일요일 … 6=토요일. 1970-01-01은 목요일(4)이다. */
function weekdayOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}

export function yearMonthOf(date: string): YearMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 해당 월을 덮는 6행 × 7열(42칸) 날짜 목록. 첫 칸은 1일이 속한 주의 시작 요일이다. */
export function buildMonthGrid({ year, month }: YearMonth, weekStart: WeekStart): string[] {
  const firstDay = toUtcDayNumber(`${year}-${pad(month)}-01`);
  const startWeekday = weekStart === "SUN" ? 0 : 1;
  const offset = (weekdayOf(firstDay) - startWeekday + 7) % 7;
  const gridStart = firstDay - offset;
  return Array.from({ length: GRID_CELL_COUNT }, (_, i) => fromUtcDayNumber(gridStart + i));
}

export function getWeekdayLabels(weekStart: WeekStart): string[] {
  return weekStart === "SUN"
    ? WEEKDAY_LABELS
    : [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]];
}
