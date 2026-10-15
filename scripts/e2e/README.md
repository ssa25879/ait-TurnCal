# 브라우저 E2E 스크립트

AIT Devtools mock이 켜진 개발 서버(`npm run dev`)를 헤드리스 Edge로 조작해 검증한다.
실기기 확인을 대신하지 않는다(실기기는 콘솔 QR/테스트 푸시로 확인).

## 준비

```powershell
# 저장소 의존성을 늘리지 않도록 임시 폴더에 설치해 쓴다
mkdir $env:TEMP\turncal-e2e; cd $env:TEMP\turncal-e2e
npm init -y; npm install playwright-core@1.49.1
```

## 실행

```powershell
npx vite --port 5179 --strictPort          # 저장소 루트에서, 별도 터미널
# ESM은 NODE_PATH를 무시하므로 스크립트를 playwright-core 설치 폴더로 복사해 실행한다
Copy-Item scripts\e2e\*.mjs $env:TEMP\turncal-e2e\
node $env:TEMP\turncal-e2e\mvp-regression.mjs     # MVP 회귀 58개
node $env:TEMP\turncal-e2e\display-settings.mjs   # 설정 목록·테마·저장 v2→v3 39개
node $env:TEMP\turncal-e2e\day-entries.mjs        # 세부 내용·이름·초기화·주말·공휴일 59개
node $env:TEMP\turncal-e2e\banner.mjs             # 달력 하단 배너 19개
node $env:TEMP\turncal-e2e\user-key.mjs           # 사용자 식별키 저장·초기화 6개
node $env:TEMP\turncal-e2e\today-summary.mjs      # 오늘·내일 요약 37개(시계 고정, 360px, 자정 갱신)
node $env:TEMP\turncal-e2e\pattern-history.mjs    # 패턴 이력·적용 범위·초기화(패턴/전체)·손상 데이터·360px·저장 실패 53개
node $env:TEMP\turncal-e2e\empty-calendar.mjs    # 패턴 없음 빈 달력·안내 카드·설정/뒤로가기 계층·첫 실행·전체 초기화·재실행 빈 달력·뒤로가기 종료·360px 45개
node $env:TEMP\turncal-e2e\calendar-shortcuts.mjs # 달력 바로가기(패턴·이름 수정)·뒤로가기/폐기/저장 후 달력 복귀·설정 경로 불변·360px 33개
node $env:TEMP\turncal-e2e\visual-audit.mjs # 화면 감사: 11px 미만 글자·터치 영역 44px·가로 스크롤·6주 격자가 첫 화면 안(360×740·390×844) 57개
```

- Edge 155+는 Playwright 1.49의 옛 `--headless`·`--remote-debugging-pipe` 실행이 안 돼(실행 직후 종료) 직접 띄운 Edge에 CDP로 연결한다: `msedge.exe --headless=new --hide-scrollbars --mute-audio --disable-gpu --remote-debugging-port=9333 --user-data-dir=%TEMP%edge-cdp about:blank` 후 `CDP_URL=http://127.0.0.1:9333`을 주고 스크립트를 실행한다(`--hide-scrollbars`가 없으면 세로 스크롤바가 폭을 차지해 360px 가로 스크롤 검사가 틀어진다). `CDP_URL`이 없으면 예전처럼 직접 실행한다.
- 브라우저 경로는 `EDGE_PATH`, 앱 주소는 `APP_URL` 환경 변수로 바꿀 수 있다.
- mock의 `closeView`는 `history.back()`을 호출하므로 스크립트가 `history.back`을 무력화하고 콘솔 로그(`closeView called`)로 종료를 판정한다.
- 뒤로가기는 `window.dispatchEvent(new CustomEvent("__ait:backEvent"))`, 저장값은 `localStorage`의 `__ait_storage:` 접두어 키, SDK 호출 기록은 `window.__ait.state.sdkCallLog`, 광고 없음 강제는 `window.__ait.patch("ads", { forceNoFill: true })`.
- 기능이 바뀌면(예: 초기화 버튼 위치) 해당 스크립트의 선택자·기대값을 함께 고친다.

`render-logo.mjs`는 `assets/logo.svg`를 정확히 600×600 PNG로 렌더링한다:
`node scripts/e2e/render-logo.mjs assets/logo.svg assets/logo.png`
