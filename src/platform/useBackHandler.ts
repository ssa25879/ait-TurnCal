import { closeView, graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

export type Screen = "loading" | "setup-intro" | "settings" | "calendar" | "load-error";

export interface BackState {
  screen: Screen;
  /** 유효한 저장 설정이 있는지. 없으면 설정 화면도 최초 흐름이다. */
  hasSavedSettings: boolean;
  isDirty: boolean;
  /** 바텀시트·다이얼로그가 열려 있는지. TDS 오버레이는 AIT backEvent를 직접 듣지 않는다. */
  hasOverlay: boolean;
}

export type BackAction = "close-overlay" | "close" | "to-calendar" | "confirm-discard";

/**
 * 토스 내비게이션 바 뒤로가기와 Android 시스템 백버튼에 대한 동작을 정한다.
 * 열린 오버레이가 있으면 먼저 닫는다. 저장된 설정이 있는 상태의 설정 화면만 달력으로 돌아가고,
 * 나머지 최초 화면은 미니앱을 종료한다.
 */
export function decideBackAction({
  screen,
  hasSavedSettings,
  isDirty,
  hasOverlay,
}: BackState): BackAction {
  if (hasOverlay) return "close-overlay";
  if (screen === "settings" && hasSavedSettings) {
    return isDirty ? "confirm-discard" : "to-calendar";
  }
  return "close";
}

export interface BackHandlers {
  closeOverlay(): void;
  toCalendar(): void;
  confirmDiscard(): void;
}

/** backEvent 리스너를 한 번만 등록하고, 이벤트 시점의 최신 상태로 동작을 정한다. */
export function registerBackHandler(
  getState: () => BackState,
  handlers: () => BackHandlers,
): () => void {
  return graniteEvent.addEventListener("backEvent", {
    onEvent: () => {
      switch (decideBackAction(getState())) {
        case "close-overlay":
          handlers().closeOverlay();
          break;
        case "close":
          void closeView();
          break;
        case "to-calendar":
          handlers().toCalendar();
          break;
        case "confirm-discard":
          handlers().confirmDiscard();
          break;
      }
    },
    onError: (error) => console.error("뒤로가기 이벤트를 처리하지 못했어요.", error),
  });
}

/** getState는 이벤트 시점에 호출되므로 렌더 이후 바뀐 값(열린 오버레이 등)도 반영된다. */
export function useBackHandler(getState: () => BackState, handlers: BackHandlers): void {
  const getStateRef = useRef(getState);
  const handlersRef = useRef(handlers);
  getStateRef.current = getState;
  handlersRef.current = handlers;

  useEffect(
    () => registerBackHandler(() => getStateRef.current(), () => handlersRef.current),
    [],
  );
}
