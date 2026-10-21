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

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-10 휴무, 10-13 오후(오늘 위치 인덱스 2)
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (extra = {}) => ({ version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null, ...extra });

/** 시계를 2026-10-13로 고정한 새 컨텍스트에서 저장값을 넣고 달력을 연다. stored가 null이면 저장값 없이 연다. */
async function open(stored, { width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  if (stored !== null) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, typeof stored === "string" ? stored : JSON.stringify(stored)]);
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(400);
  return { context, page };
}
const raw = (page) => page.evaluate((k) => localStorage.getItem(k), SKEY);
const stored = async (page) => JSON.parse(await raw(page));
const openPattern = async (page) => {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  await page.waitForTimeout(250);
};
const save = async (page) => {
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  await page.waitForTimeout(250);
};
const cellLabel = (page, date) => page.locator(`.calendar-cell[data-date="${date}"]`).getAttribute("aria-label");
const pickScope = (page, title) => page.locator(".scope-option", { hasText: title }).click();

// ---------- 1. 이력 필드가 없는 기존 v3 ----------
{
  const original = JSON.stringify(base());
  const { context, page } = await open(original);
  check("기존 v3(이력 없음) 복원: 달력 표시·저장값 불변", (await page.locator(".calendar").isVisible()) && (await raw(page)) === original);
  check("오늘 10/13 오후, 10/10 휴무", (await cellLabel(page, "2026-10-13")).includes("오후") && (await cellLabel(page, "2026-10-10")).includes("휴무"));
  await openPattern(page);
  check("이력 없음: 적용 범위 선택 숨김", (await page.locator(".scope-options").count()) === 0);
  check("이력 없음: 현재 패턴 한 행 + 안내 문구", (await page.locator(".history-item").count()) === 1 && (await page.getByText("바꾼 기록이 아직 없어요").isVisible()));
  check("현재 행: '처음부터 (현재)'", (await page.locator(".history-range").first().innerText()) === "처음부터 (현재)");
  // 변경하면 선택이 나타나고 기본은 오늘부터, 되돌리면 사라진다
  await page.locator(".today-cell").nth(0).click();
  check("변경 시 적용 범위 2개·기본 '오늘부터 적용'", (await page.locator(".scope-option").count()) === 2 && (await page.locator(".scope-option.is-selected .scope-title").innerText()) === "오늘부터 적용");
  check("적용 범위는 오버레이가 아님(dialog 없음)", (await page.locator("[role=dialog], [role=alertdialog]").count()) === 0);
  await page.locator(".today-cell").nth(2).click();
  check("원래대로 되돌리면 적용 범위 선택 숨김", (await page.locator(".scope-options").count()) === 0);
  await context.close();
}

