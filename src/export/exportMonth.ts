import { saveBase64Data, Share } from "@apps-in-toss/web-framework";
import type { YearMonth } from "../domain/calendar";
import type { ReminderSetting } from "../domain/calendarReminder";
import type { DayRecord } from "../domain/dayEntries";
import { buildIcs, buildMonthShifts, exportFileName, toBase64Utf8 } from "../domain/monthExport";
import type { PatternTimeline } from "../domain/patternHistory";
import type { ShiftLabels } from "../domain/shiftLabels";
import type { WeekStart } from "../domain/types";
import { renderMonthImage } from "./renderMonthImage";

export type ExportKind = "image" | "calendar" | "cal-octet" | "cal-plain" | "cal-nolink" | "cal-tiny";
/** [진단 전용] 마지막 실패 단계와 오류 */
export let lastExportError = "";
/** 공유 창은 취소해도 성공으로 끝나므로 "opened"는 보냈다는 뜻이 아니다. */
export type ExportResult = "opened" | "unsupported" | "failed";

export interface ExportInput {
  month: YearMonth;
  weekStart: WeekStart;
  timeline: PatternTimeline;
  days: Record<string, DayRecord>;
  labels: ShiftLabels;
  /** 근무표 이름(없으면 기본 제목) */
  scheduleTitle: string;
  primary: string;
  reminder: ReminderSetting;
}

const APP_PATH = "intoss://ait-turncal";
const LINK_TIMEOUT_MS = 2000;

/** 턴캘을 여는 공유 링크. 실패하거나 2초 안에 오지 않으면 링크 없이 진행한다. */
async function createAppLink(): Promise<string | null> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LINK_TIMEOUT_MS));
    return await Promise.race([Share.createLink({ path: APP_PATH }), timeout]);
  } catch {
    return null;
  }
}

/** 보고 있는 달을 PNG 또는 .ics로 만들어 기기의 파일 공유 창에 넘긴다. */
export async function exportMonth(kind: ExportKind, input: ExportInput): Promise<ExportResult> {
  if (!saveBase64Data.isSupported()) return "unsupported";
  const { month, weekStart, timeline, days, labels, scheduleTitle, primary, reminder } = input;
  const shifts = buildMonthShifts(month, timeline, days);
  const monthTitle = `${month.year}년 ${month.month}월`;
  let step = "start";
  try {
    if (kind === "image") {
      const data = renderMonthImage({ month, weekStart, shifts, labels, primary, title: `${scheduleTitle} · ${monthTitle}` });
      await saveBase64Data({ data, fileName: exportFileName(month, "png"), mimeType: "image/png" });
    } else {
      step = "link";
      const link = kind === "cal-nolink" || kind === "cal-tiny" ? null : await createAppLink();
      step = "ics";
      let ics = buildIcs({ month, shifts, labels, link, reminder, title: `${scheduleTitle} ${monthTitle}`, now: new Date() });
      if (kind === "cal-tiny") ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TurnCal//KO", "END:VCALENDAR", ""].join(String.fromCharCode(13, 10));
      step = "base64";
      const data = toBase64Utf8(ics);
      const mimeType = kind === "cal-octet" ? "application/octet-stream" : kind === "cal-plain" ? "text/plain" : "text/calendar";
      const fileName = kind === "cal-plain" ? exportFileName(month, "ics").replace(".ics", ".txt") : exportFileName(month, "ics");
      step = `save(${mimeType}, ${fileName}, ${data.length}B, link=${link ? link.length : "none"})`;
      await saveBase64Data({ data, fileName, mimeType });
    }
    lastExportError = "";
    return "opened";
  } catch (error) {
    const e = error as { name?: string; code?: string; message?: string };
    lastExportError = `${step}: ${e?.name ?? ""} ${e?.code ?? ""} ${e?.message ?? String(error)}`.slice(0, 300);
    return "failed";
  }
}
