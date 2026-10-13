import { describe, expect, it } from "vitest";
import { BRAND_PRIMARY_COLOR } from "../brand";
import { applyTheme, DEFAULT_THEME, isThemeId, THEME_IDS, THEMES } from "./theme";

describe("THEMES", () => {
  it("인디고·딥 틸·코랄 오렌지 세 테마를 정의한다", () => {
    expect(THEME_IDS).toEqual(["INDIGO", "TEAL", "CORAL"]);
    expect(THEMES.INDIGO).toMatchObject({ name: "인디고", primary: "#4F46E5" });
    expect(THEMES.TEAL).toMatchObject({ name: "딥 틸", primary: "#0F766E" });
    expect(THEMES.CORAL).toMatchObject({ name: "코랄 오렌지", primary: "#C2410C" });
  });

  it("기본 테마는 인디고이고 브랜드 대표색과 같다", () => {
    expect(DEFAULT_THEME).toBe("INDIGO");
    expect(BRAND_PRIMARY_COLOR).toBe(THEMES.INDIGO.primary);
  });

  it("토스 브랜드 색 계열을 포함하지 않는다", () => {
    const colors = Object.values(THEMES).flatMap((t) => [t.primary, t.primaryWeak].map((c) => c.toUpperCase()));
    expect(colors).not.toContain("#3182F6");
    expect(colors).not.toContain("#0064FF");
  });
});

describe("isThemeId", () => {
  it("정의된 테마만 허용한다", () => {
    expect(isThemeId("TEAL")).toBe(true);
    expect(isThemeId("teal")).toBe(false);
    expect(isThemeId("BLUE")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});

describe("applyTheme", () => {
  it.each(THEME_IDS)("%s 테마의 강조색 변수를 설정한다", (id) => {
    const values = new Map<string, string>();
    applyTheme({ style: { setProperty: (name, value) => values.set(name, value) } }, id);
    expect(values.get("--color-primary")).toBe(THEMES[id].primary);
    expect(values.get("--color-primary-weak")).toBe(THEMES[id].primaryWeak);
  });
});
