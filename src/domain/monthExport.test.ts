import { describe, expect, it } from "vitest";
import type { DayRecord } from "./dayEntries";
import {
  buildIcs,
  buildMonthShifts,
  daysInMonth,
  exportFileName,
  fromBase64Utf8,
  toBase64Utf8,
} from "./monthExport";
import type { PatternTimeline } from "./patternHistory";
import { DEFAULT_SHIFT_LABELS, resolveShiftLabels } from "./shiftLabels";

// 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-13 오후, 10-14 야간
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] } as const;
const timeline: PatternTimeline = { current: { ...A, cycle: [...A.cycle] }, history: [] };
const OCT = { year: 2026, month: 10 };
const NOW = new Date("2026-10-19T06:30:00Z");

const entry = (extra: object) => ({ id: "e1", name: "병원", start: "14:00", memo: "진료 예약", createdAt: 1, ...extra });

describe("daysInMonth / exportFileName", () => {
  it("달 길이(윤년 포함)", () => {
    expect(daysInMonth({ year: 2026, month: 10 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 11 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
  });

  it("파일 이름은 연·월·확장자로만 만든다", () => {
    expect(exportFileName({ year: 2026, month: 10 }, "png")).toBe("turncal-2026-10.png");
    expect(exportFileName({ year: 2027, month: 1 }, "ics")).toBe("turncal-2027-01.ics");
    expect(exportFileName.length).toBe(2);
  });
});

describe("buildMonthShifts", () => {
  it("1일~말일, 달력과 같은 근무 계산", () => {
    const shifts = buildMonthShifts(OCT, timeline, {});
    expect(shifts).toHaveLength(31);
    expect(shifts[0]).toEqual({ date: "2026-10-01", shift: "NIGHT" });
    expect(shifts.find((s) => s.date === "2026-10-13")?.shift).toBe("EVENING");
    expect(shifts.find((s) => s.date === "2026-10-14")?.shift).toBe("NIGHT");
  });

  it("세부 내용 분류로 바뀐 근무가 우선", () => {
    const days: Record<string, DayRecord> = { "2026-10-14": { items: [entry({ shift: "OFF" })] } };
    expect(buildMonthShifts(OCT, timeline, days).find((s) => s.date === "2026-10-14")?.shift).toBe("OFF");
  });

  it("이력 경계와 패턴 없는 날은 null", () => {
    const afterReset: PatternTimeline = { current: null, history: [{ until: "2026-10-13", pattern: { ...A, cycle: [...A.cycle] } }] };
    const shifts = buildMonthShifts(OCT, afterReset, {});
    expect(shifts.find((s) => s.date === "2026-10-12")?.shift).toBe("DAY");
    expect(shifts.find((s) => s.date === "2026-10-13")?.shift).toBeNull();
    expect(shifts.filter((s) => s.shift === null)).toHaveLength(19);
  });
});

describe("buildIcs", () => {
  const base = { month: OCT, labels: DEFAULT_SHIFT_LABELS, title: "병동 3교대 2026년 10월", now: NOW };

  const lines = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

  it("구조: CRLF·BEGIN/END 짝·VERSION·PRODID·근무 있는 날만 VEVENT", () => {
    const ics = buildIcs({ ...base, shifts: buildMonthShifts(OCT, timeline, {}), link: null });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    const l = lines(ics);
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l).toContain("VERSION:2.0");
    expect(l).toContain("PRODID:-//TurnCal//KO");
    expect(l.filter((x) => x === "BEGIN:VEVENT")).toHaveLength(31);
    expect(l.filter((x) => x === "END:VEVENT")).toHaveLength(31);
    expect(l.at(-2)).toBe("END:VCALENDAR");
  });

  it("종일 일정: 다음 날 종료, 월말은 다음 달 1일, UID 날짜 고정, SUMMARY=근무 이름", () => {
    const l = lines(buildIcs({ ...base, shifts: buildMonthShifts(OCT, timeline, {}), link: null }));
    const i = l.indexOf("UID:turncal-20261013@ait-turncal");
    expect(i).toBeGreaterThan(0);
    const event = l.slice(i - 1, l.indexOf("END:VEVENT", i));
    expect(event).toContain("DTSTART;VALUE=DATE:20261013");
    expect(event).toContain("DTEND;VALUE=DATE:20261014");
    expect(event).toContain("SUMMARY:오후");
    expect(event).toContain("DTSTAMP:20261019T063000Z");
    expect(l).toContain("DTEND;VALUE=DATE:20261101");
  });

  it("근무 없는 날은 일정이 없다", () => {
    const afterReset: PatternTimeline = { current: null, history: [{ until: "2026-10-13", pattern: { ...A, cycle: [...A.cycle] } }] };
    const l = lines(buildIcs({ ...base, shifts: buildMonthShifts(OCT, afterReset, {}), link: null }));
    expect(l.filter((x) => x === "BEGIN:VEVENT")).toHaveLength(12);
    expect(l).not.toContain("UID:turncal-20261013@ait-turncal");
  });

  it("사용자 정의 이름과 텍스트 이스케이프", () => {
    const labels = resolveShiftLabels({ EVENING: { name: "저녁;,\\", short: "저", color: "ORANGE" } });
    const l = lines(buildIcs({ ...base, labels, shifts: buildMonthShifts(OCT, timeline, {}), link: null }));
    expect(l).toContain("SUMMARY:저녁\\;\\,\\\\");
    expect(l).toContain("X-WR-CALNAME:병동 3교대 2026년 10월");
  });

  it("링크가 있으면 DESCRIPTION·URL, 없으면 둘 다 없음", () => {
    const shifts = buildMonthShifts(OCT, timeline, {});
    const withLink = lines(buildIcs({ ...base, shifts, link: "https://toss.im/share/abc" }));
    expect(withLink).toContain("DESCRIPTION:턴캘에서 보기: https://toss.im/share/abc");
    expect(withLink).toContain("URL:https://toss.im/share/abc");
    const without = buildIcs({ ...base, shifts, link: null });
    expect(without).not.toContain("DESCRIPTION");
    expect(without).not.toContain("URL:");
  });

  it("75옥텟을 넘는 줄은 접는다(UTF-8 기준)", () => {
    const longTitle = "가".repeat(40);
    const ics = buildIcs({ ...base, title: longTitle, shifts: buildMonthShifts(OCT, timeline, {}), link: null });
    for (const raw of ics.split("\r\n")) expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(75);
    expect(lines(ics)).toContain(`X-WR-CALNAME:${longTitle}`);
  });

  it("세부 내용 이름·시간·메모는 들어가지 않는다", () => {
    const days: Record<string, DayRecord> = { "2026-10-14": { items: [entry({ shift: "OFF" })] } };
    const ics = buildIcs({ ...base, shifts: buildMonthShifts(OCT, timeline, days), link: null });
    expect(ics).not.toContain("병원");
    expect(ics).not.toContain("14:00");
    expect(ics).not.toContain("진료");
    expect(lines(ics)).toContain("SUMMARY:휴무");
  });
});

describe("toBase64Utf8", () => {
  it("한글을 깨지지 않게 왕복한다", () => {
    const text = "BEGIN:VCALENDAR\r\nSUMMARY:야간 근무 🌙\r\n";
    expect(fromBase64Utf8(toBase64Utf8(text))).toBe(text);
    expect(toBase64Utf8("A")).toBe("QQ==");
  });
});
