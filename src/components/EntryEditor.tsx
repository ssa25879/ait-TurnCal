import { Button, ConfirmDialog, TextArea, TextField } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import {
  ENTRY_MEMO_MAX,
  ENTRY_NAME_MAX,
  validateEntryInput,
  type DayEntry,
} from "../domain/dayEntries";
import { SHIFT_LABELS, SHIFT_TYPES, type ShiftType } from "../domain/types";
import { useCloseOnBack } from "../platform/overlayBack";
import { formatDateTitle } from "./DayScreen";
import { TimeInput } from "./TimeInput";

export interface EntryDraft {
  name: string;
  start: string;
  end: string;
  memo: string;
  shift: ShiftType | null;
}

function toDraft(entry: DayEntry | null): EntryDraft {
  return {
    name: entry?.name ?? "",
    start: entry?.start ?? "",
    end: entry?.end ?? "",
    memo: entry?.memo ?? "",
    shift: entry?.shift ?? null,
  };
}

function sameDraft(a: EntryDraft, b: EntryDraft): boolean {
  return a.name === b.name && a.start === b.start && a.end === b.end && a.memo === b.memo && a.shift === b.shift;
}

interface Props {
  date: string;
  entry: DayEntry | null;
  onSave(draft: EntryDraft): Promise<void>;
  onDelete(): Promise<void>;
  onDirtyChange(dirty: boolean): void;
}

/** 세부 내용 작성·수정. 저장 전에는 날짜 화면·달력이 바뀌지 않는다. */
export function EntryEditor({ date, entry, onSave, onDelete, onDirtyChange }: Props) {
  const [original] = useState(() => toDraft(entry));
  const [draft, setDraft] = useState(original);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useCloseOnBack(confirmDelete, () => setConfirmDelete(false));

  const dirty = !sameDraft(draft, original);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const check = validateEntryInput(draft);
  const fieldError = (field: "name" | "start" | "end" | "memo") =>
    showErrors && !check.ok && check.field === field ? check.reason : undefined;

  const update = (patch: Partial<EntryDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setShowErrors(true);
    if (!check.ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요. 입력한 내용은 그대로 있어요.");
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <section className="entry-editor">
      <h1 className="page-title">{entry ? "세부 내용 수정" : "세부 내용 추가"}</h1>
      <p className="section-desc">{formatDateTitle(date)}</p>

      <div className="form-field">
        <TextField
          variant="box"
          label="이름"
          labelOption="sustain"
          aria-label="이름"
          placeholder="예: 병원 예약, 연차"
          value={draft.name}
          maxLength={ENTRY_NAME_MAX + 5}
          hasError={Boolean(fieldError("name"))}
          help={fieldError("name") ?? `${Array.from(draft.name.trim()).length}/${ENTRY_NAME_MAX}`}
          onChange={(event) => update({ name: event.target.value })}
        />
      </div>

      <div className="time-row">
        <TimeInput label="시작" value={draft.start} hasError={Boolean(fieldError("start"))} onChange={(start) => update({ start })} />
        <TimeInput label="종료" value={draft.end} hasError={Boolean(fieldError("end"))} onChange={(end) => update({ end })} />
      </div>
      {(fieldError("start") || fieldError("end")) && (
        <p className="error-text">{fieldError("start") ?? fieldError("end")}</p>
      )}
      {draft.start && draft.end && draft.end < draft.start && <p className="hint">종료는 다음 날 {draft.end}로 저장돼요.</p>}

      <div className="form-field">
        <TextArea
          variant="box"
          label="내용"
          labelOption="sustain"
          aria-label="내용"
          placeholder="메모를 남겨 보세요 (선택)"
          value={draft.memo}
          height={120}
          hasError={Boolean(fieldError("memo"))}
          help={fieldError("memo") ?? `${Array.from(draft.memo).length}/${ENTRY_MEMO_MAX}`}
          onChange={(event) => update({ memo: event.target.value })}
        />
      </div>

      <section className="section">
        <h2 className="section-title">분류</h2>
        <p className="section-desc">고르면 이날 근무가 이 분류로 바뀌어요. 반복 패턴은 그대로예요.</p>
        <div className="category-options" role="radiogroup" aria-label="분류">
          <button
            type="button"
            role="radio"
            aria-checked={draft.shift === null}
            className={`category-option${draft.shift === null ? " is-selected" : ""}`}
            onClick={() => update({ shift: null })}
          >
            없음
          </button>
          {SHIFT_TYPES.map((shift) => (
            <button
              key={shift}
              type="button"
              role="radio"
              aria-checked={draft.shift === shift}
              className={`category-option shift-${shift}${draft.shift === shift ? " is-selected" : ""}`}
              onClick={() => update({ shift })}
            >
              {SHIFT_LABELS[shift].name}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="bottom-action entry-actions">
        <Button size="xlarge" display="full" loading={busy} onClick={save}>
          저장
        </Button>
        {entry && (
          <Button size="large" color="danger" variant="weak" display="full" disabled={busy} onClick={() => setConfirmDelete(true)}>
            삭제
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="이 세부 내용을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요."
        onClose={() => setConfirmDelete(false)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setConfirmDelete(false)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={
          <ConfirmDialog.ConfirmButton color="danger" onClick={() => void remove()}>
            삭제하기
          </ConfirmDialog.ConfirmButton>
        }
      />
    </section>
  );
}
