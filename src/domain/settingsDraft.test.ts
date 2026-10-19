import { describe, expect, it } from "vitest";
import {
  adjustTodayIndex,
  canSaveDraft,
  createDraft,
  draftToPattern,
  isDraftDirty,
  loadCycleIntoDraft,
  setStartDateOnDraft,
  type PatternDraft,
} from "./settingsDraft";
import type { WorkPattern } from "./types";

const saved: WorkPattern = {
  startDate: "2026-10-13",
  cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"],
};

describe("createDraft", () => {
  it("저장된 설정이 있으면 오늘 위치를 미리 선택한다", () => {
    expect(createDraft(saved, "2026-10-15")).toEqual({ cycle: saved.cycle, todayIndex: 2 });
  });

  it("저장된 설정이 없으면 빈 패턴, 오늘 위치 미선택으로 시작한다", () => {
    expect(createDraft(null, "2026-10-15")).toEqual({ cycle: [], todayIndex: null });
  });
});

describe("adjustTodayIndex", () => {
  it("패턴 길이가 줄면 index mod length로 보정한다", () => {
    expect(adjustTodayIndex(4, 3)).toBe(1);
  });

  it("길이가 늘면 위치를 유지한다", () => {
    expect(adjustTodayIndex(2, 7)).toBe(2);
  });

  it("미선택이거나 패턴이 비면 미선택이다", () => {
    expect(adjustTodayIndex(null, 3)).toBeNull();
    expect(adjustTodayIndex(2, 0)).toBeNull();
  });
});

describe("canSaveDraft", () => {
  it("빈 패턴, 오늘 위치 없음, 56개 초과면 사유와 함께 저장할 수 없다", () => {
    expect(canSaveDraft({ cycle: [], todayIndex: null })).toEqual({
      ok: false,
      reason: "근무 유형을 1개 이상 추가해 주세요.",
    });
    expect(canSaveDraft({ cycle: ["DAY"], todayIndex: null })).toEqual({
      ok: false,
      reason: "오늘에 해당하는 칸을 선택해 주세요.",
    });
    expect(canSaveDraft({ cycle: Array(57).fill("DAY"), todayIndex: 0 }).ok).toBe(false);
  });

  it("유효하면 저장할 수 있다", () => {
    expect(canSaveDraft({ cycle: ["DAY"], todayIndex: 0 })).toEqual({ ok: true });
  });
});

describe("draftToPattern", () => {
  it("오늘 위치로 기준일을 계산한다", () => {
    const draft: PatternDraft = { cycle: saved.cycle, todayIndex: 2 };
    expect(draftToPattern(draft, "2026-10-15")).toEqual(saved);
  });
});

describe("setStartDateOnDraft", () => {
  it("직접 지정한 기준일에 맞게 오늘 위치를 갱신한다", () => {
    const draft: PatternDraft = { cycle: saved.cycle, todayIndex: 0 };
    expect(setStartDateOnDraft(draft, "2026-10-13", "2026-10-15").todayIndex).toBe(2);
  });
});

describe("isDraftDirty", () => {
  it("저장된 설정과 같으면 변경 없음이다", () => {
    expect(isDraftDirty(createDraft(saved, "2026-10-15"), saved, "2026-10-15")).toBe(false);
  });

  it("패턴이나 오늘 위치가 다르면 변경 있음이다", () => {
    expect(isDraftDirty({ cycle: saved.cycle, todayIndex: 3 }, saved, "2026-10-15")).toBe(true);
    expect(isDraftDirty({ cycle: ["DAY"], todayIndex: 0 }, saved, "2026-10-15")).toBe(true);
  });

  it("저장된 설정이 없으면 패턴이 있을 때 변경 있음이다", () => {
    expect(isDraftDirty({ cycle: [], todayIndex: null }, null, "2026-10-15")).toBe(false);
    expect(isDraftDirty({ cycle: ["DAY"], todayIndex: null }, null, "2026-10-15")).toBe(true);
  });
});

describe("loadCycleIntoDraft", () => {
  const past: WorkPattern = { startDate: "2026-10-01", cycle: ["DAY", "NIGHT", "OFF"] };

  it("이력 패턴의 근무 순서를 불러오고 오늘 위치는 비운다", () => {
    expect(loadCycleIntoDraft(past.cycle)).toEqual({ cycle: ["DAY", "NIGHT", "OFF"], todayIndex: null });
  });

  it("원본 이력 배열과 분리된 복사본을 만든다", () => {
    const draft = loadCycleIntoDraft(past.cycle);
    expect(draft.cycle).not.toBe(past.cycle);
    draft.cycle.push("OFF");
    expect(past.cycle).toEqual(["DAY", "NIGHT", "OFF"]);
  });

  it("오늘 위치를 고르기 전에는 저장할 수 없다", () => {
    expect(canSaveDraft(loadCycleIntoDraft(past.cycle))).toEqual({
      ok: false,
      reason: "오늘에 해당하는 칸을 선택해 주세요.",
    });
  });

  it("저장된 패턴과 같은 근무 순서를 불러와도 편집 중으로 본다", () => {
    expect(isDraftDirty(loadCycleIntoDraft(saved.cycle), saved, "2026-10-15")).toBe(true);
    expect(isDraftDirty(loadCycleIntoDraft(past.cycle), saved, "2026-10-15")).toBe(true);
    expect(isDraftDirty(loadCycleIntoDraft(past.cycle), null, "2026-10-15")).toBe(true);
  });
});
