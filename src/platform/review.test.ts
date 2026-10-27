import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const requestReview = Object.assign(vi.fn(), { isSupported: vi.fn() });
  return { requestReview };
});
vi.mock("@apps-in-toss/web-framework", () => sdk);

beforeEach(() => {
  vi.resetModules();
  sdk.requestReview.mockReset().mockResolvedValue(undefined);
  sdk.requestReview.isSupported.mockReset().mockReturnValue(true);
});

const load = () => import("./review");

describe("리뷰 요청", () => {
  it("지원되고 아직 요청하지 않았으면 안내를 보여 줄 수 있다", async () => {
    const { canAskReview } = await load();
    expect(canAskReview()).toBe(true);
  });

  it("미지원이거나 isSupported가 던지면 안내하지 않는다", async () => {
    const { canAskReview } = await load();
    sdk.requestReview.isSupported.mockReturnValue(false);
    expect(canAskReview()).toBe(false);
    sdk.requestReview.isSupported.mockImplementation(() => {
      throw new Error("x");
    });
    expect(canAskReview()).toBe(false);
  });

  it("한 번 요청하면 같은 실행 중에는 다시 안내하지 않는다", async () => {
    const { askReview, canAskReview } = await load();
    askReview();
    expect(sdk.requestReview).toHaveBeenCalledTimes(1);
    expect(canAskReview()).toBe(false);
  });

  it("요청 실패·동기 예외는 사용자 흐름으로 번지지 않는다", async () => {
    const { askReview } = await load();
    sdk.requestReview.mockRejectedValue(new Error("x"));
    expect(() => askReview()).not.toThrow();
    const again = await load();
    sdk.requestReview.mockImplementation(() => {
      throw new Error("y");
    });
    expect(() => again.askReview()).not.toThrow();
  });
});