// ---------- 2. 오늘부터 적용(기본) ----------
let afterFromToday;
{
  const { context, page } = await open(base());
  await openPattern(page);
  await page.locator(".today-cell").nth(0).click(); // 오늘을 첫째 칸(주간)으로 → 기준일 10-13
  await save(page);
  const s = await stored(page);
  afterFromToday = JSON.stringify(s);
  check("저장 형식 version 3 유지·이력 1개", s.version === 3 && s.patternHistory?.length === 1);
  check("이력: until=오늘, 이전 패턴 A 보존", s.patternHistory[0].until === "2026-10-13" && s.patternHistory[0].pattern.startDate === "2026-10-11" && s.patternHistory[0].pattern.cycle.join() === A.cycle.join(), JSON.stringify(s.patternHistory));
  check("현재 패턴 기준일=오늘(10-13)", s.pattern.startDate === "2026-10-13");
  check("지난 날짜 10/10은 이전 패턴(휴무) 유지", (await cellLabel(page, "2026-10-10")).includes("휴무"));
  // 이전 패턴 A(기준일 10-11)로는 10-12가 둘째 칸(주간), 새 패턴이었다면 휴무가 된다.
  check("10/12도 이전 패턴(주간) 유지", (await cellLabel(page, "2026-10-12")).includes("주간"), await cellLabel(page, "2026-10-12"));
  check("오늘 10/13부터 새 패턴(주간)", (await cellLabel(page, "2026-10-13")).includes("주간"));
  const t0 = (await page.locator(".today-card").nth(0).innerText()).replace(/\s+/g, " ");
  check("요약 오늘 카드도 새 패턴(주간)", t0.includes("주간"), t0);
  await page.locator('.calendar-cell[data-date="2026-10-10"]').click();
  await page.waitForSelector(".day-screen");
  check("날짜 화면 10/10도 이전 패턴(휴무)", (await page.locator(".day-shift").innerText()).includes("휴무"));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.waitForSelector(".today-card");
  await openPattern(page);
  const ranges = await page.locator(".history-range").allInnerTexts();
  check("이력 목록: 현재·이전 순서와 기간 문구", ranges.length === 2 && ranges[0] === "2026년 10월 13일부터 (현재)" && ranges[1] === "처음부터 2026년 10월 12일까지", JSON.stringify(ranges));
  check("이력 목록: 근무 칩 색과 약어(이전 패턴 7칸)", (await page.locator(".history-item").nth(1).locator(".history-chip").count()) === 7 && (await page.locator(".history-item").nth(1).locator(".history-chip.shift-EVENING").innerText()) === "오");
  // 현재 패턴 행은 누를 수 없다(불러오기는 2-2에서 따로 검사)
  await page.locator(".history-item.is-current").click();
  await page.waitForTimeout(250);
  check("현재 행 누르기: 화면·창 변화 없음·버튼 아님", (await page.locator(".settings").isVisible()) && (await page.locator("[role=dialog], [role=alertdialog]").count()) === 0 && (await page.locator(".history-item.is-current button, .history-item.is-current a").count()) === 0 && (await page.locator(".scope-options").count()) === 0);
  // 변경 없이 저장 → 이력·저장값 불변
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  check("변경 없이 저장: 이력 불변·저장값 동일", (await raw(page)) === afterFromToday);
  await context.close();
}

