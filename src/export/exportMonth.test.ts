import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const saveBase64Data = Object.assign(vi.fn(), { isSupported: vi.fn(() => true) });
  return { saveBase64Data, Share: { createLink: vi.fn() } };
});

vi.mock("@apps-in-toss/web-framework", () => sdk);
vi.mock("./renderMonthImage", () => ({ renderMonthImage: vi.fn(() => "UE5H") }));

import { DEFAULT_REMINDER } from "../domain/calendarReminder";
import { fromBase64Utf8 } from "../domain/monthExport";
import { DEFAULT_SHIFT_LABELS } from "../domain/shiftLabels";
import { exportMonth, type ExportInput } from "./exportMonth";
import { renderMonthImage } from "./renderMonthImage";

const input: ExportInput = {
  month: { year: 2026, month: 10 },
  weekStart: "SUN",
  timeline: { current: { startDate: "2026-10-11", cycle: ["DAY", "NIGHT", "OFF"] }, history: [] },
  days: {},
  labels: DEFAULT_SHIFT_LABELS,
  scheduleTitle: "병동/3교대 ../",
  primary: "#4F46E5",
  reminder: DEFAULT_REMINDER,
};

const savedArgs = () => sdk.saveBase64Data.mock.calls.at(-1)![0] as { data: string; fileName: string; mimeType: string };

beforeEach(() => {
  vi.clearAllMocks();
  sdk.saveBase64Data.isSupported.mockReturnValue(true);
  sdk.saveBase64Data.mockResolvedValue(undefined);
  sdk.Share.createLink.mockResolvedValue("https://toss.im/share/abc");
});

describe("exportMonth", () => {
  it("이미지: PNG를 연·월·보낸 시각 파일 이름으로 공유 창에 넘기고 opened", async () => {
    expect(await exportMonth("image", input)).toBe("opened");
    expect(savedArgs()).toEqual({ data: "UE5H", fileName: expect.stringMatching(/^turncal-2026-10-\d{14}\.png$/), mimeType: "image/png" });
    expect(vi.mocked(renderMonthImage).mock.calls[0][0].title).toBe("병동/3교대 ../ · 2026년 10월");
    expect(sdk.Share.createLink).not.toHaveBeenCalled();
  });

  it("캘린더: .ics에 intoss:// 경로로 만든 링크를 넣는다", async () => {
    expect(await exportMonth("calendar", input)).toBe("opened");
    expect(sdk.Share.createLink).toHaveBeenCalledWith({ path: "intoss://ait-turncal" });
    const { data, fileName, mimeType } = savedArgs();
    expect(fileName).toMatch(/^turncal-2026-10-\d{14}\.ics$/);
    expect(mimeType).toBe("text/calendar");
    const ics = fromBase64Utf8(data);
    expect(ics).toContain("URL:https://toss.im/share/abc");
    expect(ics).not.toContain("intoss-private");
    expect(ics).toContain("TRIGGER:-PT3H");
  });

  it("캘린더 알림을 끄면 .ics에 알림이 없다", async () => {
    await exportMonth("calendar", { ...input, reminder: { enabled: false, hour: 20 } });
    expect(fromBase64Utf8(savedArgs().data)).not.toContain("VALARM");
  });

  it("파일 이름에 근무표 이름이 들어가지 않는다", async () => {
    await exportMonth("calendar", input);
    expect(savedArgs().fileName).not.toContain("병동");
  });

  it("링크 실패 → 링크 없이 보낸다", async () => {
    sdk.Share.createLink.mockRejectedValue(new Error("x"));
    expect(await exportMonth("calendar", input)).toBe("opened");
    const ics = fromBase64Utf8(savedArgs().data);
    expect(ics).not.toContain("URL:");
    expect(ics).not.toContain("턴캘에서 보기");
  });

  it("링크가 2초 안에 오지 않으면 링크 없이 보낸다", async () => {
    vi.useFakeTimers();
    sdk.Share.createLink.mockReturnValue(new Promise(() => {}));
    const pending = exportMonth("calendar", input);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBe("opened");
    expect(fromBase64Utf8(savedArgs().data)).not.toContain("URL:");
    vi.useRealTimers();
  });

  it("지원하지 않는 버전 → 시도하지 않고 unsupported", async () => {
    sdk.saveBase64Data.isSupported.mockReturnValue(false);
    expect(await exportMonth("image", input)).toBe("unsupported");
    expect(sdk.saveBase64Data).not.toHaveBeenCalled();
  });

  it("공유 창 호출 실패 → failed", async () => {
    sdk.saveBase64Data.mockRejectedValue(new Error("native"));
    expect(await exportMonth("image", input)).toBe("failed");
    expect(await exportMonth("calendar", input)).toBe("failed");
  });
});
