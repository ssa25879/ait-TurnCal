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
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { history.back = () => {}; });
const page = await context.newPage();
const logs = [];
const errors = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const wait = (ms = 400) => page.waitForTimeout(ms);
const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
// 클릭 직후 변경 여부(dirty) 상태가 반영되기 전에 이벤트가 읽히지 않게 잠깐 기다린다.
const back = async () => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await wait(); };
const get = (k) => page.evaluate((key) => localStorage.getItem(key), k);
const settingsJson = async () => JSON.parse(await get(SKEY));
const entriesJson = async () => JSON.parse(await get(EKEY));
const visible = (text, timeout = 2500) => page.getByText(text).first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
const cell = (date) => page.locator(`.calendar-cell[data-date="${date}"]`);

const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const addDays = (date, n) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const D = addDays(today, 1); // 같은 달이 아닐 수 있으니 data-date로 찾는다

const v3 = (extra = {}) => JSON.stringify({ version: 3, pattern: { startDate: today, cycle: ["DAY", "DAY", "NIGHT", "NIGHT", "OFF", "OFF"] }, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null, ...extra });

async function fresh(settings, entries = null) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("main.app", { timeout: 15000 });
  await page.evaluate(([sk, sv, ek, ev]) => {
    sv === null ? localStorage.removeItem(sk) : localStorage.setItem(sk, sv);
    ev === null ? localStorage.removeItem(ek) : localStorage.setItem(ek, ev);
  }, [SKEY, settings, EKEY, entries]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await wait(300);
}
const openMenu = async () => { await page.getByRole("button", { name: "설정", exact: true }).click(); await page.waitForSelector(".settings-menu"); };
const openDay = async (date) => {
  if ((await cell(date).count()) === 0) await page.getByLabel("다음 달").click();
  await cell(date).click();
  await page.waitForSelector(".day-screen");
};
async function addEntry({ name, start = "", end = "", memo = "", shift = null }) {
  await page.getByRole("button", { name: "세부 내용 추가" }).click();
  await page.waitForSelector(".entry-editor");
  await page.getByLabel("이름").fill(name);
  if (start) await page.locator(".time-input").nth(0).locator("input").fill(start);
  if (end) await page.locator(".time-input").nth(1).locator("input").fill(end);
  if (memo) await page.getByLabel("내용").fill(memo);
  if (shift) await page.locator(".category-option", { hasText: shift }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".day-screen");
  await wait(200);
}

// ---------- 이름 ----------
await fresh(v3());
check("이름 없음: '내 근무표'", (await page.locator(".schedule-title").textContent()) === "내 근무표" && (await page.locator(".schedule-owner").count()) === 0);
await openMenu();
const menuItems = await page.locator(".settings-menu [role=button]").evaluateAll((els) => els.map((e) => e.textContent));
check("설정 목록 6항목 순서", ["이름", "근무 패턴", "근무 유형", "화면 설정", "캘린더 알림", "초기화"].every((t, i) => menuItems[i]?.startsWith(t)), JSON.stringify(menuItems));
await page.getByText("이름", { exact: true }).click();
await page.waitForSelector(".names-screen");
await page.getByLabel("근무표 이름").fill("가".repeat(21));
check("근무표 이름 21자 → 저장 불가", await page.getByRole("button", { name: "저장", exact: true }).isDisabled());
await page.getByLabel("근무표 이름").fill("  병동 3교대 ");
await page.getByLabel("내 호칭").fill("지수");
await back();
check("이름 dirty 뒤로가기 → 폐기 확인", await visible("변경한 내용을 버릴까요?"));
await page.getByText("계속 편집하기").click();
await wait();
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForSelector(".settings-menu");
const s1 = await settingsJson();
check("이름 저장: 공백 제거, v3", s1.version === 3 && s1.scheduleName === "병동 3교대" && s1.userName === "지수", JSON.stringify(s1));
await back();
check("달력 상단 이름·호칭 표시", (await page.locator(".schedule-title").textContent()) === "병동 3교대" && (await page.locator(".schedule-owner").textContent()) === "지수님");

