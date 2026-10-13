/**
 * 배너 영역 상태. 렌더링이 끝나기 전·광고가 없을 때·실패했을 때는 높이 0으로 숨겨
 * 빈 공간을 남기지 않는다.
 */
export type BannerState = "hidden" | "loading" | "shown";
export type BannerEvent = "attach" | "rendered" | "noFill" | "failed" | "reset";

export function bannerReducer(state: BannerState, event: BannerEvent): BannerState {
  switch (event) {
    case "attach":
      return "loading";
    case "rendered":
      return state === "loading" ? "shown" : state;
    case "noFill":
    case "failed":
    case "reset":
      return "hidden";
  }
}

export function isBannerVisible(state: BannerState): boolean {
  return state === "shown";
}
