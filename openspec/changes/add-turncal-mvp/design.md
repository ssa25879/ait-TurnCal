# Design

## Context

- 저장소 루트에 `create-ait-app` Vanilla JS 템플릿이 있다: `src/main.js`·`counter.js`·`style.css`, `index.html`(진입 `/src/main.js`), `apps-in-toss.config.ts`(`appName: 'ait-turncal'`, `webBundleDir: 'dist'`), 스크립트 `dev`/`build`(vite build && ait build)/`deploy`.
- 설치된 의존성: `@apps-in-toss/web-framework` 3.7.0, `@apps-in-toss/devtools` 3.8.0(`./unplugin` export 있음), `vite` ^8.3.0. React·TypeScript·Vitest·TDS는 없고 `vite.config.ts`·`tsconfig.json`도 없다.
- SDK 3.7.0 타입 정의에 `Storage`(getItem/setItem, 문자열, 없으면 `null`), `graniteEvent.addEventListener('backEvent', …)`(구독 해제 함수 반환), `closeView`, `SafeArea`(get/subscribe), `setIosSwipeGestureEnabled`가 있다.
- 비게임 출시 가이드 제약: 앱인토스 내비게이션 바, 최초 화면 뒤로가기 시 종료, 라이트 모드, 확대·축소 비활성화, 진입 시 바텀시트 금지, CSR만 허용.
- 동기와 범위는 proposal.md, 동작 계약은 `specs/` 참고.

## Goals / Non-Goals

**Goals:**
- 계산 로직(`domain/`)을 React·SDK와 분리된 순수 함수로 두어 Vitest만으로 spec 시나리오를 검증한다.
- SDK 의존 코드를 `storage/`, `platform/`에 가두어 테스트에서 `vi.mock`으로 교체할 수 있게 한다.
- 브라우저 개발은 AIT Devtools mock으로, 플랫폼 동작은 토스 앱 실기기로 검증한다.

**Non-Goals:**
- 라우터 라이브러리 도입(화면 2~3개는 상태로 충분).
- 전역 상태 라이브러리, Repository/Service 계층.
- 다크 모드, 다국어, 서버 통신.

## Decisions

### D1. React 18 + TypeScript + TDS 2.4.1로 전환
기존 Vanilla 템플릿 위에 의존성을 추가하고 `main.js`를 `main.tsx`로 교체한다. TDS 2.4.1은 SDK 3.x 호환 버전이며 React 18을 요구하므로 React를 `^18`로 고정한다.
- 대안: Vanilla TS — 의존성은 적지만 편집 UI·다이얼로그·바텀시트를 직접 구현해야 하고 TDS를 쓸 수 없다.
- 대안: React 19 — TDS 2.4.1과 호환되지 않는다.
- `@vitejs/plugin-react`와 `vitest`는 설치 시 Vite 8 peer 범위를 확인해 맞는 버전을 고른다.

### D2. 날짜는 `YYYY-MM-DD` 문자열 + UTC 일수로만 계산
도메인 전체에서 날짜를 문자열로 다루고, 차이 계산은 `Date.UTC(y, m-1, d) / 86400000`의 정수 일수로 한다. 일수→문자열 변환은 UTC 자정 타임스탬프에만 `toISOString()`을 쓴다. "오늘"은 `getFullYear/getMonth/getDate`로 만든 로컬 날짜이며, 오늘 계산에 `toISOString()`을 쓰지 않는다.
- 대안: date-fns/dayjs — 필요한 연산이 일수 차이·더하기·검증뿐이라 의존성을 늘릴 이유가 없다.
- 날짜 검증은 정규식 + 범위(1970~2100) + `Date.UTC` 왕복 비교로 자동 보정 날짜를 거부한다.

### D3. 모듈 구성
```text
src/
  domain/    types.ts, date.ts, schedule.ts, calendar.ts (+ *.test.ts)   -- 순수 함수
  storage/   scheduleStorage.ts (+ test)                                 -- Storage, 스키마 검증·마이그레이션
  platform/  useBackHandler.ts, useSafeArea.ts, useToday.ts              -- SDK·브라우저 이벤트 훅
  components/ Calendar.tsx, PatternEditor.tsx, TodayPositionPicker.tsx, ...
  App.tsx    화면 상태 머신, 저장된 설정 보유
  main.tsx   TDS Provider(필요 시) + App 마운트
```
- `schedule.ts`: `getShift`, `getCycleIndex`, `deriveStartDate`, `getTodayIndex`.
- `calendar.ts`: `buildMonthGrid(year, month, weekStart)` → 42개 날짜 문자열, `addMonths`.

### D4. 화면 상태는 App의 상태 머신으로 관리
```text
            load
 [loading] -------> [setup-intro]  (저장값 없음)
     |                   | CTA
     |                   v
     |              [settings(first)] --save--> [calendar]
     |
     +------------> [calendar] <--save/back-- [settings(edit)]
     |                   |  설정 진입 ------------^
     +------------> [load-error] --다시 설정--> [settings(first, 덮어쓰기 허용)]
```
- 라우터·history를 쓰지 않는다. SDK가 `backEvent`를 history와 자동 연동한다는 보장이 없고, 화면 수가 적다.
- 설정 화면은 진입 시 저장된 설정을 복사한 draft를 가지며, `isDirty`는 draft와 원본 비교로 판단한다.

