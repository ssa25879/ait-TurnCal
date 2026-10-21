import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER,
  isReminderHour,
  isReminderShift,
  reminderLabel,
  reminderTrigger,
  resolveReminder,
} from "./calendarReminder";
import { SHIFT_TYPES } from "./types";

describe("calendarReminder", () => {
  it("시각은 18~23 정수만", () => {
    for (const ok of [18, 19, 20, 21, 22, 23]) expect(isReminderHour(ok)).toBe(true);
    for (const bad of [17, 24, 20.5, "21", null, undefined]) expect(isReminderHour(bad)).toBe(false);
  });

  it("필드가 없으면 켜짐·21시, 꺼도 시각은 유지", () => {
    expect(resolveReminder({})).toEqual(DEFAULT_REMINDER);
    expect(resolveReminder({ icsReminderHour: 20 })).toEqual({ enabled: true, hour: 20 });
    expect(resolveReminder({ icsReminderEnabled: false, icsReminderHour: 20 })).toEqual({ enabled: false, hour: 20 });
  });

  it("트리거는 종일 일정 0시 기준 몇 시간 전", () => {
    expect(reminderTrigger(18)).toBe("-PT6H");
    expect(reminderTrigger(21)).toBe("-PT3H");
    expect(reminderTrigger(23)).toBe("-PT1H");
  });

  it("알림 대상은 주간·오후·야간·당직", () => {
    expect(SHIFT_TYPES.filter(isReminderShift)).toEqual(["DAY", "EVENING", "NIGHT", "DUTY"]);
  });

  it("문구", () => {
    expect(reminderLabel({ enabled: true, hour: 20 })).toBe("전날 20:00");
    expect(reminderLabel({ enabled: false, hour: 20 })).toBe("끔");
  });
});
