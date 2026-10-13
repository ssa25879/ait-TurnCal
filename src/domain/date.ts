const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MIN_YEAR = 1970;
export const MAX_YEAR = 2100;

/**
 * YYYY-MM-DD 형식이고, 실제로 존재하며, 지원 범위(1970~2100년) 안의 날짜인지 확인한다.
 * "2026-02-31"처럼 Date가 자동 보정하는 날짜는 거부한다.
 */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * 기기 로컬 시간대 기준의 오늘 날짜.
 * toISOString()은 UTC 날짜라 한국 시간 00:00~08:59에 전날이 되므로 쓰지 않는다.
 */
export function getTodayLocal(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 검증된 YYYY-MM-DD를 1970-01-01부터의 일수로 바꾼다(시간대·DST 영향 없음). */
export function toUtcDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** UTC 자정 타임스탬프만 다루므로 toISOString() 사용이 안전하다. */
export function fromUtcDayNumber(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtcDayNumber(toUtcDayNumber(date) + days);
}
