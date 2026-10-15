import { getShift } from "./schedule";
import type { ShiftType, WorkPattern } from "./types";

export const ENTRY_NAME_MAX = 20;
export const ENTRY_MEMO_MAX = 500;

export interface DayEntry {
  id: string;
  /** 1~20자 */
  name: string;
  /** HH:MM */
  start?: string;
  /** HH:MM, start가 있을 때만. start보다 이르면 다음 날 종료 */
  end?: string;
  memo?: string;
  /** 분류. 있으면 그날 근무를 바꿀 수 있다 */
  shift?: ShiftType;
  /** 작성 순서(ms) */
  createdAt: number;
}

export interface DayRecord {
  items: DayEntry[];
  /** 그날 근무로 적용할 항목(사용자 선택) */
  shiftSourceId?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** 시작 시간이 있는 항목은 시간순으로 먼저, 없는 항목은 작성 순서로 뒤에 둔다. */
export function sortEntries(items: DayEntry[]): DayEntry[] {
  return [...items].sort((a, b) => {
    if (a.start && b.start) return a.start.localeCompare(b.start) || a.createdAt - b.createdAt;
    if (a.start) return -1;
    if (b.start) return 1;
    return a.createdAt - b.createdAt;
  });
}

/**
 * 그날 근무를 정하는 항목: 사용자가 고른 항목이 분류를 가지면 그것,
 * 아니면 분류를 가진 항목 중 가장 먼저 작성한 것.
 */
export function getShiftSource(day: DayRecord | undefined): DayEntry | null {
  if (!day) return null;
  const categorized = day.items.filter((item) => item.shift);
  if (categorized.length === 0) return null;
  const chosen = categorized.find((item) => item.id === day.shiftSourceId);
  if (chosen) return chosen;
  return categorized.reduce((first, item) => (item.createdAt < first.createdAt ? item : first));
}

export function getEffectiveShift(
  date: string,
  pattern: WorkPattern | null,
  day: DayRecord | undefined,
): { shift: ShiftType | null; overridden: boolean } {
  const source = getShiftSource(day);
  if (source?.shift) return { shift: source.shift, overridden: true };
  return { shift: pattern ? getShift(date, pattern) : null, overridden: false };
}

/** 정렬 첫 항목 이름의 첫 글자, 항목이 여러 개면 +n */
export function getCellMarker(day: DayRecord | undefined): string | null {
  if (!day || day.items.length === 0) return null;
  const [first] = sortEntries(day.items);
  const initial = Array.from(first.name.trim())[0] ?? "";
  return day.items.length > 1 ? `${initial}+${day.items.length - 1}` : initial;
}

export function formatTimeRange(start?: string, end?: string): string | null {
  if (!start) return null;
  if (!end) return start;
  return end < start ? `${start}~다음 날 ${end}` : `${start}~${end}`;
}

export interface EntryInput {
  name: string;
  start: string;
  end: string;
  memo: string;
}

export type EntryCheck =
  | { ok: true }
  | { ok: false; field: "name" | "start" | "end" | "memo"; reason: string };

export function validateEntryInput({ name, start, end, memo }: EntryInput): EntryCheck {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, field: "name", reason: "이름을 입력해 주세요." };
  if (Array.from(trimmed).length > ENTRY_NAME_MAX) {
    return { ok: false, field: "name", reason: `이름은 ${ENTRY_NAME_MAX}자까지 쓸 수 있어요.` };
  }
  if (!start && end) return { ok: false, field: "start", reason: "시작 시간을 입력해 주세요." };
  if (start && !isValidTime(start)) return { ok: false, field: "start", reason: "시작 시간 형식이 올바르지 않아요." };
  if (end && !isValidTime(end)) return { ok: false, field: "end", reason: "종료 시간 형식이 올바르지 않아요." };
  if (Array.from(memo).length > ENTRY_MEMO_MAX) {
    return { ok: false, field: "memo", reason: `내용은 ${ENTRY_MEMO_MAX}자까지 쓸 수 있어요.` };
  }
  return { ok: true };
}
