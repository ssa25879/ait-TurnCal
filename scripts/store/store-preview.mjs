// 콘솔 "미리보기 및 스크린샷"용 세로형 이미지(636×1048)를 실제 앱 화면으로 만든다. 설계는 docs/STORE_PREVIEW.md.
// 실행: 개발 서버(npx vite --port 5179 --strictPort)와 CDP Edge를 띄운 뒤
//   node store-preview.mjs <출력 폴더>   (playwright-core가 설치된 폴더로 복사해 실행, scripts/e2e/README.md 참고)
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const OUT = process.argv[2] ?? "./store-out";
mkdirSync(OUT, { recursive: true });
const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
process.on("unhandledRejection", (error) => {
  if (error?.name === "TargetClosedError") return;
  throw error;
});

const W = 390; // CSS 폭
const PIECE = 536; // 틀 안 이미지 폭(px)
const SKEY = "__ait_storage:turncal.settings";
const EKEY = "__ait_storage:turncal.entries";

// 기준 데이터: 7일 주기, 2026-10-13(화) 오늘, 가상의 이름
const A = { startDate: "2026-10-11", cycle: ["DAY", "DAY", "EVENING", "NIGHT", "NIGHT", "AFTER_NIGHT", "OFF"] };
const PAST = { startDate: "2026-09-01", cycle: ["DAY", "NIGHT", "AFTER_NIGHT", "OFF"] };
const settings = (extra = {}) => ({
  version: 3, pattern: A, patternHistory: [{ until: "2026-10-06", pattern: PAST }],
  weekStart: "SUN", theme: "INDIGO", userName: "김턴캘", scheduleName: null, ...extra,
});
const ENTRIES = {
  version: 1,
  days: {
    "2026-10-13": { items: [{ id: "e1", name: "병동 교육", start: "09:00", end: "12:00", memo: "안전 교육 2층 세미나실", createdAt: 1 }] },
    "2026-10-20": { items: [{ id: "e2", name: "근무 바꿈", shift: "OFF", createdAt: 2 }] },
  },
};

const HIDE = `.ait-panel-toggle, .ait-navbar, .ait-viewport-navbar, [class*="ait-navbar"], [data-ait-accessory-button-id] { display: none !important; }`;

async function open(stored = settings()) {
  const context = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: PIECE / W });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  // setFixedTime은 바텀시트 애니메이션을 멈추므로 시작 시각만 정한다.
  await page.clock.install({ time: new Date("2026-10-13T10:00:00+09:00") });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([k, v, ek, ev]) => { localStorage.setItem(k, v); localStorage.setItem(ek, ev); }, [SKEY, JSON.stringify(stored), EKEY, JSON.stringify(ENTRIES)]);
  await page.reload({ waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(500);
  return { context, page };
}

/** 요소 위쪽(px 여백 포함)부터 높이 h(CSS)만큼 자른다. */
async function shotFrom(page, selector, h, { pad = 12, nth = 0 } = {}) {
  // 화면 아래에 있는 요소도 잘리지 않게 먼저 위로 스크롤한다(clip은 보이는 화면 기준).
  await page.locator(selector).nth(nth).evaluate((e, p) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -p); }, pad);
  await page.waitForTimeout(150);
  const box = await page.locator(selector).nth(nth).boundingBox();
  const y = Math.max(0, box.y - pad);
  return page.screenshot({ clip: { x: 0, y, width: W, height: h }, animations: "disabled" });
}

