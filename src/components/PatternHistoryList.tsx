import { describeTimeline, type PatternTimeline, type TimelineRow } from "../domain/patternHistory";
import { SHIFT_LABELS } from "../domain/types";

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
}

/**
 * 읽기 전용 패턴 이력. 현재 패턴이 맨 위, 이전 패턴이 최신순이다.
 * 항목을 누르는 동작은 없고(수정·삭제 없음), 근무는 색과 한 글자 약어로 함께 보여 준다.
 */
export function PatternHistoryList({ timeline }: Props) {
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
          const names = row.cycle.map((shift) => SHIFT_LABELS[shift].name).join(", ");
          return (
            <li key={index} className={`history-item${row.current ? " is-current" : ""}`}>
              <p className="history-range">{label}</p>
              <div className="history-cycle" role="img" aria-label={`${label}, 근무 순서 ${names}`}>
                {row.cycle.map((shift, i) => (
                  <span key={i} className={`history-chip shift-${shift}`} aria-hidden="true">
                    {SHIFT_LABELS[shift].short}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
