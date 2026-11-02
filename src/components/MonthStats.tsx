import type { DayRecord } from "../domain/dayEntries";
import type { YearMonth } from "../domain/calendar";
import { buildMonthStats } from "../domain/monthStats";
import type { PatternTimeline } from "../domain/patternHistory";
import { SHIFT_TYPES } from "../domain/types";
import { useShiftLabels } from "./ShiftLabelsContext";

interface Props {
  month: YearMonth;
  timeline: PatternTimeline;
  days: Record<string, DayRecord>;
}

/**
 * 보고 있는 달의 근무 유형별 일수. 달력 칸과 같은 판정으로 매 렌더 계산하고,
 * 근무를 정할 수 있는 날이 하루도 없으면 아무것도 그리지 않는다.
 */
export function MonthStats({ month, timeline, days }: Props) {
  const shiftLabels = useShiftLabels();
  const { counts, decided } = buildMonthStats(month, timeline, days);
  if (decided === 0) return null;

  return (
    <ul className="month-stats" aria-label={`${month.month}월 근무 통계`}>
      {SHIFT_TYPES.map((type) => (
        <li key={type} className="month-stats-item" aria-label={`${shiftLabels[type].name} ${counts[type]}일`}>
          <span className={`month-stats-badge shift-${type}`} aria-hidden="true">
            {shiftLabels[type].short}
          </span>
          <span className="month-stats-name" aria-hidden="true">
            {shiftLabels[type].name}
          </span>
          <span className="month-stats-count" aria-hidden="true">
            {counts[type]}일
          </span>
        </li>
      ))}
    </ul>
  );
}
