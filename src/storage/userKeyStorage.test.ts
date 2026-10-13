import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
const storageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
vi.mock("@apps-in-toss/web-framework", () => ({ Storage: storageMock }));

import { removeUserKey, syncAnonymousKey, USER_KEY } from "./userKeyStorage";

const issue = (hash: string) => async () => ({ type: "HASH" as const, hash });

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
  storageMock.getItem.mockImplementation(async (key: string) => memory.get(key) ?? null);
  storageMock.setItem.mockImplementation(async (key: string, value: string) => void memory.set(key, value));
  storageMock.removeItem.mockImplementation(async (key: string) => void memory.delete(key));
});

describe("syncAnonymousKey", () => {
  it("새 식별키를 version과 함께 저장한다", async () => {
    expect(await syncAnonymousKey(issue("abc"))).toBe("saved");
    expect(JSON.parse(memory.get(USER_KEY)!)).toEqual({ version: 1, anonymousKey: "abc" });
  });

  it("같은 값이면 다시 쓰지 않는다", async () => {
    memory.set(USER_KEY, JSON.stringify({ version: 1, anonymousKey: "abc" }));
    expect(await syncAnonymousKey(issue("abc"))).toBe("unchanged");
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });

  it("다른 값이면 덮어쓴다", async () => {
    memory.set(USER_KEY, JSON.stringify({ version: 1, anonymousKey: "old" }));
    expect(await syncAnonymousKey(issue("new"))).toBe("saved");
    expect(JSON.parse(memory.get(USER_KEY)!).anonymousKey).toBe("new");
  });

  it("손상된 값은 새 값으로 덮어쓴다", async () => {
    memory.set(USER_KEY, "{broken");
    expect(await syncAnonymousKey(issue("abc"))).toBe("saved");
    expect(JSON.parse(memory.get(USER_KEY)!).anonymousKey).toBe("abc");
  });

  it("미지원이면 쓰지 않는다", async () => {
    expect(await syncAnonymousKey(async () => undefined)).toBe("unsupported");
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });

  it("발급이 throw해도 예외 없이 failed, 기존 값은 그대로", async () => {
    memory.set(USER_KEY, JSON.stringify({ version: 1, anonymousKey: "old" }));
    const result = await syncAnonymousKey(async () => {
      throw new Error("UNKNOWN_ERROR");
    });
    expect(result).toBe("failed");
    expect(JSON.parse(memory.get(USER_KEY)!).anonymousKey).toBe("old");
  });

  it("쓰기 실패도 예외 없이 failed", async () => {
    storageMock.setItem.mockRejectedValueOnce(new Error("io"));
    expect(await syncAnonymousKey(issue("abc"))).toBe("failed");
  });
});

describe("removeUserKey", () => {
  it("저장된 식별키를 지운다", async () => {
    memory.set(USER_KEY, "x");
    await removeUserKey();
    expect(memory.has(USER_KEY)).toBe(false);
  });
});
