import type { DayRecord } from "../domain/dayEntries";
import { buildTodaySummary, type DaySummary } from "../domain/summary";
import { SHIFT_LABELS, type WorkPattern } from "../domain/types";
import { formatDateTitle } from "./DayScreen";

const LABELS = ["오늘", "내일"];

interface Props {
  pattern: WorkPattern;
  today: string;
  days: Record<string, DayRecord>;
  onSelectDate(date: string): void;
}

function cardLabel(summary: DaySummary, label: string): string {
  return [
    label,
    formatDateTitle(summary.date),
    SHIFT_LABELS[summary.shift].name,
    summary.overridden ? "바뀐 근무" : null,
    ...summary.holidays,
    summary.timeRange,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * 달력 화면 위쪽의 오늘·내일 근무 요약. 보고 있는 달과 무관하게 항상 오늘 기준이며,
 * props에서 매 렌더 계산하므로 날짜·데이터가 바뀌면 자동으로 갱신된다.
 */
export function TodaySummary({ pattern, today, days, onSelectDate }: Props) {
  const summaries = buildTodaySummary(today, pattern, days);

  return (
    <div className="today-summary" aria-label="오늘과 내일 근무">
      {summaries.map((summary, index) => {
        const { name, short } = SHIFT_LABELS[summary.shift];
        return (
          <button
            key={summary.date}
            type="button"
            className={`today-card${index === 0 ? " is-today" : ""}`}
            data-date={summary.date}
            aria-label={cardLabel(summary, LABELS[index])}
            onClick={() => onSelectDate(summary.date)}
          >
            <span className="today-card-head">
              <span className="today-card-label">{LABELS[index]}</span>
              <span className="today-card-date">{formatDateTitle(summary.date)}</span>
            </span>
            <span className="today-card-shift">
              <span className={`today-card-badge shift-${summary.shift}`}>{short}</span>
              <span className="today-card-name">{name}</span>
              {summary.overridden && <span className="today-card-changed">바뀐 근무</span>}
            </span>
            {summary.holidays.length > 0 && (
              <span className="today-card-holiday">{summary.holidays.join(" · ")}</span>
            )}
            {summary.timeRange && <span className="today-card-time">{summary.timeRange}</span>}
          </button>
        );
      })}
    </div>
  );
}
