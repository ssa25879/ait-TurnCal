# Tasks

## 1. 요약 도메인 로직

- [x] 1.1 `src/domain/summary.ts`에 `buildDaySummary(date, pattern, day)`(근무 유형·바뀐 근무 여부·공휴일 이름 목록·시간 문자열)와 `buildTodaySummary(today, pattern, days)`(`[오늘, 내일]`, 내일이 `isValidDateString` 실패면 오늘만)를 구현한다. 근무 판정은 `getEffectiveShift`, 시간은 `sortEntries` 첫 항목의 `formatTimeRange`, 공휴일은 `getHolidays`를 재사용한다. 확인: `npm run typecheck` 통과.
- [x] 1.2 `src/domain/summary.test.ts`에 명세 시나리오를 단위 테스트로 작성한다: 패턴 근무, 기준일 이전 날짜, 월말·연말(`2026-12-31`→`2027-01-01`), 바뀐 근무(분류 세부 내용), 시간 표시(`15:00~23:00`, 다음 날 종료, 시작 시간 없는 항목은 시간 없음), 한글날·`개천절 대체공휴일`, 공휴일이 근무를 바꾸지 않음, 지원 범위 마지막 날(`2100-12-31`은 오늘만). 확인: `npm test`에서 새 테스트가 모두 통과하고 `npm run test:tz`(서울·뉴욕·UTC)에서도 통과한다.

## 2. 요약 화면

- [x] 2.1 `src/components/TodaySummary.tsx`를 만든다: 오늘·내일 카드를 `button`으로 그리고(라벨, `M월 D일 (요일)`, 근무 색·약어·이름, 바뀐 근무 표시, 공휴일 이름, 시간 줄), 누르면 `onSelectDate(date)`를 호출한다. 스크린 리더용 `aria-label`에 날짜·근무 이름·공휴일·바뀐 근무 여부를 넣는다. 날짜 표기(`M월 D일 (요일)`)는 `DayScreen`의 `formatDateTitle`을 재사용한다. 확인: `npm run typecheck` 통과, 컴포넌트가 `domain/summary.ts` 값만 그린다(근무 규칙 중복 없음).
- [x] 2.2 `src/style.css`에 카드 스타일을 추가한다: 카드 2개 같은 폭 한 줄 배치, 오늘 카드는 `--color-primary-weak` 배경, 근무 색은 기존 `shift-<TYPE>` 재사용, 글자 11px 이상·누름 영역 44px 이상, 토스 브랜드 색·`Toss Product Sans`·다크 모드 규칙 없음. 확인: 개발 서버에서 360×640 뷰포트로 열어 가로 스크롤·겹침이 없고 카드가 잘리지 않는다(스크린샷으로 확인).
- [x] 2.3 `CalendarScreen`의 알림 문구 아래, `month-nav` 위에 `TodaySummary`를 넣고 `pattern`·`days`·`today`·`onSelectDate`를 전달한다. 광고·설정 버튼·격자는 건드리지 않는다. 확인: 개발 서버에서 요약 → 월 이동줄 → 격자 → 설정 → 광고 순서로 보이고, 다른 달로 이동해도 요약은 그대로이며, 카드를 눌러 날짜 화면이 열리고 뒤로가기로 보던 달에 돌아온다.

## 3. 브라우저 E2E

- [x] 3.1 `scripts/e2e/today-summary.mjs`를 추가한다(`scripts/e2e/README.md` 방식, 시계는 `2026-10-13T10:00+09:00`로 고정): 오늘·내일 카드 텍스트와 색 클래스, 다른 달 이동 후에도 유지, 바뀐 근무·시간 표시, 공휴일 이름(오늘 `2026-10-09` → "한글날", 오늘 `2026-10-04` → 내일 "개천절 대체공휴일"), 카드 → 날짜 화면 → 뒤로가기 시 달 유지, 자정 후 `visibilitychange`로 갱신, 360px 가로 스크롤 없음, 광고 없음(`forceNoFill`)에서도 정상. 확인: 스크립트 실행 결과가 전부 통과.
- [x] 3.2 기존 E2E 5종(`mvp-regression`, `display-settings`, `day-entries`, `banner`, `user-key`)을 다시 실행해 달력 위치·광고 간격(32px 이상)·뒤로가기 가정이 깨지지 않았는지 확인하고, 깨진 선택자·좌표가 있으면 새 레이아웃에 맞게 고친다. 확인: 5종 모두 통과, `banner.mjs`의 `[설정] 버튼 아래 32px 이상 간격` 통과.

## 4. 문서·명세 반영

- [x] 4.1 `README.md` "주요 기능"에 오늘·내일 근무 요약을 추가하고, `scripts/e2e/README.md`에 `today-summary.mjs` 실행 줄과 검증 개수를 추가한다. 확인: 문서 안의 명령을 그대로 실행해 동작한다.
- [x] 4.2 `docs/NEXT_STEPS.md`의 상태 표(테스트 개수, 진행 중 change, 출시 후보)와 "2. 알려진 개선 후보"의 "오늘/내일 근무 요약" 항목을 현재 상태로 고친다. 확인: 문서의 테스트 개수가 실제 `npm test`·E2E 출력과 일치한다.

## 5. 통합 확인과 출시 전 점검

- [x] 5.1 `npm run typecheck`, `npm test`, `npm run test:tz`, E2E 6종(기존 5 + 신규 1)을 모두 실행한다. 확인: 전부 통과, 실패는 0.
- [x] 5.2 `npm run build:adtest`로 번들을 만들어 `/ait:test-on-device`로 업로드·테스트 푸시(실제 광고 ID 사용 금지)하고, 실기기에서 오늘·내일 카드, 바뀐 근무·시간, 공휴일, 카드 탭 이동, 360px급 폭에서 겹침 없음, 광고 간격을 확인한다. 확인: 사용자 확인 결과를 기록한다.
- [x] 5.3 출시 가이드 대조표(비게임 출시 가이드 원문을 새로 받아)를 다시 만들어 통과/해당 없음/확인 필요를 정리한다. 확인: 확인 필요가 남지 않았는지 보고하고, 남으면 검토 신청을 하지 않는다. 검토 신청은 사용자가 요청할 때만 한다.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive add-today-tomorrow-summary`(명세 동기화: `today-summary` 신규).
- `feat/add-today-tomorrow-summary`를 `main`에 `--no-ff`로 병합하고 푸시한다.
- 출시용 번들(실제 광고 ID)은 `.env.production.local`로 빌드해 업로드하고 업데이트 검토는 사용자가 요청할 때 진행한다.
