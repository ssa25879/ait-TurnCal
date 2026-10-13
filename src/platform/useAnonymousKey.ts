import { User } from "@apps-in-toss/web-framework";
import { useEffect } from "react";
import { syncAnonymousKey, type AnonymousKeyFetch, type SyncResult } from "../storage/userKeyStorage";

interface Deps {
  isSupported: () => boolean;
  issue: () => Promise<{ type: "HASH"; hash: string }>;
  sync: (fetchKey: AnonymousKeyFetch) => Promise<SyncResult>;
}

/** 식별키 발급·저장을 앱 실행당 한 번만 수행한다. 결과는 화면에 영향을 주지 않는다. */
export function createAnonymousKeyRunner({ isSupported, issue, sync }: Deps) {
  let started = false;
  return {
    async run(): Promise<void> {
      if (started) return;
      started = true;
      const result = await sync(async () => (isSupported() ? issue() : undefined));
      if (result === "failed") console.warn("사용자 식별키를 저장하지 못했어요.");
    },
  };
}

const runner = createAnonymousKeyRunner({
  isSupported: () => {
    try {
      return User.getAnonymousKey.isSupported();
    } catch {
      return false;
    }
  },
  issue: () => User.getAnonymousKey(),
  sync: syncAnonymousKey,
});

/** App 최상위에서 한 번 호출한다. StrictMode의 이중 effect에도 실행은 한 번이다. */
export function useAnonymousKey(): void {
  useEffect(() => {
    void runner.run();
  }, []);
}
