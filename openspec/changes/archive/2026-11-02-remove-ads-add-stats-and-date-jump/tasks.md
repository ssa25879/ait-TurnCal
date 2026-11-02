# Tasks

## 1. 광고 제거

- [x] 1.1 `src/ads/` 전체(`CalendarBanner`, `tossAds`, `bannerState`, `adConfig`와 각 테스트)를 삭제하고 `App.tsx`의 `useInitAds` 호출·import, `CalendarScreen.tsx`의 `CalendarBanner` 렌더링·import를 제거한다. 검증: `npm run typecheck` 통과, `src/`에 `ads/`·`CalendarBanner`·`useInitAds` 참조가 없음(`Grep`).
- [x] 1.2 `src/style.css`의 `.calendar-banner*` 규칙과 `src/vite-env.d.ts`의 `VITE_TOSS_BANNER_AD_GROUP_ID` 선언, `package.json`의 `build:adtest` 스크립트, `.env.adtest`를 삭제한다. `.env.production.local`은 수정하지 않는다. 검증: `Grep`으로 `banner|adtest|AD_GROUP|tossAds`(대소문자 무시)가 `src/`·`package.json`·`vite.config.ts`에 남지 않음, `npm run build` 성공.
- [x] 1.3 E2E를 정리한다: `scripts/e2e/banner.mjs` 삭제, `navbar-settings.mjs`·`today-summary.mjs`의 `.calendar-banner` 단언 제거(나머지 검사 유지, 검사 개수 갱신), `scripts/e2e/README.md`·`README.md`의 광고·`build:adtest` 안내 삭제. 검증: 두 E2E가 새 개수로 모두 통과, 문서에 광고 안내가 없음.
- [x] 1.4 단위 테스트가 광고 삭제 뒤에도 통과하는지 확인한다. 검증: `npm test`와 `npm run test:tz`(서울·뉴욕·UTC) 통과.

## 2. 월간 통계

- [x] 2.1 `src/domain/monthStats.ts`에 `buildMonthStats(month, timeline, days)`를 구현한다(달력 칸과 같은 `getEffectiveShift` 재사용, 보고 있는 달만 집계, 근무를 정할 수 없는 날 제외, 정해진 날 수 `decided` 반환). 테스트 `monthStats.test.ts`를 먼저 작성한다: 31/30/28/29일 달 합계, 앞뒤 달 칸 제외, 세부 내용으로 바뀐 근무, 패턴 이력 경계, 패턴 기준일 이전, 패턴 없음(`decided` 0), 일부만 정해진 달. 검증: 해당 테스트 통과, `test:tz` 3개 시간대 통과.
- [x] 2.2 `src/components/MonthStats.tsx`를 만들고 `CalendarScreen`의 `Calendar` 아래·`bottom-action` 위에 연결한다. 6종 고정 순서, 근무 색 칩+약어+이름+`N일`, 0일도 표시, 사용자 정의 이름·약어 반영, `decided === 0`이면 렌더링하지 않음. `style.css`에 3열(좁으면 2열) 스타일을 추가하고 글자 11px 이상을 지킨다. 검증: 개발 서버에서 한 달 합계가 달력 칸 개수와 일치함을 확인.
- [x] 2.3 E2E `scripts/e2e/month-stats.mjs`를 추가한다: 합계=그달 일수, 달 이동 시 값 변경, 세부 내용으로 근무를 바꾸면 값 변경, 근무 유형 이름 변경 반영, 패턴 없음에서 요약 숨김, 360px 가로 스크롤·겹침 없음, 글자 11px 이상, 기존 요소(날짜 칸·월 이동·내보내기) 동작 유지. `scripts/e2e/README.md`에 실행 줄을 추가한다. 검증: 새 E2E 전부 통과, `visual-audit.mjs`(6주 격자가 첫 화면 안, 글자·터치 영역)가 통과하거나 통계 추가로 달라진 기준이 있으면 그 사유를 기록.

