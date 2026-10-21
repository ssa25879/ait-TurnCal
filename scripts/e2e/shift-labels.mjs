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

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-13 오후, 10-14 야간
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const HISTORY = [{ until: "2026-10-01", pattern: { startDate: "2026-09-01", cycle: ["EVENING", "OFF"] } }];
const base = (extra = {}) => ({ version: 3, pattern: A, patternHistory: HISTORY, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null, ...extra });
// 10-20(야간)에 분류 없는 세부 내용, 10-21(야간 → 오후로 바꾼 근무)
const ENTRIES = { version: 1, days: { "2026-10-21": { items: [{ id: "e1", name: "교육", shift: "EVENING", createdAt: 1 }] } } };
const PINK = { bg: "rgb(255, 224, 236)", fg: "rgb(157, 23, 77)" };

async function open(stored, { width = 390, height = 844, entries = ENTRIES } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date("2026-10-13T10:00:00+09:00"));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v, ek, ev]) => {
    if (v !== null) localStorage.setItem(k, v);
    if (ev !== null) localStorage.setItem(ek, ev);
  }, [SKEY, stored === null ? null : typeof stored === "string" ? stored : JSON.stringify(stored), EKEY, entries ? JSON.stringify(entries) : null]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(400);
  return { context, page };
}
const raw = (page, key = SKEY) => page.evaluate((k) => localStorage.getItem(k), key);
const stored = async (page) => JSON.parse(await raw(page));
const back = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.waitForTimeout(350);
};
const openMenu = async (page) => {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
};
const openLabels = async (page) => {
  await openMenu(page);
  await page.getByText("근무 유형", { exact: true }).click();
  await page.waitForSelector(".shift-labels-screen");
  await page.waitForTimeout(250);
};
const card = (page, type) => page.locator(`.shift-label-card[data-shift="${type}"]`);
const nameInput = (page, type) => card(page, type).locator("input").nth(0);
const shortInput = (page, type) => card(page, type).locator("input").nth(1);
const fill = async (locator, value) => { await locator.fill(value); await locator.page().waitForTimeout(80); };
const saveButton = (page) => page.getByRole("button", { name: "저장", exact: true });
const cellLabel = (page, date) => page.locator(`.calendar-cell[data-date="${date}"]`).getAttribute("aria-label");
const cellShort = (page, date) => page.locator(`.calendar-cell[data-date="${date}"] .calendar-shift`).innerText();
const colorsOf = (locator) => locator.evaluate((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color }; });