// ---------- 2-2. 이력 패턴 불러오기(저장 안 함·오늘 위치 비움·편집 중 확인) ----------
{
  // 현재 패턴 C(10-13부터 주·야·휴), 이전 패턴 A(10-12까지)
  const C = { startDate: "2026-10-13", cycle: ["DAY", "NIGHT", "OFF"] };
  const original = JSON.stringify(base({ pattern: C, patternHistory: [{ until: "2026-10-13", pattern: A }] }));
  const { context, page } = await open(original);
  await openPattern(page);
  const cycleClasses = () => page.locator(".cycle-item").evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith("shift-")).slice(6)).join());
  const loadButton = page.locator(".history-item.is-loadable .history-load");
  const dialogs = () => page.locator("[role=dialog], [role=alertdialog]").count();
  check("이전 행만 불러오기 버튼(1개)·현재 행은 버튼 없음", (await loadButton.count()) === 1 && (await page.locator(".history-item.is-current button").count()) === 0);
  check("불러오기 버튼 이름: 기간·근무 순서·편집기에 불러오기", ((await loadButton.getAttribute("aria-label")) ?? "").startsWith("처음부터 2026년 10월 12일까지, 근무 순서 주간") && (await loadButton.getAttribute("aria-label")).endsWith("편집기에 불러오기"));
  check("편집기 처음 상태 = 현재 패턴 C", (await cycleClasses()) === C.cycle.join());

  // 편집 내용이 없으면 바로 불러온다
  await loadButton.click();
  await page.waitForTimeout(300);
  check("불러오기: 확인 창 없이 편집기가 패턴 A(7칸)", (await dialogs()) === 0 && (await cycleClasses()) === A.cycle.join(), await cycleClasses());
  check("불러오기: 오늘 위치 미선택", (await page.locator('.today-cell[aria-checked="true"]').count()) === 0);
  check("불러오기: [저장] 비활성 + 오늘 칸 안내", (await page.getByRole("button", { name: "저장", exact: true }).isDisabled()) && (await page.getByText("오늘에 해당하는 칸을 선택해 주세요.").isVisible()));
  check("불러오기: 안내 문구(role=status)", await page.getByRole("status").filter({ hasText: "불러온 근무 순서예요" }).isVisible());
  check("불러오기: 저장값 그대로", (await raw(page)) === original);

  // 불러온 뒤 뒤로가기 → 변경 폐기 확인
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.getByText("변경한 내용을 버릴까요?").waitFor({ state: "visible", timeout: 3000 });
  check("불러온 뒤 뒤로가기: 변경 폐기 확인 창", true);
  await page.getByRole("button", { name: "계속 편집하기" }).click();
  await page.waitForTimeout(300);
  check("계속 편집하기: 불러온 내용 유지", (await page.locator(".settings").isVisible()) && (await cycleClasses()) === A.cycle.join());

  // 편집 중에 누르면 확인 창: 뒤로가기·취소는 편집 유지, 불러오기는 교체
  await page.locator(".shift-button", { hasText: "휴무" }).click();
  check("편집하면 불러오기 안내가 사라짐", (await page.getByText("불러온 근무 순서예요").count()) === 0 && (await page.locator(".cycle-item").count()) === 8);
  await loadButton.click();
  await page.getByText("편집 중인 내용을 바꿀까요?").waitFor({ state: "visible", timeout: 3000 });
  check("편집 중 불러오기: 확인 창", true);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.waitForTimeout(400);
  check("확인 창 뒤로가기: 창만 닫힘·편집 유지·화면 유지", (await page.getByText("편집 중인 내용을 바꿀까요?").isVisible().catch(() => false)) === false && (await page.getByText("변경한 내용을 버릴까요?").count()) === 0 && (await page.locator(".settings").isVisible()) && (await page.locator(".cycle-item").count()) === 8);
  await loadButton.click();
  await page.getByText("편집 중인 내용을 바꿀까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.waitForTimeout(300);
  check("확인 창 취소: 편집 유지", (await page.locator(".cycle-item").count()) === 8);
  await loadButton.click();
  await page.getByText("편집 중인 내용을 바꿀까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "불러오기", exact: true }).click();
  await page.waitForTimeout(300);
  check("확인 창 불러오기: 패턴 A로 교체·오늘 위치 미선택", (await cycleClasses()) === A.cycle.join() && (await page.locator('.today-cell[aria-checked="true"]').count()) === 0);
  check("확인 후에도 저장값 그대로", (await raw(page)) === original);

  // 오늘 위치를 고르고 오늘부터 적용으로 저장 → 기존 이력 규칙대로
  await page.locator(".today-cell").nth(0).click();
  check("오늘 위치 선택: 안내 사라짐·적용 범위 기본 '오늘부터 적용'", (await page.getByText("불러온 근무 순서예요").count()) === 0 && (await page.locator(".scope-option.is-selected .scope-title").innerText()) === "오늘부터 적용");
  await save(page);
  const s = await stored(page);
  // 같은 날(10-13) 시작한 C를 덮어쓰므로 이력은 A 하나 그대로다.
  check("불러와 저장: 현재 패턴 = A의 근무 순서·기준일 10-13", s.pattern.startDate === "2026-10-13" && s.pattern.cycle.join() === A.cycle.join(), JSON.stringify(s.pattern));
  check("불러와 저장: 이력 규칙대로(같은 날 덮어쓰기, A 하나)", s.patternHistory.length === 1 && s.patternHistory[0].until === "2026-10-13" && s.patternHistory[0].pattern.startDate === "2026-10-11", JSON.stringify(s.patternHistory));
  check("불러와 저장: 10/13 주간·10/14 주간·10/15 오후, 10/10은 이전 패턴(휴무)", (await cellLabel(page, "2026-10-13")).includes("주간") && (await cellLabel(page, "2026-10-14")).includes("주간") && (await cellLabel(page, "2026-10-15")).includes("오후") && (await cellLabel(page, "2026-10-10")).includes("휴무"));
  await context.close();
}

// ---------- 3. 같은 날 다시 저장 ----------
{
  const { context, page } = await open(afterFromToday);
  await openPattern(page);
  await page.locator(".today-cell").nth(4).click(); // 같은 날 또 변경
  await save(page);
  const s = await stored(page);
  check("같은 날 재저장: 이력 1개 유지(빈 기간 없음)", s.patternHistory.length === 1 && s.patternHistory[0].until === "2026-10-13", JSON.stringify(s.patternHistory));
  check("같은 날 재저장: 이전 패턴은 여전히 A", s.patternHistory[0].pattern.startDate === "2026-10-11");
  check("같은 날 재저장: 현재 패턴 갱신(기준일 10-09)", s.pattern.startDate === "2026-10-09", s.pattern.startDate);
  check("같은 날 재저장 후에도 10/10은 이전 패턴(휴무)", (await cellLabel(page, "2026-10-10")).includes("휴무"));
  await context.close();
}

// ---------- 4. 전체 기간에 적용 ----------
{
  const { context, page } = await open(afterFromToday);
  await openPattern(page);
  await page.locator(".today-cell").nth(1).click();
  await pickScope(page, "전체 기간에 적용");
  check("전체 기간 선택 표시", (await page.locator(".scope-option.is-selected .scope-title").innerText()) === "전체 기간에 적용");
  await save(page);
  const s = await stored(page);
  check("전체 기간 적용: 이력 필드 없음", !("patternHistory" in s) && s.version === 3, JSON.stringify(s));
  const expected = (await stored(page)).pattern.startDate; // 오늘 위치 1 → 기준일 10-12
  check("전체 기간 적용: 기준일 10-12", expected === "2026-10-12", expected);
  // 이전 패턴이었다면 10/10은 휴무였다. 전체 기간 적용 후에는 새 패턴(기준일 10-12)의 idx 5 = 비번이다.
  check("전체 기간 적용: 10/10이 새 패턴(비번)으로 다시 계산", (await cellLabel(page, "2026-10-10")).includes("비번"), await cellLabel(page, "2026-10-10"));
  await openPattern(page);
  check("전체 기간 적용 후 이력 목록은 안내 문구", (await page.locator(".history-item").count()) === 1 && (await page.getByText("바꾼 기록이 아직 없어요").isVisible()));
  await context.close();
}

// ---------- 5. 패턴 초기화 → 패턴만 삭제·이력 유지, 재등록은 적용 범위 없음 ----------
{
  const before = JSON.parse(afterFromToday);
  const { context, page } = await open(afterFromToday);
  await openPattern(page);
  check("패턴 초기화 설명: 이력은 남는다고 안내", (await page.getByText("패턴 이력·근무 유형·화면 설정·캘린더 알림·이름·날짜 세부 내용은 남아요").count()) > 0);
  await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
  await page.getByText("근무 패턴을 초기화할까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(500);
  const s = await stored(page);
  check("패턴 초기화: 패턴 null·이력 유지·테마 유지", s.pattern === null && JSON.stringify(s.patternHistory) === JSON.stringify(before.patternHistory) && s.theme === "INDIGO", JSON.stringify(s));
  check("패턴 초기화 후 빈 달력 + 등록 안내 카드", (await page.locator(".no-pattern-card").isVisible()) && (await page.locator(".intro").count()) === 0);
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  for (const name of ["주간", "야간", "휴무"]) await page.locator(".shift-button", { hasText: name }).click();
  await page.locator(".today-cell").nth(0).click();
  const resetRanges = await page.locator(".history-range").allInnerTexts();
  check("재등록: 적용 범위 선택 없음·이력 목록은 현재 행 없이 이전 패턴만", (await page.locator(".scope-options").count()) === 0 && (await page.locator(".history-item.is-current").count()) === 0 && resetRanges.length === 1 && resetRanges[0] === "처음부터 2026년 10월 12일까지", JSON.stringify(resetRanges));
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  const after = await stored(page);
  check("재등록 후: 이력 그대로, 새 패턴이 현재 패턴", after.pattern.cycle.join() === "DAY,NIGHT,OFF" && JSON.stringify(after.patternHistory) === JSON.stringify(before.patternHistory), JSON.stringify(after));
  check("재등록 후 10/10은 이전 패턴(휴무) 유지", (await cellLabel(page, "2026-10-10")).includes("휴무"));
  await openPattern(page);
  const ranges = await page.locator(".history-range").allInnerTexts();
  check("재등록 후 이력 목록: 새 패턴 + 이전 기록", ranges.length === 2 && ranges[0] === "2026년 10월 13일부터 (현재)" && ranges[1] === "처음부터 2026년 10월 12일까지", JSON.stringify(ranges));
  await context.close();
}

// ---------- 5-3. 패턴 초기화 뒤 이력 패턴을 불러와 재등록 ----------
{
  const before = JSON.parse(afterFromToday);
  const { context, page } = await open(JSON.stringify({ ...before, pattern: null }));
  check("초기화 상태(패턴 없음·이력 있음): 빈 달력", await page.locator(".no-pattern-card").isVisible());
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  check("초기화 뒤 설정: 편집기 비어 있음·불러오기 버튼 1개", (await page.locator(".cycle-item").count()) === 0 && (await page.locator(".history-load").count()) === 1);
  await page.locator(".history-load").click();
  await page.waitForTimeout(300);
  check("초기화 뒤 불러오기: 확인 창 없이 패턴 A 7칸", (await page.locator("[role=dialog], [role=alertdialog]").count()) === 0 && (await page.locator(".cycle-item").count()) === 7);
  await page.locator(".today-cell").nth(2).click();
  check("초기화 뒤 재등록: 적용 범위 선택 없음", (await page.locator(".scope-options").count()) === 0);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  const after = await stored(page);
  check("초기화 뒤 불러와 재등록: 이력 그대로·현재 패턴 = A 근무 순서", JSON.stringify(after.patternHistory) === JSON.stringify(before.patternHistory) && after.pattern.cycle.join() === A.cycle.join() && after.pattern.startDate === "2026-10-11", JSON.stringify(after));
  check("초기화 뒤 불러와 재등록: 10/13 오후·10/10 휴무", (await cellLabel(page, "2026-10-13")).includes("오후") && (await cellLabel(page, "2026-10-10")).includes("휴무"));
  await context.close();
}

// ---------- 5-2. 전체 초기화 → 경고 후 이력까지 삭제 ----------
{
  const { context, page } = await open(afterFromToday);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
  await page.getByText("초기화", { exact: true }).click();
  await page.getByRole("button", { name: "전체 초기화" }).click();
  await page.getByText("모든 데이터를 지울까요?").waitFor({ state: "visible", timeout: 3000 });
  const dialog = await page.locator("[role=dialog], [role=alertdialog]").first().innerText();
  check("전체 초기화 경고문: 패턴 이력 삭제·되돌릴 수 없음 명시", dialog.includes("패턴 이력") && dialog.includes("되돌릴 수 없어요"), dialog.replace(/s+/g, " "));
  check("경고 전에는 저장값이 그대로", (await raw(page)) === afterFromToday);
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(600);
  check("전체 초기화 후 설정 저장값 삭제", (await raw(page)) === null);
  check("전체 초기화 후 빈 달력 + 등록 안내", await page.locator(".no-pattern-card").isVisible());
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  for (const name of ["주간", "휴무"]) await page.locator(".shift-button", { hasText: name }).click();
  await page.locator(".today-cell").nth(0).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".today-card");
  const after = await stored(page);
  check("전체 초기화 후 재등록: 이력 없음", !("patternHistory" in after), JSON.stringify(after));
  await openPattern(page);
  check("전체 초기화 후 이력 목록은 안내 문구", (await page.getByText("바꾼 기록이 아직 없어요").isVisible()) && (await page.locator(".history-item").count()) === 1);
  await context.close();
}

// ---------- 6. 손상된 이력 → 오류 안내·저장값 보존 ----------
{
  const bad = JSON.stringify(base({ patternHistory: [
    { until: "2026-10-13", pattern: A },
    { until: "2026-10-01", pattern: A },
  ] }));
  const { context, page } = await open(bad);
  check("이력 순서 오류 → 오류 안내", await page.getByText("저장된 근무 설정을 불러오지 못했어요").isVisible());
  check("이력 순서 오류 → 저장값 보존", (await raw(page)) === bad);
  await context.close();
}

// ---------- 7. 이전 앱 관점: 이력 필드를 빼도 현재 패턴으로 정상 ----------
{
  const withHistory = JSON.parse(afterFromToday);
  const { patternHistory, ...legacy } = withHistory;
  const { context, page } = await open(JSON.stringify(legacy));
  check("이력 필드를 뺀 같은 데이터도 정상 복원(이전 앱과 같은 형태)", (await page.locator(".calendar").isVisible()) && patternHistory.length === 1);
  check("이력이 없으면 10/10도 현재 패턴으로 계산", (await cellLabel(page, "2026-10-10")).includes("야간"), await cellLabel(page, "2026-10-10"));
  await context.close();
}

// ---------- 8. 360px: 56칸 패턴 + 이력 3개 ----------
{
  const long = { startDate: "2026-10-13", cycle: Array.from({ length: 56 }, (_, i) => ["DAY", "EVENING", "NIGHT", "DUTY", "AFTER_NIGHT", "OFF"][i % 6]) };
  const history = [
    { until: "2026-08-01", pattern: long },
    { until: "2026-09-01", pattern: A },
    { until: "2026-10-01", pattern: long },
  ];
  const { context, page } = await open(JSON.stringify(base({ pattern: long, patternHistory: history })), { width: 360, height: 640 });
  await openPattern(page);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    items: document.querySelectorAll(".history-item").length,
    chipsRight: Math.max(...[...document.querySelectorAll(".history-chip")].map((c) => c.getBoundingClientRect().right)),
    minFont: Math.min(...[...document.querySelectorAll(".history-list *")].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
  }));
  check("360px: 이력 4행(현재+3) 표시", m.items === 4, `items=${m.items}`);
  check("360px: 가로 스크롤 없음·칩이 화면 안(56칸 줄바꿈)", m.sw <= m.cw && m.chipsRight <= 360, JSON.stringify(m));
  check("이력 목록 글자 11px 이상", m.minFont >= 11, `min=${m.minFont}`);
  const loads = await page.locator(".history-load").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right }; }));
  check("360px: 불러오기 행 3개·높이 44px 이상·화면 안", loads.length === 3 && loads.every((b) => b.h >= 44 && b.right <= 360), JSON.stringify(loads));
  await context.close();
}

// ---------- 9. 저장 실패 → 편집·적용 범위 선택 유지, 저장값 그대로 ----------
{
  const original = JSON.stringify(base());
  const { context, page } = await open(original);
  await openPattern(page);
  await page.locator(".today-cell").nth(0).click();
  await pickScope(page, "전체 기간에 적용");
  await page.evaluate(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).includes("turncal.settings")) throw new Error("disk");
      return originalSet.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(400);
  check("저장 실패: 설정 화면 유지·오류 안내", (await page.locator(".settings").isVisible()) && (await page.getByText("저장하지 못했어요").isVisible()));
  check("저장 실패: 편집 내용(오늘 위치 0)·적용 범위 선택 유지", (await page.locator(".today-cell").nth(0).getAttribute("aria-checked")) === "true" && (await page.locator(".scope-option.is-selected .scope-title").innerText()) === "전체 기간에 적용");
  check("저장 실패: 저장값 그대로", (await raw(page)) === original);
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
