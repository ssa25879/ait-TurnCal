import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SKEY = "__ait_storage:turncal.settings";
const UKEY = "__ait_storage:turncal.user";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { history.back = () => {}; });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms = 400) => page.waitForTimeout(ms);
const get = (k) => page.evaluate((key) => localStorage.getItem(key), k);
const v3 = JSON.stringify({ version: 3, pattern: { startDate: "2026-10-13", cycle: ["DAY", "OFF"] }, weekStart: "SUN", theme: "INDIGO", userName: null, scheduleName: null });

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SKEY, v3]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".calendar");
await wait(600);

const stored = JSON.parse((await get(UKEY)) ?? "null");
check("식별키 저장(version 1, 문자열)", stored?.version === 1 && typeof stored.anonymousKey === "string" && stored.anonymousKey.length > 0);
const firstKey = stored?.anonymousKey;
const bodyText = await page.locator("body").innerText();
check("화면에 식별키 값 없음", !!firstKey && !bodyText.includes(firstKey));

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".calendar");
await wait(600);
check("재실행해도 같은 식별키 유지", JSON.parse((await get(UKEY)) ?? "null")?.anonymousKey === firstKey);

// 전체 초기화 → 식별키 삭제 → 다음 실행에 다시 저장
await page.getByRole("button", { name: "설정", exact: true }).click();
await page.waitForSelector(".settings-menu");
await page.getByText("초기화", { exact: true }).click();
await page.waitForSelector(".reset-screen");
await page.getByRole("button", { name: "전체 초기화" }).click();
await page.getByRole("button", { name: "초기화하기" }).click();
await wait(600);
check("전체 초기화 후 설정·식별키 삭제", (await get(SKEY)) === null && (await get(UKEY)) === null);
await page.reload({ waitUntil: "networkidle" });
await wait(600);
check("다음 실행에 식별키 다시 저장", JSON.parse((await get(UKEY)) ?? "null")?.version === 1);

check("페이지 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
