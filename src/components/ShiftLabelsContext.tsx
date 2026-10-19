import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SHIFT_LABELS, type ShiftLabels } from "../domain/shiftLabels";

const ShiftLabelsContext = createContext<ShiftLabels>(DEFAULT_SHIFT_LABELS);

/** 저장된 사용자 정의를 반영한 근무 유형 이름·약어·색. 모든 화면이 이 값으로 표시한다. */
export function ShiftLabelsProvider({ labels, children }: { labels: ShiftLabels; children: ReactNode }) {
  return <ShiftLabelsContext.Provider value={labels}>{children}</ShiftLabelsContext.Provider>;
}

/** Provider 밖(단독 렌더·테스트)에서는 기본값을 돌려준다. */
export function useShiftLabels(): ShiftLabels {
  return useContext(ShiftLabelsContext);
}
