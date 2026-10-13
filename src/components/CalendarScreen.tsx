import { Button, SegmentedControl } from "@toss/tds-mobile";
import { useState } from "react";
import { addMonths, yearMonthOf, type YearMonth } from "../domain/calendar";
import type { WeekStart, WorkPattern } from "../domain/types";
import { Calendar } from "./Calendar";

interface Props {
  pattern: WorkPattern;
  weekStart: WeekStart;
  today: string;
  weekStartError: string | null;
  onWeekStartChange(weekStart: WeekStart): void;
  onOpenSettings(): void;
}

export function CalendarScreen({
  pattern,
  weekStart,
  today,
  weekStartError,
  onWeekStartChange,
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

      <div className="week-start">
        <SegmentedControl
          size="small"
          value={weekStart}
          onChange={(value) => {
            if (value === "SUN" || value === "MON") onWeekStartChange(value);
          }}
        >
          <SegmentedControl.Item value="SUN">일요일 시작</SegmentedControl.Item>
          <SegmentedControl.Item value="MON">월요일 시작</SegmentedControl.Item>
        </SegmentedControl>
        {weekStartError && <p className="error-text" role="alert">{weekStartError}</p>}
      </div>

      <div className="bottom-action">
        <Button size="large" variant="weak" display="full" onClick={onOpenSettings}>
          근무 패턴 설정
        </Button>
      </div>
    </section>
  );
}