// ---------- 날짜 화면·세부 내용 ----------
const shiftOfD = await cell(D).count() ? await cell(D).locator(".calendar-shift").textContent() : null;
await openDay(D);
check("날짜 칸 누르기 → 날짜 화면", await page.locator(".day-screen").isVisible());
check("빈 상태 안내", await visible("아직 적은 내용이 없어요."));
await page.getByRole("button", { name: "세부 내용 추가" }).click();
await page.waitForSelector(".entry-editor");
await page.getByRole("button", { name: "저장", exact: true }).click();
check("이름 없음 → 저장 불가 안내", await visible("이름을 입력해 주세요."));
await page.locator(".time-input").nth(1).locator("input").fill("10:00");
await page.getByLabel("이름").fill("병원");
await page.getByRole("button", { name: "저장", exact: true }).click();
check("종료만 입력 → 안내", await visible("시작 시간을 입력해 주세요."));
await page.locator(".time-input").nth(1).locator(".time-clear").click();
await back();
check("편집 dirty 뒤로가기 → 폐기 확인", await visible("변경한 내용을 버릴까요?"));
await page.getByRole("button", { name: "버리기" }).click();
await wait();
check("폐기 → 날짜 화면", await page.locator(".day-screen").isVisible());

await addEntry({ name: "회식", start: "19:00", end: "22:00" });
await addEntry({ name: "병원", start: "10:00" });
await addEntry({ name: "택배" });
const order = await page.locator(".entry-name").allTextContents();
check("정렬: 시간순 → 시간 없음", JSON.stringify(order) === JSON.stringify(["병원", "회식", "택배"]), JSON.stringify(order));
check("시간 표기", (await page.locator(".entry-time").allTextContents()).join("|") === "10:00|19:00~22:00|종일");
await back();
check("날짜 화면 뒤로가기 → 달력(보던 달 유지)", (await cell(D).count()) === 1);
check("칸 표시 '병+2'", (await cell(D).locator(".calendar-marker").textContent()) === "병+2");

// 분류로 근무 변경
await openDay(D);
await addEntry({ name: "당직대체", shift: "당직" });
check("분류 → 그날 근무 변경 표시", await visible("근무 변경:"));
await addEntry({ name: "연차", shift: "휴무" });
check("분류 여러 개 → 먼저 작성한 당직", (await page.locator(".day-shift .chip").textContent()) === "당");
check("적용 항목 선택 UI", (await page.locator(".source-options [role=radio]").count()) === 2);
await page.locator(".source-options [role=radio]", { hasText: "연차" }).click();
await wait();
check("적용 항목 선택 → 휴무", (await page.locator(".day-shift .chip").textContent()) === "휴");
const e1 = await entriesJson();
check("저장: turncal.entries v1, shiftSourceId", e1.version === 1 && e1.days[D].items.length === 5 && typeof e1.days[D].shiftSourceId === "string");
await back();
check("달력: 바뀐 근무 '휴' + 변경 점", (await cell(D).locator(".calendar-shift").textContent()) === "휴" && (await cell(D).locator(".calendar-changed").count()) === 1);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".calendar");
if ((await cell(D).count()) === 0) await page.getByLabel("다음 달").click();
check("재실행 후 유지", (await cell(D).locator(".calendar-shift").textContent()) === "휴" && (await cell(D).locator(".calendar-marker").textContent()) === "병+4");

