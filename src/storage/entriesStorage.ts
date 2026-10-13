import { Storage } from "@apps-in-toss/web-framework";
import { isValidDateString } from "../domain/date";
import {
  ENTRY_MEMO_MAX,
  ENTRY_NAME_MAX,
  isValidTime,
  type DayEntry,
  type DayRecord,
} from "../domain/dayEntries";
import { isShiftType } from "../domain/types";

export const ENTRIES_KEY = "turncal.entries";
export const ENTRIES_VERSION = 1;

/** 날짜(YYYY-MM-DD) → 그날 세부 내용 */
export type EntriesByDate = Record<string, DayRecord>;

export type EntriesLoadResult =
  | { kind: "empty" }
  | { kind: "ok"; days: EntriesByDate }
  | { kind: "corrupt"; reason: string }
  | { kind: "error"; error: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEntry(value: unknown): value is DayEntry {
  if (!isRecord(value)) return false;
  const { id, name, start, end, memo, shift, createdAt } = value;
  if (typeof id !== "string" || id.length === 0) return false;
  if (typeof name !== "string" || name.trim() !== name || name.length === 0) return false;
  if (Array.from(name).length > ENTRY_NAME_MAX) return false;
  if (start !== undefined && (typeof start !== "string" || !isValidTime(start))) return false;
  if (end !== undefined && (typeof end !== "string" || !isValidTime(end) || start === undefined)) return false;
  if (memo !== undefined && (typeof memo !== "string" || Array.from(memo).length > ENTRY_MEMO_MAX)) return false;
  if (shift !== undefined && !isShiftType(shift)) return false;
  return typeof createdAt === "number" && Number.isFinite(createdAt);
}

function parseDays(value: unknown): EntriesByDate | null {
  if (!isRecord(value)) return null;
  const days: EntriesByDate = {};
  for (const [date, record] of Object.entries(value)) {
    if (!isValidDateString(date) || !isRecord(record)) return null;
    const { items, shiftSourceId } = record;
    if (!Array.isArray(items) || !items.every(isValidEntry)) return null;
    if (shiftSourceId !== undefined && typeof shiftSourceId !== "string") return null;
    days[date] = shiftSourceId === undefined ? { items } : { items, shiftSourceId };
  }
  return days;
}

/** 예외를 던지지 않는다. corrupt·error 경로에서는 저장소에 아무것도 쓰지 않는다. */
export async function loadEntries(): Promise<EntriesLoadResult> {
  let raw: string | null;
  try {
    raw = await Storage.getItem(ENTRIES_KEY);
  } catch (error) {
    return { kind: "error", error };
  }
  if (raw === null) return { kind: "empty" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "corrupt", reason: "저장된 세부 내용을 읽을 수 없어요." };
  }
  if (!isRecord(data) || data.version !== ENTRIES_VERSION) {
    return { kind: "corrupt", reason: "저장된 세부 내용의 형식이나 버전을 알 수 없어요." };
  }
  const days = parseDays(data.days);
  return days ? { kind: "ok", days } : { kind: "corrupt", reason: "저장된 세부 내용 값이 올바르지 않아요." };
}

/** 항목이 없는 날짜는 지우고 저장한다. 실패하면 예외를 전달한다. */
export async function saveEntries(days: EntriesByDate): Promise<EntriesByDate> {
  const compact: EntriesByDate = {};
  for (const [date, record] of Object.entries(days)) {
    if (record.items.length > 0) compact[date] = record;
  }
  await Storage.setItem(ENTRIES_KEY, JSON.stringify({ version: ENTRIES_VERSION, days: compact }));
  return compact;
}

export async function removeEntries(): Promise<void> {
  await Storage.removeItem(ENTRIES_KEY);
}
