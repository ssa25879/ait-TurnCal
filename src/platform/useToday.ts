import { useEffect, useState } from "react";
import { getTodayLocal } from "../domain/date";

interface VisibilitySource {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * 화면이 다시 보일 때(visibilitychange → visible) 로컬 오늘을 다시 계산해
 * 날짜가 바뀌었으면 알린다. 자정을 넘겨 켜 둔 화면의 오늘 강조를 맞추기 위함이다.
 */
export function watchToday(
  source: VisibilitySource,
  onChange: (today: string) => void,
  initial: string,
  now: () => Date = () => new Date(),
): () => void {
  let current = initial;
  const listener = () => {
    if (source.visibilityState !== "visible") return;
    const next = getTodayLocal(now());
    if (next !== current) {
      current = next;
      onChange(next);
    }
  };
  source.addEventListener("visibilitychange", listener);
  return () => source.removeEventListener("visibilitychange", listener);
}

export function useToday(): string {
  const [today, setToday] = useState(() => getTodayLocal());
  useEffect(() => watchToday(document, setToday, today), [today]);
  return today;
}
