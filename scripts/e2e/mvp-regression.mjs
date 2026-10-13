import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const KEY = "__ait_storage:turncal.settings";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "dark", // 기기 다크 모드에서도 라이트로 보이는지 확인
});
await context.addInitScript(() => { history.back = () => {}; });
const page = await context.newPage();
const logs = [];
const errors = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
const back = () => page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
const stored = () => page.evaluate((k) => localStorage.getItem(k), KEY);
const today = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});

async function fresh(raw) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("main.app", { timeout: 15000 });
  await page.evaluate(
    ([k, v]) => {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    },
    [KEY, raw],
  );
  await page.reload();
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(300);
}

const goMenu = async () => { await page.getByRole("button", { name: "설정", exact: true }).click(); await page.waitForSelector(".settings-menu"); };
const goPattern = async () => { await goMenu(); await page.getByText("근무 패턴", { exact: true }).click(); };
const goDisplay = async () => { await goMenu(); await page.getByText("화면 설정", { exact: true }).click(); await page.waitForSelector(".display-settings"); };

// ---------- 1. 최초 실행 ----------
await fresh(null);
check("최초 실행: 초기 안내 화면", await page.getByText("패턴 등록하기").isVisible());
check("최초 실행: 바텀시트·다이얼로그 자동 표시 없음", (await page.locator('[role="dialog"]').count()) === 0);
const safeTop = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--safe-top"));
check("SafeArea CSS 변수 적용", /px$/.test(safeTop.trim()), `--safe-top=${safeTop.trim()}`);
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check("다크 모드 기기에서도 라이트 배경", bg === "rgb(255, 255, 255)", bg);
const viewport = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
check("확대·축소 비활성화 viewport", viewport.includes("user-scalable=no") && viewport.includes("maximum-scale=1"));

let before = closeCalls();
await back();
await page.waitForTimeout(200);
check("초기 안내에서 뒤로가기 → closeView", closeCalls() === before + 1);

// ---------- 2. 패턴 등록 ----------
await page.getByText("패턴 등록하기").click();
await page.waitForSelector(".settings");
const saveButton = page.getByRole("button", { name: "저장", exact: true });
check("빈 패턴이면 저장 비활성", await saveButton.isDisabled());
check("빈 패턴 사유 표시", await page.getByText("근무 유형을 1개 이상 추가해 주세요.").isVisible());

before = closeCalls();
await back();
await page.waitForTimeout(200);
check("첫 설정 화면에서 뒤로가기 → closeView", closeCalls() === before + 1);

for (const name of ["주간", "주간", "야간", "야간", "휴무", "휴무"]) {
  await page.locator(".shift-button", { hasText: name }).click();
}
check("유형 추가로 6칸", (await page.locator(".cycle-item").count()) === 6);
check("오늘 위치 미선택 사유 표시", await page.getByText("오늘에 해당하는 칸을 선택해 주세요.").isVisible());
check("오늘 위치 미선택이면 저장 비활성", await saveButton.isDisabled());

await page.locator(".today-cell").nth(2).click();
check("오늘 위치 선택", (await page.locator(".today-cell.is-selected").count()) === 1);
await saveButton.click();
await page.waitForSelector(".calendar");
const raw = JSON.parse(await stored());
const expectedStart = await page.evaluate((t) => {
  const [y, m, d] = t.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 2)).toISOString().slice(0, 10);
}, today);
check(
  "저장 형식(version 2, 기준일=오늘-2, 일요일 시작, 인디고)",
  raw.version === 3 && raw.theme === "INDIGO" && raw.pattern.startDate === expectedStart && raw.weekStart === "SUN" &&
    raw.pattern.cycle.join() === "DAY,DAY,NIGHT,NIGHT,OFF,OFF",
  JSON.stringify(raw),
);
const todayCell = page.locator(`.calendar-cell[data-date="${today}"]`);
check("오늘 칸 강조", (await todayCell.getAttribute("class")).includes("is-today"));
check("오늘 칸 근무 = 야간(인덱스 2)", (await todayCell.locator(".calendar-shift").textContent()) === "야");
check("달력 42칸", (await page.locator(".calendar-cell").count()) === 42);

// ---------- 3. 재실행 복원 ----------
await page.reload();
await page.waitForSelector(".calendar");
check("재실행 후 달력 복원", (await page.locator(`.calendar-cell[data-date="${today}"] .calendar-shift`).textContent()) === "야");

