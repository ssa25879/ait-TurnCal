import { addDays, toUtcDayNumber } from "./date";
import type { ShiftType, WorkPattern } from "./types";

/** 이력은 이 개수까지만 보관한다. 넘치면 가장 오래된 기록부터 버린다. */
export const MAX_PATTERN_HISTORY = 50;

/** 교체되기 전에 쓰던 패턴. `until` 전날까지 적용되었다(`until` 당일부터는 다음 패턴). */
export interface PastPattern {
  /** YYYY-MM-DD */
  until: string;
  pattern: WorkPattern;
}

/** 날짜별로 어떤 패턴이 적용되는지 정하는 입력. history는 until 오름차순이다. */
export interface PatternTimeline {
  current: WorkPattern;
  history: PastPattern[];
}

/** 저장 시 적용 범위: 오늘부터(지난 날짜 유지) 또는 전체 기간(이력을 지우고 모든 날짜) */
export type ApplyScope = "FROM_TODAY" | "ALL";

/** 그 날짜에 적용되던 패턴. `date < until`인 첫 이력 항목, 없으면 현재 패턴이다. */
export function resolvePattern(date: string, timeline: PatternTimeline): WorkPattern {
  for (const past of timeline.history) {
    if (date < past.until) return past.pattern;
  }
  return timeline.current;
}

/**
 * 같은 근무 순서이고 위상이 같으면 같은 일정이다. 기준일 표현이 주기의 배수만큼 달라도
 * 모든 날짜의 근무가 같으므로 변경으로 보지 않는다.
 */
export function isSameSchedule(a: WorkPattern, b: WorkPattern): boolean {
  const length = a.cycle.length;
  if (length === 0 || length !== b.cycle.length) return false;
  if (!a.cycle.every((shift, i) => shift === b.cycle[i])) return false;
  const diff = toUtcDayNumber(a.startDate) - toUtcDayNumber(b.startDate);
  return ((diff % length) + length) % length === 0;
}

/**
 * 패턴 저장 결과로 새 타임라인을 만든다.
 * - 저장된 패턴이 없거나 "전체 기간"이면 이력 없이 새 패턴 하나로 모든 날짜를 계산한다.
 * - "오늘부터"는 오늘 적용 중인 패턴을 이력에 남기고 새 패턴을 오늘부터 적용한다.
 *   일정이 같으면 아무것도 바꾸지 않고, 오늘 시작된 패턴을 다시 바꾸면 이력 없이 덮어쓴다.
 */
export function applyPatternChange(
  timeline: PatternTimeline | null,
  next: WorkPattern,
  scope: ApplyScope,
  today: string,
): PatternTimeline {
  if (!timeline || scope === "ALL") return { current: next, history: [] };

  const effective = resolvePattern(today, timeline);
  if (isSameSchedule(effective, next)) return timeline;

  // 기기 날짜가 과거로 바뀐 경우를 위해 오늘 이후 종료되는 기록은 버린다(날짜순 유지).
  const kept = timeline.history.filter((past) => past.until <= today);
  const last = kept[kept.length - 1];
  if (last && last.until === today) return { current: next, history: kept };

  const history = [...kept, { until: today, pattern: effective }].slice(-MAX_PATTERN_HISTORY);
  return { current: next, history };
}

/** 이력 목록 한 행: 적용 기간(`from`~`to`, null이면 처음/현재)과 근무 순서 */
export interface TimelineRow {
  /** 적용 시작일. 가장 오래된 패턴은 null(처음부터) */
  from: string | null;
  /** 마지막 적용일. 현재 패턴은 null(계속 적용 중) */
  to: string | null;
  current: boolean;
  cycle: ShiftType[];
}

/** 현재 패턴을 맨 위에 두고 이전 패턴을 최신순으로 나열한다. */
export function describeTimeline(timeline: PatternTimeline): TimelineRow[] {
  const { history, current } = timeline;
  const rows: TimelineRow[] = [
    {
      from: history.length > 0 ? history[history.length - 1].until : null,
      to: null,
      current: true,
      cycle: current.cycle,
    },
  ];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    rows.push({
      from: i > 0 ? history[i - 1].until : null,
      to: addDays(history[i].until, -1),
      current: false,
      cycle: history[i].pattern.cycle,
    });
  }
  return rows;
}
