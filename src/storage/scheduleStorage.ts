import { Storage } from "@apps-in-toss/web-framework";
import { isValidPattern } from "../domain/schedule";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "../domain/theme";
import { isShiftType, type WeekStart, type WorkPattern } from "../domain/types";

export const SETTINGS_KEY = "turncal.settings";
export const CURRENT_VERSION = 2;

/** 앱 내부에서 쓰는 설정은 항상 최신 형식(v2)이다. */
export interface StoredSettingsV2 {
  version: 2;
  pattern: WorkPattern;
  weekStart: WeekStart;
  theme: ThemeId;
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; settings: StoredSettingsV2 }
  | { kind: "corrupt"; reason: string }
  | { kind: "error"; error: unknown };

type ParseResult =
  | { ok: true; settings: StoredSettingsV2 }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** v1 필드(패턴·주 시작 요일)를 검증하고, v1에는 없는 테마를 기본값으로 채운다. */
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
  return {
    ok: true,
    settings: { version: 2, pattern: workPattern, weekStart, theme: DEFAULT_THEME },
  };
}

function parseV2(data: Record<string, unknown>): ParseResult {
  const base = parseV1(data);
  if (!base.ok) return base;
  if (!isThemeId(data.theme)) return { ok: false, reason: "테마 값이 올바르지 않아요." };
  return { ok: true, settings: { ...base.settings, theme: data.theme } };
}

/**
 * 저장된 JSON을 version별로 검증·변환한다. v1은 v2로 변환만 하고 저장소에 다시 쓰지 않는다
 * (다음 저장 때 v2로 기록된다). 현재 앱이 모르는 상위 version은 손상 데이터와 같이 다루되
 * 저장값은 지우지 않는다.
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
    case 2:
      return parseV2(data);
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
export async function saveSettings(settings: StoredSettingsV2): Promise<void> {
  await Storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
