import { partner, tdsEvent } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

/** 내비게이션 바 기능 버튼 등록 상태. pending 동안에는 대체 버튼을 그리지 않아 깜빡임을 막는다. */
export type NavButtonState = "pending" | "registered" | "failed";

export const NAV_SETTINGS_ID = "settings";

/** 모노톤 아이콘만 지원된다(앱인토스 내비게이션 바 문서). 이름은 TDS 아이콘 이름이다. */
const BUTTON = { id: NAV_SETTINGS_ID, title: "설정", icon: { name: "icon-setting-mono" } } as const;

/** 등록이 이 시간 안에 끝나지 않으면 대체 하단 버튼을 보여 준다(늦게 성공하면 다시 숨긴다). */
const REGISTER_TIMEOUT_MS = 1500;

interface Deps {
  add(params: typeof BUTTON): Promise<void>;
  remove(): Promise<void>;
  /** 클릭한 버튼 id를 받는다. 해제 함수를 돌려준다. */
  listen(handler: (id: string) => void): () => void;
  /** 지정한 시간 뒤 fn을 부르고 취소 함수를 돌려준다. */
  schedule(fn: () => void, ms: number): () => void;
}

/**
 * 기능 버튼 등록·클릭 연결·해제를 한 곳에서 다룬다. SDK에 직접 기대지 않아 단위 테스트할 수 있다.
 * start()는 등록을 시작하고, 돌려준 stop()은 이벤트 구독과 버튼을 정리한다.
 */
export function createNavSettingsButton(
  deps: Deps,
  onClick: () => void,
  onState: (state: NavButtonState) => void,
  timeoutMs = REGISTER_TIMEOUT_MS,
) {
  return {
    start(): () => void {
      let stopped = false;
      let state: NavButtonState = "pending";
      const set = (next: NavButtonState) => {
        if (stopped || state === next) return;
        state = next;
        onState(next);
      };
      onState("pending");

      let unlisten: () => void = () => {};
      try {
        unlisten = deps.listen((id) => {
          if (id === NAV_SETTINGS_ID) onClick();
        });
      } catch {
        set("failed");
        return () => {
          stopped = true;
        };
      }

      const cancelTimer = deps.schedule(() => {
        if (state === "pending") set("failed");
      }, timeoutMs);

      try {
        deps.add(BUTTON).then(
          () => {
            cancelTimer();
            set("registered");
          },
          () => {
            cancelTimer();
            set("failed");
          },
        );
      } catch {
        cancelTimer();
        set("failed");
      }

      return () => {
        stopped = true;
        cancelTimer();
        unlisten();
        try {
          deps.remove().catch(() => {});
        } catch {
          // 지원하지 않는 환경이면 지울 버튼도 없다.
        }
      };
    },
  };
}

const sdkDeps: Deps = {
  add: (params) => partner.addAccessoryButton(params),
  remove: () => partner.removeAccessoryButton(),
  listen: (handler) =>
    tdsEvent.addEventListener("navigationAccessoryEvent", {
      onEvent: ({ id }) => handler(id),
      onError: () => {},
    }),
  schedule: (fn, ms) => {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  },
};

/**
 * active일 때만(달력 화면) 내비게이션 바에 "설정" 기능 버튼을 등록하고, 누르면 onClick을 부른다.
 * 기능 버튼은 최대 1개이므로 다른 화면에서는 반드시 해제한다. 등록 상태를 돌려준다.
 */
export function useNavSettingsButton(active: boolean, onClick: () => void): NavButtonState {
  const [state, setState] = useState<NavButtonState>("pending");
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!active) {
      setState("pending");
      return;
    }
    return createNavSettingsButton(sdkDeps, () => clickRef.current(), setState).start();
  }, [active]);

  return state;
}
