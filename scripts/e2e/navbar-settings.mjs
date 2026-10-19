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

const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (x = {}) => ({ version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: "민수", scheduleName: "병동", ...x });
const ACC = "button[data-ait-accessory-button-id=settings]";

/** 기능 버튼 등록이 실패하는 환경을 흉내 낸다: Devtools mock이 버튼을 DOM에 붙일 때 예외를 던지게 한다. */
const BREAK_ACCESSORY = () => {
  const original = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (node && node.dataset && node.dataset.aitAccessoryButtonId !== undefined) throw new Error("unsupported");
    return original.call(this, node);
  };
};

async function open(settings, { broken = false, w = 390, h = 844 } = {}) {
  const logs = [];
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(() => { history.back = () => {}; });
  if (broken) await context.addInitScript(BREAK_ACCESSORY);
  const page = await context.newPage();
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  if (settings !== null) await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(settings)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(500);
  const back = async () => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await page.waitForTimeout(400); };
  const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
  const accCount = () => page.locator(ACC).count();
  return { context, page, back, closeCalls, accCount };
}

// ---------- 1. 등록된 환경: 달력에서만 내비 바 기능 버튼 ----------
{
  const { context, page, back, accCount } = await open(base());
  check("달력: 내비게이션 바 기능 버튼 1개", (await accCount()) === 1);
  const info = await page.locator(ACC).evaluate((el) => ({ text: el.textContent, title: el.title }));
  check("버튼 이름 '설정'·아이콘 icon-setting-mono", info.text === "설정" && info.title.includes("icon-setting-mono"), JSON.stringify(info));
  check("하단에는 바로가기 2개만(대체 [설정] 없음)", (await page.locator(".bottom-action button").count()) === 2);

  await page.locator(ACC).click();
  await page.waitForSelector(".settings-menu");
  const items = await page.locator(".settings-menu [role=button]").allInnerTexts();
  check("버튼 클릭 → 설정 목록 5항목", items.length === 5, JSON.stringify(items));
  check("설정 목록에서는 기능 버튼 없음", (await accCount()) === 0);

  // 설정 계열 화면 전부에서 없음
  const screens = [
    ["이름", async () => { await page.getByText("이름", { exact: true }).click(); await page.waitForTimeout(300); }],
    ["근무 패턴", async () => { await page.getByText("근무 패턴", { exact: true }).click(); await page.waitForSelector(".settings"); }],
    ["근무 유형", async () => { await page.getByText("근무 유형", { exact: true }).click(); await page.waitForSelector(".shift-labels-screen"); }],
    ["화면 설정", async () => { await page.getByText("화면 설정", { exact: true }).click(); await page.waitForSelector(".display-settings"); }],
    ["초기화", async () => { await page.getByText("초기화", { exact: true }).click(); await page.waitForSelector(".reset-screen"); }],
  ];
  for (const [name, go] of screens) {
    await go();
    check(`${name} 화면에서는 기능 버튼 없음`, (await accCount()) === 0);
    await back();
    check(`${name} → 뒤로가기 → 설정 목록`, await page.locator(".settings-menu").isVisible());
  }
  await back();
  check("설정 목록 → 뒤로가기 → 달력, 기능 버튼 다시 표시(중복 없음)", (await page.locator(".calendar").isVisible()) && (await accCount()) === 1);

  // 날짜·편집 화면
  await page.locator('.calendar-cell[data-date="2026-10-14"]').click();
  await page.waitForSelector(".day-screen");
  check("날짜 화면에서는 기능 버튼 없음", (await accCount()) === 0);
  // 화면이 달력이 아닐 때 이벤트가 와도 무시
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:navigationAccessoryEvent", { detail: { id: "settings" } })));
  await page.waitForTimeout(300);
  check("달력이 아니면 기능 버튼 이벤트를 무시", await page.locator(".day-screen").isVisible());
  await page.getByRole("button", { name: "세부 내용 추가" }).click();
  await page.waitForTimeout(300);
  check("세부 내용 편집에서는 기능 버튼 없음", (await accCount()) === 0);
  await back();
  await back();
  check("편집 → 날짜 → 달력 복귀 시 기능 버튼 1개", (await page.locator(".calendar").isVisible()) && (await accCount()) === 1);

  // 바로가기 경로에서도 달력 복귀 시 1개
  await page.getByRole("button", { name: "이름 수정" }).click();
  await page.waitForTimeout(300);
  check("바로가기로 연 이름 화면에서는 기능 버튼 없음", (await accCount()) === 0);
  await back();
  check("바로가기 → 뒤로가기 → 달력, 기능 버튼 1개", (await page.locator(".calendar").isVisible()) && (await accCount()) === 1);

  // 반복 이동해도 중복 없음
  for (let i = 0; i < 4; i++) {
    await page.locator(ACC).click();
    await page.waitForSelector(".settings-menu");
    await back();
    await page.waitForSelector(".calendar");
  }
  check("설정 왕복 4회 뒤에도 기능 버튼 1개", (await accCount()) === 1);
  await context.close();
}

