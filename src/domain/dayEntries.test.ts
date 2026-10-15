import { describe, expect, it } from "vitest";
import {
  formatTimeRange,
  getCellMarker,
  getEffectiveShift,
  getShiftSource,
  sortEntries,
  validateEntryInput,
  type DayEntry,
  type DayRecord,
} from "./dayEntries";
import type { WorkPattern } from "./types";

const pattern: WorkPattern = {
  startDate: "2026-10-13",
  cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"],
};

let seq = 0;
function entry(name: string, extra: Partial<DayEntry> = {}): DayEntry {
  seq += 1;
  return { id: `e${seq}`, name, createdAt: seq, ...extra };
}

describe("sortEntries", () => {
  it("시작 시간이 있는 항목을 시간순으로, 없는 항목을 작성순으로 뒤에 둔다", () => {
    const dinner = entry("회식", { start: "19:00" });
    const clinic = entry("병원", { start: "10:00" });
    const parcel = entry("택배");
    expect(sortEntries([dinner, clinic, parcel]).map((e) => e.name)).toEqual(["병원", "회식", "택배"]);
  });
});

describe("getShiftSource / getEffectiveShift", () => {
  it("분류 항목이 없으면 패턴 근무다", () => {
    const day: DayRecord = { items: [entry("택배")] };
    expect(getShiftSource(day)).toBeNull();
    expect(getEffectiveShift("2026-10-15", pattern, day)).toEqual({ shift: "NIGHT", overridden: false });
  });

  it("세부 내용이 없는 날은 패턴 근무다", () => {
    expect(getEffectiveShift("2026-10-15", pattern, undefined)).toEqual({ shift: "NIGHT", overridden: false });
  });

  it("분류 항목이 있으면 그날 근무가 그 분류로 바뀐다", () => {
    const day: DayRecord = { items: [entry("연차", { shift: "OFF" })] };
    expect(getEffectiveShift("2026-10-15", pattern, day)).toEqual({ shift: "OFF", overridden: true });
  });

  it("분류 항목이 여러 개면 가장 먼저 작성한 항목을 쓴다", () => {
    const duty = entry("당직", { shift: "DUTY" });
    const off = entry("휴가", { shift: "OFF" });
    expect(getShiftSource({ items: [off, duty] })?.id).toBe(duty.id);
  });

  it("사용자가 고른 항목을 우선한다", () => {
    const duty = entry("당직", { shift: "DUTY" });
    const off = entry("휴가", { shift: "OFF" });
    const day: DayRecord = { items: [duty, off], shiftSourceId: off.id };
    expect(getEffectiveShift("2026-10-15", pattern, day).shift).toBe("OFF");
  });

  it("고른 항목이 분류를 잃었거나 사라지면 가장 먼저 작성한 분류 항목으로 돌아간다", () => {
    const duty = entry("당직", { shift: "DUTY" });
    const off = entry("휴가");
    expect(getShiftSource({ items: [duty, off], shiftSourceId: off.id })?.id).toBe(duty.id);
    expect(getShiftSource({ items: [duty], shiftSourceId: "gone" })?.id).toBe(duty.id);
  });

  it("패턴이 없으면 근무 없음이고, 분류 항목이 있으면 그 근무를 쓴다", () => {
    expect(getEffectiveShift("2026-10-15", null, undefined)).toEqual({ shift: null, overridden: false });
    expect(getEffectiveShift("2026-10-15", null, { items: [entry("택배")] })).toEqual({ shift: null, overridden: false });
    const day: DayRecord = { items: [entry("휴가", { shift: "OFF" })] };
    expect(getEffectiveShift("2026-10-15", null, day)).toEqual({ shift: "OFF", overridden: true });
  });
});

describe("getCellMarker", () => {
  it("항목이 없으면 표시가 없다", () => {
    expect(getCellMarker(undefined)).toBeNull();
    expect(getCellMarker({ items: [] })).toBeNull();
  });

  it("정렬 첫 항목 이름의 앞글자를 표시한다", () => {
    expect(getCellMarker({ items: [entry("병원")] })).toBe("병");
  });

  it("항목이 여러 개면 +n을 붙인다", () => {
    const items = [entry("택배"), entry("병원", { start: "10:00" }), entry("회식", { start: "19:00" })];
    expect(getCellMarker({ items })).toBe("병+2");
  });

  it("서로게이트 문자의 첫 글자를 깨뜨리지 않는다", () => {
    expect(getCellMarker({ items: [entry("🎂생일")] })).toBe("🎂");
  });
});

describe("formatTimeRange", () => {
  it("시간 표기", () => {
    expect(formatTimeRange(undefined, undefined)).toBeNull();
    expect(formatTimeRange("09:00", undefined)).toBe("09:00");
    expect(formatTimeRange("09:00", "18:00")).toBe("09:00~18:00");
    expect(formatTimeRange("22:00", "07:00")).toBe("22:00~다음 날 07:00");
  });
});

describe("validateEntryInput", () => {
  const base = { name: "병원", start: "", end: "", memo: "" };

  it("이름만 있으면 유효하다", () => {
    expect(validateEntryInput(base)).toEqual({ ok: true });
  });

  it("이름이 비었거나 20자를 넘으면 거부한다", () => {
    expect(validateEntryInput({ ...base, name: "  " })).toMatchObject({ ok: false, field: "name" });
    expect(validateEntryInput({ ...base, name: "가".repeat(21) })).toMatchObject({ ok: false, field: "name" });
  });

  it("종료만 있으면 거부한다", () => {
    expect(validateEntryInput({ ...base, end: "18:00" })).toMatchObject({ ok: false, field: "start" });
  });

  it("시간 형식이 틀리면 거부한다", () => {
    expect(validateEntryInput({ ...base, start: "24:00" })).toMatchObject({ ok: false, field: "start" });
    expect(validateEntryInput({ ...base, start: "09:00", end: "9:5" })).toMatchObject({ ok: false, field: "end" });
  });

  it("내용이 500자를 넘으면 거부한다", () => {
    expect(validateEntryInput({ ...base, memo: "가".repeat(501) })).toMatchObject({ ok: false, field: "memo" });
  });
});
