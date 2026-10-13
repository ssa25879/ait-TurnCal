import { SafeArea } from "@apps-in-toss/web-framework";
import { useEffect } from "react";

interface StyleTarget {
  style: { setProperty(name: string, value: string): void };
}

interface Insets {
  top: number;
  bottom: number;
}

export function applySafeArea(target: StyleTarget, { top, bottom }: Insets): void {
  target.style.setProperty("--safe-top", `${top}px`);
  target.style.setProperty("--safe-bottom", `${bottom}px`);
}

/** 현재 SafeArea 값을 CSS 변수로 반영하고 변경을 구독한다. 반환 함수로 구독을 해제한다. */
export function startSafeAreaSync(target: StyleTarget): () => void {
  try {
    applySafeArea(target, SafeArea.get());
    return SafeArea.subscribe({ onEvent: (insets) => applySafeArea(target, insets) });
  } catch (error) {
    console.error("SafeArea 값을 가져오지 못했어요.", error);
    applySafeArea(target, { top: 0, bottom: 0 });
    return () => {};
  }
}

export function useSafeArea(): void {
  useEffect(() => startSafeAreaSync(document.documentElement), []);
}
