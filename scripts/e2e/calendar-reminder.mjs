import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SKEY = "__ait_storage:turncal.settings";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// Edge 155+는 옛 --headless로 실행되지 않아, CDP_URL이 있으면 떠 있는 Edge에 연결한다.
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch({ executablePath: EDGE, headless: true });
const errors = [];
// data URL 다운로드를 받은 컨텍스트를 닫을 때 Playwright 내부에서 나는 TargetClosedError만 무시한다(month-export.mjs와 같음).
process.on("unhandledRejection", (error) => {
  if (error?.name === "TargetClosedError") return;
  throw error;
});

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-14 야간, 10-16 비번, 10-17 휴무
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (extra = {}) => ({ version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null, ...extra });

async function open(stored, { width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  // 바텀시트를 여닫으므로 시간은 흐르게 둔다(setFixedTime 금지).
  await page.clock.install({ time: new Date("2026-10-13T10:00:00+09:00") });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v]) => { if (v !== null) localStorage.setItem(k, v); }, [SKEY, stored === null ? null : JSON.stringify(stored)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(400);
  return { context, page };
}
const stored = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SKEY));
const back = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.waitForTimeout(400);
};
const openMenu = async (page) => {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
};
const menuItems = (page) => page.locator(".settings-menu [role=button]").allInnerTexts();
const reminderRow = async (page) => (await menuItems(page)).find((t) => t.startsWith("캘린더 알림")) ?? "";
const openReminder = async (page) => {
  await openMenu(page);
  await page.getByText("캘린더 알림", { exact: true }).click();
  await page.waitForSelector(".reminder-settings");
  await page.waitForTimeout(250);
};
const toggle = (page) => page.getByRole("switch", { name: "캘린더 파일에 알림 넣기" });
const hour = (page, h) => page.getByRole("radio", { name: new RegExp(`전날 ${h}:00`) });
const selectedHour = (page) => page.locator(".reminder-hours [aria-checked=true]").innerText();
const unfold = (text) => text.replace(/\r\n /g, "");
async function exportIcs(page) {
  await page.getByRole("button", { name: "이번 달 내보내기" }).click();
  const option = page.locator(".export-option", { hasText: "캘린더 파일 보내기" });
  await option.waitFor({ state: "visible", timeout: 3000 });
  const note = await option.locator(".export-reminder").innerText();
  const guidance = await option.innerText();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), option.click()]);
  const lines = unfold(readFileSync(await download.path()).toString("utf8")).split("\r\n");
  const event = (ymd) => { const i = lines.indexOf(`UID:turncal-${ymd}@ait-turncal`); return lines.slice(i, lines.indexOf("END:VEVENT", i)); };
  return { note, guidance, lines, event };
}

// ---------- 1. 설정 목록·기본 상태 ----------
{
  const { context, page } = await open(base());
  await openMenu(page);
  const tops = (await menuItems(page)).map((t) => t.split("\n")[0].trim());
  check("설정 목록 6항목·순서(캘린더 알림은 화면 설정과 초기화 사이)", JSON.stringify(tops) === JSON.stringify(["이름", "근무 패턴", "근무 유형", "화면 설정", "캘린더 알림", "초기화"]), JSON.stringify(tops));
  check("보조 문구 기본 '전날 21:00'", (await reminderRow(page)).includes("전날 21:00"), await reminderRow(page));
  await page.getByText("캘린더 알림", { exact: true }).click();
  await page.waitForSelector(".reminder-settings");
  check("토글 기본 켜짐", await toggle(page).isChecked());
  check("시각 여섯 개, 21시 선택·기본 표시", (await page.locator(".reminder-hours [role=radio]").count()) === 6 && (await selectedHour(page)).includes("전날 21:00") && (await selectedHour(page)).includes("기본"), await selectedHour(page));
  const text = (await page.locator(".reminder-settings").innerText()).replace(/\s+/g, " ");
  check("안내: 파일 알림·휴무 제외·기본 알림·자동 변경 없음·지운 뒤 가져오기", text.includes("파일에") && text.includes("캘린더 앱에서 울려요") && text.includes("비번·휴무는 제외") && text.includes("기본 알림이 따로 붙을 수") && text.includes("자동으로 바뀌지 않아요") && text.includes("그 달 일정을 지운 뒤 가져와 주세요"), text);
  await back(page);
  check("뒤로가기 → 설정 목록", await page.locator(".settings-menu").isVisible());
  await context.close();
}

