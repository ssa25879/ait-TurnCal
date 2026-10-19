import { Button, ConfirmDialog } from "@toss/tds-mobile";
import { useEffect, useRef, useState } from "react";
import {
  adjustTodayIndex,
  canSaveDraft,
  createDraft,
  draftToPattern,
  isDraftDirty,
  loadCycleIntoDraft,
  setStartDateOnDraft,
  type PatternDraft,
} from "../domain/settingsDraft";
import type { ApplyScope, PatternTimeline } from "../domain/patternHistory";
import type { ShiftType, WorkPattern } from "../domain/types";
import { useCloseOnBack } from "../platform/overlayBack";
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
  /** 저장된 패턴과 이력. 이력 목록 표시에 쓴다(패턴도 이력도 없으면 null). */
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
  // 편집 중에 이력을 눌렀을 때 덮어쓰기 확인을 기다리는 근무 순서
  const [pendingLoad, setPendingLoad] = useState<ShiftType[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const topRef = useRef<HTMLElement>(null);
  useCloseOnBack(pendingLoad !== null, () => setPendingLoad(null));

  const dirty = isDraftDirty(draft, saved, today);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const check = canSaveDraft(draft);
  // 저장된 패턴을 바꾼 경우에만 적용 범위를 고른다. 변경이 없으면 항상 이력을 건드리지 않는 값이다.
  const askScope = saved !== null && dirty;

  const edit = (update: (prev: PatternDraft) => PatternDraft) => {
    setLoaded(false);
    setDraft(update);
  };

  const changeCycle = (cycle: ShiftType[]) => {
    edit((prev) => ({
      cycle,
      todayIndex: adjustTodayIndex(prev.todayIndex, cycle.length),
    }));
  };

  // 불러오기는 편집 내용만 바꾸고 저장하지 않는다. 결과가 보이도록 편집기로 올라간다.
  const applyLoad = (cycle: ShiftType[]) => {
    setPendingLoad(null);
    setDraft(loadCycleIntoDraft(cycle));
    setLoaded(true);
    topRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };

  const requestLoad = (cycle: ShiftType[]) => {
    if (dirty) setPendingLoad(cycle);
    else applyLoad(cycle);
  };

  const save = async () => {
    if (!check.ok || saving) return;
    setLoaded(false);
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
    <section className="settings" ref={topRef}>
      <h1 className="page-title">근무 패턴 설정</h1>

      <PatternEditor cycle={draft.cycle} onChange={changeCycle} />

      {loaded && (
        <p className="notice-inline" role="status">
          불러온 근무 순서예요. 오늘에 해당하는 칸을 골라 주세요.
        </p>
      )}

      <TodayPositionPicker
        cycle={draft.cycle}
        todayIndex={draft.todayIndex}
        onSelect={(todayIndex) => edit((prev) => ({ ...prev, todayIndex }))}
      />
      <StartDatePicker
        disabled={draft.cycle.length === 0}
        onPick={(startDate) => edit((prev) => setStartDateOnDraft(prev, startDate, today))}
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

      {timeline && <PatternHistoryList timeline={timeline} onLoad={requestLoad} />}

      <ConfirmDialog
        open={pendingLoad !== null}
        title="편집 중인 내용을 바꿀까요?"
        description="저장하지 않은 근무 순서가 불러온 패턴으로 바뀌어요."
        onClose={() => setPendingLoad(null)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setPendingLoad(null)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={
          <ConfirmDialog.ConfirmButton onClick={() => pendingLoad && applyLoad(pendingLoad)}>
            불러오기
          </ConfirmDialog.ConfirmButton>
        }
      />

      <div className="bottom-action">
        {saveError && <p className="error-text" role="alert">{saveError}</p>}
        {!check.ok && <p className="hint">{check.reason}</p>}
        <Button size="xlarge" display="full" disabled={!check.ok} loading={saving} onClick={save}>
          저장
        </Button>
      </div>

      <p className="notice">
        설정은 이 기기에만 저장돼요. 앱을 삭제하면 저장된 설정도 함께 삭제되고, 다른 기기와
        자동으로 동기화되지 않아요.
      </p>

      {onResetPattern && (
        <ResetAction
          title="근무 패턴 초기화"
          description="현재 반복 근무 순서와 기준일을 지우고 다시 등록해요. 패턴 이력·근무 유형·화면 설정·이름·날짜 세부 내용은 남아요."
          confirm="근무 패턴을 초기화할까요?"
          onReset={onResetPattern}
        />
      )}
    </section>
  );
}
