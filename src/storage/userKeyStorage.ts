import { Storage } from "@apps-in-toss/web-framework";

export const USER_KEY = "turncal.user";
export const USER_KEY_VERSION = 1;

export type AnonymousKeyFetch = () => Promise<{ type: "HASH"; hash: string } | undefined>;
export type SyncResult = "saved" | "unchanged" | "unsupported" | "failed";

async function readStoredKey(): Promise<string | null> {
  try {
    const raw = await Storage.getItem(USER_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const { version, anonymousKey } = parsed as Record<string, unknown>;
      if (version === USER_KEY_VERSION && typeof anonymousKey === "string") return anonymousKey;
    }
  } catch {
    // 읽지 못하거나 손상된 값은 다시 받을 수 있으므로 없는 것으로 보고 덮어쓴다.
  }
  return null;
}

/** 식별키를 발급받아 저장한다. 어떤 실패도 예외로 전달하지 않는다. */
export async function syncAnonymousKey(fetchKey: AnonymousKeyFetch): Promise<SyncResult> {
  try {
    const issued = await fetchKey();
    if (issued === undefined) return "unsupported";
    if ((await readStoredKey()) === issued.hash) return "unchanged";
    await Storage.setItem(
      USER_KEY,
      JSON.stringify({ version: USER_KEY_VERSION, anonymousKey: issued.hash }),
    );
    return "saved";
  } catch {
    return "failed";
  }
}

export async function removeUserKey(): Promise<void> {
  await Storage.removeItem(USER_KEY);
}
