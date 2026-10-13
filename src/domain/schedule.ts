import { fromUtcDayNumber, isValidDateString, toUtcDayNumber } from "./date";
import {
  MAX_CYCLE_LENGTH,
  MIN_CYCLE_LENGTH,
  type ShiftType,
  type WorkPattern,
} from "./types";

export function isValidCycleLength(length: number): boolean {
  return length >= MIN_CYCLE_LENGTH && length <= MAX_CYCLE_LENGTH;
}

export function isValidPattern(pattern: WorkPattern): boolean {
  return (
    isValidDateString(pattern.startDate) &&
    isValidCycleLength(pattern.cycle.length)
  );
}

/** 음수 차이도 0..count-1 범위로 접는 순환 인덱스 */
function cycleIndex(diffDays: number, count: number): number {
  return ((diffDays % count) + count) % count;
}

/** 검증된 날짜를 받아 기준일로부터 순환한 근무 유형을 계산한다. 기준일 이전도 역방향으로 반복된다. */
export function getShift(targetDate: string, pattern: WorkPattern): ShiftType {
  const count = pattern.cycle.length;
  if (count === 0) {
    throw new Error("근무 패턴은 1개 이상이어야 합니다.");
  }
  const diffDays = toUtcDayNumber(targetDate) - toUtcDayNumber(pattern.startDate);
  return pattern.cycle[cycleIndex(diffDays, count)];
}

/** 저장된 기준일로 오늘이 패턴의 몇 번째 칸(0부터)인지 계산한다. */
export function getTodayIndex(today: string, pattern: WorkPattern): number {
  const count = pattern.cycle.length;
  if (count === 0) {
    throw new Error("근무 패턴은 1개 이상이어야 합니다.");
  }
  return cycleIndex(toUtcDayNumber(today) - toUtcDayNumber(pattern.startDate), count);
}

/** "오늘은 패턴의 todayIndex번째 칸"이라는 선택으로 기준일(패턴 첫째 날)을 계산한다. */
export function deriveStartDate(today: string, todayIndex: number): string {
  return fromUtcDayNumber(toUtcDayNumber(today) - todayIndex);
}
