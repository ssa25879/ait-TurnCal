import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SKEY = "__ait_storage:turncal.settings";
const EKEY = "__ait_storage:turncal.entries";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// Edge 155+는 옛 --headless와 --remote-debugging-pipe로 실행되지 않아, CDP_URL이 있으면 떠 있는 Edge에 연결한다.
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch({ executablePath: EDGE, headless: true });
const errors = [];

const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (x = {}) => ({ version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: "민수", scheduleName: "병동 3교대", ...x });
const entries = { version: 1, days: { "2026-10-14": { items: [
  { id: "e1", name: "병원 진료", start: "09:00", end: "10:30", memo: "정기 검진", createdAt: 1 },
  { id: "e2", name: "연차", shift: "OFF", createdAt: 2 }] } } };

async function open(settings, { w, h, raw = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { history.back = () => {}; });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v, ek, ev]) => { localStorage.setItem(k, v); localStorage.setItem(ek, ev); },
    [SKEY, raw ? settings : JSON.stringify(settings), EKEY, JSON.stringify(entries)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

/** 화면 안의 글자 크기·터치 영역·가로 스크롤을 잰다. */
async function audit(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
    };
    const small = [];
    for (const el of document.querySelectorAll("main.app *")) {
      if (!visible(el)) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!hasText) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) small.push(`${el.className || el.tagName}:${size}`);
    }
    const touch = [];
    const sel = "button, a, [role=button], [role=radio], [role=gridcell], input, textarea, select";
    for (const el of document.querySelectorAll(`main.app ${sel.split(", ").join(", main.app ")}`)) {
      if (!visible(el)) continue;
      // 바로가기 줄: 사용자가 실기기에서 확인·승인한 크기(TDS medium). 입력란: TDS TextField는 상자 전체가 누르는 영역이고 SegmentedControl은 TDS 최대 크기(40px)다.
      if (el.closest(".shortcut-row, .form-field, [role=radiogroup]:not(.category-options):not(.source-options)")) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 44 || r.width < 40) touch.push(`${el.className || el.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return {
      small,
      touch,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

const screens = {
  "달력(패턴 있음)": async () => null,
  "날짜 화면": async (p) => { await p.locator('.calendar-cell[data-date="2026-10-14"]').click(); await p.waitForSelector(".day-screen"); },
  "세부 내용 편집": async (p) => { await p.locator('.calendar-cell[data-date="2026-10-14"]').click(); await p.waitForSelector(".day-screen"); await p.getByRole("button", { name: "세부 내용 추가" }).click(); await p.waitForTimeout(400); },
  "설정 목록": async (p) => { await p.getByRole("button", { name: "설정", exact: true }).click(); await p.waitForSelector(".settings-menu"); },
  "근무 패턴 설정": async (p) => { await p.getByRole("button", { name: "근무 패턴 수정" }).click(); await p.waitForSelector(".settings"); },
  "이름": async (p) => { await p.getByRole("button", { name: "이름 수정" }).click(); await p.waitForTimeout(400); },
  "근무 유형": async (p) => { await p.getByRole("button", { name: "설정", exact: true }).click(); await p.waitForSelector(".settings-menu"); await p.getByText("근무 유형", { exact: true }).click(); await p.waitForSelector(".shift-labels-screen"); },
  "화면 설정": async (p) => { await p.getByRole("button", { name: "설정", exact: true }).click(); await p.waitForSelector(".settings-menu"); await p.getByText("화면 설정", { exact: true }).click(); await p.waitForSelector(".display-settings"); },
  "초기화 화면": async (p) => { await p.getByRole("button", { name: "설정", exact: true }).click(); await p.waitForSelector(".settings-menu"); await p.getByText("초기화", { exact: true }).click(); await p.waitForSelector(".reset-screen"); },
};

for (const [w, h] of [[360, 740], [390, 844]]) {
  for (const [name, go] of Object.entries(screens)) {
    const { ctx, page } = await open(base(), { w, h });
    await go(page);
    await page.waitForTimeout(300);
    const r = await audit(page);
    check(`${w}px ${name}: 11px 미만 글자 없음`, r.small.length === 0, r.small.slice(0, 4).join(", "));
    check(`${w}px ${name}: 터치 영역 44px(칸은 40×44) 이상`, r.touch.length === 0, [...new Set(r.touch)].slice(0, 5).join(", "));
    check(`${w}px ${name}: 가로 스크롤 없음`, !r.overflow);
    await ctx.close();
  }
  // 달력: 6주 격자가 첫 화면(스크롤 없이)에 모두 들어온다 + 20자 이름
  // 20자 이름+호칭은 이름 줄이 두 줄로 접히는 극단 사례라 첫 화면 기준에서는 제외하고 세로 길이만 기록한다.
  for (const [label, settings] of [["기본", base()], ["20자 이름", base({ scheduleName: "가".repeat(20), userName: "열자까지이름입니다" })]]) {
    const { ctx, page } = await open(settings, { w, h });
    const bottom = await page.evaluate(() => document.querySelector(".calendar").getBoundingClientRect().bottom);
    const rows = await page.locator(".calendar-row").count();
    check(`${w}×${h} 달력(${label}): 6주 격자 끝(${Math.round(bottom)}px)${label === "기본" ? "이 첫 화면 안" : " 기록"}`, rows === 7 && (label !== "기본" || bottom <= h), `bottom=${Math.round(bottom)}`);
    await ctx.close();
  }
  // 패턴 없는 달력과 오류 화면도 같은 기준
  {
    const { ctx, page } = await open(base({ pattern: null, patternHistory: [{ until: "2026-10-13", pattern: A }] }), { w, h });
    const r = await audit(page);
    check(`${w}px 패턴 없는 달력: 글자·터치·가로 스크롤`, r.small.length === 0 && r.touch.length === 0 && !r.overflow, [...r.small, ...r.touch].slice(0, 5).join(", "));
    await ctx.close();
  }
  {
    const { ctx, page } = await open("{bad", { w, h, raw: true });
    const r = await audit(page);
    check(`${w}px 오류 화면: 글자·터치·가로 스크롤`, r.small.length === 0 && r.touch.length === 0 && !r.overflow, [...r.small, ...r.touch].slice(0, 5).join(", "));
    await ctx.close();
  }
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
