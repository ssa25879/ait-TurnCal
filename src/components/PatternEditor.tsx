import { BottomSheet, Button } from "@toss/tds-mobile";
import { useState } from "react";
import {
  MAX_CYCLE_LENGTH,
  SHIFT_LABELS,
  SHIFT_TYPES,
  isShiftType,
  type ShiftType,
} from "../domain/types";
import { useCloseOnBack } from "../platform/overlayBack";

interface Props {
  cycle: ShiftType[];
  onChange(cycle: ShiftType[]): void;
}

export function PatternEditor({ cycle, onChange }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isFull = cycle.length >= MAX_CYCLE_LENGTH;
  const closeSheet = () => setEditingIndex(null);
  useCloseOnBack(editingIndex !== null, closeSheet);

  const changeAt = (index: number, shift: ShiftType) => {
    onChange(cycle.map((value, i) => (i === index ? shift : value)));
    closeSheet();
  };

  const removeAt = (index: number) => {
    onChange(cycle.filter((_, i) => i !== index));
    closeSheet();
  };

  return (
    <section className="section">
      <h2 className="section-title">근무 순서</h2>
      <p className="section-desc">반복되는 순서대로 눌러 추가하세요. 칸을 누르면 바꾸거나 지울 수 있어요.</p>

      <div className="shift-buttons">
        {SHIFT_TYPES.map((shift) => (
          <button
            key={shift}
            type="button"
            className={`shift-button shift-${shift}`}
            disabled={isFull}
            onClick={() => onChange([...cycle, shift])}
          >
            <span className="shift-button-short">{SHIFT_LABELS[shift].short}</span>
            {SHIFT_LABELS[shift].name}
          </button>
        ))}
      </div>
      {isFull && (
        <p className="hint">근무 패턴은 최대 {MAX_CYCLE_LENGTH}개까지 만들 수 있어요.</p>
      )}

      {cycle.length === 0 ? (
        <p className="empty">아직 추가한 근무가 없어요.</p>
      ) : (
        <ol className="cycle-list" aria-label={`근무 순서 ${cycle.length}일`}>
          {cycle.map((shift, index) => (
            <li key={index}>
              <button
                type="button"
                className={`cycle-item shift-${shift}`}
                aria-label={`${index + 1}번째 ${SHIFT_LABELS[shift].name}, 바꾸거나 지우기`}
                onClick={() => setEditingIndex(index)}
              >
                <span className="cycle-item-order">{index + 1}</span>
                {SHIFT_LABELS[shift].short}
              </button>
            </li>
          ))}
        </ol>
      )}

      <BottomSheet
        open={editingIndex !== null}
        onClose={closeSheet}
        header={
          <BottomSheet.Header>
            {editingIndex !== null ? `${editingIndex + 1}번째 근무` : ""}
          </BottomSheet.Header>
        }
      >
        {editingIndex !== null && (
          <>
            <BottomSheet.Select
              options={SHIFT_TYPES.map((shift) => ({
                name: SHIFT_LABELS[shift].name,
                value: shift,
              }))}
              value={cycle[editingIndex]}
              onChange={(event) => {
                const value = event.target.value;
                if (isShiftType(value)) changeAt(editingIndex, value);
              }}
            />
            <div className="sheet-action">
              <Button
                color="danger"
                variant="weak"
                size="large"
                display="full"
                onClick={() => removeAt(editingIndex)}
              >
                이 칸 지우기
              </Button>
            </div>
          </>
        )}
      </BottomSheet>
    </section>
  );
}