// 수정·삭제
await openDay(D);
await page.locator(".entry-row", { hasText: "병원" }).click();
await page.waitForSelector(".entry-editor");
await page.getByLabel("이름").fill("치과");
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForSelector(".day-screen");
check("수정 반영", (await page.locator(".entry-name").allTextContents()).includes("치과"));
for (const name of ["연차", "당직대체"]) {
  await page.locator(".entry-row", { hasText: name }).click();
  await page.waitForSelector(".entry-editor");
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await visible("이 세부 내용을 삭제할까요?");
  await page.getByRole("button", { name: "삭제하기" }).click();
  await page.waitForSelector(".day-screen");
  await wait(200);
}
check("분류 항목 모두 삭제 → 패턴 근무 복귀", !(await page.getByText("근무 변경:").isVisible()));
await back();
check("달력: 변경 점 사라짐", (await cell(D).locator(".calendar-changed").count()) === 0 && (shiftOfD === null || (await cell(D).locator(".calendar-shift").textContent()) === shiftOfD));

// ---------- 초기화 (근무 패턴·화면 설정은 각 화면 아래, 전체는 초기화 화면) ----------
await openMenu();
await page.getByText("화면 설정", { exact: true }).click();
await page.getByText("딥 틸").click();
await page.getByText("월요일 시작").click();
await wait();
await back();
await page.getByText("초기화", { exact: true }).click();
await page.waitForSelector(".reset-screen");
check("초기화 화면: 전체 초기화만", (await page.locator(".reset-screen .reset-option").count()) === 1 && (await page.getByRole("button", { name: "화면 설정 초기화" }).count()) === 0 && (await page.getByRole("button", { name: "근무 패턴 초기화" }).count()) === 0);
await page.getByRole("button", { name: "전체 초기화" }).click();
await visible("모든 데이터를 지울까요?");
await page.getByRole("button", { name: "취소" }).click();
await wait();
check("초기화 취소 → 무변경", (await settingsJson()).theme === "TEAL");
await back();
check("초기화 화면 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
await page.getByText("화면 설정", { exact: true }).click();
await page.getByRole("button", { name: "화면 설정 초기화" }).click();
await visible("화면 설정을 초기화할까요?");
await back();
check("화면 설정 초기화 확인 창 뒤로가기 → 창만 닫힘", (await page.locator(".display-settings").isVisible()) && (await settingsJson()).theme === "TEAL");
await page.getByRole("button", { name: "화면 설정 초기화" }).click();
await visible("화면 설정을 초기화할까요?");
await page.getByRole("button", { name: "초기화하기" }).click();
await wait();
const s2 = await settingsJson();
check("화면 설정 초기화: 인디고·일요일, 나머지 유지, 화면 설정에 머묾", s2.theme === "INDIGO" && s2.weekStart === "SUN" && s2.scheduleName === "병동 3교대" && s2.pattern !== null && (await page.locator(".display-settings").isVisible()));
await back();
await page.getByText("근무 패턴", { exact: true }).click();
await page.waitForSelector(".settings");
await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
await visible("근무 패턴을 초기화할까요?");
await page.getByRole("button", { name: "취소" }).click();
await wait();
check("근무 패턴 초기화 취소 → 무변경", (await settingsJson()).pattern !== null && (await page.locator(".settings").isVisible()));
await page.locator(".shift-button", { hasText: "당직" }).click();
await wait(200);
await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
await visible("근무 패턴을 초기화할까요?");
await page.getByRole("button", { name: "초기화하기" }).click();
await page.waitForSelector(".no-pattern-card");
const s3 = await settingsJson();
check("편집 중 근무 패턴 초기화: 패턴 null, 이름·세부 내용 유지", s3.pattern === null && s3.scheduleName === "병동 3교대" && (await entriesJson()).days[D].items.length === 3);
let before = closeCalls();
await back();
check("패턴 초기화 후 빈 달력 뒤로가기 → 종료", closeCalls() === before + 1);
await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
await page.waitForSelector(".settings");
check("최초 등록 화면: 근무 패턴 초기화 없음", (await page.getByRole("button", { name: "근무 패턴 초기화" }).count()) === 0);
await page.locator(".shift-button", { hasText: "주간" }).click();
await page.locator(".shift-button", { hasText: "휴무" }).click();
await page.locator(".today-cell").first().click();
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForSelector(".calendar");
check("새 패턴 저장 후 이름·세부 내용 유지", (await page.locator(".schedule-title").textContent()) === "병동 3교대");
await openMenu();
await page.getByText("초기화", { exact: true }).click();
await page.getByRole("button", { name: "전체 초기화" }).click();
await visible("모든 데이터를 지울까요?");
await page.getByRole("button", { name: "초기화하기" }).click();
await page.waitForSelector(".no-pattern-card");
check("전체 초기화: 저장 데이터 없음, 인디고", (await get(SKEY)) === null && (await get(EKEY)) === null && (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim().toUpperCase())) === "#4F46E5");

