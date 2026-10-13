export const THEME_IDS = ["INDIGO", "TEAL", "CORAL"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface Theme {
  name: string;
  /** 버튼·오늘 강조·선택 표시. 흰 글자 대비 4.5:1 이상 */
  primary: string;
  /** 연한 강조 배경 */
  primaryWeak: string;
}

/** 토스 브랜드 색 계열은 테마로 쓰지 않는다. */
export const THEMES: Record<ThemeId, Theme> = {
  INDIGO: { name: "인디고", primary: "#4F46E5", primaryWeak: "#EEF2FF" },
  TEAL: { name: "딥 틸", primary: "#0F766E", primaryWeak: "#E6F4F2" },
  CORAL: { name: "코랄 오렌지", primary: "#C2410C", primaryWeak: "#FFF1EA" },
};

export const DEFAULT_THEME: ThemeId = "INDIGO";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

interface StyleTarget {
  style: { setProperty(name: string, value: string): void };
}

export function applyTheme(target: StyleTarget, themeId: ThemeId): void {
  const theme = THEMES[themeId];
  target.style.setProperty("--color-primary", theme.primary);
  target.style.setProperty("--color-primary-weak", theme.primaryWeak);
}
