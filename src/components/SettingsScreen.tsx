import { Button } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import {
  adjustTodayIndex,
  canSaveDraft,
  createDraft,
  draftToPattern,
  isDraftDirty,
  setStartDateOnDraft,
  type PatternDraft,
} from "../domain/settingsDraft";
import type { ShiftType, WorkPattern } from "../domain/types";
import { PatternEditor } from "./PatternEditor";
import { ResetAction } from "./ResetAction";
import { StartDatePicker } from "./StartDatePicker";
import { TodayPositionPicker } from "./TodayPositionPicker";

interface Props {
  saved: WorkPattern | null;
  today: string;
  onSave(pattern: WorkPattern): Promise<void>;
  onDirtyChange(dirty: boolean): void;
  /** 저장된 패턴이 있는 편집 흐름에서만 넘긴다. 없으면 초기화 버튼을 그리지 않는다. */
  onResetPattern?: () => Promise<void>;
}

/** 편집 내용은 draft로만 유지하고 [저장]을 눌렀을 때만 저장소·달력에 반영한다. */
export function SettingsScreen({ saved, today, onSave, onDirtyChange, onResetPattern }: Props) {
  const [draft, setDraft] = useState<PatternDraft>(() => createDraft(saved, today));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = isDraftDirty(draft, saved, today);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const check = canSaveDraft(draft);

  const changeCycle = (cycle: ShiftType[]) => {
    setDraft((prev) => ({
      cycle,
      todayIndex: adjustTodayIndex(prev.todayIndex, cycle.length),
    }));
  };

  const save = async () => {
    if (!check.ok || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draftToPattern(draft, today));
    } catch {
      setSaveError("저장하지 못했어요. 잠시 후 다시 시도해 주세요. 편집한 내용은 그대로 있어요.");
      setSaving(false);
    }
  };

  return (
    <section className="settings">
      <h1 className="page-title">근무 패턴 설정</h1>

      <PatternEditor cycle={draft.cycle} onChange={changeCycle} />

      <TodayPositionPicker
        cycle={draft.cycle}
        todayIndex={draft.todayIndex}
        onSelect={(todayIndex) => setDraft((prev) => ({ ...prev, todayIndex }))}
      />
      <StartDatePicker
        disabled={draft.cycle.length === 0}
        onPick={(startDate) => setDraft((prev) => setStartDateOnDraft(prev, startDate, today))}
      />

      <p className="notice">
        설정은 이 기기에만 저장돼요. 앱을 삭제하면 저장된 설정도 함께 삭제되고, 다른 기기와
        자동으로 동기화되지 않아요.
      </p>

      {onResetPattern && (
        <ResetAction
          title="근무 패턴 초기화"
          description="반복 근무 순서와 기준일을 지우고 다시 등록해요. 화면 설정·이름·날짜 세부 내용은 남아요."
          confirm="근무 패턴을 초기화할까요?"
          onReset={onResetPattern}
        />
      )}

      <div className="bottom-action">
        {saveError && <p className="error-text" role="alert">{saveError}</p>}
        {!check.ok && <p className="hint">{check.reason}</p>}
        <Button size="xlarge" display="full" disabled={!check.ok} loading={saving} onClick={save}>
          저장
        </Button>
      </div>
    </section>
  );
}
