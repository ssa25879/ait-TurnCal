import { buildMonthGrid, getWeekdayLabels, type YearMonth } from "../domain/calendar";
import { getShift } from "../domain/schedule";
import { SHIFT_LABELS, type WeekStart, type WorkPattern } from "../domain/types";

interface Props {
  month: YearMonth;
  pattern: WorkPattern;
  weekStart: WeekStart;
  today: string;
}

/** 6행 × 7열 고정 격자. 인접 월 칸은 흐리게, 오늘 칸은 테두리로 강조한다. */
export function Calendar({ month, pattern, weekStart, today }: Props) {
  const cells = buildMonthGrid(month, weekStart);
  const labels = getWeekdayLabels(weekStart);
  const monthPrefix = `${month.year}-${String(month.month).padStart(2, "0")}-`;

  return (
    <div className="calendar" role="grid" aria-label={`${month.year}년 ${month.month}월 근무표`}>
      <div className="calendar-row calendar-head" role="row">
        {labels.map((label) => (
          <span
            key={label}
            role="columnheader"
            className={`calendar-weekday${label === "일" ? " is-sunday" : ""}${label === "토" ? " is-saturday" : ""}`}
          >
            {label}
          </span>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, week) => (
        <div className="calendar-row" role="row" key={week}>
          {cells.slice(week * 7, week * 7 + 7).map((date) => {
            const shift = getShift(date, pattern);
            const outside = !date.startsWith(monthPrefix);
            const isToday = date === today;
            const day = Number(date.slice(8));
            return (
              <div
                key={date}
                role="gridcell"
                aria-label={`${date} ${SHIFT_LABELS[shift].name}${isToday ? " 오늘" : ""}`}
                aria-current={isToday ? "date" : undefined}
                className={`calendar-cell${outside ? " is-outside" : ""}${isToday ? " is-today" : ""}`}
                data-date={date}
              >
                <span className="calendar-day">{day}</span>
                <span className={`calendar-shift shift-${shift}`}>{SHIFT_LABELS[shift].short}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