// ---------- 주말·공휴일 표시 ----------
const monthIndex = (date) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
async function showMonth(date, settings = v3()) {
  await fresh(settings);
  const diff = monthIndex(date) - monthIndex(today);
  for (let i = 0; i < Math.abs(diff); i++) await page.getByLabel(diff > 0 ? "다음 달" : "이전 달").click();
  await wait(200);
}
const dayClass = async (date) => (await cell(date).locator(".calendar-day").getAttribute("class")) ?? "";
const dayColor = (date) => cell(date).locator(".calendar-day").evaluate((el) => getComputedStyle(el).color);
const holidayText = async (date) => ((await cell(date).locator(".calendar-holiday").textContent()) ?? "").trim();
await showMonth("2026-10-01");
check("일요일 숫자 빨강", (await dayClass("2026-10-11")).includes("is-sunday") && (await dayColor("2026-10-11")) === "rgb(240, 68, 82)");
check("토요일 숫자 테마색(인디고)", (await dayClass("2026-10-17")).includes("is-saturday") && (await dayColor("2026-10-17")) === "rgb(79, 70, 229)");
check("평일 숫자 기본색", !/is-(sunday|saturday|holiday)/.test(await dayClass("2026-10-14")));
check("한글날 칸: 빨강 + 축약 이름", (await dayClass("2026-10-09")).includes("is-holiday") && (await holidayText("2026-10-09")) === "한글날");
check("개천절(토) 칸: 공휴일 색 우선", (await dayClass("2026-10-03")).includes("is-holiday") && (await holidayText("2026-10-03")) === "개천절");
check("대체공휴일 10-05 칸: 대체", (await holidayText("2026-10-05")) === "대체");
check("공휴일 접근성 이름", ((await cell("2026-10-09").getAttribute("aria-label")) ?? "").includes("한글날"));
const heights = await page.locator(".calendar-row:not(.calendar-head)").evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
check("행 높이 일정", new Set(heights).size === 1, heights.join(","));
await cell("2026-10-05").click();
await page.waitForSelector(".day-screen");
check("날짜 화면: 개천절 대체공휴일", ((await page.locator(".day-holiday").textContent()) ?? "") === "개천절 대체공휴일");
await back();
await cell("2026-10-14").click();
await page.waitForSelector(".day-screen");
check("평일 날짜 화면: 공휴일 줄 없음", (await page.locator(".day-holiday").count()) === 0);
await showMonth("2026-09-01");
check("추석 3일 칸", (await holidayText("2026-09-24")) === "추석" && (await holidayText("2026-09-25")) === "추석" && (await holidayText("2026-09-26")) === "추석");
await cell("2026-09-25").click();
await page.waitForSelector(".day-screen");
check("날짜 화면: 추석", ((await page.locator(".day-holiday").textContent()) ?? "") === "추석");
await showMonth("2026-10-01", v3({ theme: "TEAL", weekStart: "MON" }));
check("딥 틸·월요일 시작: 토요일 숫자 딥 틸, 실제 요일 기준", (await dayClass("2026-10-17")).includes("is-saturday") && (await dayColor("2026-10-17")) === "rgb(15, 118, 110)" && (await dayClass("2026-10-11")).includes("is-sunday"));
await showMonth("2036-01-01");
check("범위 밖(2036-01): 공휴일 표시 없음", (await page.locator(".calendar-day.is-holiday").count()) === 0 && (await page.locator(".calendar-day.is-sunday").count()) > 0);

