import { Button } from "@toss/tds-mobile";
import { CalendarBanner } from "../ads/CalendarBanner";
import { addMonths, yearMonthOf, type YearMonth } from "../domain/calendar";
import { scheduleTitle } from "../domain/names";
import type { WeekStart, WorkPattern } from "../domain/types";
import type { EntriesByDate } from "../storage/entriesStorage";
import { Calendar } from "./Calendar";

interface Props {
  pattern: WorkPattern;
  weekStart: WeekStart;
  today: string;
  /** 날짜 화면에 다녀와도 보던 달을 유지하려고 상위(App)에서 관리한다. */
  month: YearMonth;
  onMonthChange(month: YearMonth): void;
  userName: string | null;
  scheduleName: string | null;
  days: EntriesByDate;
  entriesNotice: string | null;
  onSelectDate(date: string): void;
  onOpenSettings(): void;
}

export function CalendarScreen({
  pattern,
  weekStart,
  today,
  month,
  onMonthChange,
  userName,
  scheduleName,
  days,
  entriesNotice,
  onSelectDate,
  onOpenSettings,
}: Props) {
  const todayMonth = yearMonthOf(today);
  const isTodayMonth = month.year === todayMonth.year && month.month === todayMonth.month;

  return (
    <section className="calendar-screen">
      <header className="schedule-header">
        <p className="schedule-title">{scheduleTitle(scheduleName)}</p>
        {userName && <p className="schedule-owner">{userName}님</p>}
      </header>

      {entriesNotice && (
        <p className="notice-inline" role="status">
          {entriesNotice}
        </p>
      )}

      <div className="month-nav">
        <button
          type="button"
          className="month-nav-button"
          aria-label="이전 달"
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          ‹
        </button>
        <h1 className="month-title">
          {month.year}년 {month.month}월
        </h1>
        <button
          type="button"
          className="month-nav-button"
          aria-label="다음 달"
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          ›
        </button>
        <Button size="small" variant="weak" disabled={isTodayMonth} onClick={() => onMonthChange(todayMonth)}>
          오늘
        </Button>
      </div>

      <Calendar
        month={month}
        pattern={pattern}
        weekStart={weekStart}
        today={today}
        days={days}
        onSelectDate={onSelectDate}
      />

      <div className="bottom-action">
        <Button size="large" variant="weak" display="full" onClick={onOpenSettings}>
          설정
        </Button>
      </div>

      <CalendarBanner />
    </section>
  );
}
