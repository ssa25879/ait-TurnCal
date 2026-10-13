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
```

- 브라우저 경로는 `EDGE_PATH`, 앱 주소는 `APP_URL` 환경 변수로 바꿀 수 있다.
- mock의 `closeView`는 `history.back()`을 호출하므로 스크립트가 `history.back`을 무력화하고 콘솔 로그(`closeView called`)로 종료를 판정한다.
- 뒤로가기는 `window.dispatchEvent(new CustomEvent("__ait:backEvent"))`, 저장값은 `localStorage`의 `__ait_storage:` 접두어 키, SDK 호출 기록은 `window.__ait.state.sdkCallLog`, 광고 없음 강제는 `window.__ait.patch("ads", { forceNoFill: true })`.
- 기능이 바뀌면(예: 초기화 버튼 위치) 해당 스크립트의 선택자·기대값을 함께 고친다.

`render-logo.mjs`는 `assets/logo.svg`를 정확히 600×600 PNG로 렌더링한다:
`node scripts/e2e/render-logo.mjs assets/logo.svg assets/logo.png`
