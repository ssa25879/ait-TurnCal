import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const initialize = Object.assign(vi.fn(), { isSupported: vi.fn(() => true) });
  const attachBanner = Object.assign(vi.fn(), { isSupported: vi.fn(() => true) });
  return { initialize, attachBanner, isMinVersionSupported: vi.fn(() => true) };
});

vi.mock("@apps-in-toss/web-framework", () => ({
  TossAds: { initialize: sdk.initialize, attachBanner: sdk.attachBanner },
  isMinVersionSupported: sdk.isMinVersionSupported,
}));

import { createAdsController } from "./tossAds";

beforeEach(() => {
  vi.clearAllMocks();
  sdk.initialize.isSupported.mockReturnValue(true);
  sdk.attachBanner.isSupported.mockReturnValue(true);
  sdk.isMinVersionSupported.mockReturnValue(true);
});

describe("createAdsController", () => {
  it("여러 번 호출해도 한 번만 초기화하고, 성공하면 ready", () => {
    sdk.initialize.mockImplementation(({ callbacks }) => callbacks.onInitialized());
    const ads = createAdsController();
    const seen: string[] = [];
    ads.subscribe(() => seen.push(ads.getStatus()));
    ads.init();
    ads.init();
    ads.init();
    expect(sdk.initialize).toHaveBeenCalledTimes(1);
    expect(ads.getStatus()).toBe("ready");
    expect(seen).toContain("ready");
  });

  it("5.241.0 미만 판정이면 초기화하지 않고 unsupported", () => {
    sdk.isMinVersionSupported.mockReturnValue(false);
    const ads = createAdsController();
    ads.init();
    expect(sdk.isMinVersionSupported).toHaveBeenCalledWith({ android: "5.241.0", ios: "5.241.0" });
    expect(sdk.initialize).not.toHaveBeenCalled();
    expect(ads.getStatus()).toBe("unsupported");
  });

  it("SDK isSupported가 거짓이면 unsupported", () => {
    sdk.attachBanner.isSupported.mockReturnValue(false);
    const ads = createAdsController();
    ads.init();
    expect(ads.getStatus()).toBe("unsupported");
  });

  it("지원 판정 중 예외가 나도 unsupported로 처리한다", () => {
    sdk.isMinVersionSupported.mockImplementation(() => {
      throw new Error("no bridge");
    });
    const ads = createAdsController();
    ads.init();
    expect(ads.getStatus()).toBe("unsupported");
  });

  it("초기화 실패 콜백이면 failed", () => {
    sdk.initialize.mockImplementation(({ callbacks }) => callbacks.onInitializationFailed(new Error("x")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ads = createAdsController();
    ads.init();
    expect(ads.getStatus()).toBe("failed");
  });

  it("초기화 응답 전에는 pending", () => {
    sdk.initialize.mockImplementation(() => {});
    const ads = createAdsController();
    ads.init();
    expect(ads.getStatus()).toBe("pending");
  });

  it("구독 해제 후에는 알리지 않는다", () => {
    let done: () => void = () => {};
    sdk.initialize.mockImplementation(({ callbacks }) => {
      done = callbacks.onInitialized;
    });
    const ads = createAdsController();
    const listener = vi.fn();
    const unsubscribe = ads.subscribe(listener);
    ads.init();
    listener.mockClear();
    unsubscribe();
    done();
    expect(listener).not.toHaveBeenCalled();
    expect(ads.getStatus()).toBe("ready");
  });
});
