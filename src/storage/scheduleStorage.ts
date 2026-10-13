import { Storage } from "@apps-in-toss/web-framework";
import { isValidPattern } from "../domain/schedule";
import { isShiftType, type WeekStart, type WorkPattern } from "../domain/types";

export const SETTINGS_KEY = "turncal.settings";
export const CURRENT_VERSION = 1;

export interface StoredSettingsV1 {
  version: 1;
  pattern: WorkPattern;
  weekStart: WeekStart;
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; settings: StoredSettingsV1 }
  | { kind: "corrupt"; reason: string }
  | { kind: "error"; error: unknown };

type ParseResult =
  | { ok: true; settings: StoredSettingsV1 }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseV1(data: Record<string, unknown>): ParseResult {
  const { pattern, weekStart } = data;
  if (!isRecord(pattern)) return { ok: false, reason: "패턴 형식이 올바르지 않아요." };
  const { startDate, cycle } = pattern;
  if (typeof startDate !== "string" || !Array.isArray(cycle) || !cycle.every(isShiftType)) {
    return { ok: false, reason: "패턴 값이 올바르지 않아요." };
  }
  const workPattern: WorkPattern = { startDate, cycle };
  if (!isValidPattern(workPattern)) {
    return { ok: false, reason: "기준일 또는 패턴 길이가 올바르지 않아요." };
  }
  if (weekStart !== "SUN" && weekStart !== "MON") {
    return { ok: false, reason: "주 시작 요일 값이 올바르지 않아요." };
  }
  return { ok: true, settings: { version: 1, pattern: workPattern, weekStart } };
}

/**
 * 저장된 JSON을 version별로 검증·변환한다.
 * 현재 앱이 모르는 상위 version은 손상 데이터와 같이 다루되 저장값은 지우지 않는다.
 */
function migrate(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "저장된 설정을 읽을 수 없어요." };
  }
  if (!isRecord(data)) return { ok: false, reason: "저장된 설정 형식이 올바르지 않아요." };
  switch (data.version) {
    case 1:
      return parseV1(data);
    default:
      return typeof data.version === "number" && data.version > CURRENT_VERSION
        ? { ok: false, reason: "더 새로운 버전의 앱에서 저장한 설정이에요." }
        : { ok: false, reason: "저장된 설정의 버전을 알 수 없어요." };
  }
}

/** 예외를 던지지 않는다. corrupt·error 경로에서는 저장소에 아무것도 쓰지 않는다. */
export async function loadSettings(): Promise<LoadResult> {
  let raw: string | null;
  try {
    raw = await Storage.getItem(SETTINGS_KEY);
  } catch (error) {
    return { kind: "error", error };
  }
  if (raw === null) return { kind: "empty" };
  const result = migrate(raw);
  return result.ok
    ? { kind: "ok", settings: result.settings }
    : { kind: "corrupt", reason: result.reason };
}

/** 실패하면 예외를 그대로 전달해 호출자가 안내하게 한다. */
export async function saveSettings(settings: StoredSettingsV1): Promise<void> {
  await Storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
