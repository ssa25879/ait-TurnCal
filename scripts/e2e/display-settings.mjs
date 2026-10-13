import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const KEY = "__ait_storage:turncal.settings";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
await context.addInitScript(() => { history.back = () => {}; });
const page = await context.newPage();
const logs = [];
const errors = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const wait = (ms = 400) => page.waitForTimeout(ms);
const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
const back = async () => { await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await wait(); };
const stored = () => page.evaluate((k) => localStorage.getItem(k), KEY);
const primaryVar = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim().toUpperCase());
const bgOf = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const failWrites = () => page.evaluate((k) => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) { if (key === k) throw new Error("quota"); return original.call(this, key, value); };
}, KEY);

async function fresh(value) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("main.app", { timeout: 15000 });
  await page.evaluate(([k, v]) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v)), [KEY, value]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await wait(300);
}
const openMenu = async () => { await page.getByRole("button", { name: "설정", exact: true }).click(); await page.waitForSelector(".settings-menu"); };
const openDisplay = async () => { await openMenu(); await page.getByText("화면 설정", { exact: true }).click(); await page.waitForSelector(".display-settings"); };
const openPatternFromMenu = async () => { await openMenu(); await page.getByText("근무 패턴", { exact: true }).click(); await page.waitForSelector(".settings"); };

