# Tasks

## 1. 공휴일 도메인 (`calendar-holidays`)

- [ ] 1.1 `src/domain/holidays.ts`에 음력 공휴일 표(2026~2035, 천문연 조회값)·선거일 표·제2조 고정 공휴일·제3조 대체공휴일 계산·`getHolidays(date)`(범위 밖은 빈 배열, 연도별 메모)를 구현하고 근거·갱신 방법을 머리 주석에 적는다 — `holidays.test.ts`로 2027년 대체공휴일 7일과 공휴일 72일, 2026년 대체공휴일 4일·지방선거일·추석 3일, 2025-05-05형 평일 중복(가상 연도 대신 규칙 함수 직접 호출), 2030-06-12 선거일, 범위 밖 빈 배열, 모든 `short`가 3자 이하임을 확인한다
- [ ] 1.2 `calendar.ts`의 요일 계산을 `weekdayOf(date)`로 내보내고 `DayScreen`의 중복 계산을 이것으로 바꾼다 — 기존 `calendar.test.ts`·`npm test` 통과와 `weekdayOf` 테스트 추가로 확인한다

## 2. 달력·날짜 화면 표시 (`calendar-holidays`)

- [ ] 2.1 `Calendar` 칸에 날짜 숫자 색 클래스(`is-sunday`/`is-saturday`/`is-holiday`)와 공휴일 축약 이름 줄(모든 칸 확보, 11px, 말줄임)을 넣고 접근성 이름에 공휴일 전체 이름을 더한다. 칸 높이는 86px로 — 브라우저에서 2026년 9·10월, 2027년 2월 칸 표시와 행 높이 일정을 확인한다
- [ ] 2.2 `DayScreen` 제목 아래에 공휴일 전체 이름(여럿이면 모두)을 표시한다 — 브라우저에서 `2026-09-25`, `2027-08-16`, 평일 날짜 화면을 확인한다

## 3. 초기화 위치 변경 (`settings-reset`, `display-settings`)

- [ ] 3.1 확인 다이얼로그·실행 중 비활성·실패 안내를 담은 `ResetAction` 컴포넌트를 만들고 `ResetScreen`을 전체 초기화만 남도록 바꾼다 — 브라우저에서 초기화 화면에 버튼 하나, 취소·뒤로가기 시 무변경을 확인한다
- [ ] 3.2 `SettingsScreen` 아래에 근무 패턴 초기화를 두되 저장된 패턴이 있는 편집 흐름에서만 보이게 하고, `DisplaySettingsScreen` 아래에 화면 설정 초기화를 둔다. `App.runReset`은 화면 설정 초기화 후 화면 설정에 머물고 실패 시 이전 값을 유지한다. `SettingsMenu` 초기화 요약 문구를 "전체 데이터 지우기"로 바꾼다 — 브라우저에서 각 버튼의 결과, 최초 등록 화면에 버튼 없음, 편집 중 초기화를 확인한다

## 4. 통합 검증

- [ ] 4.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`가 모두 통과하고 공휴일 모듈 추가에 따른 번들 크기 증가를 기록한다
- [ ] 4.2 `scripts/e2e/day-entries.mjs`의 초기화 경로를 새 위치로 고치고 주말·공휴일 표시(숫자 색·축약 이름·날짜 화면 이름·접근성 이름) 검사를 추가해 E2E 4종을 모두 실행한다 — 전부 통과를 확인한다
- [ ] 4.3 세 테마로 390×844·360×640 달력(공휴일·세부 내용이 같은 주), 날짜 화면, 근무 패턴 설정·화면 설정·초기화 화면 스크린샷을 찍어 글자 겹침·격자 높이·배너 위치와 토스 브랜드 색·서체가 없는지 확인한다

## Workflow follow-up

- 실기기 테스트 번들(`npm run build:adtest`)로 주말·공휴일·초기화 버튼을 확인한 뒤 v1 출시 후보 단계(`docs/NEXT_STEPS.md` 1-3)로 넘어간다.
- `/opsx:archive improve-calendar-weekends-and-resets`.
