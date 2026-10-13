import { describe, expect, it, vi } from "vitest";
import { createAnonymousKeyRunner } from "./useAnonymousKey";

describe("createAnonymousKeyRunner", () => {
  it("미지원이면 발급을 호출하지 않는다", async () => {
    const issue = vi.fn();
    const sync = vi.fn(async (fetch: () => Promise<unknown>) => {
      await fetch();
      return "unsupported" as const;
    });
    await createAnonymousKeyRunner({ isSupported: () => false, issue, sync }).run();
    expect(issue).not.toHaveBeenCalled();
  });

  it("지원되면 발급 결과를 sync에 넘긴다", async () => {
    const issue = vi.fn(async () => ({ type: "HASH" as const, hash: "h" }));
    const sync = vi.fn(async (fetch: () => Promise<unknown>) => {
      expect(await fetch()).toEqual({ type: "HASH", hash: "h" });
      return "saved" as const;
    });
    await createAnonymousKeyRunner({ isSupported: () => true, issue, sync }).run();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("두 번 호출해도 한 번만 실행한다", async () => {
    const sync = vi.fn(async () => "saved" as const);
    const runner = createAnonymousKeyRunner({ isSupported: () => true, issue: vi.fn(), sync });
    await Promise.all([runner.run(), runner.run()]);
    await runner.run();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("failed는 경고만 남기고 값을 로그에 찍지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await createAnonymousKeyRunner({
      isSupported: () => true,
      issue: vi.fn(),
      sync: async () => "failed",
    }).run();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
