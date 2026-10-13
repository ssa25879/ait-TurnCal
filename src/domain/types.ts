export const SHIFT_TYPES = [
  "DAY",
  "EVENING",
  "NIGHT",
  "DUTY",
  "AFTER_NIGHT",
  "OFF",
] as const;

export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_LABELS: Record<ShiftType, { name: string; short: string }> = {
  DAY: { name: "주간", short: "주" },
  EVENING: { name: "오후", short: "오" },
  NIGHT: { name: "야간", short: "야" },
  DUTY: { name: "당직", short: "당" },
  AFTER_NIGHT: { name: "비번", short: "비" },
  OFF: { name: "휴무", short: "휴" },
};

export const MIN_CYCLE_LENGTH = 1;
export const MAX_CYCLE_LENGTH = 56;

export type WeekStart = "SUN" | "MON";

export interface WorkPattern {
  /** YYYY-MM-DD, 패턴의 첫째 날 */
  startDate: string;
  /** 반복되는 근무 순서, 1~56개 */
  cycle: ShiftType[];
}

export function isShiftType(value: unknown): value is ShiftType {
  return (
    typeof value === "string" &&
    (SHIFT_TYPES as readonly string[]).includes(value)
  );
}