const v2 = (extra = {}) => JSON.stringify({ version: 2, pattern: { startDate: "2026-10-11", cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"] }, weekStart: "SUN", theme: "INDIGO", ...extra });

// ---------- 최초 등록 흐름 (MVP 회귀, 설정 목록을 거치지 않음) ----------
await fresh(null);
check("최초: 초기 안내", await page.getByText("패턴 등록하기").isVisible());
check("최초: 기본 테마 인디고", (await primaryVar()) === "#4F46E5");
await page.getByText("패턴 등록하기").click();
await page.waitForSelector(".settings");
check("최초: 안내 → 근무 패턴 화면으로 바로 진입", (await page.locator(".settings-menu").count()) === 0);
let before = closeCalls();
await back();
check("최초: 근무 패턴에서 뒤로가기 → 종료", closeCalls() === before + 1);
for (const n of ["주간", "주간", "야간", "야간", "휴무", "휴무"]) await page.locator(".shift-button", { hasText: n }).click();
await page.locator(".today-cell").nth(2).click();
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForSelector(".calendar");
const saved = JSON.parse(await stored());
check("최초 저장: version 3, 테마 인디고", saved.version === 3 && saved.theme === "INDIGO" && saved.weekStart === "SUN", JSON.stringify(saved));

// ---------- 달력에서 주 시작 요일 UI 제거 ----------
check("달력: 주 시작 요일 선택 UI 없음", (await page.getByText("월요일 시작").count()) === 0 && (await page.locator('[role="radiogroup"]').count()) === 0);
check("달력: 하단 [설정] 버튼", await page.getByRole("button", { name: "설정", exact: true }).isVisible());

// ---------- 설정 목록 ----------
await openMenu();
check("설정 목록: 두 항목", (await page.getByText("근무 패턴", { exact: true }).isVisible()) && (await page.getByText("화면 설정", { exact: true }).isVisible()));
check("설정 목록: 요약 문구", (await page.getByText("6일 주기").isVisible()) && (await page.getByText("인디고 · 일요일 시작").isVisible()));
await back();
check("설정 목록 뒤로가기 → 달력", await page.locator(".calendar").isVisible());
before = closeCalls();
await back();
check("달력 뒤로가기 → 종료", closeCalls() === before + 1);

// ---------- 근무 패턴 (설정 목록 경유) ----------
await openPatternFromMenu();
check("근무 패턴: 저장값·오늘 위치 채움", (await page.locator(".cycle-item").count()) === 6 && (await page.locator(".today-cell").nth(2).getAttribute("aria-checked")) === "true");
await back();
check("근무 패턴(변경 없음) 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
await page.getByText("근무 패턴", { exact: true }).click();
await page.waitForSelector(".settings");
await page.locator(".shift-button", { hasText: "비번" }).click();
await wait();
await back();
const dialogShown = await page.getByText("변경한 내용을 버릴까요?").waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
check("근무 패턴 dirty 뒤로가기 → 폐기 확인", dialogShown);
await page.getByText("계속 편집하기").click();
await wait();
check("폐기 취소 → 편집 유지", (await page.locator(".cycle-item").count()) === 7);
await back();
await page.getByRole("button", { name: "버리기" }).waitFor({ state: "visible", timeout: 3000 });
await page.getByRole("button", { name: "버리기" }).click();
await wait();
check("폐기 확인 → 설정 목록, 저장값 그대로", (await page.locator(".settings-menu").isVisible()) && JSON.parse(await stored()).pattern.cycle.length === 6);
await back();

// ---------- 화면 설정: 테마 ----------
await openDisplay();
check("화면 설정: 세 테마 선택지", (await page.locator(".theme-option").count()) === 3);
check("화면 설정: 현재 테마 선택됨", (await page.locator(".theme-option").nth(0).getAttribute("aria-checked")) === "true");
check("화면 설정: 견본 색", (await bgOf(page.locator(".theme-swatch").nth(1))) === "rgb(15, 118, 110)");
const dayCellBefore = await bgOf(page.locator(".shift-DAY").first()).catch(() => null);
await page.getByText("딥 틸").click();
await wait();
check("테마 변경 → CSS 강조색 즉시 딥 틸", (await primaryVar()) === "#0F766E");
check("테마 변경 → 즉시 저장", JSON.parse(await stored()).theme === "TEAL");
await back();
check("화면 설정 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
check("설정 목록 요약 갱신", await page.getByText("딥 틸 · 일요일 시작").isVisible());
await back();
const todayCell = page.locator(`.calendar-cell[data-date="${today}"]`);
check("달력 오늘 강조 = 딥 틸", (await todayCell.evaluate((el) => getComputedStyle(el).borderTopColor)) === "rgb(15, 118, 110)");
await openPatternFromMenu();
const fills = await page.getByRole("button", { name: "저장", exact: true }).evaluate((el) => [el, ...el.querySelectorAll("*")].map((n) => getComputedStyle(n).backgroundColor).filter((c) => c !== "rgba(0, 0, 0, 0)"));
check("TDS 채움 버튼 = 딥 틸", fills.includes("rgb(15, 118, 110)"), JSON.stringify(fills));
await back();
await back();
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".calendar");
check("재실행 후 딥 틸 유지", (await primaryVar()) === "#0F766E");
check("근무 유형 색은 테마와 무관", (await bgOf(page.locator(".calendar-shift.shift-DAY").first())) === "rgb(255, 243, 196)");

// ---------- 화면 설정: 주 시작 요일 ----------
await openDisplay();
await page.getByText("월요일 시작").click();
await wait();
check("주 시작 요일 즉시 저장", JSON.parse(await stored()).weekStart === "MON");
await back();
await back();
check("달력이 월요일 시작", (await page.locator(".calendar-weekday").first().textContent()) === "월");

// ---------- 저장 실패 되돌림 ----------
await openDisplay();
await failWrites();
await page.getByText("코랄 오렌지").click();
await wait();
check("테마 저장 실패 → 되돌림·안내", (await primaryVar()) === "#0F766E" && (await page.getByText("화면 설정을 저장하지 못했어요").isVisible()));
await page.getByText("일요일 시작").click();
await wait();
check("주 시작 저장 실패 → 되돌림", JSON.stringify(await page.locator("input[type=radio]:checked").evaluateAll((els) => els.map((e) => e.value))) === '["MON"]' && JSON.parse(await stored()).weekStart === "MON");

// ---------- v1 마이그레이션 ----------
const v1 = JSON.stringify({ version: 1, pattern: { startDate: "2026-10-11", cycle: ["DAY", "OFF"] }, weekStart: "MON" });
await fresh(v1);
check("v1: 달력 표시, 인디고", (await page.locator(".calendar").isVisible()) && (await primaryVar()) === "#4F46E5");
check("v1: 월요일 시작 유지", (await page.locator(".calendar-weekday").first().textContent()) === "월");
check("v1: 저장값 무기록", (await stored()) === v1);
await openDisplay();
await page.getByText("딥 틸").click();
await wait();
const migrated = JSON.parse(await stored());
check("v1 이후 첫 변경 → v3 기록", migrated.version === 3 && migrated.theme === "TEAL" && migrated.weekStart === "MON" && migrated.pattern.cycle.join() === "DAY,OFF", JSON.stringify(migrated));

// ---------- 상위 버전·알 수 없는 테마 ----------
for (const [label, value] of [["version 4", v2({ version: 4 })], ["알 수 없는 테마", v2({ theme: "BLUE" })]]) {
  await fresh(value);
  check(`${label}: 오류 안내·보존`, (await page.getByText("저장된 근무 설정을 불러오지 못했어요").isVisible()) && (await stored()) === value);
}

// ---------- 오버레이 우선 닫기(회귀) ----------
await fresh(v2());
await openPatternFromMenu();
await page.locator(".cycle-item").nth(1).click();
await wait(600);
await back();
check("바텀시트 열린 상태 뒤로가기 → 시트만 닫힘", (await page.locator(".settings").isVisible()) && !(await page.getByText("2번째 근무").isVisible()));

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
