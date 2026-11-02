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

const CYCLE = ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"];
const START = "2026-10-11";
const settings = (extra = {}) =>
  JSON.stringify({ version: 3, pattern: { startDate: START, cycle: CYCLE }, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null, ...extra });
const entries = (days) => JSON.stringify({ version: 1, days });

/** 화면과 별개로 계산한 기대값: 해당 월의 유형별 일수 */
function expected(year, month, overrides = {}) {
  const counts = { DAY: 0, EVENING: 0, NIGHT: 0, DUTY: 0, AFTER_NIGHT: 0, OFF: 0 };
  const startMs = Date.UTC(2026, 9, 11);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d += 1) {
    const diff = Math.round((Date.UTC(year, month - 1, d) - startMs) / 86400000);
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    counts[overrides[key] ?? CYCLE[((diff % 7) + 7) % 7]] += 1;
  }
  return counts;
}

async function open({ width = 390, height = 844, stored = {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([sk, sv, ek, ev]) => {
    localStorage.setItem(sk, sv);
    localStorage.setItem(ek, ev);
  }, [SKEY, stored.settings ?? settings(), EKEY, stored.entries ?? entries({})]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".calendar");
  await page.waitForTimeout(400);
  return { context, page };
}

/** 화면의 통계 항목을 { 이름: 일수 } 와 { 이름: 약어 } 로 읽는다. */
const readStats = (page) =>
  page.evaluate(() => {
    const items = [...document.querySelectorAll(".month-stats-item")];
    return items.map((li) => ({
      name: li.querySelector(".month-stats-name").textContent,
      short: li.querySelector(".month-stats-badge").textContent,
      cls: li.querySelector(".month-stats-badge").className,
      count: Number(li.querySelector(".month-stats-count").textContent.replace("일", "")),
      label: li.getAttribute("aria-label"),
    }));
  });
const NAMES = { DAY: "주간", EVENING: "오후", NIGHT: "야간", DUTY: "당직", AFTER_NIGHT: "비번", OFF: "휴무" };
const sum = (items) => items.reduce((a, b) => a + b.count, 0);
const matches = (items, counts) => Object.entries(NAMES).every(([type, name], i) => items[i]?.name === name && items[i]?.count === counts[type]);

// ---------- 기본 표시 · 달 이동 ----------
{
  const { context, page } = await open();
  const oct = await readStats(page);
  check("6개 유형이 고정 순서로 표시", oct.length === 6 && oct.map((i) => i.name).join() === Object.values(NAMES).join());
  check("2026년 10월 유형별 일수가 독립 계산과 일치", matches(oct, expected(2026, 10)), JSON.stringify(oct.map((i) => i.count)));
  check("10월 합계 31일", sum(oct) === 31);
  check("0일인 유형(당직)도 0일로 표시", oct[3].count === 0 && (await page.locator(".month-stats-count").nth(3).innerText()) === "0일");
  check("근무 색 클래스 + 약어(색만으로 구별하지 않음)", oct[0].cls.includes("shift-DAY") && oct[0].short === "주");
  check("aria-label에 이름·일수", oct[0].label === `주간 ${oct[0].count}일`, oct[0].label);
  const order = await page.evaluate(() => [".calendar", ".month-stats", ".bottom-action"].map((s) => document.querySelector(s)?.getBoundingClientRect().y ?? -1));
  check("순서: 격자 → 통계 → 하단 조작", order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), JSON.stringify(order.map(Math.round)));

  await page.getByRole("button", { name: "다음 달" }).click();
  await page.waitForTimeout(200);
  check("다음 달(11월 30일) 값으로 바뀜", matches(await readStats(page), expected(2026, 11)) && sum(await readStats(page)) === 30);
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.waitForTimeout(200);
  check("2027년 2월(28일) 합계", sum(await readStats(page)) === 28 && matches(await readStats(page), expected(2027, 2)));
  await page.getByRole("button", { name: "오늘", exact: true }).click();
  await page.waitForTimeout(200);
  check("[오늘]로 돌아오면 10월 값", matches(await readStats(page), expected(2026, 10)));
  // 앞뒤 달 칸이 격자에 있어도 합계는 그달 일수
  const outside = await page.locator(".calendar-cell.is-outside").count();
  check("격자에 앞뒤 달 칸이 있어도 합계는 그달 일수", outside > 0 && sum(await readStats(page)) === 31, `outside=${outside}`);
  await context.close();
}

