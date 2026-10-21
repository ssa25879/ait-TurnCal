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

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (extra = {}) => ({ version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: "민수", scheduleName: "병동", ...extra });

/** 시계를 2026-10-13로 고정한 새 컨텍스트에서 저장값을 넣고 연다. */
async function open(settings, { width = 390, height = 844 } = {}) {
  const logs = [];
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, JSON.stringify(settings)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".calendar", { timeout: 10000 });
  await page.waitForTimeout(400);
  // 클릭 직후 변경 여부(dirty) 상태가 반영되기 전에 이벤트가 읽히지 않게 잠깐 기다린다.
  const back = async () => { await page.waitForTimeout(250); await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent"))); await page.waitForTimeout(400); };
  const closeCalls = () => logs.filter((l) => l.includes("closeView called")).length;
  return { context, page, back, closeCalls };
}
const stored = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SKEY));
const onCalendar = (page) => page.locator(".calendar").isVisible();
const shortcut = (page, name) => page.locator(".shortcut-row").getByRole("button", { name });
const scheduleInput = (page) => page.getByLabel("근무표 이름");
const userInput = (page) => page.getByLabel("내 호칭");

// ---------- 1. 버튼 표시와 기존 설정 경로 ----------
{
  const { context, page, back } = await open(base());
  const labels = await page.locator(".shortcut-row button").allInnerTexts();
  check("바로가기 2개: 근무 패턴 수정·이름 수정", labels.length === 2 && labels[0].includes("근무 패턴 수정") && labels[1].includes("이름 수정"), JSON.stringify(labels));
  check("오늘·내일 카드·설정 진입(내비 바 기능 버튼) 유지", (await page.locator(".today-card").count()) === 2 && (await page.locator("button[data-ait-accessory-button-id=settings]").isVisible()));

  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  const items = await page.locator(".settings-menu [role=button]").allInnerTexts();
  check("설정 버튼: 설정 목록 6항목 그대로", items.length === 6, JSON.stringify(items));
  // 설정 목록 경로의 계층은 그대로: 이름 → 뒤로 → 설정 목록 → 뒤로 → 달력
  await page.getByText("이름", { exact: true }).click();
  await page.waitForTimeout(300);
  await back();
  check("설정 목록 → 이름 → 뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
  await back();
  check("설정 목록 → 뒤로가기 → 달력", await onCalendar(page));
  // 설정 목록 경로로 이름 저장하면 설정 목록으로 돌아간다
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("이름", { exact: true }).click();
  await page.waitForTimeout(300);
  await scheduleInput(page).fill("설정경로이름");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  check("설정 목록 경로의 이름 저장 → 설정 목록으로", (await stored(page)).scheduleName === "설정경로이름");
  await context.close();
}

// ---------- 2. 근무 패턴 수정 바로가기 ----------
{
  const { context, page, back, closeCalls } = await open(base());
  await shortcut(page, "근무 패턴 수정").click();
  await page.waitForSelector(".settings");
  check("패턴 수정: 설정 목록 없이 근무 패턴 화면, 저장된 패턴 불러옴", (await page.locator(".settings-menu").count()) === 0 && (await page.locator(".shift-button").count()) > 0 && (await page.getByRole("button", { name: "근무 패턴 초기화" }).count()) === 1);
  await back();
  check("변경 없이 뒤로가기 → 달력(종료 아님)", (await onCalendar(page)) && closeCalls() === 0);

  await shortcut(page, "근무 패턴 수정").click();
  await page.waitForSelector(".settings");
  await page.locator(".shift-button", { hasText: "휴무" }).click();
  await back();
  check("변경 후 뒤로가기 → 폐기 확인", await page.getByText("변경한 내용을 버릴까요?").isVisible());
  await page.getByRole("button", { name: "계속 편집하기" }).click();
  await page.waitForTimeout(300);
  check("폐기 취소 → 편집 화면 유지", (await page.locator(".settings").isVisible()) && (await page.getByText("변경한 내용을 버릴까요?").count()) === 0);
  await back();
  await page.getByRole("button", { name: "버리기" }).click();
  await page.waitForTimeout(400);
  check("폐기 확인 → 달력, 저장된 패턴 그대로", (await onCalendar(page)) && JSON.stringify((await stored(page)).pattern) === JSON.stringify(A));

  const before = closeCalls();
  await back();
  check("바로가기 뒤 달력에서 뒤로가기 → 앱 종료", closeCalls() === before + 1);

  // 패턴 저장은 달력으로
  await shortcut(page, "근무 패턴 수정").click();
  await page.waitForSelector(".settings");
  await page.locator(".shift-button", { hasText: "휴무" }).click();
  await page.locator(".today-cell").nth(0).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  check("패턴 저장 → 달력으로, 바뀐 패턴 저장", (await onCalendar(page)) && (await stored(page)).pattern.cycle.length === 8);
  await context.close();
}

// ---------- 3. 이름 수정 바로가기 ----------
{
  const { context, page, back, closeCalls } = await open(base());
  await shortcut(page, "이름 수정").click();
  await page.waitForTimeout(400);
  check("이름 수정: 설정 목록 없이 이름 화면, 저장된 값이 채워짐", (await page.locator(".settings-menu").count()) === 0 && (await userInput(page).inputValue()) === "민수" && (await scheduleInput(page).inputValue()) === "병동");
  await back();
  check("변경 없이 뒤로가기 → 달력(종료 아님)", (await onCalendar(page)) && closeCalls() === 0);

  await shortcut(page, "이름 수정").click();
  await page.waitForTimeout(300);
  await scheduleInput(page).fill("임시이름");
  await back();
  check("변경 후 뒤로가기 → 폐기 확인", await page.getByText("변경한 내용을 버릴까요?").isVisible());
  await page.getByRole("button", { name: "계속 편집하기" }).click();
  await page.waitForTimeout(300);
  check("폐기 취소 → 입력 내용 유지", (await scheduleInput(page).inputValue()) === "임시이름");
  await back();
  await page.getByRole("button", { name: "버리기" }).click();
  await page.waitForTimeout(400);
  check("폐기 확인 → 달력, 이름 그대로", (await onCalendar(page)) && (await stored(page)).scheduleName === "병동" && (await page.locator(".schedule-title").innerText()) === "병동");

  await shortcut(page, "이름 수정").click();
  await page.waitForTimeout(300);
  await scheduleInput(page).fill("병동 3교대");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".calendar");
  check("이름 저장 → 달력으로, 상단에 즉시 반영", (await page.locator(".schedule-title").innerText()) === "병동 3교대" && (await stored(page)).scheduleName === "병동 3교대" && (await page.locator(".settings-menu").count()) === 0);

  await shortcut(page, "이름 수정").click();
  await page.waitForTimeout(300);
  await scheduleInput(page).fill("가".repeat(21));
  const saveDisabled = await page.getByRole("button", { name: "저장", exact: true }).isDisabled();
  await page.getByRole("button", { name: "저장", exact: true }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  check("길이 초과: 저장 안 됨·이름 화면에 머묾", (await page.locator(".calendar").count()) === 0 && (await stored(page)).scheduleName === "병동 3교대", String(saveDisabled));
  await context.close();
}

// ---------- 4. 패턴 없는 달력 ----------
{
  const { context, page, back } = await open(base({ pattern: null, patternHistory: [{ until: "2026-10-13", pattern: A }] }));
  const labels = await page.locator(".shortcut-row button").allInnerTexts();
  check("패턴 없음: 이름 수정만 보임·근무 패턴 수정 숨김", labels.length === 1 && labels[0].includes("이름 수정") && (await page.getByRole("button", { name: "근무 패턴 등록하기" }).isVisible()), JSON.stringify(labels));
  await shortcut(page, "이름 수정").click();
  await page.waitForTimeout(300);
  await back();
  check("패턴 없는 달력의 이름 수정 → 뒤로가기 → 달력", await onCalendar(page));
  await context.close();
}

// ---------- 5. 360px: 긴 이름·겹침·가로 스크롤 ----------
for (const [width, height] of [[360, 740], [390, 844]]) {
  const { context, page } = await open(base({ scheduleName: "가".repeat(20), userName: "열자까지이름입니다" }), { width, height });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(`${width}px 가로 스크롤 없음`, !overflow);
  const row = await page.locator(".shortcut-row").boundingBox();
  const btns = await page.locator(".shortcut-row button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, h: r.height }; }));
  const cal = await page.locator(".calendar").boundingBox();
  check(`${width}px 버튼이 화면 안·겹치지 않음·높이 36px 이상`, btns.length === 2 && btns[0].x >= 0 && btns[1].right <= width && btns[0].right <= btns[1].x && btns.every((b) => b.h >= 36), JSON.stringify(btns));
  check(`${width}px 달력 아래 바로가기 줄(겹침 없음)`, cal.y + cal.height <= row.y + 1, JSON.stringify({ cal, row }));
  const small = await page.evaluate(() => [...document.querySelectorAll(".shortcut-row, .shortcut-row *")].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).length);
  check(`${width}px 버튼 글자 11px 이상`, small === 0);
  check(`${width}px 하단에는 바로가기 2개와 [이번 달 내보내기]만, 대체 [설정] 버튼은 없음(내비 바 버튼 등록됨)`, (await page.locator(".bottom-action button").count()) === 3 && (await page.locator(".bottom-action").getByRole("button", { name: "설정", exact: true }).count()) === 0);
  if (width === 360) await page.screenshot({ path: process.env.SHOT ?? "calendar-shortcuts-360.png" });
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
