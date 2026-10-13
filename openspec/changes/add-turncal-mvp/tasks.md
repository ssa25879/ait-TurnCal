# Tasks

## 1. 프로젝트 전환 (React 18 + TS + TDS + Devtools)

- [ ] 1.1 현재 미커밋 파일(`openspec/`, `.claude/`, `.agents/`, `.gemini/`)을 커밋해 전환 전 기준점을 만들고 `git status`가 깨끗한지 확인한다
- [ ] 1.2 `react@^18`, `react-dom@^18`, `@toss/tds-mobile@2.4.1`, `@toss/tds-mobile-ait@2.4.1`, `@emotion/react@^11`과 개발 의존성 `typescript`, `@types/react@^18`, `@types/react-dom@^18`, Vite 8 호환 `@vitejs/plugin-react`·`vitest`를 설치하고 `npm ls react`가 18.x, peer 경고가 없는지 확인한다
- [ ] 1.3 `vite.config.ts`(`aitDevtools.vite()` + `react()`)와 `tsconfig.json`(`strict`, `jsx: react-jsx`)을 추가하고 `npx tsc --noEmit`이 통과하는지 확인한다
- [ ] 1.4 `index.html`을 수정한다(진입 `/src/main.tsx`, `<title>턴캘</title>`, viewport `maximum-scale=1, user-scalable=no`, `color-scheme: light`) — 브라우저 개발자 도구에서 meta 값을 확인한다
- [ ] 1.5 `src/main.js`, `src/counter.js`, 미사용 `src/assets/*`를 제거하고 `main.tsx`·빈 `App.tsx`를 만든다. TDS WebView 문서에서 Provider 필요 여부를 확인해 `main.tsx`에 적용한다 — `npm run dev`에서 앱이 렌더링되고 우측 하단 AIT Devtools 패널이 보이는지 확인한다
- [ ] 1.6 `package.json`에 `typecheck`, `test`, `test:tz` 스크립트를 추가하고 `build`를 `tsc --noEmit && vite build && ait build`로 바꾼다 — `npm run build`가 성공하는지 확인한다(Windows에서 `TZ` 미반영 시 `cross-env` 추가)

## 2. 도메인: 날짜·근무 계산 (`shift-schedule`)

- [ ] 2.1 `domain/types.ts`에 `ShiftType`(6종), 표시명·약어 매핑, `WorkPattern`, `WeekStart`, 패턴 길이 상수(1~56)를 정의하고 typecheck 통과를 확인한다
- [ ] 2.2 `domain/date.ts`에 `isValidDateString`, `getTodayLocal`, `toUtcDayNumber`, `fromUtcDayNumber`, `addDays`를 구현하고 `date.test.ts`로 spec의 날짜 검증 5개 시나리오와 KST 03:00 로컬 오늘 시나리오가 통과하는지 확인한다
- [ ] 2.3 `domain/schedule.ts`에 `isValidPattern`, `getShift`, `getTodayIndex`, `deriveStartDate`를 구현하고 `schedule.test.ts`로 기준일 전후 7개 날짜, 하루짜리·빈·57개 패턴, 당직·비번 패턴, 월말·연말·윤년 경계, 오늘 위치↔기준일 변환 3개 시나리오가 통과하는지 확인한다
- [ ] 2.4 `npm run test:tz`로 Asia/Seoul·America/New_York(2026-03-08, 2026-11-01 DST 경계 포함)·UTC에서 2.2~2.3 테스트가 모두 통과하는지 확인한다

## 3. 도메인: 달력 격자 (`shift-calendar`)

- [ ] 3.1 `domain/calendar.ts`에 `buildMonthGrid(year, month, weekStart)`와 `addMonths`를 구현하고 `calendar.test.ts`로 2026년 10월 일/월 시작 첫·마지막 칸, 2026년 2월 일요일 시작 첫 칸 `2026-02-01`, 12월→1월 연도 이동이 통과하는지 확인한다

## 4. 저장소 (`settings-persistence`)

- [ ] 4.1 `storage/scheduleStorage.ts`에 `StoredSettingsV1`, 검증·`migrate`, `load(): LoadResult`(empty/ok/corrupt/error), `save(settings)`를 `Storage`(키 `turncal.settings`)로 구현한다
- [ ] 4.2 `scheduleStorage.test.ts`에서 `vi.mock('@apps-in-toss/web-framework')` 메모리 Storage로 저장 내용 형식, 재로드 복원, 값 없음, JSON 파싱 실패, 알 수 없는 근무 유형, `version: 2`, 읽기 예외 시나리오를 검증하고 corrupt/error 경로에서 `setItem`·`removeItem`이 호출되지 않는지 확인한다

## 5. 플랫폼 셸 (`miniapp-shell`)

