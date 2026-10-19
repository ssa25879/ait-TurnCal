import { Button, TextField } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import {
  DEFAULT_SHIFT_LABELS,
  SHIFT_COLOR_IDS,
  SHIFT_NAME_MAX,
  SHIFT_PALETTE,
  charLength,
  resolveShiftLabels,
  toStoredShiftLabels,
  validateShiftLabels,
  type ShiftLabel,
  type ShiftLabels,
  type StoredShiftLabels,
} from "../domain/shiftLabels";
import { SHIFT_LABELS, SHIFT_TYPES, type ShiftType } from "../domain/types";
import { ResetAction } from "./ResetAction";

interface Props {
  saved: StoredShiftLabels | undefined;
  onSave(labels: StoredShiftLabels | undefined): Promise<void>;
  /** 기본값으로 되돌려 바로 저장한다(화면에 머무른다). */
  onReset(): Promise<void>;
  onDirtyChange(dirty: boolean): void;
}

const sameStored = (a: StoredShiftLabels | undefined, b: StoredShiftLabels | undefined) =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/** 근무 유형 6종의 이름·약어·색. 유형 개수는 고정이며 [저장]을 눌렀을 때만 반영된다. */
export function ShiftLabelsScreen({ saved, onSave, onReset, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<ShiftLabels>(() => resolveShiftLabels(saved));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validateShiftLabels(draft);
  const canSave = Object.keys(errors).length === 0;
  const dirty = !sameStored(toStoredShiftLabels(draft), saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const update = (type: ShiftType, patch: Partial<ShiftLabel>) =>
    setDraft((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(toStoredShiftLabels(draft));
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요. 편집한 내용은 그대로 있어요.");
      setSaving(false);
    }
  };

  const reset = async () => {
    await onReset();
    setDraft(DEFAULT_SHIFT_LABELS);
    setError(null);
  };

  return (
    <section className="shift-labels-screen">
      <h1 className="page-title">근무 유형</h1>
      <p className="section-desc">직장에서 쓰는 이름과 한 글자 약어, 달력에 보일 색을 정해요.</p>

      {SHIFT_TYPES.map((type) => {
        const label = draft[type];
        const color = SHIFT_PALETTE[label.color];
        const fieldErrors = errors[type];
        const title = label.name.trim() || SHIFT_LABELS[type].name;
        return (
          <section key={type} className="section shift-label-card" data-shift={type}>
            <h2 className="shift-label-title">
              <span className="chip" style={{ background: color.bg, color: color.fg }} aria-hidden="true">
                {label.short.trim() || "?"}
              </span>
              {title}
              {title !== SHIFT_LABELS[type].name && (
                <span className="shift-label-default">기본 {SHIFT_LABELS[type].name}</span>
              )}
            </h2>
            <div className="form-field">
              <TextField
                variant="box"
                label="이름"
                labelOption="sustain"
                aria-label={`${SHIFT_LABELS[type].name} 이름`}
                value={label.name}
                hasError={Boolean(fieldErrors?.name)}
                help={fieldErrors?.name ?? `${charLength(label.name.trim())}/${SHIFT_NAME_MAX}`}
                onChange={(event) => update(type, { name: event.target.value })}
              />
            </div>
            <div className="form-field">
              <TextField
                variant="box"
                label="약어(한 글자)"
                labelOption="sustain"
                aria-label={`${SHIFT_LABELS[type].name} 약어`}
                value={label.short}
                hasError={Boolean(fieldErrors?.short)}
                help={fieldErrors?.short ?? "달력 칸에 보이는 글자예요."}
                onChange={(event) => update(type, { short: event.target.value })}
              />
            </div>
            <div className="shift-color-options" role="radiogroup" aria-label={`${SHIFT_LABELS[type].name} 색`}>
              {SHIFT_COLOR_IDS.map((id) => {
                const selected = id === label.color;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={SHIFT_PALETTE[id].name}
                    className={`shift-color-option${selected ? " is-selected" : ""}`}
                    style={{ background: SHIFT_PALETTE[id].bg, color: SHIFT_PALETTE[id].fg }}
                    onClick={() => update(type, { color: id })}
                  >
                    {label.short.trim() || SHIFT_LABELS[type].short}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="bottom-action">
        {!canSave && <p className="hint">입력을 확인해 주세요.</p>}
        <Button size="xlarge" display="full" disabled={!canSave} loading={saving} onClick={save}>
          저장
        </Button>
      </div>

      <ResetAction
        title="기본값으로 되돌리기"
        description="6가지 근무 유형의 이름·약어·색을 처음 값으로 되돌려요. 근무 패턴과 다른 설정은 그대로예요."
        confirm="근무 유형을 기본값으로 되돌릴까요?"
        confirmLabel="되돌리기"
        onReset={reset}
      />
    </section>
  );
}
