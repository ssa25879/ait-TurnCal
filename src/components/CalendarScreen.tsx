import { Button } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import { CalendarBanner } from "../ads/CalendarBanner";
import { addMonths, yearMonthOf, type YearMonth } from "../domain/calendar";
import type { ReminderSetting } from "../domain/calendarReminder";
import { scheduleTitle } from "../domain/names";
import type { PatternTimeline } from "../domain/patternHistory";
import type { WeekStart } from "../domain/types";
import { exportMonth, type ExportKind } from "../export/exportMonth";
import type { EntriesByDate } from "../storage/entriesStorage";
import { Calendar } from "./Calendar";
import { ExportSheet } from "./ExportSheet";
import { useShiftLabels } from "./ShiftLabelsContext";
import { TodaySummary } from "./TodaySummary";

interface Props {
  timeline: PatternTimeline;
  weekStart: WeekStart;
  today: string;
  /** 날짜 화면에 다녀와도 보던 달을 유지하려고 상위(App)에서 관리한다. */
  month: YearMonth;
  onMonthChange(month: YearMonth): void;
  userName: string | null;
  scheduleName: string | null;
  days: EntriesByDate;
  entriesNotice: string | null;
  /** 캘린더 파일 전날 저녁 알림 설정 */
  reminder: ReminderSetting;
  onSelectDate(date: string): void;
  /** 내비게이션 바 기능 버튼을 쓸 수 없을 때만 true: 하단에 대체 [설정] 버튼을 보인다. */
  showSettingsButton: boolean;
  onOpenSettings(): void;
  /** 근무 패턴 설정(첫 등록) 화면을 연다. */
  onRegisterPattern(): void;
  /** 설정 목록을 거치지 않고 근무 패턴 설정 화면을 연다. */
  onEditPattern(): void;
  /** 설정 목록을 거치지 않고 이름 화면을 연다. */
  onEditNames(): void;
}

export function CalendarScreen({
  timeline,
  weekStart,
  today,
  month,
  onMonthChange,
  userName,
  scheduleName,
  days,
  entriesNotice,
  reminder,
  onSelectDate,
  showSettingsButton,
  onOpenSettings,
  onRegisterPattern,
  onEditPattern,
  onEditNames,
}: Props) {
  const shiftLabels = useShiftLabels();
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  // 다른 달로 넘기면 이전 달의 내보내기 안내는 지운다(화면을 떠나면 이 컴포넌트와 함께 사라진다).
  useEffect(() => setExportNotice(null), [month.year, month.month]);

  /** 공유 창은 취소해도 성공으로 끝나므로 완료 안내는 하지 않고 실패·미지원만 알린다. */
  const runExport = async (kind: ExportKind) => {
    setExportOpen(false);
    setExporting(true);
    setExportNotice(null);
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#4F46E5";
    const result = await exportMonth(kind, {
      month,
      weekStart,
      timeline,
      days,
      labels: shiftLabels,
      scheduleTitle: scheduleTitle(scheduleName),
      primary,
      reminder,
    });
    setExporting(false);
    if (result === "unsupported") setExportNotice("토스 앱을 업데이트하면 내보낼 수 있어요.");
    if (result === "failed") setExportNotice("내보내지 못했어요. 잠시 후 다시 시도해 주세요.");
  };

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

      {timeline.current === null && (
        <div className="no-pattern-card">
          <p className="no-pattern-text">근무 패턴이 없어요</p>
          <Button className="tap-44" size="small" variant="weak" onClick={onRegisterPattern}>
            근무 패턴 등록하기
          </Button>
        </div>
      )}

      <TodaySummary timeline={timeline} today={today} days={days} onSelectDate={onSelectDate} />

      <div className="month-nav">
        <button
          type="button"
          className="month-nav-button"
          aria-label="이전 달"
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Button className="month-today" size="small" variant="weak" disabled={isTodayMonth} onClick={() => onMonthChange(todayMonth)}>
          오늘
        </Button>
      </div>

      <Calendar
        month={month}
        timeline={timeline}
        weekStart={weekStart}
        today={today}
        days={days}
        onSelectDate={onSelectDate}
      />

      <div className="bottom-action">
        <div className="shortcut-row">
          {timeline.current !== null && (
            <Button size="medium" variant="weak" display="full" onClick={onEditPattern}>
              근무 패턴 수정
            </Button>
          )}
          <Button size="medium" variant="weak" display="full" onClick={onEditNames}>
            이름 수정
          </Button>
        </div>
        {timeline.current !== null && (
          <Button
            className="export-button tap-44"
            size="medium"
            variant="weak"
            display="full"
            loading={exporting}
            onClick={() => setExportOpen(true)}
          >
            이번 달 내보내기
          </Button>
        )}
        {exportNotice && (
          <p className="notice-inline" role="alert">
            {exportNotice}
          </p>
        )}
        {showSettingsButton && (
          <Button className="tap-44" size="medium" variant="weak" display="full" onClick={onOpenSettings}>
            설정
          </Button>
        )}
      </div>

      <ExportSheet open={exportOpen} busy={exporting} reminder={reminder} onClose={() => setExportOpen(false)} onSelect={(kind) => void runExport(kind)} />

      <CalendarBanner />
    </section>
  );
}
