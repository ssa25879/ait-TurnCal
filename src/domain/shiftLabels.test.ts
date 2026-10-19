import { describe, expect, it } from "vitest";
import {
  applyShiftColors,
  DEFAULT_SHIFT_LABELS,
  SHIFT_COLOR_IDS,
  SHIFT_PALETTE,
  charLength,
  countCustomized,
  resolveShiftLabels,
  toStoredShiftLabels,
  validateShiftLabels,
  type ShiftLabels,
} from "./shiftLabels";
import { SHIFT_LABELS, SHIFT_TYPES } from "./types";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const withChange = (patch: Partial<ShiftLabels>): ShiftLabels => ({ ...DEFAULT_SHIFT_LABELS, ...patch });

describe("SHIFT_PALETTE", () => {
  it("10색이고 모든 짝의 글자 대비가 4.5:1 이상이다", () => {
    expect(SHIFT_COLOR_IDS).toHaveLength(10);
    for (const id of SHIFT_COLOR_IDS) {
      const { bg, fg } = SHIFT_PALETTE[id];
      expect(contrast(bg, fg), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("토스 브랜드 색을 포함하지 않는다", () => {
    const values = SHIFT_COLOR_IDS.flatMap((id) => [SHIFT_PALETTE[id].bg, SHIFT_PALETTE[id].fg]).map((v) => v.toLowerCase());
    expect(values).not.toContain("#3182f6");
    expect(values).not.toContain("#0064ff");
  });

  it("기본 색은 유형마다 다르고 팔레트에 있다", () => {
    const colors = SHIFT_TYPES.map((t) => DEFAULT_SHIFT_LABELS[t].color);
    expect(new Set(colors).size).toBe(6);
    for (const c of colors) expect(SHIFT_COLOR_IDS).toContain(c);
  });
});

describe("DEFAULT_SHIFT_LABELS", () => {
  it("이름·약어는 기존 기본값과 같다", () => {
    for (const t of SHIFT_TYPES) {
      expect(DEFAULT_SHIFT_LABELS[t].name).toBe(SHIFT_LABELS[t].name);
      expect(DEFAULT_SHIFT_LABELS[t].short).toBe(SHIFT_LABELS[t].short);
    }
  });
});

describe("charLength", () => {
  it("보이는 글자 단위로 센다", () => {
    expect(charLength("저녁")).toBe(2);
    expect(charLength("A")).toBe(1);
    expect(charLength("🌙")).toBe(1);
    expect(charLength("👩‍⚕️")).toBe(1);
  });
});

describe("validateShiftLabels", () => {
  it("기본값은 오류가 없다", () => {
    expect(validateShiftLabels(DEFAULT_SHIFT_LABELS)).toEqual({});
  });

  it("이름은 앞뒤 공백을 빼고 1~4자", () => {
    expect(validateShiftLabels(withChange({ EVENING: { name: "  저녁  ", short: "저", color: "ORANGE" } }))).toEqual({});
    expect(validateShiftLabels(withChange({ EVENING: { name: "   ", short: "저", color: "ORANGE" } })).EVENING?.name).toBeTruthy();
    expect(validateShiftLabels(withChange({ EVENING: { name: "저녁근무조", short: "저", color: "ORANGE" } })).EVENING?.name).toBeTruthy();
    expect(validateShiftLabels(withChange({ EVENING: { name: "저녁근무", short: "저", color: "ORANGE" } }))).toEqual({});
  });

  it("약어는 공백이 아닌 정확히 1자(한글·영문·이모지)", () => {
    for (const short of ["저", "E", "🌙"]) {
      expect(validateShiftLabels(withChange({ EVENING: { name: "저녁", short, color: "ORANGE" } })), short).toEqual({});
    }
    for (const short of ["", " ", "저녁"]) {
      expect(validateShiftLabels(withChange({ EVENING: { name: "저녁", short, color: "ORANGE" } })).EVENING?.short, short).toBeTruthy();
    }
  });

  it("약어 중복은 겹치는 두 유형 모두 오류", () => {
    const errors = validateShiftLabels(withChange({ DUTY: { name: "당직", short: "야", color: "PURPLE" } }));
    expect(errors.DUTY?.short).toBeTruthy();
    expect(errors.NIGHT?.short).toBeTruthy();
    expect(errors.DAY).toBeUndefined();
  });

  it("이름 중복은 겹치는 두 유형 모두 오류(공백 무시)", () => {
    const errors = validateShiftLabels(withChange({ AFTER_NIGHT: { name: " 휴무", short: "비", color: "MINT" } }));
    expect(errors.AFTER_NIGHT?.name).toBeTruthy();
    expect(errors.OFF?.name).toBeTruthy();
  });

  it("같은 색은 허용한다", () => {
    expect(validateShiftLabels(withChange({ AFTER_NIGHT: { name: "비번", short: "비", color: "GRAY" } }))).toEqual({});
  });

  it("팔레트 밖 색은 오류", () => {
    const bad = withChange({ DAY: { name: "주간", short: "주", color: "#ff0000" as never } });
    expect(validateShiftLabels(bad).DAY?.color).toBeTruthy();
  });
});

describe("resolveShiftLabels / toStoredShiftLabels", () => {
  it("저장값이 없으면 기본값", () => {
    expect(resolveShiftLabels(undefined)).toEqual(DEFAULT_SHIFT_LABELS);
  });

  it("저장된 유형만 덮어쓴다", () => {
    const resolved = resolveShiftLabels({ EVENING: { name: "저녁", short: "저", color: "PINK" } });
    expect(resolved.EVENING).toEqual({ name: "저녁", short: "저", color: "PINK" });
    expect(resolved.DAY).toEqual(DEFAULT_SHIFT_LABELS.DAY);
  });

  it("기본값과 다른 유형만 남기고 공백을 정리한다", () => {
    const stored = toStoredShiftLabels(withChange({ EVENING: { name: " 저녁 ", short: " 저", color: "ORANGE" } }));
    expect(stored).toEqual({ EVENING: { name: "저녁", short: "저", color: "ORANGE" } });
  });

  it("기본값과 같으면(공백만 다른 경우 포함) undefined", () => {
    expect(toStoredShiftLabels(DEFAULT_SHIFT_LABELS)).toBeUndefined();
    expect(toStoredShiftLabels(withChange({ DAY: { name: " 주간 ", short: "주", color: "YELLOW" } }))).toBeUndefined();
  });

  it("바꾼 유형 수를 센다", () => {
    expect(countCustomized(undefined)).toBe(0);
    expect(countCustomized({ EVENING: { name: "저녁", short: "저", color: "ORANGE" }, NIGHT: { name: "밤", short: "밤", color: "NAVY" } })).toBe(2);
  });
});

describe("applyShiftColors", () => {
  it("유형마다 팔레트의 배경·글자 변수를 설정한다", () => {
    const values = new Map<string, string>();
    const labels = resolveShiftLabels({ NIGHT: { name: "밤", short: "밤", color: "PINK" } });
    applyShiftColors({ style: { setProperty: (name, value) => values.set(name, value) } }, labels);
    expect(values.size).toBe(12);
    expect(values.get("--shift-night-bg")).toBe(SHIFT_PALETTE.PINK.bg);
    expect(values.get("--shift-night-fg")).toBe(SHIFT_PALETTE.PINK.fg);
    expect(values.get("--shift-after-night-bg")).toBe(SHIFT_PALETTE.MINT.bg);
    expect(values.get("--shift-day-fg")).toBe(SHIFT_PALETTE.YELLOW.fg);
  });
});
