import { BottomSheet } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import type { YearMonth } from "../domain/calendar";
import { canStepYear, stepYear } from "../domain/monthPicker";
import { useCloseOnBack } from "../platform/overlayBack";

interface Props {
  open: boolean;
  /** 지금 보고 있는 달. 시트가 열릴 때 이 연·월이 선택된 상태로 시작한다. */
  month: YearMonth;
  onClose(): void;
  onPick(month: YearMonth): void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 월 제목을 눌러 여는 연·월 직접 이동 시트. 연도는 한 해씩, 월은 1~12월 중에서 고른다. */
export function MonthPickerSheet({ open, month, onClose, onPick }: Props) {
  // 시트 안 연도는 열릴 때마다 보고 있는 연도로 시작한다(닫기 전에 넘겨 둔 연도는 버린다).
  const [year, setYear] = useState(month.year);
  useEffect(() => {
    if (open) setYear(month.year);
  }, [open, month.year]);
  useCloseOnBack(open, onClose);

  return (
    <BottomSheet open={open} onClose={onClose} header={<BottomSheet.Header>연·월 선택</BottomSheet.Header>}>
      <div className="month-picker">
        <div className="month-picker-year">
          <button
            type="button"
            className="month-nav-button"
            aria-label="이전 해"
            disabled={!canStepYear(year, -1)}
            onClick={() => setYear(stepYear(year, -1))}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="month-picker-year-text" aria-live="polite">
            {year}년
          </p>
          <button
            type="button"
            className="month-nav-button"
            aria-label="다음 해"
            disabled={!canStepYear(year, 1)}
            onClick={() => setYear(stepYear(year, 1))}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="month-picker-grid">
          {MONTHS.map((value) => {
            const selected = year === month.year && value === month.month;
            return (
              <button
                key={value}
                type="button"
                className={`month-picker-month${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onPick({ year, month: value })}
              >
                {value}월
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
