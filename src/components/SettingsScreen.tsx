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
import type { ApplyScope, PatternTimeline } from "../domain/patternHistory";
import type { ShiftType, WorkPattern } from "../domain/types";
import { PatternEditor } from "./PatternEditor";
import { PatternHistoryList } from "./PatternHistoryList";
import { ResetAction } from "./ResetAction";
import { StartDatePicker } from "./StartDatePicker";
import { TodayPositionPicker } from "./TodayPositionPicker";

const SCOPE_OPTIONS: ReadonlyArray<{ id: ApplyScope; title: string; desc: string }> = [
  { id: "FROM_TODAY", title: "오늘부터 적용", desc: "지난 날짜는 이전 패턴 그대로 유지돼요." },
  { id: "ALL", title: "전체 기간에 적용", desc: "지난 날짜도 새 패턴으로 다시 계산해요. 패턴 이력은 지워져요." },
];

interface Props {
  saved: WorkPattern | null;
  /** 저장된 패턴과 이력. 이력 목록 표시에 쓴다(저장된 패턴이 없으면 null). */
  timeline: PatternTimeline | null;
  today: string;
  onSave(pattern: WorkPattern, scope: ApplyScope): Promise<void>;
  onDirtyChange(dirty: boolean): void;
  /** 저장된 패턴이 있는 편집 흐름에서만 넘긴다. 없으면 초기화 버튼을 그리지 않는다. */
  onResetPattern?: () => Promise<void>;
}

/** 편집 내용은 draft로만 유지하고 [저장]을 눌렀을 때만 저장소·달력에 반영한다. */
export function SettingsScreen({ saved, timeline, today, onSave, onDirtyChange, onResetPattern }: Props) {
  const [draft, setDraft] = useState<PatternDraft>(() => createDraft(saved, today));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scope, setScope] = useState<ApplyScope>("FROM_TODAY");

  const dirty = isDraftDirty(draft, saved, today);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const check = canSaveDraft(draft);
  // 저장된 패턴을 바꾼 경우에만 적용 범위를 고른다. 변경이 없으면 항상 이력을 건드리지 않는 값이다.
  const askScope = saved !== null && dirty;

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
      await onSave(draftToPattern(draft, today), askScope ? scope : "FROM_TODAY");
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

      {askScope && (
        <section className="section">
          <h2 className="section-title">적용 범위</h2>
          <div className="scope-options" role="radiogroup" aria-label="적용 범위">
            {SCOPE_OPTIONS.map((option) => {
              const selected = option.id === scope;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`scope-option${selected ? " is-selected" : ""}`}
                  onClick={() => setScope(option.id)}
                >
                  <span className="scope-title">{option.title}</span>
                  <span className="scope-desc">{option.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {timeline && <PatternHistoryList timeline={timeline} />}

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