// ---------- 2. 패턴 없는 달력·첫 실행에도 기능 버튼 ----------
{
  const { context, page } = await open(base({ pattern: null, patternHistory: [{ until: "2026-10-13", pattern: A }] }));
  check("패턴 없는 달력: 기능 버튼 1개", (await page.locator(ACC).count()) === 1);
  await context.close();
}
{
  const { context, page, back, closeCalls } = await open(null);
  check("첫 실행 빈 달력: 기능 버튼 1개·저장값 없음", (await page.locator(ACC).count()) === 1 && (await page.evaluate((k) => localStorage.getItem(k), SKEY)) === null);
  const before = closeCalls();
  await back();
  check("첫 실행 달력에서 뒤로가기 → 종료(기능 버튼 때문에 바뀌지 않음)", closeCalls() === before + 1);
  await context.close();
}

// ---------- 3. 등록 실패 환경: 하단 대체 [설정] 버튼 ----------
{
  const { context, page, back } = await open(base(), { broken: true });
  await page.waitForTimeout(500);
  check("등록 실패: 기능 버튼 없음", (await page.locator(ACC).count()) === 0);
  const fallback = page.locator(".bottom-action").getByRole("button", { name: "설정", exact: true });
  check("등록 실패: 하단에 대체 [설정] 버튼 표시(바로가기 2개 + 설정)", (await fallback.isVisible()) && (await page.locator(".bottom-action button").count()) === 3);
  const box = await fallback.boundingBox();
  check("대체 버튼 터치 영역 44px 이상", box.height >= 44, `h=${Math.round(box.height)}`);
  await fallback.click();
  await page.waitForSelector(".settings-menu");
  check("대체 버튼 → 설정 목록 5항목", (await page.locator(".settings-menu [role=button]").count()) === 5);
  await back();
  check("설정 목록 → 뒤로가기 → 달력, 대체 버튼 유지", (await page.locator(".calendar").isVisible()) && (await fallback.isVisible()));
  // 배너와의 간격 32px
  await page.waitForSelector(".calendar-banner.is-shown", { timeout: 5000 }).catch(() => {});
  const gap = await page.evaluate(() => {
    const s = document.querySelector(".bottom-action").getBoundingClientRect();
    const a = document.querySelector(".calendar-banner").getBoundingClientRect();
    return a.top - s.bottom;
  });
  check("대체 버튼 아래 배너와 32px 이상 간격", gap >= 32, `gap=${Math.round(gap)}`);
  await context.close();
}

// ---------- 4. 360px: 기능 버튼이 레이아웃을 바꾸지 않음 ----------
{
  const { context, page } = await open(base({ scheduleName: "가".repeat(20), userName: "열자까지이름입니다" }), { w: 360, h: 740 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check("360px 가로 스크롤 없음", !overflow);
  const bottom = await page.evaluate(() => document.querySelector(".calendar").getBoundingClientRect().bottom);
  check("360px 6주 격자가 보이는 높이(20자 이름 포함 기록)", bottom > 0, `bottom=${Math.round(bottom)}`);
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
