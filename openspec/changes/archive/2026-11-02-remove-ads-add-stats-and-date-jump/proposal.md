# Proposal

## Why

배너 광고는 DAU가 2명 안팎이고 누적 노출 32회, 수익 0원이라 수익원 역할을 못 하면서 SDK 호출·환경변수·빌드 스크립트·E2E 유지 비용만 만든다. 광고 그룹도 노출이 없으면 11월 중순 삭제 예정이 된다. 광고를 걷어내는 출시를 한 번 하는 김에, 근무 달력의 쓸모를 높이는 작은 기능 두 가지(월간 통계, 연·월 직접 이동)를 함께 넣는다.

## What Changes

- **광고 제거(BREAKING: 광고 기능 전체 삭제)**
  - 달력 하단 배너와 `src/ads/` 전체(`CalendarBanner`, `tossAds`, `bannerState`, `adConfig`와 테스트), 배너 CSS, `VITE_TOSS_BANNER_AD_GROUP_ID` 타입 선언을 삭제한다.
  - `build:adtest` 스크립트와 `.env.adtest`를 삭제한다. 광고용 E2E(`banner.mjs`)를 삭제하고, 배너 위치를 검사하던 다른 E2E의 단언을 정리한다.
  - README·E2E README의 광고 안내를 지운다.
  - 광고 SDK 자체(`@apps-in-toss/web-framework`)는 내비 바·분석·공유 등에 계속 쓰므로 의존성에서 빼지 않는다.
  - 콘솔의 광고 그룹은 건드리지 않는다. 출시 뒤 사용자가 정리한다. `.env.production.local`(커밋 제외, 로컬 파일)의 광고 ID 줄도 이번 변경에서 수정하지 않는다.
- **월간 통계 추가**: 달력 격자 아래(하단 조작 요소 위)에 보고 있는 달의 근무 유형별 일수(주간·오후·야간·당직·비번·휴무)를 표시한다. 달력 칸과 같은 판정(그날 적용 패턴 + 세부 내용으로 바뀐 근무)을 쓰며, 저장 데이터는 바꾸지 않는다.
- **연·월 직접 이동 추가**: 월 제목(`2026년 10월`)을 누르면 연·월을 골라 바로 이동하는 선택 창을 연다. 기존 이전·다음 달 화살표와 [오늘] 버튼은 그대로 둔다.
- 저장 구조(`turncal.settings` version 3, 날짜 항목)와 사용 분석 이벤트 이름은 바꾸지 않는다.

## Capabilities

### New Capabilities
- `month-stats`: 보고 있는 달의 근무 유형별 일수 요약. 판정 규칙, 패턴 없음·이력 경계 처리, 표시 위치를 다룬다.

### Modified Capabilities
- `in-app-ads`: 모든 요구사항을 제거한다(배너 위치·숨김·생명주기·광고 ID 규칙 등). 이후 이 capability는 광고 없음 상태를 가리키는 빈 명세가 된다.
- `shift-calendar`: [월 이동]에 연·월 직접 이동 요구사항을 추가하고, [근무 패턴·이름 수정 바로가기]에서 배너 언급을 뺀다.
- `schedule-export`: [내보내기 진입점]에서 배너 간격 문장을 뺀다.
- `today-summary`: [기존 달력 화면 요소 유지]에서 배너·광고 간격 문장과 시나리오를 뺀다.

## Impact

- 코드: `src/ads/**` 삭제, `src/components/CalendarScreen.tsx`(배너 제거, 통계·월 선택 연결), 신규 `src/domain/monthStats.ts`와 월 선택 컴포넌트, `src/style.css`(배너 CSS 삭제, 통계·월 선택 스타일), `src/vite-env.d.ts`, `package.json`, `.env.adtest` 삭제.
- 테스트: 단위 테스트 추가(통계 계산, 월 선택 범위), 광고 단위 테스트 삭제, E2E는 `banner.mjs` 삭제와 `navbar-settings.mjs`·`today-summary.mjs`의 배너 단언 정리 및 통계·월 선택 E2E 추가.
- 출시: 번들 새로 빌드 → 실기기 확인 → 가이드 대조 → 사용자가 요청할 때만 검토 신청. 롤백 대상은 v1.4 `20261027-33`(롤백하면 광고가 되살아난다).
- 의존성: 추가·삭제 없음. 콘솔 광고 그룹 `ait.v2.live.319dbf4b189e4745`는 출시 뒤 사용자가 정리한다.
