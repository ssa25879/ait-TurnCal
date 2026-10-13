import { describe, expect, it } from "vitest";
import { resolveBannerAdGroupId, TEST_BANNER_AD_GROUP_ID } from "./adConfig";

describe("resolveBannerAdGroupId", () => {
  it("테스트 ID는 토스 애즈 리스트형 배너 테스트 ID다", () => {
    expect(TEST_BANNER_AD_GROUP_ID).toBe("ait-ad-test-banner-id");
  });

  it("값이 없으면 fallback(개발: 테스트 ID)을 쓴다", () => {
    expect(resolveBannerAdGroupId({ envValue: undefined, fallback: TEST_BANNER_AD_GROUP_ID })).toBe(TEST_BANNER_AD_GROUP_ID);
    expect(resolveBannerAdGroupId({ envValue: "  ", fallback: TEST_BANNER_AD_GROUP_ID })).toBe(TEST_BANNER_AD_GROUP_ID);
  });

  it("출시 빌드(fallback null)에서 값이 없으면 null", () => {
    expect(resolveBannerAdGroupId({ envValue: undefined, fallback: null })).toBeNull();
    expect(resolveBannerAdGroupId({ envValue: "", fallback: null })).toBeNull();
  });

  it("값이 있으면 그 값을 쓴다", () => {
    expect(resolveBannerAdGroupId({ envValue: "ait.v2.live.x", fallback: null })).toBe("ait.v2.live.x");
    expect(resolveBannerAdGroupId({ envValue: " ait-ad-test-banner-id ", fallback: null })).toBe("ait-ad-test-banner-id");
  });
});
