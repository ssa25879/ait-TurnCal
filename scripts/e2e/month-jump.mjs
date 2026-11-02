import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SKEY = "__ait_storage:turncal.settings";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// Edge 155+는 옛 --headless와 --remote-debugging-pipe로 실행되지 않아, CDP_URL이 있으면 떠 있는 Edge에 연결한다.
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch({ executablePath: EDGE, headless: true });
const errors = [];

const CYCLE = ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"];
const settings = JSON.stringify({
  version: 3,
  pattern: { startDate: "2026-10-11", cycle: CYCLE },
  weekStart: "SUN",
  theme: "INDIGO",
  userName: null,
  scheduleName: null,
});

/** 시계를 고정하면 TDS 바텀시트 닫힘이 끝나지 않으므로 시작 시각만 정한다. */
async function open({ width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date("2026-10-13T10:00:00+09:00") });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, settings]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".calendar");
  await page.waitForTimeout(400);
  return { context, page };
}

const title = async (page) => (await page.locator(".month-title").textContent()).trim();
const sheetOpen = (page) => page.locator(".month-picker").isVisible().catch(() => false);
const openSheet = async (page) => {
  await page.locator(".month-title-button").click();
  await page.waitForSelector(".month-picker", { state: "visible" });
  await page.waitForTimeout(500);
};
const back = async (page) => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await page.waitForTimeout(600); };
const shiftOf = (page, date) => page.locator(`.calendar-cell[data-date="${date}"] .calendar-shift`).innerText();

// ---------- 열기 · 선택 상태 ----------
{
  const { context, page } = await open();
  check("월 제목 텍스트는 그대로 'YYYY년 M월'", (await title(page)) === "2026년 10월", await title(page));
  check("월 제목 버튼에 접근 가능한 이름", (await page.locator(".month-title-button").getAttribute("aria-label")) === "2026년 10월, 연월 선택");
  await openSheet(page);
  check("시트에 현재 연도(2026년)가 표시", (await page.locator(".month-picker-year-text").innerText()) === "2026년");
  check("월 버튼이 12개", (await page.locator(".month-picker-month").count()) === 12);
  const selected = await page.locator(".month-picker-month.is-selected").allInnerTexts();
  check("현재 달(10월)만 선택 상태", selected.length === 1 && selected[0] === "10월" && (await page.locator(".month-picker-month.is-selected").getAttribute("aria-pressed")) === "true", selected.join());
  await context.close();
}

// ---------- 연·월 선택으로 이동 ----------
{
  const { context, page } = await open();
  await openSheet(page);
  await page.getByRole("button", { name: "다음 해" }).click();
  await page.getByRole("button", { name: "다음 해" }).click();
  check("다음 해 두 번 → 2028년", (await page.locator(".month-picker-year-text").innerText()) === "2028년");
  check("다른 연도에서는 선택 표시가 없음(10월은 2026년 기준)", (await page.locator(".month-picker-month.is-selected").count()) === 0);
  await page.locator(".month-picker-month", { hasText: "3월" }).click();
  await page.waitForTimeout(600);
  check("시트가 닫히고 2028년 3월 표시", (await title(page)) === "2028년 3월" && !(await sheetOpen(page)), await title(page));
  // 2028-03-01: 2026-10-11 기준 (Date.UTC 차이 % 7) → 독립 계산
  const diff = Math.round((Date.UTC(2028, 2, 1) - Date.UTC(2026, 9, 11)) / 86400000);
  const expectedShift = { DAY: "주", EVENING: "오", NIGHT: "야", AFTER_NIGHT: "비", OFF: "휴" }[CYCLE[((diff % 7) + 7) % 7]];
  check("이동한 달의 근무가 계산되어 있음(2028-03-01)", (await shiftOf(page, "2028-03-01")) === expectedShift, `${await shiftOf(page, "2028-03-01")} vs ${expectedShift}`);
  check("이동 뒤 통계도 그 달 기준(31일 합계)", (await page.locator(".month-stats-count").allInnerTexts()).reduce((a, t) => a + Number(t.replace("일", "")), 0) === 31);
  // 다시 열면 보고 있는 달(2028년 3월)이 선택 상태로 시작
  await openSheet(page);
  check("다시 열면 보던 연·월(2028년 3월)이 선택", (await page.locator(".month-picker-year-text").innerText()) === "2028년" && (await page.locator(".month-picker-month.is-selected").innerText()) === "3월");
  await context.close();
}