### D5. 뒤로가기는 단일 `backEvent` 처리기
`useBackHandler(screen, isDirty, hasSavedSettings)`가 `graniteEvent.addEventListener('backEvent')`를 한 번 등록하고 반환된 해제 함수로 정리한다.
- `calendar`, `setup-intro`, `load-error`, `settings(first)` → `closeView()`
- `settings(edit)` → dirty면 TDS 확인 다이얼로그 후 `calendar`, 아니면 바로 `calendar`
- 대안: `popstate` 기반 — 연동이 문서화되지 않아 기각.
- iOS 스와이프 뒤로가기가 `backEvent`로 오는지 실기기에서 확인하고, 아니면 `setIosSwipeGestureEnabled({ isEnabled: false })` 후 내비게이션 바 뒤로가기에 의존한다.

### D6. 저장 스키마와 마이그레이션
```ts
type StoredSettingsV1 = { version: 1; pattern: { startDate: string; cycle: ShiftType[] }; weekStart: "SUN" | "MON" };
type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; settings: StoredSettingsV1 }
  | { kind: "corrupt"; reason: string }      // 파싱 실패·검증 실패·상위 version
  | { kind: "error"; error: unknown };       // Storage 호출 실패
```
- `load()`는 예외를 던지지 않고 `LoadResult`를 반환해 UI가 분기한다. `corrupt`/`error`는 어떤 쓰기도 하지 않는다.
- `migrate(raw)`는 version별 변환 지점이며, 현재는 v1 검증만 한다. P1의 `exceptions` 추가 시 v2로 올린다.
- 주 시작 요일 토글은 현재 설정에 `weekStart`만 바꿔 전체 객체를 다시 `setItem`한다.
- 대안: 키를 필드별로 분리 — 부분 저장으로 불일치가 생길 수 있어 단일 키 원자 저장을 택한다.

### D7. 개발·테스트 환경
- `vite.config.ts`: `plugins: [aitDevtools.vite(), react()]`. 브라우저에서 Devtools 패널로 Storage 값을 주입해 empty/corrupt/상위 version 경로를 확인한다. 자체 `localStorage` 대체 경로는 만들지 않는다.
- Vitest: `domain`은 그대로, `storage`는 `vi.mock('@apps-in-toss/web-framework')`로 메모리 Storage를 주입한다. Vitest 환경은 `node`(DOM 불필요한 범위)로 시작한다.
- 시간대 회귀: `TZ=Asia/Seoul|America/New_York|UTC`로 각각 실행하는 `test:tz` 스크립트. Windows에서 `TZ`가 Node에 반영되는지 확인하고, 안 되면 `cross-env`를 추가한다.
- `package.json` 스크립트: `typecheck`(tsc --noEmit), `test`(vitest run), `build`는 `tsc --noEmit && vite build && ait build`.

### D8. 플랫폼 UI 규칙 적용 위치
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`, `<meta name="color-scheme" content="light">`, `<title>턴캘</title>`.
- `useSafeArea`: `SafeArea.get()` 초기값 + `SafeArea.subscribe()`로 CSS 변수(`--safe-top`, `--safe-bottom`)를 갱신한다.
- `useToday`: `visibilitychange`가 visible이 될 때 로컬 오늘을 다시 계산한다.
- 근무 유형 색상은 라이트 배경 대비가 충분한 6색으로 정의하고 약어를 항상 함께 표시한다.
- TDS 컴포넌트: 버튼, 토글(주 시작 요일), 목록, 바텀시트(항목 변경/삭제), 다이얼로그(폐기 확인·오류). 달력 격자는 CSS Grid로 직접 구현한다.

## Risks / Trade-offs

- [TDS Provider 설정이 앱인토스 문서에 없음] → 착수 시 TDS WebView 문서를 확인해 `main.tsx`에 적용한다. Provider 없이 동작하면 생략한다.
- [Vite 8과 `@vitejs/plugin-react`·`vitest` 호환] → 설치 시 peer 경고를 확인한다. 맞는 버전이 없으면 Vite를 호환 버전으로 맞추는 것을 검토하되, `ait build`가 성공하는지 함께 확인한다.
- [iOS 스와이프 뒤로가기가 `backEvent`를 거치지 않을 수 있음] → D5의 대안대로 스와이프를 끄고 내비게이션 바 뒤로가기에 의존한다.
- [`window.confirm` 등 네이티브 대화상자가 WebView에서 다르게 보임] → TDS 다이얼로그를 사용한다.
- [`<input type="date">`가 토스 WebView에서 표시가 다를 수 있음] → 보조 수단이므로 기본 흐름(오늘 위치 선택)에 영향 없음. 실기기에서 확인한다.
- [패턴 변경 시 과거 근무도 재계산됨] → MVP의 알려진 한계로 수용한다.
- [Devtools mock은 실제 Storage와 다를 수 있음] → 저장·복원은 토스 앱 실기기에서 최종 확인한다.

## Migration Plan

- 신규 앱이므로 데이터 마이그레이션은 없다. 템플릿 예제 파일은 전환 커밋에서 제거한다.
- 배포는 `npm run build`로 `.ait` 산출 후 `npm run deploy`. 되돌릴 때는 콘솔에서 이전 버전으로 롤백한다.

## Open Questions

- TDS에 월간 달력이나 날짜 선택 컴포넌트가 있는지 — 있으면 날짜 직접 지정 입력에 사용하고, 없으면 `<input type="date">`를 쓴다. 달력 격자 자체 구현 결정은 바뀌지 않는다.
- `brand.primaryColor` 최종 색상 값.
