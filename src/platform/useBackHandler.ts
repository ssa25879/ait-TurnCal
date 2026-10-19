import { closeView, graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

export type Screen =
  | "loading"
  | "load-error"
  | "calendar"
  | "settings-menu"
  | "names"
  | "shift-labels"
  | "pattern"
  | "display"
  | "reset"
  | "day"
  | "entry";

export interface BackState {
  screen: Screen;
  /** 저장된 설정이 있는지(패턴이 없어도 true). 없으면(첫 실행) 설정 화면도 최초 흐름이다. */
  hasSavedSettings: boolean;
  isDirty: boolean;
  /** 바텀시트·다이얼로그가 열려 있는지. TDS 오버레이는 AIT backEvent를 직접 듣지 않는다. */
  hasOverlay: boolean;
}

export type BackAction =
  | "close-overlay"
  | "close"
  | "to-calendar"
  | "to-settings-menu"
  | "to-day"
  | "confirm-discard";

/**
 * 토스 내비게이션 바 뒤로가기와 Android 시스템 백버튼에 대한 동작을 정한다.
 * 열린 오버레이가 있으면 먼저 닫는다. 저장된 설정이 있으면 화면 계층을 한 단계씩 올라가고
 * (설정 상세 → 설정 목록 → 달력, 세부 내용 편집 → 날짜 → 달력), 나머지 최초 화면은 미니앱을 종료한다.
 * 편집 중인 변경이 있으면 폐기 확인을 먼저 띄운다(목적지는 호출자가 화면별로 정한다).
 */
export function decideBackAction({
  screen,
  hasSavedSettings,
  isDirty,
  hasOverlay,
}: BackState): BackAction {
  if (hasOverlay) return "close-overlay";
  if (!hasSavedSettings) return "close";
  switch (screen) {
    case "pattern":
    case "names":
    case "shift-labels":
      return isDirty ? "confirm-discard" : "to-settings-menu";
    case "display":
    case "reset":
      return "to-settings-menu";
    case "settings-menu":
    case "day":
      return "to-calendar";
    case "entry":
      return isDirty ? "confirm-discard" : "to-day";
    default:
      return "close";
  }
}

export interface BackHandlers {
  closeOverlay(): void;
  toCalendar(): void;
  toSettingsMenu(): void;
  toDay(): void;
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
        case "to-settings-menu":
          handlers().toSettingsMenu();
          break;
        case "to-day":
          handlers().toDay();
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
