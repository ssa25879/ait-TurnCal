# Tasks

## 1. 이력 도메인 로직

- [x] 1.1 `src/domain/patternHistory.ts`에 타입(`PastPattern { until, pattern }`, `PatternTimeline { current, history }`)과 `resolvePattern(date, timeline)`, `isSameSchedule(a, b)`를 구현한다. 확인: `npm run typecheck` 통과.
- [x] 1.2 같은 파일에 `applyPatternChange(timeline | null, next, scope, today)`(첫 등록·전체 기간·오늘부터, 변경 없음, 같은 날 재저장, `until > today` 정리, 50개 상한)를 구현한다. 확인: 타입체크 통과.
- [x] 1.3 `describeTimeline(timeline)`(최신순 행: 적용 기간 문구용 날짜, 근무 순서)을 구현하고 `src/domain/patternHistory.test.ts`에 명세 시나리오를 단위 테스트로 작성한다(이력 없음, 패턴 A→B 경계 `2026-10-12`/`13`, 오늘부터·전체 기간, 변경 없음, 같은 날 두 번 저장, 기기 날짜 과거, 50개 초과, 위상만 다른 같은 일정, 연말 경계). 확인: `npm test`와 `npm run test:tz`(서울·뉴욕·UTC) 통과.

## 2. 저장·초기화

- [x] 2.1 `src/storage/scheduleStorage.ts`의 `StoredSettingsV3`에 선택 필드 `patternHistory`를 추가하고, v3 읽기에서 검증(항목 패턴·`until` 유효, 엄격 증가, 50개 이하, 현재 패턴 있음)하며 쓰기에서는 이력이 비면 필드를 생략한다. `version`은 3 유지, v1·v2 변환 경로는 변경 없음. `scheduleStorage.test.ts`에 필드 없는 기존 v3, 이력 있는 저장·복원, 각 손상 케이스(순서 오류·항목 값 오류·패턴 없이 이력·51개)를 추가한다. 확인: `npm test` 통과, 기존 저장소 테스트 무변경 통과.
- [x] 2.2 `src/storage/reset.ts`의 `resetPattern`이 `patternHistory`도 지우도록 하고 `reset.test.ts`에 이력 삭제 케이스를 추가한다. 확인: `npm test` 통과.

## 3. 화면 연결 (판정 지점 통일)

- [x] 3.1 `App.tsx`가 설정에서 `PatternTimeline`을 만들어 `Calendar`·`CalendarScreen`·`DayScreen`·`TodaySummary`에 `pattern` 대신 전달하고, 각 호출 지점이 `getEffectiveShift(date, resolvePattern(date, timeline), day)`를 쓰게 한다. `domain/summary.ts`의 `buildDaySummary`·`buildTodaySummary` 입력을 timeline으로 바꾸고 `summary.test.ts`를 갱신하며 이력이 있는 경우(과거는 이전 패턴, 오늘/내일은 새 패턴) 테스트를 추가한다. 확인: 타입체크·`npm test`·`test:tz` 통과, 이력이 없는 설정의 화면 동작이 이전과 같다(기존 E2E `mvp-regression`·`day-entries`·`banner` 재실행 통과).
- [x] 3.2 `App.savePattern(next, scope)`가 `applyPatternChange`로 새 timeline을 만들어 `pattern`·`patternHistory`를 한 번에 저장하고 실패 시 예외를 그대로 전달한다. 확인: 개발 서버에서 패턴 저장 후 달력 근무와 `localStorage`의 `turncal.settings`가 기대한 `pattern`/`patternHistory`와 같다.

## 4. 설정 화면

