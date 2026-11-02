# Design

## Context

- 달력 화면은 `CalendarScreen`이 `TodaySummary` → 월 이동줄(`month-nav`: 이전/제목/다음/[오늘]) → `Calendar` → 하단 조작(`bottom-action`) → `CalendarBanner` 순으로 조립한다. 일별 근무는 `Calendar`와 `buildDaySummary`가 모두 `getEffectiveShift(date, resolvePattern(date, timeline), day)`로 계산한다.
- 광고는 `src/ads/`(`tossAds`의 `useInitAds`를 `App.tsx`가 호출, `CalendarBanner`는 `CalendarScreen`에서만 사용)와 `src/style.css`의 `.calendar-banner*`, `vite-env.d.ts`의 `VITE_TOSS_BANNER_AD_GROUP_ID`, `package.json`의 `build:adtest`, `.env.adtest`, E2E 3개 파일에 퍼져 있다. 코드 밖에서는 `.env.production.local`(커밋 제외)에 실제 광고 그룹 ID가 있다.
- 월 이동 상태는 `App`이 `month: YearMonth`로 들고 `onMonthChange`로 내려 준다. 지원 날짜 범위는 `MIN_YEAR=1970`~`MAX_YEAR=2100`(`domain/date.ts`).
- 바텀시트는 TDS `BottomSheet` + `useCloseOnBack`(뒤로가기로 시트만 닫기) 패턴을 `ExportSheet`가 이미 쓴다. TDS `WheelDateSheet`는 연·월·일 휠이라 월만 고르는 용도에는 맞지 않는다.

## Goals / Non-Goals

**Goals:**
- 광고 관련 코드·설정·테스트를 남김없이 걷어내되 SDK 다른 기능과 달력 동작은 그대로 둔다.
- 통계와 월 선택은 순수 계산/UI 추가만 하며 저장 구조(`turncal.settings` v3, 날짜 항목)를 바꾸지 않는다.

**Non-Goals:**
- 광고 SDK 패키지(`@apps-in-toss/web-framework`) 제거, 콘솔 광고 그룹 정리, `.env.production.local` 수정.
- 통계의 기간 선택(주/연), 근무 시간 합산, 내보내기 파일에 통계 포함.
- 사용 분석 이벤트 추가(기존 3종 유지).

## Decisions

1. **광고는 파일째 삭제하고 `App`의 `useInitAds` 호출도 제거한다.** 숨김 플래그나 빈 컴포넌트로 남기면 죽은 코드가 남는다. 광고 전용 단위 테스트(`adConfig`/`bannerState`/`tossAds`)와 `banner.mjs`는 함께 삭제하고, 다른 E2E(`navbar-settings.mjs`, `today-summary.mjs`)의 배너 위치·간격 단언은 지우되 나머지 검사는 유지한다. 대안(배너만 숨김)은 죽은 코드와 광고 ID 환경변수가 남아 기각.
2. **통계는 순수 함수 `buildMonthStats(month, timeline, days)`로 `src/domain/monthStats.ts`에 둔다.** 그 달 1일~말일을 순회하며 `getEffectiveShift`를 호출하고 `shift`가 있는 날만 유형별로 센다(`null`이면 제외). 반환은 `{ counts: Record<ShiftType, number>, decided: number }`이고 `decided === 0`이면 UI가 요약을 숨긴다. 달력 칸과 같은 함수를 재사용해 판정 불일치를 막는다. 달 말일은 기존 `date`/`calendar` 유틸로 구한다(윤년 포함). 대안(`Calendar`에서 셀을 세기)은 앞뒤 달 칸 제외 처리가 섞여 테스트가 어려워 기각.
3. **통계 UI는 `MonthStats` 컴포넌트**로, 6개 유형을 고정 순서(`SHIFT_TYPES`)의 3열×2행 격자로 보여 준다. 각 항목은 근무 색 칩(약어) + 이름 + `N일`이며 이름·약어는 `useShiftLabels()`를 따른다(`ShiftLabelsContext`). 색은 기존 `.shift-*` 클래스를 재사용해 색만으로 구별하지 않게 한다. 위치는 `Calendar` 바로 아래, `bottom-action` 위. 폭 360px에서 3열이 좁으면 2열로 줄바꿈하는 CSS를 쓴다(글자 11px 이상 유지).
4. **월 선택은 `MonthPickerSheet`(TDS `BottomSheet` + `useCloseOnBack`)로 만든다.** 연도 영역은 [이전 해]·"YYYY년"·[다음 해]이고 1970 이하/2100 이상에서 해당 버튼을 비활성화하며, 아래에 1~12월 버튼 12개(4열×3행)를 둔다. 열릴 때 시트 안 연도는 보고 있는 연도로 초기화하고, 보고 있는 달은 `aria-pressed`로 표시한다. 월 버튼을 누르면 `onMonthChange({year, month})` 후 시트를 닫는다. 대안(`WheelDateSheet` 사용)은 일 휠이 불필요하고 일 선택 후 월로 변환하는 어색함이 있어 기각.
5. **월 제목을 `<button>`으로 바꾸고 아래 화살표(▾) 아이콘을 붙인다.** `h1.month-title`은 유지하되 안에 버튼을 넣어 제목 의미를 보존하고, `aria-label="연월 선택"`, 최소 44px 터치 영역, 포커스 스타일을 둔다. 월 제목이 길어져도 이전/다음/[오늘] 배치가 360px에서 깨지지 않는지 E2E로 확인한다.
6. **저장·분석은 건드리지 않는다.** 두 기능 모두 상태는 화면 로컬(시트 열림, 시트 안 연도)과 기존 `month` 상태뿐이다.

## Risks / Trade-offs

- [광고 제거 후 `useInitAds`/E2E 잔여 참조로 빌드·E2E 실패] → `tsc --noEmit`과 `grep -ri "banner\|adtest\|tossAds"`로 잔여 참조를 확인하고, 단위/E2E 전체를 다시 돌린다.
- [롤백하면 광고가 되살아남] → 롤백 대상은 v1.4 `20261027-33`이며, 롤백해도 데이터·저장 구조는 같아 호환된다.
- [월 제목이 버튼이 되며 스크린 리더/테스트 선택자(`.month-title` 텍스트) 변화] → `h1` 텍스트는 그대로 두고 기존 E2E의 제목 검사 선택자를 확인·필요 시 갱신한다.
- [통계가 사용자에게 필요 없는 정보로 화면을 길게 만듦] → 통계는 6칸 2행의 낮은 높이로 제한하고 달력/조작 요소보다 아래에 둔다. 불필요하면 후속으로 접기를 추가할 수 있다(이번 범위 아님).
- [출시가 필요한 변경] → 사용자가 요청할 때만 검토 신청한다(출시 절차는 `docs/NEXT_STEPS.md`의 수정 배포 규칙).

## Migration Plan

1. 구현·단위/E2E 통과 → 테스트 번들(`build`; 광고 없음) 실기기 확인.
2. 출시용 번들 업로드 → 가이드 원문 대조 → 사용자 요청 시 검토 신청 → 승인 뒤 콘솔 웹 '출시하기'.
3. 출시 뒤 사용자가 콘솔 광고 그룹을 정리한다. 롤백: v1.4 `20261027-33`.