// ---------- 1. 메뉴·처음 상태 ----------
{
  const original = JSON.stringify(base());
  const { context, page } = await open(original);
  await openMenu(page);
  const items = await page.locator(".settings-menu [role=button]").allInnerTexts();
  const tops = items.map((t) => t.split("\n")[0].trim());
  check("설정 목록 6항목·순서(근무 유형은 근무 패턴과 화면 설정 사이)", JSON.stringify(tops) === JSON.stringify(["이름", "근무 패턴", "근무 유형", "화면 설정", "캘린더 알림", "초기화"]), JSON.stringify(tops));
  check("근무 유형 보조 문구 '기본값'", items[2].includes("기본값"), items[2]);
  await page.getByText("근무 유형", { exact: true }).click();
  await page.waitForSelector(".shift-labels-screen");
  const titles = (await page.locator(".shift-label-title").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("처음 상태: 6종 기본 이름·약어 순서", JSON.stringify(titles) === JSON.stringify(["주 주간", "오 오후", "야 야간", "당 당직", "비 비번", "휴 휴무"]), JSON.stringify(titles));
  check("처음 상태: 입력값 = 기본값", (await nameInput(page, "EVENING").inputValue()) === "오후" && (await shortInput(page, "EVENING").inputValue()) === "오");
  check("색 견본 10개씩·현재 색 선택(오후=주황)", (await card(page, "EVENING").locator(".shift-color-option").count()) === 10 && (await card(page, "EVENING").locator('.shift-color-option[aria-checked="true"]').getAttribute("aria-label")) === "주황");
  check("유형 추가·삭제 버튼 없음", (await page.getByRole("button", { name: /추가|삭제/ }).count()) === 0);
  check("맨 끝 [기본값으로 되돌리기]", await page.getByRole("button", { name: "기본값으로 되돌리기" }).isVisible());
  check("변경 없이 뒤로가기 → 설정 목록·저장값 그대로", await (async () => { await back(page); return (await page.locator(".settings-menu").isVisible()) && (await raw(page)) === original; })());
  await context.close();
}

// ---------- 2. 바꿔 저장 → 앱 전체 반영, 저장값 ----------
let customized;
{
  const original = base();
  const { context, page } = await open(original);
  const entriesBefore = await raw(page, EKEY);
  await openLabels(page);
  await fill(nameInput(page, "EVENING"), "저녁");
  await fill(shortInput(page, "EVENING"), "저");
  await card(page, "NIGHT").locator('.shift-color-option[aria-label="분홍"]').click();
  await fill(nameInput(page, "NIGHT"), "밤");
  await fill(shortInput(page, "NIGHT"), "밤");
  check("미리보기 칩이 저장 전 값(밤·분홍)", (await card(page, "NIGHT").locator(".shift-label-title .chip").innerText()) === "밤" && JSON.stringify(await colorsOf(card(page, "NIGHT").locator(".shift-label-title .chip"))) === JSON.stringify(PINK));
  check("저장 전에는 루트 색 변수 그대로", (await page.evaluate(() => document.documentElement.style.getPropertyValue("--shift-night-bg"))) === "#dce4ff");
  await saveButton(page).click();
  await page.waitForSelector(".settings-menu");
  const s = await stored(page);
  customized = JSON.stringify(s);
  check("저장 → 설정 목록·보조 문구 '2개 바꿈'", (await page.locator(".settings-menu [role=button]").nth(2).innerText()).includes("2개 바꿈"));
  check("저장값: version 3·shiftLabels 두 유형만", s.version === 3 && JSON.stringify(s.shiftLabels) === JSON.stringify({ EVENING: { name: "저녁", short: "저", color: "ORANGE" }, NIGHT: { name: "밤", short: "밤", color: "PINK" } }), JSON.stringify(s.shiftLabels));
  check("저장값: 패턴·이력·세부 내용 불변", JSON.stringify(s.pattern) === JSON.stringify(A) && JSON.stringify(s.patternHistory) === JSON.stringify(HISTORY) && (await raw(page, EKEY)) === entriesBefore);
  await back(page);
  await page.waitForSelector(".calendar");
  check("달력 칸 약어: 10/13 저, 10/14 밤", (await cellShort(page, "2026-10-13")) === "저" && (await cellShort(page, "2026-10-14")) === "밤");
  check("달력 칸 접근성 이름에 바꾼 이름", (await cellLabel(page, "2026-10-14")).includes("밤") && !(await cellLabel(page, "2026-10-14")).includes("야간"), await cellLabel(page, "2026-10-14"));
  check("달력 칸 색: 야간 칸이 분홍", JSON.stringify(await colorsOf(page.locator('.calendar-cell[data-date="2026-10-14"] .calendar-shift'))) === JSON.stringify(PINK));
  const today = page.locator(".today-card").nth(0);
  check("요약 카드: 오늘 '저녁'·배지 '저'·접근성 이름", (await today.locator(".today-card-name").innerText()) === "저녁" && (await today.locator(".today-card-badge").innerText()) === "저" && (await today.getAttribute("aria-label")).includes("저녁"));
  await page.locator('.calendar-cell[data-date="2026-10-21"]').click();
  await page.waitForSelector(".day-screen");
  const dayShift = (await page.locator(".day-shift").innerText()).replace(/\s+/g, " ");
  check("날짜 화면: 바뀐 근무 '밤 → 저녁'", dayShift.includes("밤") && dayShift.includes("저녁"), dayShift);
  check("날짜 화면: 세부 내용 분류 약어 '저'", (await page.locator(".entry-shift").first().innerText()) === "저");
  await page.getByRole("button", { name: "세부 내용 추가" }).click();
  await page.waitForSelector(".entry-editor");
  check("세부 내용 분류 선택지에 바꾼 이름", (await page.locator(".category-option.shift-EVENING").innerText()).includes("저녁") && (await page.locator(".category-option.shift-NIGHT").innerText()).includes("밤"));
  await back(page);
  await back(page);
  await page.waitForSelector(".calendar");
  await openMenu(page);
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  check("패턴 편집기 근무 버튼에 바꾼 이름", (await page.locator(".shift-button.shift-EVENING").innerText()).includes("저녁") && (await page.locator(".shift-button.shift-NIGHT").innerText()).includes("밤"));
  check("근무 순서·오늘 위치 칸에 바꾼 약어", (await page.locator(".cycle-item.shift-NIGHT").first().innerText()).includes("밤") && (await page.locator(".today-cell.shift-EVENING").first().innerText()).includes("저"));
  check("근무 순서 접근성 이름", ((await page.locator(".cycle-item.shift-NIGHT").first().getAttribute("aria-label")) ?? "").includes("밤"));
  check("패턴 이력 칩·접근성 이름", (await page.locator(".history-chip.shift-EVENING").first().innerText()) === "저" && ((await page.locator(".history-load").first().getAttribute("aria-label")) ?? "").includes("저녁"));
  await page.locator(".cycle-item.shift-NIGHT").first().click();
  await page.waitForTimeout(500);
  const sheet = (await page.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("팝업(바텀시트) 근무 선택지에 바꾼 이름", sheet.includes("밤") && sheet.includes("저녁"), sheet.slice(0, 80));
  check("근무 색 변수는 문서 루트에 적용(포털 포함)", (await page.evaluate(() => document.documentElement.style.getPropertyValue("--shift-night-bg"))) === "#ffe0ec");
  await back(page);
  await context.close();
}

// ---------- 3. 저장 전 반영 없음·오류·같은 색·폐기 확인 ----------
{
  const original = JSON.stringify(base());
  const { context, page } = await open(original);
  await openLabels(page);
  await fill(nameInput(page, "EVENING"), "저녁근무조");
  check("이름 5자 → [저장] 비활성·안내", (await saveButton(page).isDisabled()) && (await card(page, "EVENING").getByText("이름은 1~4자로 입력해 주세요.").isVisible()));
  await fill(nameInput(page, "EVENING"), "");
  check("이름 비움 → [저장] 비활성", await saveButton(page).isDisabled());
  await fill(nameInput(page, "EVENING"), "저녁");
  await fill(shortInput(page, "EVENING"), "저녁");
  check("약어 두 글자 → 안내", (await saveButton(page).isDisabled()) && (await card(page, "EVENING").getByText("약어는 한 글자로 입력해 주세요.").isVisible()));
  await fill(shortInput(page, "EVENING"), "저");
  await fill(shortInput(page, "DUTY"), "야");
  check("약어 중복 → 두 유형 모두 안내", (await saveButton(page).isDisabled()) && (await card(page, "DUTY").getByText("다른 근무와 약어가 겹쳐요.").isVisible()) && (await card(page, "NIGHT").getByText("다른 근무와 약어가 겹쳐요.").isVisible()));
  await fill(shortInput(page, "DUTY"), "당");
  await fill(nameInput(page, "AFTER_NIGHT"), "휴무");
  check("이름 중복 → 안내", (await saveButton(page).isDisabled()) && (await card(page, "OFF").getByText("다른 근무와 이름이 겹쳐요.").isVisible()));
  await fill(nameInput(page, "AFTER_NIGHT"), "비번");
  await card(page, "AFTER_NIGHT").locator('.shift-color-option[aria-label="회색"]').click();
  check("같은 색은 허용 → [저장] 가능", !(await saveButton(page).isDisabled()));
  check("저장 전: 저장값 그대로", (await raw(page)) === original);
  await back(page);
  await page.getByText("변경한 내용을 버릴까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "계속 편집하기" }).click();
  await page.waitForTimeout(300);
  check("폐기 취소 → 편집 유지", (await page.locator(".shift-labels-screen").isVisible()) && (await nameInput(page, "EVENING").inputValue()) === "저녁");
  await back(page);
  await page.getByText("변경한 내용을 버릴까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "버리기" }).click();
  await page.waitForTimeout(300);
  check("버리기 → 설정 목록·저장값 그대로", (await page.locator(".settings-menu").isVisible()) && (await raw(page)) === original);
  await back(page);
  await page.waitForSelector(".calendar");
  check("저장 안 한 변경은 달력에 반영 안 됨", (await cellShort(page, "2026-10-13")) === "오");
  await context.close();
}

// ---------- 4. 기본값으로 되돌리기 ----------
{
  const { context, page } = await open(customized);
  await openLabels(page);
  await page.getByRole("button", { name: "기본값으로 되돌리기" }).click();
  await page.getByText("근무 유형을 기본값으로 되돌릴까요?").waitFor({ state: "visible", timeout: 3000 });
  await back(page);
  check("되돌리기 확인 창 뒤로가기 → 창만 닫힘·그대로", (await page.locator(".shift-labels-screen").isVisible()) && (await raw(page)) === customized && (await page.getByText("근무 유형을 기본값으로 되돌릴까요?").count()) === 0);
  await page.getByRole("button", { name: "기본값으로 되돌리기" }).click();
  await page.getByText("근무 유형을 기본값으로 되돌릴까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.waitForTimeout(300);
  check("되돌리기 취소 → 그대로", (await raw(page)) === customized && (await nameInput(page, "EVENING").inputValue()) === "저녁");
  await page.getByRole("button", { name: "기본값으로 되돌리기" }).click();
  await page.getByText("근무 유형을 기본값으로 되돌릴까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "되돌리기", exact: true }).click();
  await page.waitForTimeout(500);
  const s = await stored(page);
  const before = JSON.parse(customized);
  check("되돌리기 → 화면 유지·입력 기본값", (await page.locator(".shift-labels-screen").isVisible()) && (await nameInput(page, "EVENING").inputValue()) === "오후" && (await shortInput(page, "NIGHT").inputValue()) === "야");
  check("되돌리기 → shiftLabels 필드 없음·다른 값 그대로", !("shiftLabels" in s) && JSON.stringify(s.pattern) === JSON.stringify(before.pattern) && JSON.stringify(s.patternHistory) === JSON.stringify(before.patternHistory) && s.theme === before.theme);
  await back(page);
  check("되돌린 뒤 뒤로가기 → 폐기 확인 없이 설정 목록·'기본값'", (await page.locator(".settings-menu").isVisible()) && (await page.locator(".settings-menu [role=button]").nth(2).innerText()).includes("기본값"));
  await back(page);
  await page.waitForSelector(".calendar");
  check("되돌린 뒤 달력 10/13 '오'", (await cellShort(page, "2026-10-13")) === "오");
  await context.close();
}

// ---------- 5. 저장 실패 ----------
{
  const original = JSON.stringify(base());
  const { context, page } = await open(original);
  await openLabels(page);
  await fill(nameInput(page, "EVENING"), "저녁");
  await page.evaluate(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).includes("turncal.settings")) throw new Error("disk");
      return originalSet.call(this, key, value);
    };
  });
  await saveButton(page).click();
  await page.waitForTimeout(400);
  check("저장 실패 → 화면 유지·편집 유지·안내·저장값 그대로", (await page.locator(".shift-labels-screen").isVisible()) && (await nameInput(page, "EVENING").inputValue()) === "저녁" && (await page.getByText("저장하지 못했어요").isVisible()) && (await raw(page)) === original);
  await context.close();
}

// ---------- 6. 초기화와의 관계 ----------
{
  const { context, page } = await open(customized);
  await openMenu(page);
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  check("패턴 초기화 설명에 근무 유형은 남는다고 안내", (await page.getByText("패턴 이력·근무 유형·화면 설정·캘린더 알림·이름·날짜 세부 내용은 남아요").count()) > 0);
  await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
  await page.getByText("근무 패턴을 초기화할까요?").waitFor({ state: "visible", timeout: 3000 });
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(500);
  check("패턴 초기화 뒤 shiftLabels 유지", JSON.stringify((await stored(page)).shiftLabels) === JSON.stringify(JSON.parse(customized).shiftLabels));
  await page.getByRole("button", { name: "근무 패턴 등록하기" }).click();
  await page.waitForSelector(".settings");
  check("패턴 초기화 뒤 근무 버튼에 '저녁'", (await page.locator(".shift-button.shift-EVENING").innerText()).includes("저녁"));
  await back(page);
  await page.waitForSelector(".calendar");
  await openMenu(page);
  await page.getByText("초기화", { exact: true }).click();
  await page.waitForSelector(".reset-screen");
  await page.getByRole("button", { name: "전체 초기화" }).click();
  await page.getByText("모든 데이터를 지울까요?").waitFor({ state: "visible", timeout: 3000 });
  const dialog = await page.locator("[role=dialog], [role=alertdialog]").first().innerText();
  check("전체 초기화 경고문에 근무 유형", dialog.includes("근무 유형"), dialog.replace(/\s+/g, " "));
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(600);
  check("전체 초기화 뒤 저장값 없음·색 변수 기본값", (await raw(page)) === null && (await page.evaluate(() => document.documentElement.style.getPropertyValue("--shift-night-bg"))) === "#dce4ff");
  await openMenu(page);
  check("전체 초기화 뒤 근무 유형 '기본값'", (await page.locator(".settings-menu [role=button]").nth(2).innerText()).includes("기본값"));
  await context.close();
}

// ---------- 7. 손상 데이터·이전 앱 관점 ----------
{
  const bad = JSON.stringify(base({ shiftLabels: { EVENING: { name: "저녁", short: "야", color: "ORANGE" } } }));
  const { context, page } = await open(bad);
  check("손상 shiftLabels(약어 중복) → 오류 안내", await page.getByText("저장된 근무 설정을 불러오지 못했어요").isVisible());
  check("손상 shiftLabels → 저장값 보존", (await raw(page)) === bad);
  await context.close();
}
{
  const { shiftLabels, ...legacy } = JSON.parse(customized);
  const { context, page } = await open(JSON.stringify(legacy));
  check("필드를 뺀 같은 데이터(이전 앱 관점) → 기본 이름으로 정상", (await page.locator(".calendar").isVisible()) && (await cellShort(page, "2026-10-13")) === "오" && Object.keys(shiftLabels).length === 2);
  await context.close();
}

// ---------- 8. 360px ----------
{
  const long = base({ shiftLabels: { EVENING: { name: "저녁근무", short: "저", color: "BROWN" }, NIGHT: { name: "야간근무", short: "밤", color: "PINK" } } });
  const { context, page } = await open(JSON.stringify(long), { width: 360, height: 740 });
  const summary = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, names: [...document.querySelectorAll(".today-card-name")].map((e) => ({ t: e.textContent, over: e.scrollWidth > e.clientWidth + 1 })) }));
  check("360px 달력: 4자 이름 요약 카드 넘침 없음·가로 스크롤 없음", summary.sw <= summary.cw && summary.names.every((n) => !n.over) && summary.names[0].t === "저녁근무", JSON.stringify(summary));
  await openLabels(page);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    minFont: Math.min(...[...document.querySelectorAll(".shift-labels-screen *")].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0).map((e) => parseFloat(getComputedStyle(e).fontSize))),
    swatches: [...document.querySelectorAll(".shift-color-option")].map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, r.right]; }),
  }));
  check("360px 근무 유형 화면: 가로 스크롤 없음", m.sw <= m.cw, JSON.stringify({ sw: m.sw, cw: m.cw }));
  check("360px: 글자 11px 이상", m.minFont >= 11, `min=${m.minFont}`);
  check("360px: 견본 60개 모두 44px 이상·화면 안", m.swatches.length === 60 && m.swatches.every(([w, h, r]) => w >= 44 && h >= 44 && r <= 360), JSON.stringify(m.swatches.slice(0, 3)));
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
