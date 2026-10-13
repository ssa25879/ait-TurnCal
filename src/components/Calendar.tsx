import { buildMonthGrid, getWeekdayLabels, weekdayOf, type YearMonth } from "../domain/calendar";
import { getCellMarker, getEffectiveShift } from "../domain/dayEntries";
import { getHolidays } from "../domain/holidays";
import { SHIFT_LABELS, type WeekStart, type WorkPattern } from "../domain/types";
import type { EntriesByDate } from "../storage/entriesStorage";

interface Props {
  month: YearMonth;
  pattern: WorkPattern;
  weekStart: WeekStart;
  today: string;
  days: EntriesByDate;
  onSelectDate(date: string): void;
}

/**
 * 6행 × 7열 고정 격자. 칸은 누르면 그 날짜 화면을 연다.
 * 날짜 숫자는 일요일·공휴일 빨강, 토요일 테마색이고, 그 아래 공휴일 축약 이름 줄(모든 칸에 확보)이 있다.
 * 근무 글자(세부 내용 분류로 바뀐 근무 반영, 바뀐 날은 점) 아래에 첫 세부 내용 이름 앞글자를 보여 준다.
 */
export function Calendar({ month, pattern, weekStart, today, days, onSelectDate }: Props) {
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
            const day = days[date];
            const { shift, overridden } = getEffectiveShift(date, pattern, day);
            const marker = getCellMarker(day);
            const count = day?.items.length ?? 0;
            const outside = !date.startsWith(monthPrefix);
            const isToday = date === today;
            const holidays = getHolidays(date);
            const weekday = weekdayOf(date);
            const dayTone =
              holidays.length > 0 ? " is-holiday" : weekday === 0 ? " is-sunday" : weekday === 6 ? " is-saturday" : "";
            const label = [
              date,
              ...holidays.map((holiday) => holiday.name),
              SHIFT_LABELS[shift].name,
              overridden ? "근무 변경됨" : null,
              count > 0 ? `세부 내용 ${count}개` : null,
              isToday ? "오늘" : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-current={isToday ? "date" : undefined}
                className={`calendar-cell${outside ? " is-outside" : ""}${isToday ? " is-today" : ""}`}
                data-date={date}
                onClick={() => onSelectDate(date)}
              >
                <span className={`calendar-day${dayTone}`}>{Number(date.slice(8))}</span>
                <span className="calendar-holiday" aria-hidden="true">
                  {holidays[0]?.short ?? ""}
                </span>
                <span className={`calendar-shift shift-${shift}`}>
                  {SHIFT_LABELS[shift].short}
                  {overridden && <span className="calendar-changed" aria-hidden="true" />}
                </span>
                <span className="calendar-marker" aria-hidden="true">
                  {marker ?? ""}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
