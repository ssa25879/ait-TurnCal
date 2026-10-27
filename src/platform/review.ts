import { requestReview } from "@apps-in-toss/web-framework";

/** 같은 실행 중에 리뷰 요청을 반복하지 않는다(앱인토스 리뷰 요청 가이드). */
let requested = false;

export function canAskReview(): boolean {
  if (requested) return false;
  try {
    return requestReview.isSupported();
  } catch {
    return false;
  }
}

/** 리뷰 창은 피로도 정책에 따라 뜨지 않을 수 있고 결과도 알 수 없으므로 기다리지 않는다. */
export function askReview(): void {
  requested = true;
  try {
    void requestReview().catch(() => {});
  } catch {
    // 미지원·동기 예외도 사용자 동작과 분리한다.
  }
}
