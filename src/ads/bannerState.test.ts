import { describe, expect, it } from "vitest";
import { bannerReducer, isBannerVisible } from "./bannerState";

describe("bannerReducer", () => {
  it("hidden → attach → loading → rendered → shown", () => {
    let state = bannerReducer("hidden", "attach");
    expect(state).toBe("loading");
    expect(isBannerVisible(state)).toBe(false);
    state = bannerReducer(state, "rendered");
    expect(state).toBe("shown");
    expect(isBannerVisible(state)).toBe(true);
  });

  it("광고 없음·렌더링 실패면 숨긴다", () => {
    expect(bannerReducer("loading", "noFill")).toBe("hidden");
    expect(bannerReducer("loading", "failed")).toBe("hidden");
    expect(bannerReducer("shown", "failed")).toBe("hidden");
  });

  it("reset은 언제나 hidden", () => {
    for (const s of ["hidden", "loading", "shown"] as const) {
      expect(bannerReducer(s, "reset")).toBe("hidden");
    }
  });

  it("부착 전 rendered는 무시한다", () => {
    expect(bannerReducer("hidden", "rendered")).toBe("hidden");
  });
});
