import { chromium } from "playwright-core";

const URL = process.env.APP_URL ?? "http://localhost:5179/";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SKEY = "__ait_storage:turncal.settings";
const EKEY = "__ait_storage:turncal.entries";
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch({ executablePath: EDGE, headless: true });
const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const pattern = { startDate: "2026-10-11", cycle: ["DAY", "NIGHT", "OFF"] };
const base = (extra = {}) => ({ version: 3, pattern, weekStart: "SUN", theme: "INDIGO", userName: "전송금지이름", scheduleName: "전송금지근무표", ...extra });
const entries = { version: 1, days: { "2026-10-13": { items: [{ id: "private-id", name: "전송금지일정", start: "14:00", memo: "전송금지메모", shift: "EVENING", createdAt: 1 }] } } };

async function open(settings = base()) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { history.back = () => {}; });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  await page.clock.install({ time: new Date("2026-10-13T10:00:00+09:00") });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(([sk, settings, ek, entries]) => {
    localStorage.setItem(sk, JSON.stringify(settings));
    localStorage.setItem(ek, JSON.stringify(entries));
  }, [SKEY, settings, EKEY, entries]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".calendar-screen");
  await page.evaluate(async () => {
    const source = await (await fetch("/src/platform/analytics.ts")).text();
    const sdkUrl = source.match(/from\s+["']([^"']+)["']/)?.[1];
    if (!sdkUrl) throw new Error("분석 SDK import를 찾지 못했어요.");
    window.__testSdk = await import(sdkUrl);
    window.__shareCalls = 0;
    // 공유 창 반환과 취소를 구별하지 못하는 SDK 경계를 재현하고 파일 다운로드는 생략한다.
    HTMLAnchorElement.prototype.click = function () { window.__shareCalls += 1; };
  });
  return { context, page };
}

const events = page => page.evaluate(() => window.__ait.state.analyticsLog
  .filter(entry => entry.params.log_name?.startsWith("turncal_"))
  .map(entry => ({ type: entry.type, params: entry.params })));
const stored = page => page.evaluate(([sk, ek]) => [localStorage.getItem(sk), localStorage.getItem(ek)], [SKEY, EKEY]);
const openMenu = async page => {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.waitForSelector(".settings-menu");
};
const openPattern = async page => {
  await openMenu(page);
  await page.getByText("근무 패턴", { exact: true }).click();
  await page.waitForSelector(".settings");
};
const save = async page => {
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForSelector(".calendar-screen", { timeout: 2000 });
};
const selectExport = async (page, format) => {
  await page.getByRole("button", { name: "이번 달 내보내기", exact: true }).click();
  const option = page.locator(".export-option", { hasText: format === "image" ? "달력 이미지 보내기" : "캘린더 파일 보내기" });
  await option.click();
  await option.waitFor({ state: "hidden" });
};
const noCompletion = page => page.getByText(/저장했어요|보냈어요|전송 완료/).count().then(count => count === 0);

