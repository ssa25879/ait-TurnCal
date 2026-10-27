import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportKind, ExportResult } from "../export/exportMonth";

const sdk = vi.hoisted(() => ({ log: vi.fn(), click: vi.fn() }));
vi.mock("@apps-in-toss/web-framework", () => ({ Analytics: sdk }));

import { recordExportRequested, recordExportResult, recordPatternSaved } from "./analytics";

beforeEach(() => {
  sdk.log.mockReset().mockResolvedValue(undefined);
  sdk.click.mockReset().mockResolvedValue(undefined);
});

describe("사용 행동 이벤트 계약", () => {
  it("패턴 저장은 사용자 입력 없이 고정 이벤트만 기록한다", () => {
    recordPatternSaved();
    expect(sdk.log.mock.calls).toEqual([[{ log_name: "turncal_pattern_saved", log_type: "event", params: {} }]]);
  });

  it.each(["image", "calendar"] as const)("%s 요청은 형식만 클릭 이벤트로 기록한다", (kind) => {
    recordExportRequested(kind);
    expect(sdk.click.mock.calls).toEqual([[{ log_name: "turncal_export_requested", format: kind }]]);
  });

  it.each([
    ["image", "opened"], ["image", "failed"], ["image", "unsupported"],
    ["calendar", "opened"], ["calendar", "failed"], ["calendar", "unsupported"],
  ] as const)("%s의 %s 결과를 완료로 바꾸지 않는다", (kind, result) => {
    recordExportResult(kind, result);
    expect(sdk.log.mock.calls).toEqual([[{ log_name: "turncal_export_result", log_type: "event", params: { format: kind, result } }]]);
  });

  it("독립된 두 행동을 한 번으로 합치지 않는다", () => {
    recordPatternSaved();
    recordPatternSaved();
    expect(sdk.log).toHaveBeenCalledTimes(2);
  });

  it.each(["csv", { name: "전송 금지", memo: "전송 금지" }])("허용되지 않은 형식 %j는 전송하지 않는다", (kind) => {
    recordExportRequested(kind as ExportKind);
    recordExportResult(kind as ExportKind, "opened");
    expect(sdk.log).not.toHaveBeenCalled();
    expect(sdk.click).not.toHaveBeenCalled();
  });

  it("허용되지 않은 결과·오류 객체는 전송하지 않는다", () => {
    recordExportResult("calendar", "completed" as ExportResult);
    recordExportResult("image", new Error("개인 데이터가 포함된 오류") as unknown as ExportResult);
    expect(sdk.log).not.toHaveBeenCalled();
  });
});

describe("분석 실패 격리", () => {
  for (const [method, record] of [["log", recordPatternSaved], ["click", () => recordExportRequested("calendar")]] as const) {
    it.each(["throw", "reject", "pending"] as const)(`${method}가 %s여도 호출자가 기다리거나 예외를 받지 않는다`, async (mode) => {
      sdk[method].mockImplementation(() => {
        if (mode === "throw") throw new Error("분석 오류");
        if (mode === "reject") return Promise.reject(new Error("분석 거부"));
        return new Promise<void>(() => {});
      });
      expect(record()).toBeUndefined();
      await Promise.resolve();
      expect(sdk[method]).toHaveBeenCalledTimes(1);
    });

    it(`${method}가 없는 환경에서도 예외를 전달하지 않는다`, () => {
      const original = sdk[method];
      Reflect.set(sdk, method, undefined);
      try {
        expect(record()).toBeUndefined();
      } finally {
        Reflect.set(sdk, method, original);
      }
    });
  }
});