// ---------- 4. 월 이동 ----------
const [ty, tm] = today.split("-").map(Number);
const toDecember = (2026 - ty) * 12 + (12 - tm);
for (let i = 0; i < toDecember; i += 1) await page.getByLabel("다음 달").click();
check("2026년 12월로 이동", (await page.locator(".month-title").textContent()) === "2026년 12월");
await page.getByLabel("다음 달").click();
check("12월 → 2027년 1월", (await page.locator(".month-title").textContent()) === "2027년 1월");
check("2027년 1월 근무 표시", (await page.locator(".calendar-cell .calendar-shift").count()) === 42);
await page.getByRole("button", { name: "오늘", exact: true }).click();
check("[오늘]로 복귀", (await page.locator(".month-title").textContent()) === `${ty}년 ${tm}월`);

if (today.startsWith("2026-10")) {
  check("일요일 시작 2026-10 첫 칸 09-27", (await page.locator(".calendar-cell").first().getAttribute("data-date")) === "2026-09-27");
  check("인접 월 칸 흐림", (await page.locator('.calendar-cell[data-date="2026-09-27"]').getAttribute("class")).includes("is-outside"));
}

// ---------- 5. 주 시작 요일 (화면 설정) ----------
await goDisplay();
await page.getByText("월요일 시작").click();
await page.waitForTimeout(300);
await back();
await page.waitForTimeout(300);
await back();
await page.waitForTimeout(300);
check("월요일 시작으로 머리글 재배치", (await page.locator(".calendar-weekday").first().textContent()) === "월");
check("주 시작 요일 즉시 저장", JSON.parse(await stored()).weekStart === "MON");
if (today.startsWith("2026-10")) {
  check("월요일 시작 2026-10 첫 칸 09-28", (await page.locator(".calendar-cell").first().getAttribute("data-date")) === "2026-09-28");
}
await page.reload();
await page.waitForSelector(".calendar");
check("재실행 후 월요일 시작 유지", (await page.locator(".calendar-weekday").first().textContent()) === "월");

// ---------- 6. 설정 편집·뒤로가기 ----------
before = closeCalls();
await back();
await page.waitForTimeout(200);
check("달력에서 뒤로가기 → closeView", closeCalls() === before + 1);

await goPattern();
await page.waitForSelector(".settings");
check("저장된 오늘 위치 미리 선택", (await page.locator(".today-cell").nth(2).getAttribute("aria-checked")) === "true");

await back();
await page.waitForTimeout(300);
check("변경 없는 근무 패턴에서 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
await back();
await page.waitForTimeout(300);

await goPattern();
await page.waitForSelector(".settings");
await page.locator(".cycle-item").nth(1).click();
await page.waitForTimeout(500);
check("항목 탭 → 바텀시트", await page.getByText("2번째 근무").isVisible());
before = closeCalls();
await back();
await page.waitForTimeout(500);
check("바텀시트 열린 상태 뒤로가기 → 시트만 닫힘", !(await page.getByText("2번째 근무").isVisible()) && closeCalls() === before && (await page.locator(".settings").isVisible()));

await page.locator(".cycle-item").nth(1).click();
await page.waitForTimeout(500);
await page.getByText("비번", { exact: true }).last().click();
await page.waitForTimeout(500);
check("가운데 항목 유형 변경(주→비)", (await page.locator(".cycle-item").nth(1).textContent()).includes("비"));

await page.locator(".cycle-item").nth(1).click();
await page.waitForTimeout(500);
await page.getByText("이 칸 지우기").click();
await page.waitForTimeout(500);
check("가운데 항목 삭제 → 5칸", (await page.locator(".cycle-item").count()) === 5);
check("길이 변경 후 오늘 위치 보정(2 mod 5 = 2)", (await page.locator(".today-cell").nth(2).getAttribute("aria-checked")) === "true");
check("저장 전에는 저장값 불변", JSON.parse(await stored()).pattern.cycle.length === 6);

await back();
await page.waitForTimeout(500);
check("변경 있는 상태 뒤로가기 → 폐기 확인", await page.getByText("변경한 내용을 버릴까요?").isVisible());
await back();
await page.waitForTimeout(500);
check("확인 다이얼로그에서 뒤로가기 → 다이얼로그만 닫힘", !(await page.getByText("변경한 내용을 버릴까요?").isVisible()) && (await page.locator(".settings").isVisible()));
await back();
await page.waitForTimeout(500);
await page.getByText("계속 편집하기").click();
await page.waitForTimeout(500);
check("폐기 취소 → 편집 유지", (await page.locator(".cycle-item").count()) === 5);
await back();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "버리기" }).click();
await page.waitForTimeout(500);
check("폐기 확인 → 설정 목록, 저장값 그대로", (await page.locator(".settings-menu").isVisible()) && JSON.parse(await stored()).pattern.cycle.length === 6);
await back();
await page.waitForTimeout(300);

