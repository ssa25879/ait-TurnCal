import { TextButton, WheelDateSheet } from "@toss/tds-mobile";
import { useState } from "react";
import { getTodayLocal, isValidDateString, MAX_YEAR, MIN_YEAR } from "../domain/date";
import { useCloseOnBack } from "../platform/overlayBack";

interface Props {
  disabled: boolean;
  onPick(startDate: string): void;
}

/** 보조 수단: 패턴 첫째 날을 날짜로 직접 지정한다. */
export function StartDatePicker({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => setOpen(false);
  useCloseOnBack(open, close);

  return (
    <div className="start-date">
      <TextButton size="small" disabled={disabled} onClick={() => setOpen(true)}>
        패턴 첫째 날을 날짜로 지정하기
      </TextButton>
      {error && <p className="error-text">{error}</p>}
      <WheelDateSheet
        open={open}
        title="패턴 첫째 날을 골라 주세요"
        description="고른 날이 근무 순서의 1번째 칸이 돼요."
        min={new Date(MIN_YEAR, 0, 1)}
        max={new Date(MAX_YEAR, 11, 31)}
        onClose={close}
        onChange={(date) => {
          // 휠에서 고른 날짜는 로컬 날짜이므로 로컬 기준으로 문자열화한다.
          const value = getTodayLocal(date);
          close();
          if (!isValidDateString(value)) {
            setError("1970년부터 2100년 사이의 날짜만 지정할 수 있어요.");
            return;
          }
          setError(null);
          onPick(value);
        }}
      />
    </div>
  );
}
