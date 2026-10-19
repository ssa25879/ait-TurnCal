import { deriveStartDate, getTodayIndex, isValidCycleLength } from "./schedule";
import { MAX_CYCLE_LENGTH, type ShiftType, type WorkPattern } from "./types";

/** 설정 화면에서 [저장] 전까지 편집하는 임시 상태 */
export interface PatternDraft {
  cycle: ShiftType[];
  /** 오늘이 패턴의 몇 번째 칸인지(0부터). 아직 고르지 않았으면 null */
  todayIndex: number | null;
}

export function createDraft(saved: WorkPattern | null, today: string): PatternDraft {
  if (!saved) return { cycle: [], todayIndex: null };
  return { cycle: saved.cycle, todayIndex: getTodayIndex(today, saved) };
}

/** 이력의 근무 순서를 편집기에 불러온다. 위상은 다시 골라야 하므로 오늘 위치는 비운다. */
export function loadCycleIntoDraft(cycle: readonly ShiftType[]): PatternDraft {
  return { cycle: [...cycle], todayIndex: null };
}

/** 패턴 길이가 바뀌면 오늘 위치를 index mod length로 보정한다. */
export function adjustTodayIndex(index: number | null, length: number): number | null {
  if (index === null || length === 0) return null;
  return index % length;
}

export type SaveCheck = { ok: true } | { ok: false; reason: string };

export function canSaveDraft({ cycle, todayIndex }: PatternDraft): SaveCheck {
  if (cycle.length === 0) return { ok: false, reason: "근무 유형을 1개 이상 추가해 주세요." };
  if (!isValidCycleLength(cycle.length)) {
    return { ok: false, reason: `근무 패턴은 최대 ${MAX_CYCLE_LENGTH}개까지 만들 수 있어요.` };
  }
  if (todayIndex === null) return { ok: false, reason: "오늘에 해당하는 칸을 선택해 주세요." };
  return { ok: true };
}

/** 검증된 draft를 저장할 패턴으로 바꾼다. */
export function draftToPattern(draft: PatternDraft, today: string): WorkPattern {
  if (draft.todayIndex === null) {
    throw new Error("오늘 위치가 선택되지 않았어요.");
  }
  return { startDate: deriveStartDate(today, draft.todayIndex), cycle: draft.cycle };
}

/** 기준일을 날짜로 직접 지정하면 그에 맞는 오늘 위치로 바꾼다. */
export function setStartDateOnDraft(
  draft: PatternDraft,
  startDate: string,
  today: string,
): PatternDraft {
  if (draft.cycle.length === 0) return draft;
  return { ...draft, todayIndex: getTodayIndex(today, { startDate, cycle: draft.cycle }) };
}

export function isDraftDirty(draft: PatternDraft, saved: WorkPattern | null, today: string): boolean {
  if (!saved) return draft.cycle.length > 0;
  const original = createDraft(saved, today);
  return (
    draft.todayIndex !== original.todayIndex ||
    draft.cycle.length !== original.cycle.length ||
    draft.cycle.some((shift, i) => shift !== original.cycle[i])
  );
}
