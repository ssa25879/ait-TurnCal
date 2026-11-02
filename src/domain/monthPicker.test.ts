import { describe, expect, it } from "vitest";
import { MAX_YEAR, MIN_YEAR } from "./date";
import { canStepYear, stepYear } from "./monthPicker";

describe("stepYear", () => {
  it("한 해씩 바꾼다", () => {
    expect(stepYear(2026, 1)).toBe(2027);
    expect(stepYear(2026, -1)).toBe(2025);
  });

  it("지원 범위(1970~2100)를 벗어나지 않는다", () => {
    expect(stepYear(MIN_YEAR, -1)).toBe(MIN_YEAR);
    expect(stepYear(MAX_YEAR, 1)).toBe(MAX_YEAR);
  });

  it("경계에서 안쪽으로는 이동한다", () => {
    expect(stepYear(MIN_YEAR, 1)).toBe(MIN_YEAR + 1);
    expect(stepYear(MAX_YEAR, -1)).toBe(MAX_YEAR - 1);
  });
});

describe("canStepYear", () => {
  it("범위 안에서는 양방향 모두 가능하다", () => {
    expect(canStepYear(2026, -1)).toBe(true);
    expect(canStepYear(2026, 1)).toBe(true);
  });

  it("1970년에서는 이전 해로, 2100년에서는 다음 해로 갈 수 없다", () => {
    expect(canStepYear(MIN_YEAR, -1)).toBe(false);
    expect(canStepYear(MIN_YEAR, 1)).toBe(true);
    expect(canStepYear(MAX_YEAR, 1)).toBe(false);
    expect(canStepYear(MAX_YEAR, -1)).toBe(true);
  });
});
