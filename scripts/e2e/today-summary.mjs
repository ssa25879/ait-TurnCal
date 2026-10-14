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

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const errors = [];

// 2026-10-11 주간 시작: 주·주·오·야·야·비·휴 → 10/13 오후, 10/14 야간, 10/9 비번, 10/4·10/5 주간
const settings = (extra = {}) =>
  JSON.stringify({
    version: 3,
    pattern: { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] },
    weekStart: "SUN",
    theme: "INDIGO",
    userName: null,
    scheduleName: null,
    ...extra,
  });
const entries = (days) => JSON.stringify({ version: 1, days });
const item = (id, extra) => ({ id, name: id, createdAt: 1, ...extra });

/** 시계를 고정한 새 컨텍스트로 달력을 연다. */
async function open(now, { width = 390, height = 844, stored = {}, noFill = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date(now));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([sk, sv, ek, ev]) => {
    localStorage.setItem(sk, sv);
    localStorage.setItem(ek, ev);
  }, [SKEY, stored.settings ?? settings(), EKEY, stored.entries ?? entries({})]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".today-card");
  if (noFill) await page.evaluate(() => window.__ait?.patch?.("ads", { forceNoFill: true }));
  await page.waitForTimeout(500);
  return { context, page };
}
const card = (page, i) => page.locator(".today-card").nth(i);
const text = async (page, i) => (await card(page, i).innerText()).replace(/\s+/g, " ").trim();
const back = async (page) => { await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await page.waitForTimeout(400); };

// ---------- 기본 표시 ----------
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00");
  check("카드 2개: 오늘·내일", (await page.locator(".today-card").count()) === 2);
  const t0 = await text(page, 0), t1 = await text(page, 1);
  check("오늘 카드: 라벨·날짜·오후", t0.includes("오늘") && t0.includes("10월 13일 (화)") && t0.includes("오후"), t0);
  check("내일 카드: 라벨·날짜·야간", t1.includes("내일") && t1.includes("10월 14일 (수)") && t1.includes("야간"), t1);
  check("근무 색 클래스 + 약어", (await card(page, 0).locator(".shift-EVENING").innerText()) === "오" && (await card(page, 1).locator(".shift-NIGHT").innerText()) === "야");
  check("오늘 카드만 강조 클래스", (await card(page, 0).getAttribute("class")).includes("is-today") && !(await card(page, 1).getAttribute("class")).includes("is-today"));
  check("평일: 공휴일·바뀐 근무·시간 없음", (await page.locator(".today-card-holiday, .today-card-changed, .today-card-time").count()) === 0);
  check("aria-label에 날짜·근무", (await card(page, 1).getAttribute("aria-label")) === "내일, 10월 14일 (수), 야간");
  const order = await page.evaluate(() => {
    const y = (sel) => document.querySelector(sel)?.getBoundingClientRect().y ?? -1;
    return [y(".schedule-header"), y(".today-summary"), y(".month-nav"), y(".calendar"), y(".bottom-action"), y(".calendar-banner")];
  });
  check("순서: 요약 → 월 이동 → 격자 → 설정 → 광고", order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), JSON.stringify(order.map(Math.round)));
  const sizes = await page.evaluate(() => [...document.querySelectorAll(".today-card")].map((c) => c.getBoundingClientRect().height));
  check("카드 누름 영역 44px 이상", sizes.every((h) => h >= 44), JSON.stringify(sizes));
  const fonts = await page.evaluate(() => Math.min(...[...document.querySelectorAll(".today-card *")].filter((e) => e.textContent.trim() && e.children.length === 0).map((e) => parseFloat(getComputedStyle(e).fontSize))));
  check("카드 글자 11px 이상", fonts >= 11, `min=${fonts}`);
  await context.close();
}

// ---------- 다른 달을 봐도 유지 ----------
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00");
  const before = [await text(page, 0), await text(page, 1)];
  await page.getByLabel("다음 달").click(); await page.getByLabel("다음 달").click();
  await page.waitForTimeout(200);
  check("2개월 뒤를 봐도 요약은 오늘·내일 그대로", (await page.locator(".month-title").innerText()).includes("12월") && (await text(page, 0)) === before[0] && (await text(page, 1)) === before[1]);
  await context.close();
}

