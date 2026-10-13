export const USER_NAME_MAX = 10;
export const SCHEDULE_NAME_MAX = 20;
export const DEFAULT_SCHEDULE_TITLE = "내 근무표";

/** 앞뒤 공백을 지우고, 비면 입력하지 않은 것(null)으로 본다. */
export function normalizeName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function isValidName(value: string | null, max: number): boolean {
  return value === null || (value.trim() === value && value.length > 0 && Array.from(value).length <= max);
}

export function scheduleTitle(scheduleName: string | null): string {
  return scheduleName ?? DEFAULT_SCHEDULE_TITLE;
}
