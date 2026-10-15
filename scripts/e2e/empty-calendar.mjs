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

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-10 휴무, 10-12 오후
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const none = (extra = {}) => ({ version: 3, pattern: null, weekStart: "SUN", theme: "INDIGO", userName: "민수", scheduleName: "병동", ...extra });
const withHistory = () => none({ patternHistory: [{ until: "2026-10-13", pattern: A }] });

/** 시계를 2026-10-13로 고정한 새 컨텍스트에서 저장값을 넣고 연다. */
async function open(settings, { width = 390, height = 844, entries = null } = {}) {
  const logs = [];
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v, ek, ev]) => {
    if (v !== null) localStorage.setItem(k, v);
    if (ev !== null) localStorage.setItem(ek, ev);
  }, [SKEY, settings === null ? null : JSON.stringify(settings), EKEY, entries === null ? null : JSON.stringify(entries)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(400);
  // 클릭 직후 변경 여부(dirty) 상태가 반영되기 전에 이벤트가 읽히지 않게 잠깐 기다린다.
  const back = async () => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await page.waitForTimeout(400); };
  const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
  return { context, page, back, closeCalls };
}
const cellLabel = (page, date) => page.locator(`.calendar-cell[data-date="${date}"]`).getAttribute("aria-label");
const cellShift = (page, date) => page.locator(`.calendar-cell[data-date="${date}"] .calendar-shift`).innerText();
const stored = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SKEY));