- [x] 4.1 `SettingsScreen.tsx`에 적용 범위 라디오(`role="radiogroup"`: "오늘부터 적용(지난 날짜는 이전 패턴 유지)" 기본, "전체 기간에 적용(지난 날짜도 새 패턴으로 계산)")를 저장된 패턴이 있고 편집 내용이 다를 때만 표시하고 `onSave(pattern, scope)`로 전달한다. 바텀시트·다이얼로그를 쓰지 않는다. 확인: 개발 서버에서 첫 등록에는 선택이 없고, 변경 시 기본값이 오늘부터이며 변경을 되돌리면 선택이 사라진다(스크린샷 확인).
- [x] 4.2 읽기 전용 `PatternHistoryList` 컴포넌트를 만들어 설정 화면 하단(날짜 지정 아래)에 표시한다: 현재 패턴 + 이전 패턴 최신순, 적용 기간 문구, `.shift-<TYPE>` 색 칩+약어, 이력이 없으면 안내 문구, 첫 등록 화면에는 숨김. `style.css`에 스타일(글자 11px 이상, 토스 브랜드 색·다크 모드 없음)을 추가한다. 확인: 360×640에서 가로 스크롤·겹침 없음, 56칸 패턴도 줄바꿈으로 잘림 없음(스크린샷), 항목을 눌러도 아무 UI도 열리지 않는다.

## 5. 브라우저 E2E

- [x] 5.1 `scripts/e2e/pattern-history.mjs`를 추가한다(시계 `2026-10-13T10:00+09:00` 고정): 이력 없는 기존 v3 데이터 복원, 변경 시 적용 범위 선택과 기본값, 오늘부터 적용 후 `2026-10-10`(이전 패턴)·`10-13`(새 패턴)·요약 카드·날짜 화면 일치, 전체 기간 적용 후 이력 비움, 변경 없이 저장 시 이력 불변, 같은 날 재저장, 이력 목록 표시와 읽기 전용, 패턴 초기화 후 이력 삭제·적용 범위 없음, 이력 있는 저장 데이터를 이전 형태로 읽어도 오류 없음, 360px 가로 스크롤 없음, 저장 실패 시 편집·선택 유지. 확인: 스크립트 전부 통과.
- [x] 5.2 기존 E2E 5종 + `today-summary`를 다시 실행해 저장 흐름(적용 범위 기본값)과 달력·설정 화면 가정이 깨지지 않았는지 확인하고, 깨진 선택자·기대값을 새 동작에 맞게 고친다. 확인: 6종 모두 통과.

## 6. 문서·통합 확인

- [x] 6.1 `README.md` 주요 기능, `scripts/e2e/README.md`(실행 줄·개수), `docs/NEXT_STEPS.md`(상태 표·개선 후보의 패턴 변경 이력 항목·테스트 개수)를 현재 상태로 고친다. 확인: 문서의 테스트 개수가 실제 `npm test`·E2E 출력과 일치한다.
- [x] 6.2 `npm run typecheck`, `npm test`, `npm run test:tz`, E2E 7종을 모두 실행한다. 확인: 전부 통과, 실패 0.
- [ ] 6.3 `npm run build:adtest`로 번들을 만들어 `/ait:test-on-device`로 업로드·테스트 푸시(실제 광고 ID 금지)하고, 실기기에서 패턴 변경 → 적용 범위 선택 → 지난 날짜 유지, 전체 기간 적용, 이력 목록, 패턴 초기화, 기존 데이터 유지(앱 재진입)를 확인한다. 확인: 사용자 확인 결과를 기록한다.
- [ ] 6.4 비게임 출시 가이드 원문을 새로 받아 대조표를 갱신한다(새 오버레이·외부 이동·권한·네트워크 없음 확인). 확인: 확인 필요 항목을 보고하고 검토 신청은 사용자가 요청할 때만 한다.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive add-pattern-history`(명세 동기화: `pattern-history` 신규, `shift-pattern-settings`·`settings-persistence`·`settings-reset` 수정).
- `feat/add-pattern-history`를 `main`에 `--no-ff`로 병합하고 푸시한다.
- 이번 업데이트는 다른 업데이트와 함께 한 번에 출시한다(사용자 계획). 출시 빌드는 `.env.production.local`로 만들고 업데이트 검토는 사용자가 요청할 때 진행한다.
