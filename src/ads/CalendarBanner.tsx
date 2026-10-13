import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useReducer, useRef } from "react";
import { BANNER_AD_GROUP_ID } from "./adConfig";
import { bannerReducer, isBannerVisible } from "./bannerState";
import { useAdsReady } from "./tossAds";

/**
 * 달력 화면 맨 아래의 토스 애즈 배너 1개.
 * 미니앱이 라이트 모드 전용이므로 theme은 light로 고정한다(auto는 기기 다크모드를 따라간다).
 * "Ad" 표기·디자인·이벤트는 SDK가 그리는 그대로 두고, 앱이 광고 영역을 새로고침하지 않는다.
 */
export function CalendarBanner() {
  const ready = useAdsReady();
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(bannerReducer, "hidden");

  useEffect(() => {
    const target = containerRef.current;
    if (!ready || !BANNER_AD_GROUP_ID || !target) return;
    dispatch("attach");
    let attached: { destroy(): void } | undefined;
    try {
      attached = TossAds.attachBanner(BANNER_AD_GROUP_ID, target, {
        theme: "light",
        tone: "blackAndWhite",
        variant: "expanded",
        callbacks: {
          onAdRendered: () => dispatch("rendered"),
          onNoFill: () => dispatch("noFill"),
          onAdFailedToRender: () => dispatch("failed"),
        },
      });
    } catch (error) {
      console.warn("배너 광고를 붙이지 못했어요.", error);
      dispatch("failed");
    }
    return () => {
      attached?.destroy();
      dispatch("reset");
    };
  }, [ready]);

  if (!BANNER_AD_GROUP_ID) return null;

  return (
    <div className={`calendar-banner${isBannerVisible(state) ? " is-shown" : ""}`} data-state={state}>
      {/* SDK가 이 요소 안에 광고를 그린다. 안쪽은 비워 둔다. */}
      <div ref={containerRef} className="calendar-banner-slot" />
    </div>
  );
}
