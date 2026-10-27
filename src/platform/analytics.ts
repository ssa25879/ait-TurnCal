import { Analytics } from "@apps-in-toss/web-framework";
import type { ExportKind, ExportResult } from "../export/exportMonth";

/** 분석 실패·지연은 저장이나 내보내기의 결과에 영향을 주지 않는다. */
function record(send: () => Promise<void> | undefined): void {
  try {
    void send()?.catch(() => {});
  } catch {
    // 미지원·동기 예외도 사용자 동작과 분리한다.
  }
}

export function recordPatternSaved(): void {
  record(() => Analytics.log({ log_name: "turncal_pattern_saved", log_type: "event", params: {} }));
}

export function recordExportRequested(kind: ExportKind): void {
  if (kind !== "image" && kind !== "calendar") return;
  record(() => Analytics.click({ log_name: "turncal_export_requested", format: kind }));
}

export function recordExportResult(kind: ExportKind, result: ExportResult): void {
  if (kind !== "image" && kind !== "calendar") return;
  if (result !== "opened" && result !== "failed" && result !== "unsupported") return;
  record(() => Analytics.log({ log_name: "turncal_export_result", log_type: "event", params: { format: kind, result } }));
}