// ---------- 1. 이력 없음·패턴 없음 ----------
{
  const { context, page, back, closeCalls } = await open(none());
  check("달력 표시(등록 안내 화면이 아님)", (await page.locator(".calendar").isVisible()) && (await page.locator(".intro").count()) === 0);
  check("안내 카드: 근무 패턴이 없어요 + 등록하기", (await page.locator(".no-pattern-card").innerText()).includes("근무 패턴이 없어요") && (await page.getByRole("button", { name: "근무 패턴 등록하기" }).isVisible()));
  const shifts = (await page.locator(".calendar-shift").allInnerTexts()).join("").trim();
  check("모든 칸에 근무 배지 없음", shifts === "");
  check("오늘 칸 접근성 이름: 근무 패턴 없음", (await cellLabel(page, "2026-10-13")).includes("근무 패턴 없음"));
  const cards = await page.locator(".today-card").allInnerTexts();
  check("오늘·내일 카드 모두 '근무 패턴 없음'·근무 색 배지 없음", cards.length === 2 && cards.every((t) => t.includes("근무 패턴 없음")) && (await page.locator(".today-card-badge").count()) === 0, JSON.stringify(cards));
  check("이름 표시 유지", (await page.getByText("병동").count()) > 0 && (await page.getByText("민수님").count()) > 0);

  // 날짜 화면
  await page.locator('.calendar-cell[data-date="2026-10-14"]').click();
  await page.waitForSelector(".day-screen");
  check("날짜 화면: 근무 패턴이 없어요, 세부 내용 추가 가능", (await page.locator(".day-shift").innerText()).includes("근무 패턴이 없어요") && (await page.getByRole("button", { name: "세부 내용 추가" }).isVisible()));
  await back();
  check("날짜 화면 뒤로가기 → 달력", await page.locator(".calendar").isVisible());

  // 설정 접근과 뒤로가기 계층
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  const items = await page.locator(".settings-menu [role=button]").allInnerTexts();
  check("설정 목록 4항목 접근·근무 패턴은 등록되지 않음", items.length === 4 && items[1].includes("등록되지 않음"), JSON.stringify(items));
  await page.getByText("이름", { exact: true }).click();
  await page.waitForTimeout(300);
  await back();
  check("이름 → 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
  await page.getByText("화면 설정", { exact: true }).click();
  await page.waitForSelector(".display-settings");
  await back();
  check("화면 설정 → 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  check("설정 → 근무 패턴: 첫 등록 화면(초기화 버튼·이력 목록 없음)", (await page.getByRole("button", { name: "근무 패턴 초기화" }).count()) === 0 && (await page.locator(".history-list").count()) === 0);
  await back();
  check("근무 패턴 → 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
  await back();
  check("설정 목록 → 뒤로가기 → 달력", await page.locator(".calendar").isVisible());
  const before = closeCalls();
  await back();
  check("패턴 없는 달력에서 뒤로가기 → 앱 종료", closeCalls() === before + 1);

  // 등록하기 → 뒤로가기는 달력
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  await back();
  check("등록하기로 연 설정에서 변경 없이 뒤로가기 → 달력(종료 아님)", (await page.locator(".calendar").isVisible()) && closeCalls() === before + 1);

  // 등록하기 → 변경 → 뒤로가기는 폐기 확인 → 버리면 달력
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  await page.locator(".shift-button", { hasText: "주간" }).click();
  await back();
  check("변경 후 뒤로가기 → 폐기 확인", await page.getByText("변경한 내용을 버릴까요?").isVisible());
  await page.getByRole("button", { name: "버리기" }).click();
  await page.waitForTimeout(400);
  check("버리면 달력으로(설정 목록 아님), 패턴은 여전히 없음", (await page.locator(".calendar").isVisible()) && (await stored(page)).pattern === null);

  // 등록 → 달력에 새 패턴
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  for (const name of ["주간", "야간", "휴무"]) await page.locator(".shift-button", { hasText: name }).click();
  await page.locator(".today-cell").nth(0).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  await page.waitForTimeout(300);
  check("등록 후 달력에 새 패턴 근무 표시·안내 카드 사라짐", (await cellShift(page, "2026-10-13")).trim() !== "" && (await page.locator(".no-pattern-card").count()) === 0);
  check("등록 후 이름·테마 유지", (await stored(page)).scheduleName === "병동" && (await stored(page)).theme === "INDIGO");
  await context.close();
}

// ---------- 2. 이력이 남아 있는 달력 ----------
{
  const { context, page } = await open(withHistory());
  check("10/12(이력 마지막 날)는 이력 패턴 근무", (await cellShift(page, "2026-10-12")).trim() !== "" && (await cellLabel(page, "2026-10-12")).includes("주간"));
  check("10/10은 이력 패턴(휴무)", (await cellLabel(page, "2026-10-10")).includes("휴무"));
  check("10/13(이력 종료일)부터 근무 배지 없음", (await cellShift(page, "2026-10-13")).trim() === "" && (await cellShift(page, "2026-10-20")).trim() === "");
  const cards = await page.locator(".today-card").allInnerTexts();
  check("오늘(10/13)·내일 카드: 근무 패턴 없음", cards.every((t) => t.includes("근무 패턴 없음")), JSON.stringify(cards));
  // 재등록: 이력 유지, 마지막 이력 이후만 새 패턴
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  for (const name of ["야간", "휴무"]) await page.locator(".shift-button", { hasText: name }).click();
  await page.locator(".today-cell").nth(0).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  await page.waitForTimeout(300);
  const s = await stored(page);
  check("재등록: 이력 그대로·새 패턴이 현재", JSON.stringify(s.patternHistory) === JSON.stringify([{ until: "2026-10-13", pattern: A }]) && s.pattern !== null);
  check("재등록 후 10/12는 여전히 이전 패턴(주간), 10/13부터 새 패턴", (await cellLabel(page, "2026-10-12")).includes("주간") && (await cellShift(page, "2026-10-13")).trim() !== "");
  await context.close();
}

// ---------- 3. 바뀐 근무는 유지, 오늘/내일 일부만 ----------
{
  const entries = { version: 1, days: { "2026-10-14": { items: [{ id: "e1", name: "연차", shift: "OFF", createdAt: 1 }] } } };
  const { context, page } = await open(none(), { entries });
  check("분류 '휴무' 세부 내용 날: 칸에 휴무 배지·바뀐 근무", (await cellShift(page, "2026-10-14")).includes("휴") && (await cellLabel(page, "2026-10-14")).includes("근무 변경됨"));
  const cards = await page.locator(".today-card").allInnerTexts();
  check("오늘 카드 근무 패턴 없음, 내일 카드 휴무·바뀐 근무", cards[0].includes("근무 패턴 없음") && cards[1].includes("휴무") && cards[1].includes("바뀐 근무"), JSON.stringify(cards));
  await page.locator('.calendar-cell[data-date="2026-10-14"]').click();
  await page.waitForSelector(".day-screen");
  const shiftLine = await page.locator(".day-shift").innerText();
  check("날짜 화면: 휴무 근무예요(패턴 비교 줄 없음)", shiftLine.includes("휴무") && !shiftLine.includes("→"), shiftLine);
  await context.close();
}

// ---------- 4. 패턴 초기화 → 빈 달력 (이력 있음) ----------
{
  const withPattern = none({ pattern: A, patternHistory: [{ until: "2026-10-05", pattern: { startDate: "2026-10-01", cycle: ["DAY", "OFF"] } }] });
  const { context, page, back, closeCalls } = await open(withPattern);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
  await page.getByText("근무 패턴을 초기화할까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForSelector(".no-pattern-card");
  const s = await stored(page);
  check("초기화 직후 빈 달력 + 안내 카드, 이력·이름·테마 유지", s.pattern === null && s.patternHistory.length === 1 && s.scheduleName === "병동" && s.theme === "INDIGO");
  check("초기화 후 10/04는 이력 패턴, 10/05부터 근무 없음", (await cellShift(page, "2026-10-04")).trim() !== "" && (await cellShift(page, "2026-10-05")).trim() === "");
  const before = closeCalls();
  await back();
  check("초기화 후 달력에서 뒤로가기 → 종료", closeCalls() === before + 1);
  await context.close();
}

// ---------- 5. 첫 실행·전체 초기화 뒤: 항상 빈 달력(등록 안내 화면 없음) ----------
{
  const { context, page, back, closeCalls } = await open(null);
  check("저장값 없음(첫 실행): 빈 달력 + 등록 안내 카드", (await page.locator(".calendar").isVisible()) && (await page.locator(".no-pattern-card").isVisible()) && (await page.locator(".intro").count()) === 0);
  check("첫 실행 빈 달력을 보여도 저장소는 비어 있음", (await page.evaluate((k) => localStorage.getItem(k), SKEY)) === null);
  const before = closeCalls();
  await back();
  check("첫 실행 빈 달력에서 뒤로가기 → 종료", closeCalls() === before + 1);
  await context.close();
}
{
  const { context, page, back, closeCalls } = await open(none({ pattern: A }));
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("초기화", { exact: true }).click();
  await page.getByRole("button", { name: "전체 초기화" }).click();
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForSelector(".no-pattern-card");
  check("전체 초기화 후 바로 빈 달력(등록 안내 화면 없음)", (await page.locator(".calendar").isVisible()) && (await page.locator(".intro").count()) === 0);
  check("전체 초기화 후 저장값 없음·근무 배지 없음·이름 수정만", (await page.evaluate((k) => localStorage.getItem(k), SKEY)) === null && (await page.locator(".shortcut-row button").count()) === 1 && (await page.locator(".calendar-shift").allInnerTexts()).join("").trim() === "");
  const beforeClose = closeCalls();
  await back();
  check("전체 초기화 뒤 달력에서 뒤로가기 → 종료", closeCalls() === beforeClose + 1);
  // 재실행해도 같은 빈 달력, 뒤로가기는 종료
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".no-pattern-card");
  const beforeReopen = closeCalls();
  await back();
  check("전체 초기화 뒤 앱을 다시 열어도 빈 달력, 뒤로가기 → 종료", closeCalls() === beforeReopen + 1 && (await page.evaluate((k) => localStorage.getItem(k), SKEY)) === null);
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  await back();
  check("등록 화면에서 뒤로가기 → 빈 달력(종료 아님)", (await page.locator(".no-pattern-card").isVisible()) && closeCalls() === beforeReopen + 1);
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  await page.locator(".shift-button", { hasText: "주간" }).click();
  await page.locator(".shift-button", { hasText: "휴무" }).click();
  await page.locator(".today-cell").nth(0).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  check("빈 달력에서 등록 → 저장되고 달력에 근무 표시", (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).pattern.cycle.length, SKEY)) === 2 && (await page.locator(".calendar-shift").allInnerTexts()).join("").trim() !== "");
  await context.close();
}

// ---------- 6. 360px: 겹침·가로 스크롤 없음 ----------
{
  const { context, page } = await open(withHistory(), { width: 360, height: 740 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check("360px 가로 스크롤 없음", !overflow);
  const card = await page.locator(".no-pattern-card").boundingBox();
  const btn = await page.getByRole("button", { name: "근무 패턴 등록하기" }).boundingBox();
  check("360px 안내 카드·버튼이 화면 안", card.x >= 0 && card.x + card.width <= 360 && btn.x >= 0 && btn.x + btn.width <= 360 && btn.height >= 32, JSON.stringify({ card, btn }));
  const small = await page.evaluate(() => [...document.querySelectorAll(".no-pattern-card, .no-pattern-card *")].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).length);
  check("안내 카드 글자 11px 이상", small === 0);
  await page.screenshot({ path: process.env.SHOT ?? "empty-calendar-360.png" });
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
