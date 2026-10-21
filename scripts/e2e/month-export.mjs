import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
// 받은 PNG를 눈으로 확인하려면 OUT_DIR을 준다(없으면 저장하지 않음).
const OUT_DIR = process.env.OUT_DIR ?? null;
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
// data URL 다운로드(Devtools saveBase64Data)를 받은 컨텍스트를 닫으면 Playwright가 내부 TargetClosedError를 처리하지 않은 채 던진다.
// 앱 동작과 무관한 도구 쪽 현상이라 이 오류만 무시하고, 다른 예외는 그대로 실패로 둔다.
process.on("unhandledRejection", (error) => {
  if (error?.name === "TargetClosedError") return;
  throw error;
});

// 패턴 A: 2026-10-11 시작 주·주·오·야·야·비·휴 → 10-13 오후, 10-14 야간
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const base = (extra = {}) => ({
  version: 3, pattern: A, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: "병동/3교대 ../",
  shiftLabels: { EVENING: { name: "저녁", short: "저", color: "PINK" } }, ...extra,
});
// 10-14(야간)에 분류 "휴무" 세부 내용 → 바뀐 근무
const ENTRIES = { version: 1, days: { "2026-10-14": { items: [{ id: "e1", name: "병원", start: "14:00", memo: "진료 예약", shift: "OFF", createdAt: 1 }] } } };

async function open(stored, { width = 390, height = 844, entries = ENTRIES } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  // setFixedTime은 Date.now를 멈춰 바텀시트 닫힘 애니메이션이 끝나지 않는다. 시작 시각만 정하고 시간은 흐르게 한다.
  await page.clock.install({ time: new Date("2026-10-13T10:00:00+09:00") });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v, ek, ev]) => {
    if (v !== null) localStorage.setItem(k, v);
    if (ev !== null) localStorage.setItem(ek, ev);
  }, [SKEY, stored === null ? null : JSON.stringify(stored), EKEY, entries ? JSON.stringify(entries) : null]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("main.app > *", { timeout: 10000 });
  await page.waitForTimeout(400);
  return { context, page };
}
const raw = (page, key = SKEY) => page.evaluate((k) => localStorage.getItem(k), key);
const back = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
  await page.waitForTimeout(400);
};
const exportButton = (page) => page.getByRole("button", { name: "이번 달 내보내기" });
const option = (page, title) => page.locator(".export-option", { hasText: title });
/** 선택지를 누르고 다운로드(Devtools의 saveBase64Data)를 받는다. */
async function exportAs(page, title) {
  await exportButton(page).click();
  await option(page, title).waitFor({ state: "visible", timeout: 3000 });
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), option(page, title).click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: readFileSync(path) };
}
const unfold = (text) => text.replace(/\r\n /g, "");