// ---------- 세부 내용으로 바뀐 근무 ----------
{
  const days = { "2026-10-14": { items: [{ id: "a", name: "연차", shift: "OFF", createdAt: 1 }] }, "2026-10-20": { items: [{ id: "b", name: "회의", createdAt: 2 }] } };
  const { context, page } = await open({ stored: { entries: entries(days) } });
  const items = await readStats(page);
  check("바뀐 근무 반영(10-14 → 휴무), 근무 안 바꾸는 내용은 무시", matches(items, expected(2026, 10, { "2026-10-14": "OFF" })) && sum(items) === 31, JSON.stringify(items.map((i) => i.count)));
  await context.close();
}

// ---------- 사용자 정의 근무 이름·약어 ----------
{
  const { context, page } = await open({ stored: { settings: settings({ shiftLabels: { DAY: { name: "데이", short: "데", color: "ORANGE" } } }) } });
  const items = await readStats(page);
  check("바꾼 이름·약어가 통계에 반영", items[0].name === "데이" && items[0].short === "데" && items[1].name === "오후");
  await context.close();
}

// ---------- 패턴 없음 ----------
{
  const { context, page } = await open({ stored: { settings: JSON.stringify({ version: 3, pattern: null, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null }) } });
  await page.waitForTimeout(300);
  check("패턴이 없으면 통계가 표시되지 않음", (await page.locator(".month-stats").count()) === 0);
  check("패턴이 없어도 등록 카드·달력은 정상", (await page.locator(".no-pattern-card").isVisible()) && (await page.locator(".calendar-cell").count()) === 42);
  await context.close();
}

// ---------- 좁은 화면 · 글자 · 기존 동작 ----------
for (const [w, h] of [[360, 740], [390, 844]]) {
  const { context, page } = await open({ width: w, height: h });
  const m = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".month-stats-item")];
    const boxes = items.map((e) => e.getBoundingClientRect());
    const fonts = Math.min(...[...document.querySelectorAll(".month-stats *")].filter((e) => e.textContent.trim() && e.children.length === 0).map((e) => parseFloat(getComputedStyle(e).fontSize)));
    const overlap = boxes.some((a, i) => boxes.some((b, j) => i < j && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    const outside = boxes.some((r) => r.left < 0 || r.right > document.documentElement.clientWidth);
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, fonts, overlap, outside, rows: new Set(boxes.map((r) => Math.round(r.top))).size };
  });
  check(`${w}px: 가로 스크롤 없음`, m.sw <= m.cw, `sw=${m.sw} cw=${m.cw}`);
  check(`${w}px: 통계 항목이 겹치거나 화면 밖으로 나가지 않음`, !m.overlap && !m.outside);
  check(`${w}px: 6개가 2행으로 표시`, m.rows === 2, `rows=${m.rows}`);
  check(`${w}px: 글자 11px 이상`, m.fonts >= 11, `min=${m.fonts}`);
  await context.close();
}
{
  const { context, page } = await open();
  await page.locator('.calendar-cell[data-date="2026-10-13"]').click();
  await page.waitForTimeout(300);
  check("통계가 있어도 날짜 칸을 누르면 날짜 화면이 열림", (await page.locator(".calendar").count()) === 0);
  await context.close();
}
{
  const { context, page } = await open();
  await page.getByRole("button", { name: "이번 달 내보내기" }).click();
  await page.waitForTimeout(500);
  check("통계가 있어도 [이번 달 내보내기] 시트가 열림", await page.getByText("달력 이미지 보내기").first().isVisible());
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