// ---------- 2. 시각 바꾸기·저장값 ----------
{
  const { context, page } = await open(base());
  await openReminder(page);
  await hour(page, 20).click();
  await page.waitForTimeout(250);
  let s = await stored(page);
  check("20시 → 저장값 icsReminderHour 20·version 3·enabled 필드 없음", s.icsReminderHour === 20 && s.version === 3 && !("icsReminderEnabled" in s), JSON.stringify(s));
  await back(page);
  check("목록 보조 문구 '전날 20:00'", (await reminderRow(page)).includes("전날 20:00"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *");
  await openReminder(page);
  check("다시 열어도 20시 선택", (await selectedHour(page)).includes("전날 20:00"));
  await hour(page, 21).click();
  await page.waitForTimeout(250);
  s = await stored(page);
  check("21시로 되돌리면 두 필드 없음", !("icsReminderHour" in s) && !("icsReminderEnabled" in s), JSON.stringify(s));
  await context.close();
}

// ---------- 3. 끄기·비활성·다시 켜기 ----------
{
  const { context, page } = await open(base({ icsReminderHour: 20 }));
  await openReminder(page);
  await toggle(page).click();
  await page.waitForTimeout(250);
  let s = await stored(page);
  check("끄기 → icsReminderEnabled false, 시각 20 유지", s.icsReminderEnabled === false && s.icsReminderHour === 20, JSON.stringify(s));
  check("꺼지면 시각 선택지 비활성", await hour(page, 22).isDisabled());
  await hour(page, 22).click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  check("비활성 선택지는 눌러도 바뀌지 않음", (await stored(page)).icsReminderHour === 20 && (await selectedHour(page)).includes("전날 20:00"));
  await back(page);
  check("목록 보조 문구 '끔'", (await reminderRow(page)).includes("끔"), await reminderRow(page));
  await page.getByText("캘린더 알림", { exact: true }).click();
  await page.waitForSelector(".reminder-settings");
  await toggle(page).click();
  await page.waitForTimeout(250);
  s = await stored(page);
  check("다시 켜면 20시 그대로·enabled 필드 없음", !("icsReminderEnabled" in s) && s.icsReminderHour === 20 && (await selectedHour(page)).includes("전날 20:00"), JSON.stringify(s));
  await context.close();
}

// ---------- 4. 캘린더 파일·바텀시트 안내 ----------
{
  const { context, page } = await open(base());
  const { note, guidance, lines, event } = await exportIcs(page);
  check("시트 안내(켜짐): 전날 21시 알림을 파일에 넣음", note === "근무 전날 21:00 알림을 파일에 넣어요. 비번·휴무는 제외해요.", note);
  check("시트 켜짐에서도 캘린더 기본 알림 안내", guidance.includes("캘린더 앱의 기본 알림이 따로 붙을 수 있어요."));
  check("야간(10/14) 일정에 -PT3H '내일 야간'", event("20261014").includes("TRIGGER:-PT3H") && event("20261014").includes("DESCRIPTION:내일 야간"), event("20261014").join(" | "));
  check("비번(10/16)·휴무(10/17) 일정은 있지만 알림 없음", event("20261016").includes("SUMMARY:비번") && !event("20261016").includes("BEGIN:VALARM") && event("20261017").includes("SUMMARY:휴무") && !event("20261017").includes("BEGIN:VALARM"));
  check("10월 알림 21개(비번·휴무 10일 제외)", lines.filter((l) => l === "BEGIN:VALARM").length === 21);
  await page.waitForTimeout(300);
  await context.close();
}
{
  const { context, page } = await open(base({ icsReminderHour: 19 }));
  const { lines } = await exportIcs(page);
  const triggers = lines.filter((l) => l.startsWith("TRIGGER:"));
  check("19시 → 모든 알림 -PT5H", triggers.length === 21 && triggers.every((l) => l === "TRIGGER:-PT5H"));
  await page.waitForTimeout(300);
  await context.close();
}
{
  const { context, page } = await open(base({ icsReminderEnabled: false }));
  const { note, guidance, lines } = await exportIcs(page);
  check("시트 안내(꺼짐): 턴캘 알림만 파일에 넣지 않음", note === "턴캘 알림을 파일에 넣지 않아요. 설정에서 켤 수 있어요.", note);
  check("시트 꺼짐에서도 캘린더 기본 알림 안내", guidance.includes("캘린더 앱의 기본 알림이 따로 붙을 수 있어요."));
  check("꺼짐 → 알림 0개", !lines.some((l) => l.includes("VALARM")));
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 5. 저장 실패 ----------
{
  const { context, page } = await open(base());
  await openReminder(page);
  await page.evaluate((k) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === k) throw new Error("quota"); return original.call(this, key, value); };
  }, SKEY);
  await toggle(page).click();
  await page.waitForTimeout(300);
  const alert = page.locator(".reminder-settings [role=alert]");
  check("토글 저장 실패 → 켜짐으로 되돌림·안내", (await toggle(page).isChecked()) && (await alert.count()) === 1 && (await alert.innerText()).includes("저장하지 못했어요"));
  await hour(page, 22).click();
  await page.waitForTimeout(300);
  check("시각 저장 실패 → 21시로 되돌림", (await selectedHour(page)).includes("전날 21:00"));
  await context.close();
}