// ---------- 7. 최대 길이 ----------
await goPattern();
await page.waitForSelector(".settings");
for (let i = 6; i < 56; i += 1) await page.locator(".shift-button", { hasText: "휴무" }).click();
check("56개 도달 시 추가 비활성", await page.locator(".shift-button").first().isDisabled());
check("최대 길이 사유 표시", await page.getByText("최대 56개").first().isVisible());

// ---------- 8. 손상·상위 버전 데이터 ----------
for (const [label, value] of [
  ["손상 JSON", "{not json"],
  ["상위 version", JSON.stringify({ version: 4, pattern: { startDate: "2026-10-13", cycle: ["DAY"] }, weekStart: "SUN" })],
]) {
  await fresh(value);
  check(`${label}: 오류 안내`, await page.getByText("저장된 근무 설정을 불러오지 못했어요").isVisible());
  check(`${label}: 저장값 보존`, (await stored()) === value);
  await page.getByText("다시 설정하기").click();
  await page.waitForSelector(".settings");
  check(`${label}: 다시 설정 진입 후에도 저장값 보존`, (await stored()) === value);
}
await page.locator(".shift-button", { hasText: "휴무" }).click();
await page.locator(".today-cell").first().click();
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForSelector(".calendar");
check("다시 설정 후 저장 시 덮어쓰기", JSON.parse(await stored()).version === 3);


// ---------- 9. 날짜 직접 지정·저장 실패·안내 ----------
await fresh(JSON.stringify({ version: 1, pattern: { startDate: "2026-10-01", cycle: ["DAY","NIGHT","AFTER_NIGHT","OFF"] }, weekStart: "SUN" }));
await goPattern();
await page.waitForSelector(".settings");
check("데이터 유지 범위 안내 표시", await page.getByText("앱을 삭제하면 저장된 설정도 함께 삭제되고").isVisible());
await page.getByText("패턴 첫째 날을 날짜로 지정하기").click();
await page.waitForTimeout(700);
check("날짜 직접 지정 시트 표시", await page.getByText("패턴 첫째 날을 골라 주세요").isVisible());
await page.getByRole("button", { name: "적용" }).click();
await page.waitForTimeout(700);
check("오늘을 첫째 날로 지정 → 오늘 위치 1번째 칸", (await page.locator(".today-cell").nth(0).getAttribute("aria-checked")) === "true");

await page.evaluate((k) => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === k) throw new Error("quota");
    return original.call(this, key, value);
  };
}, KEY);
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(700);
check("저장 실패 → 설정 화면 유지·오류 안내", (await page.locator(".settings").isVisible()) && (await page.getByText("저장하지 못했어요").isVisible()));
check("저장 실패 → 편집 내용 유지", (await page.locator(".today-cell").nth(0).getAttribute("aria-checked")) === "true");
check("저장 실패 → 저장값 그대로", JSON.parse(await stored()).pattern.startDate === "2026-10-01");

await fresh(JSON.stringify({ version: 1, pattern: { startDate: "2026-10-01", cycle: ["DAY","OFF"] }, weekStart: "SUN" }));
await page.evaluate((k) => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === k) throw new Error("quota");
    return original.call(this, key, value);
  };
}, KEY);
await goDisplay();
await page.getByText("월요일 시작").click();
await page.waitForTimeout(500);
check("주 시작 요일 저장 실패 → 되돌림·안내", JSON.stringify(await page.locator("input[type=radio]:checked").evaluateAll((els) => els.map((e) => e.value))) === '["SUN"]' && (await page.getByText("화면 설정을 저장하지 못했어요").isVisible()));

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
