import { buildMonthGrid, getWeekdayLabels, weekdayOf, type YearMonth } from "../domain/calendar";
import { getHolidays } from "../domain/holidays";
import type { DayShift } from "../domain/monthExport";
import { SHIFT_PALETTE, type ShiftLabels } from "../domain/shiftLabels";
import { SHIFT_TYPES, type ShiftType, type WeekStart } from "../domain/types";

export const IMAGE_WIDTH = 1080;
const PAD = 48;
const TITLE_H = 110;
const WEEKDAY_H = 60;
const CELL_H = 140;
const LEGEND_GAP = 32;
const LEGEND_ROW_H = 64;
const LEGEND_COLS = 3;
const FOOTER_H = 72;

const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const COLOR = { bg: "#ffffff", text: "#191f28", sub: "#6b7684", border: "#e5e8eb", danger: "#f04452" };

export interface ImageCell {
  /** 달 밖 칸은 null */
  date: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MonthImageLayout {
  width: number;
  height: number;
  weeks: number;
  weekdayLabels: string[];
  cells: ImageCell[];
  /** 그달에 쓰인 근무 유형(기본 순서) */
  legend: ShiftType[];
  gridTop: number;
  legendTop: number;
}

/** 그리기 좌표만 계산한다(캔버스 없이 테스트할 수 있게 분리). */
export function layoutMonthImage(month: YearMonth, weekStart: WeekStart, shifts: DayShift[]): MonthImageLayout {
  const prefix = `${month.year}-${String(month.month).padStart(2, "0")}-`;
  const grid = buildMonthGrid(month, weekStart);
  const offset = grid.findIndex((date) => date.startsWith(prefix));
  const weeks = Math.ceil((offset + shifts.length) / 7);
  const cellW = (IMAGE_WIDTH - PAD * 2) / 7;
  const gridTop = PAD + TITLE_H + WEEKDAY_H;
  const cells = grid.slice(0, weeks * 7).map((date, i) => ({
    date: date.startsWith(prefix) ? date : null,
    x: PAD + (i % 7) * cellW,
    y: gridTop + Math.floor(i / 7) * CELL_H,
    w: cellW,
    h: CELL_H,
  }));
  const used = new Set(shifts.map((s) => s.shift));
  const legend = SHIFT_TYPES.filter((t) => used.has(t));
  const legendTop = gridTop + weeks * CELL_H + LEGEND_GAP;
  const legendRows = Math.ceil(legend.length / LEGEND_COLS);
  return {
    width: IMAGE_WIDTH,
    height: legendTop + legendRows * LEGEND_ROW_H + FOOTER_H + PAD,
    weeks,
    weekdayLabels: getWeekdayLabels(weekStart),
    cells,
    legend,
    gridTop,
    legendTop,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawChip(ctx: CanvasRenderingContext2D, label: { short: string; color: keyof typeof SHIFT_PALETTE }, cx: number, cy: number, size: number) {
  const color = SHIFT_PALETTE[label.color];
  ctx.fillStyle = color.bg;
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.22);
  ctx.fill();
  ctx.fillStyle = color.fg;
  ctx.font = `700 ${Math.round(size * 0.55)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.short, cx, cy + 1);
}

export interface RenderInput {
  month: YearMonth;
  weekStart: WeekStart;
  shifts: DayShift[];
  labels: ShiftLabels;
  /** "근무표 이름 · 2026년 10월" */
  title: string;
  /** 토요일 색(테마 강조색) */
  primary: string;
}

/** 보고 있는 달의 달력을 PNG로 그려 base64(접두어 없음)로 돌려준다. */
export function renderMonthImage({ month, weekStart, shifts, labels, title, primary }: RenderInput): string {
  const layout = layoutMonthImage(month, weekStart, shifts);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요.");
  const shiftOf = new Map(shifts.map((s) => [s.date, s.shift]));

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // 제목
  ctx.fillStyle = COLOR.text;
  ctx.font = `700 44px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, PAD, PAD + TITLE_H / 2 - 8, layout.width - PAD * 2);

  // 요일 줄
  const cellW = layout.cells[0].w;
  ctx.font = `600 28px ${FONT}`;
  ctx.textAlign = "center";
  layout.weekdayLabels.forEach((name, i) => {
    ctx.fillStyle = name === "일" ? COLOR.danger : name === "토" ? primary : COLOR.sub;
    ctx.fillText(name, PAD + cellW * i + cellW / 2, PAD + TITLE_H + WEEKDAY_H / 2);
  });

  // 칸
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  for (const cell of layout.cells) {
    ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
    if (!cell.date) continue;
    const weekday = weekdayOf(cell.date);
    const holiday = getHolidays(cell.date).length > 0;
    ctx.fillStyle = holiday || weekday === 0 ? COLOR.danger : weekday === 6 ? primary : COLOR.text;
    ctx.font = `600 28px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(Number(cell.date.slice(8))), cell.x + 14, cell.y + 12);
    const shift = shiftOf.get(cell.date);
    if (shift) drawChip(ctx, labels[shift], cell.x + cell.w / 2, cell.y + cell.h * 0.64, 68);
  }

  // 범례
  const colW = (layout.width - PAD * 2) / LEGEND_COLS;
  layout.legend.forEach((type, i) => {
    const x = PAD + (i % LEGEND_COLS) * colW;
    const cy = layout.legendTop + Math.floor(i / LEGEND_COLS) * LEGEND_ROW_H + LEGEND_ROW_H / 2;
    drawChip(ctx, labels[type], x + 24, cy, 48);
    ctx.fillStyle = COLOR.text;
    ctx.font = `500 28px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[type].name, x + 60, cy, colW - 70);
  });

  // 앱 이름
  ctx.fillStyle = COLOR.sub;
  ctx.font = `500 24px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("턴캘 교대근무 달력", layout.width - PAD, layout.height - PAD - FOOTER_H / 2 + 16);

  return canvas.toDataURL("image/png").split(",")[1];
}
