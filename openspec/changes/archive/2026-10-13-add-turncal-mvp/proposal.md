# Proposal

## Why

교대근무자는 요일이 아닌 반복 주기로 근무하므로 일반 달력으로는 근무일을 파악하기 어렵고, 사업장마다 주기가 달라 고정 템플릿으로는 표현할 수 없다. 사용자가 근무 순서와 "오늘이 그 순서의 몇 번째인지"만 등록하면 과거·미래 근무를 자동으로 보여 주는 앱인토스 미니앱(턴캘)의 MVP를 만든다. 저장소에는 `create-ait-app`으로 생성한 Vanilla JS 템플릿만 있고 기능은 아직 없다.

## What Changes

- 6개 근무 유형(주간·오후·야간·당직·비번·휴무)으로 1~56일 길이의 반복 패턴을 정의하고, 기준일로부터 임의 날짜의 근무를 계산한다(기준일 이전 날짜 포함, UTC 일수 기반).
- 기준일은 "오늘 위치 선택"으로 자동 계산하며, 날짜 직접 지정을 보조 수단으로 제공한다. "오늘"은 기기 로컬 날짜로 정의한다.
- 패턴 편집 화면: 유형 추가, 임의 위치 항목의 유형 변경·삭제, draft 편집 후 [저장]으로 확정.
- 월간 달력: 6×7 고정 격자, 인접 월 흐리게 표시, 오늘 강조, 월 이동, 주 시작 요일(일/월) 선택.
- 앱인토스 `Storage`에 버전이 있는 설정(`turncal.settings`, `version: 1`)을 저장·복원하고, 손상·상위 버전 데이터를 삭제하지 않고 안내한다.
- 앱인토스 플랫폼 규칙 충족: 앱인토스 내비게이션 바 사용(자체 뒤로가기 금지), `graniteEvent` `backEvent` 기반 뒤로가기와 최초 화면 `closeView` 종료, 라이트 모드 전용, SafeArea, 확대·축소 비활성화, 진입 시 바텀시트 금지.
- 기술 기반 전환: Vanilla JS 템플릿을 React 18 + TypeScript + TDS Mobile 2.4.1로 전환하고, AIT Devtools Vite 플러그인과 Vitest를 구성한다. 템플릿 예제 코드는 제거한다.

## Capabilities

### New Capabilities
- `shift-schedule`: 근무 유형, 반복 패턴 모델, 날짜 검증·로컬 "오늘" 규칙, 날짜별 근무 계산, 오늘 위치↔기준일 변환.
- `shift-pattern-settings`: 패턴 편집·오늘 위치 선택·날짜 직접 지정·draft 저장 흐름과 초기 설정 안내.
- `shift-calendar`: 월간 달력 격자, 근무 표시, 월 이동, 오늘 강조, 주 시작 요일 설정.
- `settings-persistence`: 설정 저장 스키마, 저장·복원, 검증·마이그레이션, 손상 데이터 처리.
- `miniapp-shell`: 앱인토스 미니앱 셸 동작 — 내비게이션 바, 뒤로가기·종료, 라이트 모드, SafeArea, 확대·축소 비활성화, 바텀시트 정책.

### Modified Capabilities
- 없음 (기존 spec 없음)

## Impact

- **코드:** `src/main.js`, `src/counter.js`, 미사용 `src/assets/*` 제거. `src/` 아래 React 앱(`main.tsx`, `App.tsx`, `components/`, `domain/`, `storage/`, `platform/`) 신규 작성. `index.html`(진입 스크립트, viewport, color-scheme, title) 수정.
- **설정:** `vite.config.ts`, `tsconfig.json` 신규. `package.json`에 의존성과 `test`·`typecheck` 스크립트 추가. `apps-in-toss.config.ts`의 `brand.primaryColor` 변경.
- **의존성:** `react@^18`, `react-dom@^18`, `@toss/tds-mobile@2.4.1`, `@toss/tds-mobile-ait@2.4.1`, `@emotion/react@^11`; 개발 의존성 `typescript`, `@types/react@^18`, `@types/react-dom@^18`, `@vitejs/plugin-react`, `vitest`(Vite 8 호환 버전).
- **플랫폼 API:** `@apps-in-toss/web-framework` 3.7.0의 `Storage`, `graniteEvent`, `closeView`, `SafeArea`.
- **외부 시스템:** 없음(서버·로그인·네트워크 통신 없음).
