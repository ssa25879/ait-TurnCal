import type { ShiftType } from "./types";

/**
 * 캘린더 파일(.ics) 알림 설정. 알림은 턴캘이 보내지 않고, 사용자가 가져온 캘린더 앱이
 * 근무일 전날 저녁에 울린다. 기본은 켜짐·21시이고 저장소에는 기본값과 다른 값만 남긴다.
 */

export const REMINDER_HOURS = [18, 19, 20, 21, 22, 23] as const;
export type ReminderHour = (typeof REMINDER_HOURS)[number];
export const DEFAULT_REMINDER_HOUR: ReminderHour = 21;

export interface ReminderSetting {
  enabled: boolean;
  /** 꺼져 있어도 유지해 다시 켜면 그대로 쓴다 */
  hour: ReminderHour;
}

export const DEFAULT_REMINDER: ReminderSetting = { enabled: true, hour: DEFAULT_REMINDER_HOUR };

/** 비번·휴무는 쉬는 날이라 알림을 넣지 않는다(이름을 바꿔도 내부 유형으로 판단). */
const REMINDER_SHIFTS: readonly ShiftType[] = ["DAY", "EVENING", "NIGHT", "DUTY"];

export function isReminderHour(value: unknown): value is ReminderHour {
  return typeof value === "number" && (REMINDER_HOURS as readonly number[]).includes(value);
}

export function isReminderShift(shift: ShiftType): boolean {
  return REMINDER_SHIFTS.includes(shift);
}

/** 저장된 선택 필드를 앱에서 쓰는 값으로. 필드가 없으면 기본값이다. */
export function resolveReminder(stored: { icsReminderEnabled?: false; icsReminderHour?: ReminderHour }): ReminderSetting {
  return {
    enabled: stored.icsReminderEnabled !== false,
    hour: stored.icsReminderHour ?? DEFAULT_REMINDER_HOUR,
  };
}

/** 종일 일정은 그날 현지 0시에 시작하므로 전날 hour시는 (24 - hour)시간 전이다. */
export function reminderTrigger(hour: ReminderHour): string {
  return `-PT${24 - hour}H`;
}

export const hourLabel = (hour: ReminderHour) => `전날 ${hour}:00`;

export function reminderLabel(setting: ReminderSetting): string {
  return setting.enabled ? hourLabel(setting.hour) : "끔";
}
