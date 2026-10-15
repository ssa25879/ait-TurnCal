# Tasks

## 1. 패턴 없음 도메인

- [x] 1.1 `patternHistory.ts`의 `PatternTimeline.current`를 `WorkPattern | null`로 넓히고 `resolvePattern`이 패턴 없음(null)을 돌려주게 한다(이력 종료일 이후·이력 없음). `applyPatternChange`·`describeTimeline`의 null 처리(현재 패턴 행 생략 또는 "패턴 없음")를 정의한다. 확인: `npm run typecheck` 통과.
- [x] 1.2 `dayEntries.ts`의 `getEffectiveShift`가 `pattern | null`을 받아 `{ shift: ShiftType | null, overridden }`을 돌려주게 하고(세부 내용 분류가 있으면 패턴 없음이어도 그 근무), `summary.ts`의 `DaySummary.shift`를 null 허용으로 바꾼다. `patternHistory.test.ts`·`dayEntries.test.ts`·`summary.test.ts`에 명세 시나리오(이력 없음·패턴 없음, 종료일 경계, 다시 등록, 바뀐 근무 유지, 요약 "패턴 없음")를 추가한다. 확인: `npm test`·`npm run test:tz` 통과(기존 테스트 무변경 통과).

## 2. 화면 분기

- [x] 2.1 `App.tsx`의 시작 뷰·렌더링 가드·`hasSavedSettings`(`useBackHandler`)를 `pattern` 대신 `settings` 존재 기준으로 바꾸고, `runResetPattern`이 달력으로 이동하게 한다. 첫 실행(저장값 없음)과 오류 화면은 그대로 둔다. 확인: 개발 서버에서 패턴 초기화 → 달력 표시, 설정 목록·이름·화면 설정 접근, 근무 패턴 설정에서 뒤로가기 → 설정 목록 → 달력 → 종료.
- [x] 2.2 `useBackHandler.test`가 있으면 갱신하고 없으면 `decideBackAction` 단위 테스트를 추가해 패턴 없는 설정(`hasSavedSettings: true`)의 계층 동작과 첫 실행(`false`)의 종료를 검증한다. 확인: `npm test` 통과.

## 3. 빈 달력 화면

- [x] 3.1 `Calendar`·`DayScreen`·`TodaySummary`가 null 근무를 그린다: 칸은 근무 배지 없이 날짜(·공휴일)만, 날짜 화면 근무 줄은 "근무 패턴이 없어요"(패턴 근무 비교 줄 생략), 요약 카드는 "근무 패턴 없음". 접근성 이름(`aria-label`)에 반영한다. 확인: 개발 서버에서 360px에 겹침·가로 스크롤 없음(스크린샷), 세부 내용 분류가 있는 날은 근무 배지가 보인다.
- [x] 3.2 `CalendarScreen`에 패턴이 없을 때만 보이는 안내 카드("근무 패턴이 없어요" + [근무 패턴 등록하기])를 추가하고 `SettingsMenu`의 근무 패턴 항목에 패턴 없음 보조 문구를 넣는다. 버튼은 근무 패턴 설정(첫 등록) 화면으로 이동한다. `style.css`에 스타일(글자 11px 이상, 토스 브랜드 색·다크 모드 없음)을 추가한다. 확인: 등록하기 → 저장 후 달력에 새 패턴 근무 표시, 이력이 있으면 마지막 이력 이후 날짜에만 적용.

## 4. 브라우저 E2E·문서

- [x] 4.1 패턴 초기화 뒤 등록 안내를 가정한 기존 E2E(`pattern-history.mjs`의 초기화 시나리오, `mvp-regression.mjs`·`day-entries.mjs` 등)를 새 동작(빈 달력)에 맞게 고치고, `empty-calendar` 시나리오(이력 없음/있음 달력 표시, 안내 카드·등록하기, 날짜 화면·요약 문구, 설정 접근·뒤로가기 계층, 앱 종료, 첫 실행 불변, 360px)를 추가한다. 확인: E2E 전 종 통과.
- [x] 4.2 `README.md`·`scripts/e2e/README.md`·`docs/NEXT_STEPS.md`(상태 표·테스트 개수·00절)를 갱신한다. 확인: 문서의 테스트 개수가 실제 출력과 일치한다.
- [x] 4.3 `npm run typecheck`·`npm test`·`npm run test:tz`·E2E 전 종을 실행하고, `build:adtest` 번들을 실기기에서 확인한 뒤(사용자 확인 결과를 기록) 출시 가이드 대조표를 갱신한다(새 오버레이·외부 이동·권한 없음, 최초 화면 뒤로가기 종료 유지). 확인: 모두 통과·확인 필요 항목 보고.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive show-empty-calendar-after-reset`(명세 동기화: `shift-calendar`·`today-summary`·`pattern-history` 추가, `miniapp-shell`·`settings-reset` 수정).
- `feat/show-empty-calendar-after-reset`를 `main`에 `--no-ff`로 병합·푸시한다.
- 이번 업데이트도 다른 업데이트와 함께 한 번에 출시한다(사용자 계획).
