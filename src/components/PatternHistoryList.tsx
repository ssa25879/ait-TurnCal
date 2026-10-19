import { describeTimeline, type PatternTimeline, type TimelineRow } from "../domain/patternHistory";
import { type ShiftType } from "../domain/types";
import { useShiftLabels } from "./ShiftLabelsContext";

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function rangeLabel(row: TimelineRow): string {
  if (row.current) return row.from ? `${formatDate(row.from)}부터 (현재)` : "처음부터 (현재)";
  const end = formatDate(row.to ?? "");
  return row.from ? `${formatDate(row.from)}부터 ${end}까지` : `처음부터 ${end}까지`;
}

interface Props {
  timeline: PatternTimeline;
  /** 있으면 이전 패턴 행을 눌러 그 근무 순서를 편집기에 불러온다(저장하지 않음). */
  onLoad?(cycle: ShiftType[]): void;
}

function Chips({ cycle }: { cycle: ShiftType[] }) {
  const shiftLabels = useShiftLabels();
  return (
    <>
      {cycle.map((shift, i) => (
        <span key={i} className={`history-chip shift-${shift}`} aria-hidden="true">
          {shiftLabels[shift].short}
        </span>
      ))}
    </>
  );
}

/**
 * 패턴 이력. 현재 패턴이 맨 위, 이전 패턴이 최신순이다. 이력 수정·삭제는 없다.
 * `onLoad`가 있으면 이전 패턴 행은 편집기에 불러오는 버튼이고, 현재 패턴 행은 누를 수 없다.
 * 근무는 색과 한 글자 약어로 함께 보여 준다.
 */
export function PatternHistoryList({ timeline, onLoad }: Props) {
  const shiftLabels = useShiftLabels();
  const rows = describeTimeline(timeline);
  const hasHistory = timeline.history.length > 0;

  return (
    <section className="section">
      <h2 className="section-title">패턴 이력</h2>
      <p className="section-desc">
        {hasHistory ? "바꾼 날짜별로 적용된 근무 순서예요." : "바꾼 기록이 아직 없어요."}
      </p>
      <ul className="history-list">
        {rows.map((row, index) => {
          const label = rangeLabel(row);
          const names = row.cycle.map((shift) => shiftLabels[shift].name).join(", ");
          if (onLoad && !row.current) {
            return (
              <li key={index} className="history-item is-loadable">
                <button
                  type="button"
                  className="history-load"
                  aria-label={`${label}, 근무 순서 ${names}, 편집기에 불러오기`}
                  onClick={() => onLoad(row.cycle)}
                >
                  <span className="history-load-head">
                    <span className="history-range">{label}</span>
                    <span className="history-load-label">불러오기</span>
                  </span>
                  <span className="history-cycle">
                    <Chips cycle={row.cycle} />
                  </span>
                </button>
              </li>
            );
          }
          return (
            <li key={index} className={`history-item${row.current ? " is-current" : ""}`}>
              <p className="history-range">{label}</p>
              <div className="history-cycle" role="img" aria-label={`${label}, 근무 순서 ${names}`}>
                <Chips cycle={row.cycle} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
