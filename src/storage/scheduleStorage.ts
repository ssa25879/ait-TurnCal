import { Storage } from "@apps-in-toss/web-framework";
import { isValidDateString } from "../domain/date";
import { isValidName, SCHEDULE_NAME_MAX, USER_NAME_MAX } from "../domain/names";
import { MAX_PATTERN_HISTORY, type PastPattern } from "../domain/patternHistory";
import { isValidPattern } from "../domain/schedule";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "../domain/theme";
import { isShiftType, type WeekStart, type WorkPattern } from "../domain/types";

export const SETTINGS_KEY = "turncal.settings";
export const CURRENT_VERSION = 3;

/** 앱 내부에서 쓰는 설정은 항상 최신 형식(v3)이다. */
export interface StoredSettingsV3 {
  version: 3;
  /** 근무 패턴 초기화 후에는 null */
  pattern: WorkPattern | null;
  /**
   * "오늘부터 적용"으로 패턴을 바꾼 기록(교체된 이전 패턴, until 오름차순). 없거나 비어 있으면 생략한다.
   * 이 필드를 모르는 이전 v3 앱은 무시하고 pattern으로 모든 날짜를 계산한다.
   */
  patternHistory?: PastPattern[];
  weekStart: WeekStart;
  theme: ThemeId;
  userName: string | null;
  scheduleName: string | null;
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; settings: StoredSettingsV3 }
  | { kind: "corrupt"; reason: string }
  | { kind: "error"; error: unknown };

type ParseResult =
  | { ok: true; settings: StoredSettingsV3 }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PatternResult = { ok: true; pattern: WorkPattern } | { ok: false; reason: string };

function parsePattern(pattern: unknown): PatternResult {
  if (!isRecord(pattern)) return { ok: false, reason: "패턴 형식이 올바르지 않아요." };
  const { startDate, cycle } = pattern;
  if (typeof startDate !== "string" || !Array.isArray(cycle) || !cycle.every(isShiftType)) {
    return { ok: false, reason: "패턴 값이 올바르지 않아요." };
  }
  const workPattern: WorkPattern = { startDate, cycle };
  if (!isValidPattern(workPattern)) {
    return { ok: false, reason: "기준일 또는 패턴 길이가 올바르지 않아요." };
  }
  return { ok: true, pattern: workPattern };
}

type HistoryResult = { ok: true; history: PastPattern[] } | { ok: false; reason: string };

/** patternHistory: 없으면 빈 이력. 항목 패턴·until 유효, until 엄격 증가, 최대 개수 이하여야 한다. */
function parsePatternHistory(value: unknown): HistoryResult {
  if (value === undefined) return { ok: true, history: [] };
  if (!Array.isArray(value)) return { ok: false, reason: "패턴 이력 형식이 올바르지 않아요." };
  if (value.length > MAX_PATTERN_HISTORY) return { ok: false, reason: "패턴 이력이 너무 많아요." };
  const history: PastPattern[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.until !== "string" || !isValidDateString(item.until)) {
      return { ok: false, reason: "패턴 이력의 날짜가 올바르지 않아요." };
    }
    const pattern = parsePattern(item.pattern);
    if (!pattern.ok) return { ok: false, reason: "패턴 이력의 패턴이 올바르지 않아요." };
    const previous = history[history.length - 1];
    if (previous && item.until <= previous.until) {
      return { ok: false, reason: "패턴 이력의 날짜 순서가 올바르지 않아요." };
    }
    history.push({ until: item.until, pattern: pattern.pattern });
  }
  return { ok: true, history };
}

function isWeekStart(value: unknown): value is WeekStart {
  return value === "SUN" || value === "MON";
}

/** v1(패턴·주 시작 요일): 테마는 인디고, 이름은 비어 있는 v3로 변환한다. */
function parseV1(data: Record<string, unknown>): ParseResult {
  const pattern = parsePattern(data.pattern);
  if (!pattern.ok) return pattern;
  if (!isWeekStart(data.weekStart)) return { ok: false, reason: "주 시작 요일 값이 올바르지 않아요." };
  return {
    ok: true,
    settings: {
      version: 3,
      pattern: pattern.pattern,
      weekStart: data.weekStart,
      theme: DEFAULT_THEME,
      userName: null,
      scheduleName: null,
    },
  };
}

/** v2(+테마): 이름은 비어 있는 v3로 변환한다. */
function parseV2(data: Record<string, unknown>): ParseResult {
  const base = parseV1(data);
  if (!base.ok) return base;
  if (!isThemeId(data.theme)) return { ok: false, reason: "테마 값이 올바르지 않아요." };
  return { ok: true, settings: { ...base.settings, theme: data.theme } };
}

function parseV3(data: Record<string, unknown>): ParseResult {
  let pattern: WorkPattern | null = null;
  if (data.pattern !== null) {
    const parsed = parsePattern(data.pattern);
    if (!parsed.ok) return parsed;
    pattern = parsed.pattern;
  }
  const history = parsePatternHistory(data.patternHistory);
  if (!history.ok) return history;
  if (!isWeekStart(data.weekStart)) return { ok: false, reason: "주 시작 요일 값이 올바르지 않아요." };
  if (!isThemeId(data.theme)) return { ok: false, reason: "테마 값이 올바르지 않아요." };
  const { userName, scheduleName } = data;
  if (
    !(userName === null || typeof userName === "string") ||
    !(scheduleName === null || typeof scheduleName === "string") ||
    !isValidName(userName, USER_NAME_MAX) ||
    !isValidName(scheduleName, SCHEDULE_NAME_MAX)
  ) {
    return { ok: false, reason: "이름 값이 올바르지 않아요." };
  }
  const settings: StoredSettingsV3 = {
    version: 3,
    pattern,
    weekStart: data.weekStart,
    theme: data.theme,
    userName,
    scheduleName,
  };
  if (history.history.length > 0) settings.patternHistory = history.history;
  return { ok: true, settings };
}

/**
 * 저장된 JSON을 version별로 검증·변환한다. v1·v2는 v3로 변환만 하고 저장소에 다시 쓰지 않는다
 * (다음 저장 때 v3로 기록된다). 현재 앱이 모르는 상위 version은 손상 데이터와 같이 다루되
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
    case 3:
      return parseV3(data);
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
export async function saveSettings(settings: StoredSettingsV3): Promise<void> {
  // 이력이 비면 필드를 생략해 기존 v3 형식과 같게 유지한다.
  const { patternHistory, ...rest } = settings;
  const toStore: StoredSettingsV3 =
    patternHistory && patternHistory.length > 0 ? { ...rest, patternHistory } : rest;
  await Storage.setItem(SETTINGS_KEY, JSON.stringify(toStore));
}

export async function removeSettings(): Promise<void> {
  await Storage.removeItem(SETTINGS_KEY);
}

export function createDefaultSettings(): StoredSettingsV3 {
  return {
    version: 3,
    pattern: null,
    weekStart: "SUN",
    theme: DEFAULT_THEME,
    userName: null,
    scheduleName: null,
  };
}