// ---------- 1. 표시·선택지·닫기 ----------
{
  const { context, page } = await open(base());
  check("패턴 있음: [이번 달 내보내기] 보임", await exportButton(page).isVisible());
  const bottom = await page.locator(".bottom-action").boundingBox();
  const btn = await exportButton(page).boundingBox();
  const row = await page.locator(".shortcut-row").boundingBox();
  check("버튼은 하단 영역 안, 바로가기 줄 아래", btn.y >= row.y + row.height && btn.y + btn.height <= bottom.y + bottom.height + 1);
  await exportButton(page).click();
  await option(page, "달력 이미지 보내기").waitFor({ state: "visible", timeout: 3000 });
  const sheet = (await page.locator(".export-sheet").innerText()).replace(/\s+/g, " ");
  check("선택지 두 개와 공유 창 안내", (await page.locator(".export-option").count()) === 2 && sheet.includes("공유 창에서") && sheet.includes("세부 내용은 들어가지 않아요"), sheet);
  const calDesc = await option(page, "캘린더 파일 보내기").locator(".export-desc:not(.export-reminder)").innerText();
  check("캘린더 파일 안내 두 줄(캘린더 앱이 없을 수 있음 / 나와의 채팅·드라이브로 보낸 뒤 열기)", calDesc === "공유 창에는 캘린더 앱이 없을 수 있어요.\n나와의 채팅, 드라이브 등으로 보낸 뒤 받은 파일을 열면 캘린더 앱에 추가할 수 있어요.", JSON.stringify(calDesc));
  // TDS 바텀시트는 열림 애니메이션(약 0.3초) 중의 닫기 요청을 무시한다(기존 시트와 같음). 열린 뒤에 뒤로가기를 누른다.
  await page.waitForTimeout(800);
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await back(page);
  check("뒤로가기 → 시트만 닫힘·달력 유지·보내지 않음", !(await option(page, "달력 이미지 보내기").isVisible().catch(() => false)) && (await page.locator(".calendar").isVisible()) && !downloaded);
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 2. 이미지 보내기 ----------
{
  const { context, page } = await open(base());
  const settingsBefore = await raw(page);
  const entriesBefore = await raw(page, EKEY);
  const { name, bytes } = await exportAs(page, "달력 이미지 보내기");
  check("이미지 파일 이름 turncal-2026-10-<보낸 시각>.png(근무표 이름 없음)", /^turncal-2026-10-[0-9]{14}[.]png$/.test(name), name);
  check("PNG 서명", bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  check("폭 1080·5주 높이", width === 1080 && height > 900 && height < 1400, `${width}x${height}`);
  if (OUT_DIR) writeFileSync(`${OUT_DIR}/${name}`, bytes);
  await page.waitForTimeout(300);
  check("완료를 단정하는 안내 없음", (await page.locator(".bottom-action .notice-inline").count()) === 0 && (await page.getByText(/저장했어요|보냈어요/).count()) === 0);
  check("저장값 그대로", (await raw(page)) === settingsBefore && (await raw(page, EKEY)) === entriesBefore);
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.waitForTimeout(300);
  const nov = await exportAs(page, "달력 이미지 보내기");
  check("11월로 넘겨 보내면 turncal-2026-11-<보낸 시각>.png(보고 있는 달)·첫 파일과 이름 다름", /^turncal-2026-11-[0-9]{14}[.]png$/.test(nov.name) && nov.name !== name && nov.bytes.readUInt32BE(16) === 1080, `${nov.name} h=${nov.bytes.readUInt32BE(20)}`);
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 3. 캘린더 파일 보내기 ----------
{
  const { context, page } = await open(base());
  const { name, bytes } = await exportAs(page, "캘린더 파일 보내기");
  const ics = unfold(bytes.toString("utf8"));
  const lines = ics.split("\r\n");
  check("파일 이름 turncal-2026-10-<보낸 시각>.ics", /^turncal-2026-10-[0-9]{14}[.]ics$/.test(name), name);
  check("VCALENDAR·일정 31개", lines[0] === "BEGIN:VCALENDAR" && lines.filter((l) => l === "BEGIN:VEVENT").length === 31);
  const event = (date) => { const i = lines.indexOf(`UID:turncal-${date}@ait-turncal`); return lines.slice(i, lines.indexOf("END:VEVENT", i)); };
  check("10/13 일정: 종일·사용자 정의 이름 '저녁'", event("20261013").includes("DTSTART;VALUE=DATE:20261013") && event("20261013").includes("SUMMARY:저녁"), event("20261013").join(" | "));
  check("10/14는 바뀐 근무(휴무)", event("20261014").includes("SUMMARY:휴무"));
  check("세부 내용 이름·시간·메모 없음", !ics.includes("병원") && !ics.includes("14:00") && !ics.includes("진료"));
  check("일정 설명에 턴캘 공유 링크(intoss://ait-turncal)", event("20261013").some((l) => l.startsWith("URL:") && l.includes("intoss://ait-turncal")) && event("20261013").some((l) => l.startsWith("DESCRIPTION:턴캘에서 보기")), event("20261013").filter((l) => l.startsWith("URL")).join());
  check("intoss-private 없음", !ics.includes("intoss-private"));
  check("캘린더 이름에 근무표 이름(파일 이름에는 없음)", lines.some((l) => l.startsWith("X-WR-CALNAME:병동/3교대 ../ 2026년 10월")) && !name.includes("병동"));
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 4. 실패 안내 ----------
{
  const { context, page } = await open(base());
  const settingsBefore = await raw(page);
  await page.evaluate(() => { HTMLAnchorElement.prototype.click = function () { throw new Error("share failed"); }; });
  await exportButton(page).click();
  await option(page, "달력 이미지 보내기").click();
  await page.waitForTimeout(500);
  const alert = page.locator(".bottom-action [role=alert]");
  check("공유 창 실패 → 실패 안내(role=alert)", (await alert.count()) === 1 && (await alert.innerText()).includes("내보내지 못했어요"));
  check("실패해도 저장값 그대로", (await raw(page)) === settingsBefore);
  await page.getByRole("button", { name: "다음 달" }).click();
  await page.waitForTimeout(300);
  check("달을 넘기면 안내 사라짐", (await alert.count()) === 0);
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 5. 패턴 없음 ----------
{
  const { context, page } = await open(null, { entries: null });
  check("첫 실행(저장값 없음): 버튼 없음", (await exportButton(page).count()) === 0);
  await page.waitForTimeout(300);
  await context.close();
}
{
  const { context, page } = await open(base({ pattern: null, patternHistory: [{ until: "2026-10-13", pattern: A }] }));
  check("패턴 초기화 뒤(이력만): 버튼 없음", (await exportButton(page).count()) === 0);
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 6. 360px ----------
{
  const { context, page } = await open(base(), { width: 360, height: 740 });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check("360px 달력: 가로 스크롤 없음", m.sw <= m.cw, JSON.stringify(m));
  const btn = await exportButton(page).boundingBox();
  const font = await exportButton(page).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  check("360px: 버튼 높이 44px 이상·글자 11px 이상", btn.height >= 44 && font >= 11, `h=${btn.height} f=${font}`);
  await exportButton(page).click();
  await option(page, "캘린더 파일 보내기").waitFor({ state: "visible", timeout: 3000 });
  const s = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    minFont: Math.min(...[...document.querySelectorAll(".export-sheet *")].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
    heights: [...document.querySelectorAll(".export-option")].map((e) => e.getBoundingClientRect().height),
  }));
  check("360px 시트: 가로 스크롤 없음·글자 11px 이상·선택지 44px 이상", s.sw <= s.cw && s.minFont >= 11 && s.heights.every((h) => h >= 44), JSON.stringify(s));
  await page.waitForTimeout(300);
  await context.close();
}

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
