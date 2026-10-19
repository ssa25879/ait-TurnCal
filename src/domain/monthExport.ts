import type { YearMonth } from "./calendar";
import { addDays } from "./date";
import { getEffectiveShift, type DayRecord } from "./dayEntries";
import { resolvePattern, type PatternTimeline } from "./patternHistory";
import type { ShiftLabels } from "./shiftLabels";
import type { ShiftType } from "./types";

export interface DayShift {
  date: string;
  /** 패턴이 없는 날은 null */
  shift: ShiftType | null;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 파일 이름은 연·월·확장자로만 만든다(사용자 입력을 넣지 않는다). */
export function exportFileName({ year, month }: YearMonth, extension: "png" | "ics"): string {
  return `turncal-${year}-${pad(month)}.${extension}`;
}

/** 보고 있는 달 1일~말일의 근무. 달력 칸과 같은 규칙(그날 패턴, 세부 내용 분류 우선)을 쓴다. */
export function buildMonthShifts(
  month: YearMonth,
  timeline: PatternTimeline,
  days: Record<string, DayRecord>,
): DayShift[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month.year}-${pad(month.month)}-${pad(i + 1)}`;
    const { shift } = getEffectiveShift(date, resolvePattern(date, timeline), days[date]);
    return { date, shift };
  });
}

// ---------- iCalendar(RFC 5545) ----------

const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 75옥텟을 넘는 줄을 접는다. 이어지는 줄은 공백 한 칸으로 시작하며 UTF-8 글자 중간에서 자르지 않는다. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (date: string) => date.replace(/-/g, "");

function formatStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

export interface IcsInput {
  month: YearMonth;
  shifts: DayShift[];
  labels: ShiftLabels;
  /** 캘린더 이름(근무표 이름 · 연월) */
  title: string;
  /** 턴캘을 여는 공유 링크. 만들지 못했으면 null */
  link: string | null;
  now: Date;
}

/** 근무가 있는 날마다 하루 종일 일정 하나. 같은 날짜는 항상 같은 UID라 다시 가져오면 갱신된다. */
export function buildIcs({ shifts, labels, title, link, now }: IcsInput): string {
  const stamp = formatStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TurnCal//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(title)}`,
  ];
  for (const { date, shift } of shifts) {
    if (!shift) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:turncal-${compactDate(date)}@ait-turncal`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(date)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(date, 1))}`,
      `SUMMARY:${escapeText(labels[shift].name)}`,
      "TRANSP:TRANSPARENT",
    );
    if (link) lines.push(`DESCRIPTION:${escapeText(`턴캘에서 보기: ${link}`)}`, `URL:${link}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------- base64 ----------

export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64Utf8(data: string): string {
  const binary = atob(data);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
