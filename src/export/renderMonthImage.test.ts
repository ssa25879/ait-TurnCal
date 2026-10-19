import { describe, expect, it } from "vitest";
import { IMAGE_WIDTH, layoutMonthImage } from "./renderMonthImage";
import type { DayShift } from "../domain/monthExport";

const monthShifts = (year: number, month: number, days: number, pick: (i: number) => DayShift["shift"]): DayShift[] =>
  Array.from({ length: days }, (_, i) => ({ date: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`, shift: pick(i) }));

describe("layoutMonthImage", () => {
  it("폭 1080, 칸은 주 수 × 7개이며 달 밖 칸은 날짜가 없다", () => {
    // 2026-10-01은 목요일 → 일요일 시작이면 5주
    const layout = layoutMonthImage({ year: 2026, month: 10 }, "SUN", monthShifts(2026, 10, 31, () => "DAY"));
    expect(layout.width).toBe(IMAGE_WIDTH);
    expect(layout.weeks).toBe(5);
    expect(layout.cells).toHaveLength(35);
    expect(layout.cells.filter((c) => c.date !== null)).toHaveLength(31);
    expect(layout.cells[4].date).toBe("2026-10-01");
  });

  it("6주 달은 더 높다", () => {
    // 2026-08-01은 토요일 → 일요일 시작이면 6주
    const five = layoutMonthImage({ year: 2026, month: 10 }, "SUN", monthShifts(2026, 10, 31, () => "DAY"));
    const six = layoutMonthImage({ year: 2026, month: 8 }, "SUN", monthShifts(2026, 8, 31, () => "DAY"));
    expect(six.weeks).toBe(6);
    expect(six.height).toBeGreaterThan(five.height);
  });

  it("주 시작 요일을 반영한다", () => {
    const mon = layoutMonthImage({ year: 2026, month: 10 }, "MON", monthShifts(2026, 10, 31, () => "DAY"));
    expect(mon.weekdayLabels[0]).toBe("월");
    expect(mon.cells[3].date).toBe("2026-10-01");
  });

  it("범례는 그달에 쓰인 유형만, 기본 순서대로 중복 없이", () => {
    const shifts = monthShifts(2026, 10, 31, (i) => (i % 3 === 0 ? "OFF" : i % 3 === 1 ? "NIGHT" : null));
    expect(layoutMonthImage({ year: 2026, month: 10 }, "SUN", shifts).legend).toEqual(["NIGHT", "OFF"]);
  });

  it("칸은 이미지 안에 있다", () => {
    const layout = layoutMonthImage({ year: 2026, month: 8 }, "SUN", monthShifts(2026, 8, 31, () => "DAY"));
    for (const c of layout.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(layout.width);
      expect(c.y + c.h).toBeLessThan(layout.height);
    }
  });
});