// ---------- 바뀐 근무·시간 ----------
{
  const stored = { entries: entries({
    "2026-10-13": { items: [item("병동 인수인계", { start: "15:00", end: "23:00", shift: "EVENING" }), item("회식", { start: "19:00" })] },
    "2026-10-14": { items: [item("연차", { shift: "OFF" })] },
  }) };
  const { context, page } = await open("2026-10-13T10:00:00+09:00", { stored });
  const t0 = await text(page, 0), t1 = await text(page, 1);
  check("오늘: 시간순 첫 항목 시간 15:00~23:00", t0.includes("15:00~23:00") && !t0.includes("19:00"), t0);
  check("오늘: 분류가 패턴과 같으면 바뀐 근무 표시(분류 있음)", t0.includes("바뀐 근무"), t0);
  check("내일: 연차 분류 → 휴무 + 바뀐 근무, 시간 없음", t1.includes("휴무") && t1.includes("바뀐 근무") && (await card(page, 1).locator(".today-card-time").count()) === 0, t1);
  check("내일: 색 클래스 휴무", (await card(page, 1).locator(".shift-OFF").count()) === 1);
  check("aria-label에 바뀐 근무", ((await card(page, 1).getAttribute("aria-label")) ?? "").includes("바뀐 근무"));
  await context.close();
}
{
  const stored = { entries: entries({
    "2026-10-13": { items: [item("야근", { start: "22:00", end: "06:00" })] },
    "2026-10-14": { items: [item("택배"), item("장보기")] },
  }) };
  const { context, page } = await open("2026-10-13T10:00:00+09:00", { stored });
  check("다음 날 종료 표기", (await text(page, 0)).includes("22:00~다음 날 06:00"));
  check("시작 시간 없는 항목만: 시간 줄·바뀐 근무 없음", (await card(page, 1).locator(".today-card-time, .today-card-changed").count()) === 0);
  await context.close();
}

// ---------- 공휴일 ----------
{
  const { context, page } = await open("2026-10-09T10:00:00+09:00");
  const t0 = await text(page, 0);
  check("한글날 카드: 이름 표시, 근무는 패턴(비번)", t0.includes("한글날") && t0.includes("비번") && (await card(page, 0).locator(".shift-AFTER_NIGHT").count()) === 1, t0);
  await context.close();
}
{
  const { context, page } = await open("2026-10-04T10:00:00+09:00");
  const t1 = await text(page, 1);
  check("내일이 대체공휴일: '개천절 대체공휴일', 근무는 패턴(주간)", t1.includes("개천절 대체공휴일") && t1.includes("주간"), t1);
  check("aria-label에 공휴일", ((await card(page, 1).getAttribute("aria-label")) ?? "").includes("개천절 대체공휴일"));
  await context.close();
}

// ---------- 월말·연말·지원 범위 ----------
{
  const { context, page } = await open("2026-12-31T10:00:00+09:00");
  check("연말: 내일 카드 1월 1일 (금)", (await text(page, 1)).includes("1월 1일 (금)"), await text(page, 1));
  await context.close();
}
{
  const { context, page } = await open("2100-12-31T10:00:00+09:00");
  check("지원 범위 마지막 날: 오늘 카드만", (await page.locator(".today-card").count()) === 1 && (await text(page, 0)).includes("12월 31일"));
  await context.close();
}

// ---------- 카드 → 날짜 화면 → 뒤로가기 ----------
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00");
  await page.getByLabel("다음 달").click(); await page.getByLabel("다음 달").click();
  await card(page, 1).click();
  await page.waitForSelector(".day-screen");
  check("내일 카드 → 10월 14일 날짜 화면", (await page.locator(".page-title").innerText()).includes("10월 14일 (수)"));
  await back(page);
  await page.waitForSelector(".today-card");
  check("뒤로가기 → 달력, 보던 달(12월) 유지", (await page.locator(".month-title").innerText()).includes("12월"));
  await card(page, 0).click();
  await page.waitForSelector(".day-screen");
  check("오늘 카드 → 10월 13일 날짜 화면", (await page.locator(".page-title").innerText()).includes("10월 13일 (화)"));
  await context.close();
}