try {
  // 복원·시트 열기/닫기·실패·재렌더링은 저장 성공으로 세지 않는다.
  {
    const { context, page } = await open();
    check("저장값 복원에는 행동 이벤트 없음", (await events(page)).length === 0);
    await page.getByRole("button", { name: "이번 달 내보내기", exact: true }).click();
    await page.waitForTimeout(400); // TDS 열림 애니메이션 동안에는 뒤로가기를 받지 않는다.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("__ait:backEvent")));
    await page.locator(".export-option").first().waitFor({ state: "hidden" });
    check("시트 열기·닫기에는 내보내기 요청 없음", (await events(page)).length === 0);
    await openPattern(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.__restoreStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (key === "__ait_storage:turncal.settings") throw new Error("저장 실패");
        return original.call(this, key, value);
      };
    });
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText("저장하지 못했어요.", { exact: false }).waitFor({ state: "visible" });
    check("저장 실패: 편집 화면 유지·성공 이벤트 없음", await page.locator(".settings").isVisible() && (await events(page)).length === 0);
    await page.evaluate(() => window.__restoreStorage());
    await save(page);
    check("저장 성공 뒤에만 한 번 기록", JSON.stringify(await events(page)) === JSON.stringify([{ type: "event", params: { log_name: "turncal_pattern_saved" } }]));
    await page.getByRole("button", { name: "다음 달" }).click();
    await page.getByRole("button", { name: "이전 달" }).click();
    check("달력 재렌더링이 저장 이벤트를 늘리지 않음", (await events(page)).length === 1);
    await openPattern(page);
    await save(page);
    check("독립된 두 번 저장은 두 번 기록", (await events(page)).filter(entry => entry.params.log_name === "turncal_pattern_saved").length === 2);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".calendar-screen");
    check("재실행 복원에서도 이벤트 없음", (await events(page)).length === 0);
    await context.close();
  }
  {
    const { context, page } = await open(base({ pattern: null }));
    await page.getByRole("button", { name: "근무 패턴 등록하기", exact: true }).click();
    check("잘못된 최초 등록: 저장 비활성·이벤트 없음", await page.getByRole("button", { name: "저장", exact: true }).isDisabled() && (await events(page)).length === 0);
    await page.locator(".shift-button.shift-DAY").click();
    await page.locator(".today-cell").first().click();
    await save(page);
    check("최초 등록 성공도 저장 이벤트 한 번", (await events(page)).filter(entry => entry.params.log_name === "turncal_pattern_saved").length === 1);
    await context.close();
  }
  {
    const { context, page } = await open(base({ patternHistory: [{ until: "2026-10-11", pattern: { startDate: "2026-10-01", cycle: ["NIGHT", "OFF"] } }] }));
    await openPattern(page);
    await page.locator(".history-load").click();
    check("이력 불러오기만 하면 기록하지 않음", (await events(page)).length === 0 && await page.getByRole("button", { name: "저장", exact: true }).isDisabled());
    await page.locator(".today-cell").first().click();
    await save(page);
    check("불러온 패턴 저장 성공 후 한 번 기록", (await events(page)).filter(entry => entry.params.log_name === "turncal_pattern_saved").length === 1);
    await context.close();
  }
  for (const format of ["image", "calendar"]) {
    const { context, page } = await open();
    const before = await stored(page);
    await selectExport(page, format);
    const recorded = await events(page);
    const expected = [
      { type: "click", params: { log_name: "turncal_export_requested", format } },
      { type: "event", params: { log_name: "turncal_export_result", format, result: "opened" } },
    ];
    check(`${format}: 요청과 SDK 반환 각 한 번·순서·정확한 속성`, JSON.stringify(recorded) === JSON.stringify(expected));
    check(`${format}: 공유 반환이 업무 저장값을 바꾸지 않음`, JSON.stringify(await stored(page)) === JSON.stringify(before));
    check(`${format}: 완료를 단정하는 UI 없음`, await noCompletion(page));
    check(`${format}: 분석에 이름·날짜·근무·메모·원시 오류 없음`, !/전송금지|2026-|private-id|14:00|anonymous_key|scheduleName|memo/.test(JSON.stringify(recorded)));
    await context.close();
  }
  for (const format of ["image", "calendar"]) {
    for (const outcome of ["failed", "unsupported"]) {
      const { context, page } = await open();
      await page.evaluate(outcome => {
        if (outcome === "unsupported") window.__testSdk.saveBase64Data.isSupported = () => false;
        else HTMLAnchorElement.prototype.click = function () { throw new Error("전송금지 원시 오류"); };
      }, outcome);
      await selectExport(page, format);
      const recorded = await events(page);
      const expected = [
        { type: "click", params: { log_name: "turncal_export_requested", format } },
        { type: "event", params: { log_name: "turncal_export_result", format, result: outcome } },
      ];
      check(`${format} ${outcome}: 오류 내용을 넣지 않고 결과만 기록`, JSON.stringify(recorded) === JSON.stringify(expected));
      check(`${format} ${outcome}: 기존 사용자 안내 유지`, await page.locator(".bottom-action [role=alert]").isVisible() && await noCompletion(page));
      await context.close();
    }
  }
  {
    const { context, page } = await open();
    await page.evaluate(() => { window.__testSdk.Share.createLink = () => new Promise(() => {}); });
    await page.getByRole("button", { name: "이번 달 내보내기", exact: true }).click();
    await page.locator(".export-option", { hasText: "캘린더 파일 보내기" }).click();
    // TDS가 닫힘 애니메이션에 이전 버튼을 남겨도 진행 중 요청은 중복 실행하지 않는다.
    await page.locator(".export-option").evaluateAll(elements => elements.forEach(element => element.click()));
    await page.waitForFunction(() => window.__shareCalls === 1, undefined, { timeout: 4000 });
    const requests = (await events(page)).filter(entry => entry.params.log_name === "turncal_export_requested").length;
    await selectExport(page, "image");
    const nextRequests = (await events(page)).filter(entry => entry.params.log_name === "turncal_export_requested").length;
    check("처리 중 재누르기는 무시하고 완료 뒤 독립 요청은 기록", requests === 1 && nextRequests === 2, `requests=${requests}, next=${nextRequests}`);
    await context.close();
  }
  for (const mode of ["throw", "reject", "pending", "missing"]) {
    const { context, page } = await open();
    await page.evaluate(mode => {
      window.__analyticsAttempts = 0;
      const fail = () => {
        window.__analyticsAttempts += 1;
        if (mode === "throw") throw new Error("분석 오류");
        if (mode === "reject") return Promise.reject(new Error("분석 거부"));
        return new Promise(() => {});
      };
      window.__testSdk.Analytics.log = mode === "missing" ? undefined : fail;
      window.__testSdk.Analytics.click = mode === "missing" ? undefined : fail;
    }, mode);
    await openPattern(page);
    await save(page);
    check(`분석 ${mode}: 저장·화면 복귀를 막지 않음`, await page.locator(".calendar-screen").isVisible());
    await selectExport(page, "image");
    check(`분석 ${mode}: 내보내기도 정상 반환·거짓 완료 없음`, await page.evaluate(() => window.__shareCalls === 1) && await noCompletion(page));
    if (mode !== "missing") check(`분석 ${mode}: 세 호출을 시도하고 자동 재시도 없음`, await page.evaluate(() => window.__analyticsAttempts === 3));
    await context.close();
  }
  check("분석 오류를 포함해 미처리 페이지 오류 없음", errors.length === 0, errors.join(" / "));
} finally {
  await browser.close();
}
const failed = results.filter(result => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