// ---------- 세부 내용 손상 ----------
await fresh(v3(), "{bad");
check("세부 내용 손상: 달력 정상 + 안내", (await page.locator(".calendar").isVisible()) && (await visible("날짜 세부 내용을 불러오지 못했어요")));
await cell(today).click();
await page.waitForSelector(".day-screen");
check("손상 시 편집 차단", (await page.getByRole("button", { name: "세부 내용 추가" }).count()) === 0 && (await get(EKEY)) === "{bad");
await page.getByRole("button", { name: "세부 내용 비우고 새로 시작하기" }).click();
await wait();
check("새로 시작 → 빈 v1 저장, 편집 가능", JSON.stringify(await entriesJson()) === JSON.stringify({ version: 1, days: {} }) && (await page.getByRole("button", { name: "세부 내용 추가" }).isVisible()));

// ---------- 이전 버전 ----------
const v2 = JSON.stringify({ version: 2, pattern: { startDate: today, cycle: ["DAY", "OFF"] }, weekStart: "MON", theme: "TEAL" });
await fresh(v2, null);
check("v2 실행: 딥 틸·월요일, 무기록", (await page.locator(".calendar-weekday").first().textContent()) === "월" && (await get(SKEY)) === v2);

// ---------- 저장 실패 ----------
await fresh(v3({ scheduleName: "병동", theme: "TEAL" }), null);
await page.evaluate(async () => {
  const originalSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith("__ait_storage:turncal")) throw new Error("quota");
    return originalSet.call(this, key, value);
  };
  // Devtools 3.9는 localStorage 삭제 오류를 삼킨다. 앱이 받는 SDK 거부를 직접 주입한다.
  const source = await (await fetch("/src/storage/entriesStorage.ts")).text();
  const sdkUrl = source.match(/from\s+["']([^"']+)["']/)?.[1];
  if (!sdkUrl) throw new Error("저장소 SDK import를 찾지 못했어요.");
  const sdk = await import(sdkUrl);
  sdk.Storage.removeItem = async () => { throw new Error("io"); };
});
await cell(today).click();
await page.waitForSelector(".day-screen");
await page.getByRole("button", { name: "세부 내용 추가" }).click();
await page.getByLabel("이름").fill("실패테스트");
await page.getByRole("button", { name: "저장", exact: true }).click();
check("세부 내용 저장 실패 → 편집 유지·안내", (await visible("저장하지 못했어요")) && (await page.getByLabel("이름").inputValue()) === "실패테스트");
// 저장 실패로 입력이 남아 있는(변경 있는) 상태에서 뒤로가기 → 폐기 확인
await back(); await page.getByRole("button", { name: "버리기" }).click(); await wait();
await back();
await openMenu();
await page.getByText("화면 설정", { exact: true }).click();
await page.getByRole("button", { name: "화면 설정 초기화" }).click();
await visible("화면 설정을 초기화할까요?");
await page.getByRole("button", { name: "초기화하기" }).click();
check("화면 설정 초기화 실패 → 화면 설정 유지·이전 값·안내", (await visible("초기화하지 못했어요")) && (await page.locator(".display-settings").isVisible()) && (await page.locator(".theme-option.is-selected").textContent()).includes("딥 틸") && (await settingsJson()).theme === "TEAL");
await back();
await page.getByText("초기화", { exact: true }).click();
await page.getByRole("button", { name: "전체 초기화" }).click();
await visible("모든 데이터를 지울까요?");
await page.getByRole("button", { name: "초기화하기" }).click();
check("전체 초기화 실패 → 초기화 화면 유지·안내", (await visible("초기화하지 못했어요")) && (await page.locator(".reset-screen").isVisible()) && (await get(SKEY)) !== null);

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