// ---------- 날짜 화면에서 저장 후 요약 반영 ----------
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00");
  await card(page, 1).click();
  await page.waitForSelector(".day-screen");
  await page.getByRole("button", { name: "세부 내용 추가" }).click();
  await page.waitForSelector(".entry-editor");
  await page.getByLabel("이름").fill("연차");
  await page.locator(".time-input").nth(0).locator("input").fill("09:00");
  await page.locator(".time-input").nth(1).locator("input").fill("18:00");
  await page.locator(".category-option", { hasText: "휴무" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".day-screen");
  await back(page);
  await page.waitForSelector(".today-card");
  const t1 = await text(page, 1);
  check("저장 후 복귀: 내일 카드가 휴무·바뀐 근무·09:00~18:00 반영", t1.includes("휴무") && t1.includes("바뀐 근무") && t1.includes("09:00~18:00"), t1);
  // 근무 패턴 설정 변경: 오늘 위치를 4번째(야간)로 바꾸면 오늘 카드가 바뀐다
  check("패턴 변경 전 오늘 카드는 오후", (await text(page, 0)).includes("오후"));
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  await page.locator(".today-cell").nth(3).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 3 && (await page.locator(".today-card").count()) === 0; i += 1) await back(page);
  await page.waitForSelector(".today-card");
  const after = await text(page, 0);
  check("패턴 수정 후 복귀: 오늘 카드가 새 패턴(야간) 반영", after.includes("야간") && !after.includes("오후"), after);
  await context.close();
}

// ---------- 자정 경과 후 복귀 ----------
{
  const { context, page } = await open("2026-10-13T23:50:00+09:00");
  check("자정 전: 10월 13일·14일", (await text(page, 0)).includes("10월 13일") && (await text(page, 1)).includes("10월 14일"));
  await page.clock.setFixedTime(new Date("2026-10-14T00:05:00+09:00"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(400);
  check("자정 후 복귀: 10월 14일·15일로 갱신", (await text(page, 0)).includes("10월 14일") && (await text(page, 1)).includes("10월 15일"), `${await text(page, 0)} / ${await text(page, 1)}`);
  await context.close();
}

// ---------- 360px 폭 · 광고 없음 ----------
{
  const stored = { entries: entries({
    "2026-10-13": { items: [item("병동 인수인계", { start: "15:00", end: "23:00", shift: "EVENING" })] },
    "2026-10-14": { items: [item("연차", { shift: "OFF" })] },
  }) };
  const { context, page } = await open("2026-10-13T10:00:00+09:00", { width: 360, height: 640, stored });
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    boxes: [...document.querySelectorAll(".today-card")].map((c) => c.getBoundingClientRect()).map((r) => [r.left, r.right]),
    cols: new Set([...document.querySelectorAll(".calendar-weekday")].map((e) => Math.round(e.getBoundingClientRect().left))).size,
  }));
  check("360px: 가로 스크롤 없음", m.sw <= m.cw, `sw=${m.sw} cw=${m.cw}`);
  check("360px: 카드 두 개가 겹치지 않고 화면 안", m.boxes[0][1] <= m.boxes[1][0] && m.boxes[0][0] >= 0 && m.boxes[1][1] <= 360, JSON.stringify(m.boxes));
  check("360px: 달력 7열 모두 표시", m.cols === 7);
  await context.close();
}
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00", { noFill: true });
  await page.waitForTimeout(500);
  check("광고 없음에서도 요약·격자 정상", (await page.locator(".today-card").count()) === 2 && (await page.locator(".calendar-cell").count()) === 42);
  await context.close();
}
{
  const { context, page } = await open("2026-10-13T10:00:00+09:00");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const gap = await page.evaluate(() => {
    const s = document.querySelector(".bottom-action").getBoundingClientRect();
    const a = document.querySelector(".calendar-banner").getBoundingClientRect();
    return a.top - s.bottom;
  });
  check("[설정]–광고 간격 32px 이상 유지", gap >= 32, `gap=${Math.round(gap)}`);
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