## 3. 연·월 직접 이동

- [x] 3.1 `src/components/MonthPickerSheet.tsx`를 만든다(TDS `BottomSheet` + `useCloseOnBack`, 연도 이전/다음 버튼과 1~12월 버튼, 열릴 때 보고 있는 연·월 선택 상태, 1970~2100 범위에서 연도 버튼 비활성화, 월 선택 시 `onMonthChange` 후 닫기). 범위 보정 로직을 순수 함수로 분리하면 `monthPicker.test.ts`로 경계(1970, 2100, 연말 이동)를 검증한다. 검증: 단위 테스트 통과.
- [x] 3.2 `CalendarScreen`의 월 제목을 시트를 여는 버튼으로 바꾼다(`h1.month-title` 유지, 안에 `aria-label="연월 선택"` 버튼과 ▾ 아이콘, 터치 영역 44px 이상, 포커스 스타일). 기존 E2E가 `.month-title`의 `textContent === "YYYY년 M월"`을 검사하므로 아이콘은 텍스트를 포함하지 않아야 한다. 검증: `mvp-regression.mjs`의 월 이동 검사 통과.
- [x] 3.3 E2E `scripts/e2e/month-jump.mjs`를 추가한다: 시트 열림 시 현재 연·월 선택, 연도 변경 후 월 선택으로 이동(근무 계산 확인), 1970/2100 경계에서 버튼 비활성화, 뒤로가기로 시트만 닫히고 보던 달 유지, 이전/다음/[오늘]과 같이 써도 정상, 360px에서 월 이동줄이 겹치거나 넘치지 않음. README에 실행 줄을 추가한다. 검증: 새 E2E 전부 통과.

## 4. 통합 검증과 출시 준비

- [x] 4.1 전체 검사를 실행한다: `npm run typecheck`, `npm run test:tz`, 기존·신규 E2E 전체(`mvp-regression`, `display-settings`, `day-entries`, `user-key`, `today-summary`, `pattern-history`, `empty-calendar`, `calendar-shortcuts`, `visual-audit`, `navbar-settings`, `shift-labels`, `month-export`, `calendar-reminder`, `usage-analytics`, `month-stats`, `month-jump`). 검증: 전부 통과, 실패 시 원인을 기록. 정적 검사는 Android/iOS 실기기 렌더링을 대신하지 않음을 결과에 명시.
- [x] 4.2 광고 없는 번들(`npm run build`)을 만들고 산출물에 광고 그룹 ID·테스트 광고 ID·Devtools 표식·소스맵이 없는지 확인한다. 테스트 번들을 올려 테스트 푸시한다. 검증: 산출물 검색 결과, `bundle_upload_complete` 후 `CREATED`.
- [x] 4.3 사용자 실기기 확인: 광고 배너가 사라지고 하단이 조작 요소에서 끝남, 통계 값이 달력과 일치, 월 제목으로 연·월 이동과 뒤로가기, 기존 기능(내보내기·설정·내비 바 버튼) 정상. 검증: 사용자 확인 기록.
- [x] 4.4 비게임 출시 가이드 원문(docs MCP `getPage`)을 다시 대조하고 `docs/NEXT_STEPS.md`에 변경 내용·가이드 대조·롤백 대상(v1.4 `20261027-33`)·콘솔 광고 그룹 정리 안내를 기록한다. 검증: 문서 diff 확인. 검토 신청은 사용자가 요청할 때만 한다.

## Workflow follow-up

- 사용자 실기기 확인 후 `/opsx:archive`로 아카이브하고 `openspec/specs/`에 반영(광고 명세 제거, `month-stats` 추가)한다.
- 출시 번들 업로드·검토 신청·콘솔 '출시하기'는 사용자가 요청할 때 진행한다. 출시 뒤 콘솔 광고 그룹 `ait.v2.live.319dbf4b189e4745`와 로컬 `.env.production.local`의 광고 ID는 사용자가 정리한다.
