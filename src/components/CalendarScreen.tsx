import { Button } from "@toss/tds-mobile";
import { useState } from "react";
import { addMonths, yearMonthOf, type YearMonth } from "../domain/calendar";
import type { WeekStart, WorkPattern } from "../domain/types";
import { Calendar } from "./Calendar";

interface Props {
  pattern: WorkPattern;
  weekStart: WeekStart;
  today: string;
  onOpenSettings(): void;
}

export function CalendarScreen({
  pattern,
  weekStart,
  today,
  onOpenSettings,
}: Props) {
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(today));
  const todayMonth = yearMonthOf(today);
  const isTodayMonth = month.year === todayMonth.year && month.month === todayMonth.month;

  return (
    <section className="calendar-screen">
      <div className="month-nav">
        <button
          type="button"
          className="month-nav-button"
          aria-label="이전 달"
          onClick={() => setMonth((m) => addMonths(m, -1))}
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
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          ›
        </button>
        <Button
          size="small"
          variant="weak"
          disabled={isTodayMonth}
          onClick={() => setMonth(todayMonth)}
        >
          오늘
        </Button>
      </div>

      <Calendar month={month} pattern={pattern} weekStart={weekStart} today={today} />


      <div className="bottom-action">
        <Button size="large" variant="weak" display="full" onClick={onOpenSettings}>
          설정
        </Button>
      </div>
    </section>
  );
}
