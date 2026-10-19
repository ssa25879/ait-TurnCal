import { type ShiftType } from "../domain/types";
import { useShiftLabels } from "./ShiftLabelsContext";

interface Props {
  cycle: ShiftType[];
  todayIndex: number | null;
  onSelect(index: number): void;
}

/** "오늘은 이 칸이에요"를 고르게 해 기준일을 계산한다. */
export function TodayPositionPicker({ cycle, todayIndex, onSelect }: Props) {
  const shiftLabels = useShiftLabels();
  return (
    <section className="section">
      <h2 className="section-title">오늘은 몇 번째 근무인가요?</h2>
      <p className="section-desc">오늘에 해당하는 칸을 고르면 지난 날과 앞으로의 근무를 계산해요.</p>
      {cycle.length === 0 ? (
        <p className="empty">근무 순서를 먼저 추가해 주세요.</p>
      ) : (
        <div className="today-picker" role="radiogroup" aria-label="오늘 위치">
          {cycle.map((shift, index) => {
            const selected = index === todayIndex;
            return (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`today-cell shift-${shift}${selected ? " is-selected" : ""}`}
                onClick={() => onSelect(index)}
              >
                <span className="cycle-item-order">{index + 1}</span>
                {shiftLabels[shift].short}
                {selected && <span className="today-badge">오늘</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
