import { SHIFT_LABELS, SHIFT_TYPES, type ShiftType } from "./types";

/** 근무 색 팔레트. 모든 짝은 글자 대비 4.5:1 이상이며 토스 브랜드 색 계열은 넣지 않는다. */
export const SHIFT_PALETTE = {
  YELLOW: { name: "노랑", bg: "#fff3c4", fg: "#8a5a00" },
  ORANGE: { name: "주황", bg: "#ffe0cc", fg: "#a23e00" },
  NAVY: { name: "남색", bg: "#dce4ff", fg: "#1e3a8a" },
  PURPLE: { name: "보라", bg: "#f3ddfb", fg: "#6b21a8" },
  MINT: { name: "민트", bg: "#d7f2ec", fg: "#0f6b5c" },
  GRAY: { name: "회색", bg: "#f2f4f6", fg: "#4e5968" },
  PINK: { name: "분홍", bg: "#ffe0ec", fg: "#9d174d" },
  RED: { name: "빨강", bg: "#fde2e2", fg: "#b91c1c" },
  GREEN: { name: "초록", bg: "#e3f5d8", fg: "#3f6212" },
  BROWN: { name: "갈색", bg: "#efe4da", fg: "#7c4a1e" },
} as const;

export type ShiftColorId = keyof typeof SHIFT_PALETTE;
export const SHIFT_COLOR_IDS = Object.keys(SHIFT_PALETTE) as ShiftColorId[];

export interface ShiftLabel {
  name: string;
  short: string;
  color: ShiftColorId;
}

export type ShiftLabels = Record<ShiftType, ShiftLabel>;
/** 저장 형식: 기본값과 다른 유형만 담는다. */
export type StoredShiftLabels = Partial<Record<ShiftType, ShiftLabel>>;

export const SHIFT_NAME_MAX = 4;

const DEFAULT_COLORS: Record<ShiftType, ShiftColorId> = {
  DAY: "YELLOW",
  EVENING: "ORANGE",
  NIGHT: "NAVY",
  DUTY: "PURPLE",
  AFTER_NIGHT: "MINT",
  OFF: "GRAY",
};

export const DEFAULT_SHIFT_LABELS: ShiftLabels = Object.fromEntries(
  SHIFT_TYPES.map((t) => [t, { ...SHIFT_LABELS[t], color: DEFAULT_COLORS[t] }]),
) as ShiftLabels;

/** CSS 변수 이름에 쓰는 유형 조각(`--shift-<slug>-bg`) */
export const SHIFT_CSS_SLUG: Record<ShiftType, string> = {
  DAY: "day",
  EVENING: "evening",
  NIGHT: "night",
  DUTY: "duty",
  AFTER_NIGHT: "after-night",
  OFF: "off",
};

/** 사용자가 보는 글자(grapheme) 수. Intl.Segmenter가 없으면 코드 포인트 수로 대신한다. */
export function charLength(value: string): number {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("ko", { granularity: "grapheme" }).segment(value)).length;
  return Array.from(value).length;
}

export function isShiftColorId(value: unknown): value is ShiftColorId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SHIFT_PALETTE, value);
}

const normalize = (label: ShiftLabel): ShiftLabel => ({ ...label, name: label.name.trim(), short: label.short.trim() });

export interface ShiftLabelError {
  name?: string;
  short?: string;
  color?: string;
}

/** 유형별 오류. 오류가 없으면 빈 객체다. 화면과 저장소 복원이 같은 규칙을 쓴다. */
export function validateShiftLabels(labels: ShiftLabels): Partial<Record<ShiftType, ShiftLabelError>> {
  const errors: Partial<Record<ShiftType, ShiftLabelError>> = {};
  const add = (t: ShiftType, field: keyof ShiftLabelError, message: string) => {
    errors[t] = { ...errors[t], [field]: errors[t]?.[field] ?? message };
  };
  const all = SHIFT_TYPES.map((t) => [t, normalize(labels[t])] as const);

  for (const [t, { name, short, color }] of all) {
    const nameLength = charLength(name);
    if (nameLength < 1 || nameLength > SHIFT_NAME_MAX) add(t, "name", `이름은 1~${SHIFT_NAME_MAX}자로 입력해 주세요.`);
    if (charLength(short) !== 1) add(t, "short", "약어는 한 글자로 입력해 주세요.");
    if (!isShiftColorId(color)) add(t, "color", "색을 골라 주세요.");
  }
  for (const [t, label] of all) {
    for (const [other, otherLabel] of all) {
      if (other === t) continue;
      if (label.name && label.name === otherLabel.name) add(t, "name", "다른 근무와 이름이 겹쳐요.");
      if (label.short && label.short === otherLabel.short) add(t, "short", "다른 근무와 약어가 겹쳐요.");
    }
  }
  return errors;
}

export function resolveShiftLabels(stored: StoredShiftLabels | undefined): ShiftLabels {
  if (!stored) return DEFAULT_SHIFT_LABELS;
  const resolved = { ...DEFAULT_SHIFT_LABELS };
  for (const t of SHIFT_TYPES) {
    const label = stored[t];
    if (label) resolved[t] = label;
  }
  return resolved;
}

const sameLabel = (a: ShiftLabel, b: ShiftLabel) => a.name === b.name && a.short === b.short && a.color === b.color;

/** 기본값과 다른 유형만 남긴다(공백 정리 후 비교). 모두 기본값이면 undefined. */
export function toStoredShiftLabels(labels: ShiftLabels): StoredShiftLabels | undefined {
  const stored: StoredShiftLabels = {};
  for (const t of SHIFT_TYPES) {
    const label = normalize(labels[t]);
    if (!sameLabel(label, DEFAULT_SHIFT_LABELS[t])) stored[t] = label;
  }
  return Object.keys(stored).length > 0 ? stored : undefined;
}

export function countCustomized(stored: StoredShiftLabels | undefined): number {
  return stored ? Object.keys(stored).length : 0;
}

interface StyleTarget {
  style: { setProperty(name: string, value: string): void };
}

/** 근무 색 CSS 변수를 루트에 넣는다(테마와 같은 방식이라 포털로 그린 팝업에도 적용된다). */
export function applyShiftColors(target: StyleTarget, labels: ShiftLabels): void {
  for (const t of SHIFT_TYPES) {
    const { bg, fg } = SHIFT_PALETTE[labels[t].color];
    target.style.setProperty(`--shift-${SHIFT_CSS_SLUG[t]}-bg`, bg);
    target.style.setProperty(`--shift-${SHIFT_CSS_SLUG[t]}-fg`, fg);
  }
}