// ---------- 연도 경계 ----------
{
  const { context, page } = await open();
  await openSheet(page);
  const prev = page.getByRole("button", { name: "이전 해" });
  const next = page.getByRole("button", { name: "다음 해" });
  for (let i = 0; i < 74; i += 1) await next.click({ noWaitAfter: true }).catch(() => {});
  check("2100년에서 멈추고 다음 해 버튼 비활성화", (await page.locator(".month-picker-year-text").innerText()) === "2100년" && (await next.isDisabled()) && !(await prev.isDisabled()));
  await page.locator(".month-picker-month", { hasText: "12월" }).click();
  await page.waitForTimeout(600);
  check("2100년 12월로 이동", (await title(page)) === "2100년 12월", await title(page));
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.waitForTimeout(200);
  await openSheet(page);
  const minYear = page.locator(".month-picker-year-text");
  for (let i = 0; i < 131; i += 1) await page.getByRole("button", { name: "이전 해" }).click({ noWaitAfter: true }).catch(() => {});
  check("1970년에서 멈추고 이전 해 버튼 비활성화", (await minYear.innerText()) === "1970년" && (await page.getByRole("button", { name: "이전 해" }).isDisabled()) && !(await page.getByRole("button", { name: "다음 해" }).isDisabled()));
  await page.locator(".month-picker-month").getByText("1월", { exact: true }).click();
  await page.waitForTimeout(600);
  check("1970년 1월로 이동·근무 계산", (await title(page)) === "1970년 1월" && (await page.locator(".calendar-cell").count()) === 42);
  await context.close();
}

// ---------- 뒤로가기 ----------
{
  const { context, page } = await open();
  await openSheet(page);
  await page.getByRole("button", { name: "다음 해" }).click();
  await back(page);
  check("뒤로가기: 시트만 닫히고 보던 달 유지", !(await sheetOpen(page)) && (await title(page)) === "2026년 10월" && (await page.locator(".calendar").isVisible()), await title(page));
  await openSheet(page);
  check("닫기 전에 넘긴 연도는 버리고 다시 열면 보던 연도", (await page.locator(".month-picker-year-text").innerText()) === "2026년");
  await context.close();
}

// ---------- 기존 이동과 함께 쓰기 ----------
{
  const { context, page } = await open();
  await openSheet(page);
  await page.locator(".month-picker-month", { hasText: "6월" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "이전 달" }).click();
  check("이전 달 → 2026년 5월", (await title(page)) === "2026년 5월", await title(page));
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.getByRole("button", { name: "다음 달" }).click();
  check("다음 달 두 번 → 2026년 7월", (await title(page)) === "2026년 7월", await title(page));
  await page.getByRole("button", { name: "오늘", exact: true }).click();
  check("[오늘] → 2026년 10월", (await title(page)) === "2026년 10월", await title(page));
  await context.close();
}

// ---------- 360px · 터치 영역 · 글자 ----------
for (const [w, h] of [[360, 740], [390, 844]]) {
  const { context, page } = await open({ width: w, height: h });
  const m = await page.evaluate(() => {
    const nav = document.querySelector(".month-nav");
    const kids = [...nav.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
    const overlap = kids.some((a, i) => kids.some((b, j) => i < j && a.left < b.right - 0.5 && b.left < a.right - 0.5));
    const t = document.querySelector(".month-title-button").getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, overlap, th: t.height, tw: t.width, inside: kids.every((r) => r.left >= 0 && r.right <= document.documentElement.clientWidth) };
  });
  check(`${w}px: 가로 스크롤 없음`, m.sw <= m.cw, `sw=${m.sw} cw=${m.cw}`);
  check(`${w}px: 월 이동줄 버튼이 겹치거나 화면 밖으로 나가지 않음`, !m.overlap && m.inside);
  check(`${w}px: 월 제목 터치 영역 44px 이상`, m.th >= 44 && m.tw >= 44, `${Math.round(m.tw)}x${Math.round(m.th)}`);
  await openSheet(page);
  const s = await page.evaluate(() => {
    const months = [...document.querySelectorAll(".month-picker-month, .month-picker .month-nav-button")].map((e) => e.getBoundingClientRect());
    const fonts = Math.min(...[...document.querySelectorAll(".month-picker *")].filter((e) => e.textContent.trim() && e.children.length === 0).map((e) => parseFloat(getComputedStyle(e).fontSize)));
    return { small: months.some((r) => r.height < 44 || r.width < 44), fonts, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  check(`${w}px: 시트 버튼 터치 영역 44px 이상`, !s.small);
  check(`${w}px: 시트 글자 11px 이상·가로 스크롤 없음`, s.fonts >= 11 && s.sw <= s.cw, `min=${s.fonts}`);
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