// ---------- 6. 초기화 ----------
{
  const { context, page } = await open(base({ icsReminderEnabled: false, icsReminderHour: 19 }));
  await openMenu(page);
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
  check("패턴 초기화 설명에 캘린더 알림은 남는다고 안내", (await page.getByText("캘린더 알림·이름·날짜 세부 내용은 남아요").count()) > 0);
  await page.getByRole("button", { name: "근무 패턴 초기화" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(600);
  const s = await stored(page);
  check("패턴 초기화 뒤 캘린더 알림 유지", s.pattern === null && s.icsReminderEnabled === false && s.icsReminderHour === 19, JSON.stringify(s));
  await openMenu(page);
  check("패턴 초기화 뒤에도 캘린더 알림 항목 접근(끔)", (await reminderRow(page)).includes("끔"));
  await page.getByText("초기화", { exact: true }).click();
  await page.waitForSelector(".reset-screen");
  check("전체 초기화 설명에 캘린더 알림", (await page.locator(".reset-screen").innerText()).includes("캘린더 알림"));
  await page.getByRole("button", { name: "전체 초기화" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "초기화하기" }).click();
  await page.waitForTimeout(800);
  await page.evaluate((k) => {
    const v = localStorage.getItem(k);
    window.__afterReset = v;
  }, SKEY);
  check("전체 초기화 → 설정 키 없음(기본값으로)", (await page.evaluate(() => window.__afterReset)) === null);
  await context.close();
}

// ---------- 7. 좁은 화면·변경 시각 ----------
for (const width of [360, 390]) {
  const { context, page } = await open(base({ icsReminderHour: 20 }), { width, height: 740 });
  await openReminder(page);
  const audit = await page.evaluate(() => {
    const scroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const small = [...document.querySelectorAll(".reminder-settings *")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).length;
    const heights = [...document.querySelectorAll(".reminder-hours [role=radio]")].map((e) => e.getBoundingClientRect().height);
    const toggleRow = document.querySelector(".reminder-toggle").getBoundingClientRect().height;
    return { scroll, small, minHeight: Math.min(...heights), toggleRow };
  });
  check(`${width}px: 가로 스크롤 없음·11px 미만 글자 없음`, !audit.scroll && audit.small === 0, JSON.stringify(audit));
  check(`${width}px: 시각 선택지·토글 행 높이 44px 이상`, audit.minHeight >= 44 && audit.toggleRow >= 44, JSON.stringify(audit));
  await back(page); await back(page);
  await page.getByRole("button", { name: "이번 달 내보내기" }).click();
  const option = page.locator(".export-option", { hasText: "캘린더 파일 보내기" });
  await option.waitFor({ state: "visible" });
  const guidance = await option.innerText();
  check(`${width}px: 변경 시각 20시·기본 알림 안내`, guidance.includes("근무 전날 20:00 알림을 파일에 넣어요.") && guidance.includes("캘린더 앱의 기본 알림이 따로 붙을 수 있어요."));
  const sheetAudit = await option.evaluate((element) => ({ overflow: document.documentElement.scrollWidth > innerWidth, small: [...element.querySelectorAll("span")].some(el => parseFloat(getComputedStyle(el).fontSize) < 11), clipped: element.scrollWidth > element.clientWidth }));
  check(`${width}px: 내보내기 문구 잘림·가로 스크롤·작은 글자 없음`, !sheetAudit.overflow && !sheetAudit.small && !sheetAudit.clipped, JSON.stringify(sheetAudit));
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" / "));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close().catch(() => {});
process.exit(failed ? 1 : 0);
