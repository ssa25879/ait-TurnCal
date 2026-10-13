import { isMinVersionSupported, TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useSyncExternalStore } from "react";

export type AdsStatus = "idle" | "pending" | "ready" | "unsupported" | "failed";

/** 배너 광고 API는 토스 앱 5.241.0 이상에서만 지원된다(미만이면 빈 화면이 생길 수 있음). */
const MIN_BANNER_VERSION = { android: "5.241.0", ios: "5.241.0" } as const;

function isBannerSupported(): boolean {
  try {
    return (
      TossAds.initialize.isSupported() &&
      TossAds.attachBanner.isSupported() &&
      isMinVersionSupported(MIN_BANNER_VERSION)
    );
  } catch {
    return false;
  }
}

/** 광고 SDK 초기화를 앱 실행 중 한 번만 수행하고 상태를 구독할 수 있게 한다. */
export function createAdsController() {
  let status: AdsStatus = "idle";
  const listeners = new Set<() => void>();
  const set = (next: AdsStatus) => {
    status = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    init() {
      if (status !== "idle") return;
      if (!isBannerSupported()) {
        set("unsupported");
        return;
      }
      set("pending");
      TossAds.initialize({
        callbacks: {
          onInitialized: () => set("ready"),
          onInitializationFailed: (error) => {
            console.warn("광고 SDK를 초기화하지 못했어요.", error);
            set("failed");
          },
        },
      });
    },
  };
}

export const adsController = createAdsController();

/** App 최상위에서 한 번 호출한다. StrictMode의 이중 effect에도 초기화는 한 번이다. */
export function useInitAds(): void {
  useEffect(() => adsController.init(), []);
}

export function useAdsReady(): boolean {
  const status = useSyncExternalStore(adsController.subscribe, adsController.getStatus);
  return status === "ready";
}