- [ ] 5.1 `platform/useSafeArea.ts`로 `SafeArea.get()`·`subscribe()` 값을 `--safe-top`/`--safe-bottom` CSS 변수에 반영하고, Devtools에서 여백 값 변경 시 콘텐츠 패딩이 바뀌는지 확인한다
- [ ] 5.2 `platform/useToday.ts`로 `visibilitychange`(visible) 시 로컬 오늘을 다시 계산하고, 단위 테스트(가짜 타이머로 날짜 경과 후 visible 이벤트)로 값 갱신을 확인한다
- [ ] 5.3 `platform/useBackHandler.ts`로 단일 `backEvent` 리스너를 등록·해제하고 화면별 규칙(design D5)을 적용한다 — 화면 상태·dirty 조합별로 `closeView` 또는 화면 전환이 호출되는지 `vi.mock` 단위 테스트로 확인한다
- [ ] 5.4 전역 스타일을 라이트 모드 전용으로 정리하고(`prefers-color-scheme: dark` 규칙 없음) 6개 근무 유형 색상 토큰을 정의한다 — `grep`으로 dark 규칙이 없는지 확인한다

## 6. 화면: 앱 상태와 초기 설정 (`shift-pattern-settings`, `settings-persistence`)

- [ ] 6.1 `App.tsx`에 화면 상태 머신(loading/setup-intro/settings(first|edit)/calendar/load-error)을 구현하고 시작 시 `load()` 결과로 분기한다 — Devtools 패널에서 Storage를 비움/정상값/손상값/`version: 2`로 바꿔 각각 초기 안내·달력·오류 안내가 표시되는지 확인한다
- [ ] 6.2 초기 안내 화면(일반 화면, [패턴 등록하기] CTA)과 load-error 화면([다시 설정])을 TDS로 구현하고, 진입 시 바텀시트가 뜨지 않으며 [다시 설정] 후 저장 전까지 Storage 값이 바뀌지 않는지 Devtools로 확인한다

## 7. 화면: 패턴 설정 (`shift-pattern-settings`)

- [ ] 7.1 `PatternEditor.tsx`에 6개 유형 추가 버튼(56개 도달 시 비활성·사유 표시)과 패턴 목록을 구현하고, 항목 탭 시 TDS 바텀시트로 유형 변경·삭제가 되는지 브라우저에서 확인한다
- [ ] 7.2 `TodayPositionPicker.tsx`로 오늘 위치 선택, 저장된 설정 기준 미리 선택, 길이 변경 시 `index mod length` 보정을 구현하고 보정 로직 단위 테스트와 브라우저 확인으로 검증한다
- [ ] 7.3 보조 수단 "날짜로 지정"(TDS 날짜 컴포넌트가 있으면 사용, 없으면 `<input type="date">`)을 구현하고 범위 밖·잘못된 날짜가 거부되는지 확인한다
- [ ] 7.4 draft 편집과 [저장]을 구현한다(빈 패턴·오늘 위치 없음 시 비활성·사유, 저장 성공 시 달력 복귀, 실패 시 draft 유지·오류 안내) — Devtools로 저장 성공/실패를 확인하고, 저장 전에는 달력이 바뀌지 않는지 확인한다
- [ ] 7.5 설정 화면에 앱 삭제 시 데이터 삭제·동기화 미지원 안내 문구를 추가하고 화면에 표시되는지 확인한다

## 8. 화면: 달력 (`shift-calendar`)

- [ ] 8.1 `Calendar.tsx`에 6×7 CSS Grid 달력, 요일 머리글, 칸별 날짜·약어·색상, 인접 월 흐림, 오늘 강조를 구현하고 2026년 10월 화면이 3.1 테스트의 격자와 일치하는지 확인한다
- [ ] 8.2 이전/다음 달·[오늘] 이동과 설정 진입 버튼을 구현하고 2026년 12월→2027년 1월 이동 시 근무가 표시되는지 확인한다
- [ ] 8.3 주 시작 요일 TDS 토글을 구현해 즉시 저장·재배치되게 하고, 새로고침 후에도 월요일 시작이 유지되는지 Devtools Storage 값과 함께 확인한다

## 9. 통합 검증 (토스 앱 실기기)

- [ ] 9.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`가 모두 통과하는지 확인한다
- [ ] 9.2 토스 앱(샌드박스) iOS·Android에서 핵심 시나리오(최초 실행 → 패턴 등록 → 오늘 위치 선택 → 저장 → 달력 확인 → 종료 후 재실행 복원)를 수행해 통과를 확인한다
- [ ] 9.3 실기기에서 뒤로가기 규칙(달력·초기 화면 종료, 설정→달력, dirty 폐기 확인·취소, Android 시스템 백버튼, iOS 스와이프)을 확인하고, iOS 스와이프가 `backEvent`를 거치지 않으면 `setIosSwipeGestureEnabled`로 비활성화한 뒤 재확인한다
- [ ] 9.4 실기기에서 다크 모드 기기의 라이트 표시, SafeArea 가림 없음, 핀치 줌 불가, 진입 시 바텀시트 없음, 월 이동·화면 전환 2초 이내, 자체 뒤로가기 버튼 없음, 날짜 직접 지정 입력 표시를 확인한다
- [ ] 9.5 `apps-in-toss.config.ts`의 `brand.primaryColor`를 확정 색상으로 바꾸고 `npm run build`로 배포 후보 `.ait` 산출물이 생성되는지 확인한다

## Workflow follow-up

- 콘솔에 앱 아이콘(600×600 PNG, 배경 있음)·부제·설명·문의 이메일·카테고리를 등록하고, 배포 직전 비게임 출시 가이드를 다시 확인한다.
- 리뷰 후 change를 아카이브한다(`/opsx:archive`).
