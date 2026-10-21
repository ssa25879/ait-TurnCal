import { DEFAULT_THEME } from "../domain/theme";
import { removeEntries } from "./entriesStorage";
import { removeSettings, saveSettings, type StoredSettingsV3 } from "./scheduleStorage";
import { removeUserKey } from "./userKeyStorage";

/** 현재 반복 패턴·기준일만 지운다. 패턴 이력·근무 유형·화면 설정·캘린더 알림·이름·세부 내용은 유지된다. */
export async function resetPattern(settings: StoredSettingsV3): Promise<StoredSettingsV3> {
  const next: StoredSettingsV3 = { ...settings, pattern: null };
  await saveSettings(next);
  return next;
}

/** 테마 인디고, 주 시작 요일 일요일로 되돌린다. */
export async function resetDisplay(settings: StoredSettingsV3): Promise<StoredSettingsV3> {
  const next: StoredSettingsV3 = { ...settings, theme: DEFAULT_THEME, weekStart: "SUN" };
  await saveSettings(next);
  return next;
}

/**
 * 세부 내용 → 설정 → 식별키 순서로 모든 키를 지운다. 중간에 실패하면 예외를 전달하고,
 * 호출자는 저장소를 다시 읽어 실제 상태로 화면을 맞춘다.
 */
export async function resetAll(): Promise<void> {
  await removeEntries();
  await removeSettings();
  await removeUserKey();
}
