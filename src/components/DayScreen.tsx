import { Button } from "@toss/tds-mobile";
import { weekdayOf } from "../domain/calendar";
import {
  formatTimeRange,
  getEffectiveShift,
  getShiftSource,
  sortEntries,
  type DayRecord,
} from "../domain/dayEntries";
import { getHolidays } from "../domain/holidays";
import { resolvePattern, type PatternTimeline } from "../domain/patternHistory";
import { getShift } from "../domain/schedule";
import { SHIFT_LABELS } from "../domain/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDateTitle(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[weekdayOf(date)];
  return `${month}월 ${day}일 (${weekday})`;
}

interface Props {
  date: string;
  timeline: PatternTimeline;
  day: DayRecord | undefined;
  /** 세부 내용을 불러오지 못한 상태면 편집을 막는다. */
  entriesBroken: boolean;
  error: string | null;
  onAdd(): void;
  onOpenEntry(entryId: string): void;
  onSelectShiftSource(entryId: string): void;
  onStartFresh(): void;
}

export function DayScreen({
  date,
  timeline,
  day,
  entriesBroken,
  error,
  onAdd,
  onOpenEntry,
  onSelectShiftSource,
  onStartFresh,
}: Props) {
  const items = sortEntries(day?.items ?? []);
  const pattern = resolvePattern(date, timeline);
  const patternShift = getShift(date, pattern);
  const { shift, overridden } = getEffectiveShift(date, pattern, day);
  const source = getShiftSource(day);
  const categorized = items.filter((item) => item.shift);
  const holidays = getHolidays(date);

  return (
    <section className="day-screen">
      <h1 className="page-title">{formatDateTitle(date)}</h1>
      {holidays.length > 0 && (
        <p className="day-holiday">{holidays.map((holiday) => holiday.name).join(" · ")}</p>
      )}

      <div className="day-shift">
        <span className={`chip shift-${shift}`}>{SHIFT_LABELS[shift].short}</span>
        <span>
          {overridden ? (
            <>
              근무 변경: {SHIFT_LABELS[patternShift].name} → <strong>{SHIFT_LABELS[shift].name}</strong>
            </>
          ) : (
            <>
              <strong>{SHIFT_LABELS[shift].name}</strong> 근무예요
            </>
          )}
        </span>
      </div>

      {entriesBroken ? (
        <div className="section">
          <p className="error-text" role="alert">
            저장된 세부 내용을 불러오지 못해 지금은 편집할 수 없어요. 기존 데이터는 지우지 않았어요.
          </p>
          <Button color="danger" variant="weak" size="large" display="full" onClick={onStartFresh}>
            세부 내용 비우고 새로 시작하기
          </Button>
        </div>
      ) : (
        <>
          <section className="section">
            <h2 className="section-title">세부 내용</h2>
            {items.length === 0 ? (
              <p className="empty">아직 적은 내용이 없어요.</p>
            ) : (
              <ul className="entry-list">
                {items.map((item) => {
                  const time = formatTimeRange(item.start, item.end);
                  return (
                    <li key={item.id}>
                      <button type="button" className="entry-row" onClick={() => onOpenEntry(item.id)}>
                        <span className="entry-time">{time ?? "종일"}</span>
                        <span className="entry-name">{item.name}</span>
                        {item.shift && (
                          <span className={`entry-shift shift-${item.shift}`}>{SHIFT_LABELS[item.shift].short}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {categorized.length > 1 && (
            <section className="section">
              <h2 className="section-title">그날 근무로 적용</h2>
              <p className="section-desc">분류가 있는 항목이 여러 개예요. 그날 근무로 쓸 항목을 골라 주세요.</p>
              <div className="source-options" role="radiogroup" aria-label="그날 근무로 적용할 항목">
                {categorized.map((item) => {
                  const selected = item.id === source?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`theme-option${selected ? " is-selected" : ""}`}
                      onClick={() => onSelectShiftSource(item.id)}
                    >
                      <span className={`chip shift-${item.shift}`}>{SHIFT_LABELS[item.shift!].short}</span>
                      <span className="theme-name">{item.name}</span>
                      {selected && <span className="theme-check">적용 중</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <div className="bottom-action">
            <Button size="xlarge" display="full" onClick={onAdd}>
              세부 내용 추가
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