const back = (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
const goSettings = async (page, item, waitSel) => {
  // 촬영을 위해 Devtools 내비 바(기능 버튼 포함)를 숨겼으므로 버튼은 스크립트로 누른다.
  await page.evaluate(() => document.querySelector("button[data-ait-accessory-button-id=settings]")?.click());
  await page.waitForSelector(".settings-menu");
  await page.getByText(item, { exact: true }).click();
  await page.waitForSelector(waitSel);
  await page.waitForTimeout(400);
};

async function compose(name, title, sub, pieces) {
  const context = await browser.newContext({ viewport: { width: 636, height: 1048 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const imgs = pieces
    .map((buf, i) => `${i > 0 ? '<div class="gap"></div>' : ""}<img src="data:image/png;base64,${buf.toString("base64")}">`)
    .join("");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:636px;height:1048px;overflow:hidden;background:#fff;
      font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
    h1{position:absolute;left:48px;top:52px;margin:0;font-size:34px;font-weight:700;color:#191F28;letter-spacing:-0.5px}
    p{position:absolute;left:48px;top:112px;margin:0;font-size:24px;color:#6B7684}
    .frame{position:absolute;left:48px;top:200px;width:540px;height:880px;box-sizing:border-box;border:2px solid #E5E8EB;
      border-bottom:none;border-radius:28px 28px 0 0;overflow:hidden;background:#fff}
    .frame img{display:block;width:536px}
    .gap{height:14px;background:#F2F4F6}
  </style></head><body><h1>${title}</h1><p>${sub}</p><div class="frame">${imgs}</div></body></html>`);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 636, height: 1048 } });
  writeFileSync(`${OUT}/${name}`, png);
  await context.close();
  console.log("saved", name);
}

// ---------- 1. 달력 ----------
{
  const { context, page } = await open();
  const pieces = [await shotFrom(page, ".schedule-header", 640)];
  await compose("preview-1.png", "교대 근무를 한눈에", "오늘·내일 근무와 월간 달력을 바로 확인해요", pieces);
  await context.close();
}

// ---------- 2. 근무 패턴 설정 ----------
{
  const { context, page } = await open();
  await page.getByRole("button", { name: "근무 패턴 수정" }).click();
  await page.waitForSelector(".settings");
  await page.waitForTimeout(400);
  await compose("preview-2.png", "순서만 정하면 자동 계산", "반복 순서를 등록하고 오늘 위치만 골라요", [await shotFrom(page, ".settings .page-title", 640)]);
  await context.close();
}

// ---------- 3. 날짜 세부 내용 ----------
{
  const { context, page } = await open();
  await page.locator('.calendar-cell[data-date="2026-10-13"]').click();
  await page.waitForSelector(".day-screen");
  await page.locator(".entry-row").first().click();
  await page.waitForSelector(".entry-editor");
  await page.waitForTimeout(400);
  await compose("preview-3.png", "날짜별로 메모도 남겨요", "근무 시간과 세부 내용을 따로 적어요", [await shotFrom(page, ".entry-editor", 640)]);
  await context.close();
}

// ---------- 4. 주말·공휴일 ----------
{
  const { context, page } = await open();
  const nav = await page.locator(".month-nav").boundingBox();
  const row2 = await page.locator(".calendar-row").nth(2).boundingBox();
  const top = await page.screenshot({ clip: { x: 0, y: nav.y - 2, width: W, height: row2.y + row2.height - 4 - (nav.y - 2) } });
  await page.locator('.calendar-cell[data-date="2026-10-09"]').click();
  await page.waitForSelector(".day-screen");
  await page.waitForTimeout(400);
  const day = await shotFrom(page, ".day-screen", 360);
  await compose("preview-4.png", "주말·공휴일은 색과 이름으로", "달력과 날짜 화면에 공휴일 이름이 보여요", [top, day]);
  await context.close();
}

// ---------- 5. 화면 설정(딥 틸) ----------
{
  const { context, page } = await open(settings({ theme: "TEAL" }));
  const cal = await shotFrom(page, ".month-nav", 330, { pad: 2 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await goSettings(page, "화면 설정", ".display-settings");
  const display = await shotFrom(page, ".display-settings .page-title", 300);
  await compose("preview-5.png", "화면은 내 취향대로", "색 테마와 주 시작 요일을 바꿔요", [display, cal]);
  await context.close();
}

// ---------- 6. 근무 유형(새 기능) ----------
{
  const custom = {
    DAY: { name: "데이", short: "D", color: "YELLOW" },
    EVENING: { name: "이브닝", short: "E", color: "PINK" },
    NIGHT: { name: "나이트", short: "N", color: "NAVY" },
  };
  const { context, page } = await open(settings({ shiftLabels: custom }));
  const cal = await shotFrom(page, ".month-nav", 260, { pad: 2 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await goSettings(page, "근무 유형", ".shift-labels-screen");
  const screen = await shotFrom(page, '.shift-label-card[data-shift="EVENING"]', 380, { pad: 8 });
  await compose("preview-6.png", "근무 이름을 직장에 맞게", "이름·약어·색을 바꾸면 달력에 바로 보여요", [screen, cal]);
  await context.close();
}

// ---------- 7. 이번 달 내보내기(새 기능) ----------
{
  const { context, page } = await open();
  await page.getByRole("button", { name: "이번 달 내보내기" }).click();
  await page.locator(".export-option").first().waitFor({ state: "visible" });
  await page.waitForTimeout(900);
  // 시트 패널(.export-sheet의 세 단계 위, 머리글 포함)만: 손잡이 아래부터 패널 끝까지
  const panel = await page.locator(".export-sheet").evaluate((e) => {
    const r = e.parentElement.parentElement.parentElement.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const sheet = await page.screenshot({ clip: { x: panel.x, y: panel.y + 20, width: panel.width, height: Math.min(panel.height - 20, 844 - panel.y - 20) - 18 } }); // 아래 둥근 모서리 뒤 배경 제외
  // 같은 데이터로 실제 내보내기 이미지를 받아 아래에 붙인다.
  await back(page);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "이번 달 내보내기" }).click();
  await page.locator(".export-option").first().waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".export-option").first().click()]);
  const { readFileSync } = await import("node:fs");
  const exported = readFileSync(await download.path());
  await compose("preview-7.png", "이번 달 근무표를 보내요", "사진이나 캘린더 파일로 공유해요", [sheet, exported]);
  await page.waitForTimeout(300);
  await context.close();
}

// ---------- 8. 패턴 이력 불러오기(새 기능) ----------
{
  const { context, page } = await open();
  await page.getByRole("button", { name: "근무 패턴 수정" }).click();
  await page.waitForSelector(".history-list");
  await page.locator(".history-list").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const history = await shotFrom(page, ".history-list", 260, { pad: 84 });
  await page.locator(".history-load").first().click();
  await page.waitForTimeout(500);
  const loaded = await shotFrom(page, ".settings .page-title", 380);
  await compose("preview-8.png", "예전 근무 순서도 다시", "패턴 이력을 누르면 편집기에 불러와요", [history, loaded]);
  await context.close();
}

await browser.close();
