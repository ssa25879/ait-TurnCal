import { MAX_YEAR, MIN_YEAR } from "./date";

/** 연·월 선택 시트의 연도 이동 가능 여부. 지원 범위는 MIN_YEAR~MAX_YEAR(1970~2100)이다. */
export function canStepYear(year: number, delta: 1 | -1): boolean {
  const next = year + delta;
  return next >= MIN_YEAR && next <= MAX_YEAR;
}

/** 한 해씩 옮기되 지원 범위 밖으로 나가지 않는다. */
export function stepYear(year: number, delta: 1 | -1): number {
  return canStepYear(year, delta) ? year + delta : year;
}
