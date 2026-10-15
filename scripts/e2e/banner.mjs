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
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
await context.addInitScript(() => { history.back = () => {}; });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms = 400) => page.waitForTimeout(ms);
// 클릭 직후 변경 여부(dirty) 상태가 반영되기 전에 이벤트가 읽히지 않게 잠깐 기다린다.
const back = async () => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await wait(); };
const calls = (api) => page.evaluate((name) => window.__ait.state.sdkCallLog.filter((e) => JSON.stringify(e).includes(name)).length, api);
const banners = () => page.locator(".calendar-banner").count();
const bannerBox = () => page.locator(".calendar-banner").boundingBox();
const v3 = JSON.stringify({ version: 3, pattern: { startDate: "2026-10-13", cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"] }, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null });

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, v3]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".calendar");
await wait(600);

// 위치·형식
check("달력에 배너 영역 1개", (await banners()) === 1);
const box = await bannerBox();
check("렌더링 후 높이 96px로 표시", Math.round(box.height) === 96 && (await page.locator(".calendar-banner").getAttribute("data-state")) === "shown", JSON.stringify(box));
check("배너 너비 = 화면 너비, 좌우 끝까지", Math.round(box.width) === 390 && Math.round(box.x) === 0);
// 설정 진입은 내비게이션 바 기능 버튼이라 달력 하단의 마지막 조작 요소는 바로가기 줄(.bottom-action)이다.
const settingsBox = await page.locator(".bottom-action").boundingBox();
const gap = box.y - (settingsBox.y + settingsBox.height);
check("하단 조작 영역 아래 32px 이상 간격", gap >= 32, `gap=${Math.round(gap)}`);
const gridBox = await page.locator(".calendar").boundingBox();
check("달력 격자·하단 조작 영역이 배너보다 위", gridBox.y + gridBox.height <= settingsBox.y && settingsBox.y < box.y);
const attachArgs = await page.evaluate(() => JSON.stringify(window.__ait.state.sdkCallLog.filter((e) => JSON.stringify(e).includes("attachBanner")).at(-1)));
check("테스트 ID로 요청", attachArgs.includes("ait-ad-test-banner-id"), attachArgs.slice(0, 200));
check("theme light 고정(다크모드 기기)", attachArgs.includes('"theme":"light"') && (await page.locator(".calendar-banner").innerText()).includes("Banner Ad"));
check("SDK 초기화 1회", (await calls("TossAds.initialize")) === 1);

// 다른 화면에는 없음 + 반복 이동
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  if (i === 0) check("설정 목록에 배너 없음", (await banners()) === 0);
  await page.getByText("화면 설정", { exact: true }).click();
  if (i === 0) check("화면 설정에 배너 없음", (await banners()) === 0);
  await back();
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  if (i === 0) check("근무 패턴에 배너 없음", (await banners()) === 0);
  await back(); await back();
  await page.locator(".calendar-cell").nth(10).click();
  await page.waitForSelector(".day-screen");
  if (i === 0) check("날짜 화면에 배너 없음", (await banners()) === 0);
  await page.getByRole("button", { name: "세부 내용 추가" }).click();
  if (i === 0) check("세부 내용 편집에 배너 없음", (await banners()) === 0);
  await back(); await back();
  await page.waitForSelector(".calendar");
}
await wait(300);
check("반복 이동 후에도 초기화 1회", (await calls("TossAds.initialize")) === 1);
check("달력 복귀 시 배너 1개(슬롯 1개)", (await banners()) === 1 && (await page.locator(".calendar-banner-slot > *").count()) === 1);

// 광고 없음 → 숨김
await page.evaluate(() => window.__ait.patch("ads", { forceNoFill: true }));
await page.getByRole("button", { name: "설정", exact: true }).click();
await page.waitForSelector(".settings-menu");
await back();
await wait(500);
const noFillBox = await bannerBox();
check("광고 없음 → 높이 0(빈 공간 없음)", Math.round(noFillBox.height) === 0 && (await page.locator(".calendar-banner").getAttribute("data-state")) === "hidden");
await page.evaluate(() => window.__ait.patch("ads", { forceNoFill: false }));

// 초기 안내·오류 화면
await page.evaluate((k) => localStorage.removeItem(k), SKEY);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".no-pattern-card");
check("첫 실행 빈 달력은 달력 화면이라 배너 영역이 있음", (await banners()) === 1);
await page.evaluate((k) => localStorage.setItem(k, "{bad"), SKEY);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".load-error");
check("오류 화면에 배너 없음", (await banners()) === 0);

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
