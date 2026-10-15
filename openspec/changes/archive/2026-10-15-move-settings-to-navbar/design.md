# Design

## Context

동기는 proposal.md 참고. 현재 구조와 문서 확인 사실(2026-10-15):

- 설정 목록 진입은 `CalendarScreen`의 하단 [설정] 버튼(`onOpenSettings`)뿐이다. `apps-in-toss.config.ts`에는 `navigationBar` 옵션이 없고 SDK 기본 내비 바를 쓴다.
- 앱인토스 문서(내비게이션 바 설정): 웹 프레임워크에서 `partner.addAccessoryButton({ id, title, icon: { name } })`로 기능 버튼을 등록하고 `tdsEvent.addEventListener('navigationAccessoryEvent', { onEvent: ({ id }) => ... })`로 클릭을 받는다. 반환된 해제 함수를 `pagehide`나 컴포넌트 정리에서 호출한다. 한 번에 하나만 표시되고 "더보기(⋯) 왼쪽" 영역에 놓인다. 설정 파일의 `initialAccessoryButton`으로 처음부터 보이게 할 수도 있다.
- 출시 가이드(비게임): "미니앱 기능 버튼은 최대 1개만 노출돼요(선택 사항)", 뒤로가기·닫기 동작이 명확해야 하고 최초 화면 뒤로가기는 종료.
- 뒤로가기 계층은 `App.tsx`의 `View`·`useBackHandler`가 정하고, 설정 목록은 `toSettingsMenu()`로 연다.
- 배너 간격 규칙(`in-app-ads`, `today-summary`)은 "[설정] 버튼과 배너 사이 32px"으로 적혀 있고 E2E(`banner`·`today-summary`)가 그 간격을 잰다.

## Goals / Non-Goals

**Goals:**
- 달력에서 한 번의 탭으로 설정 목록에 들어가는 상단 바 버튼을 제공하고 하단 공간을 줄인다.
- 기능 버튼을 쓸 수 없는 환경에서도 설정에 들어갈 수 있다.
- 출시 가이드의 기능 버튼 규칙(최대 1개)을 지킨다.

**Non-Goals:**
- 바로가기(패턴·이름)를 내비 바로 옮기는 것(기능 버튼은 1개뿐).
- 달력 외 화면에 기능 버튼 노출.
- 내비게이션 바 테마·홈 버튼 등 다른 옵션 변경.

## Decisions

### 1. 런타임 등록 + 달력일 때만 노출
`initialAccessoryButton`(설정 파일)이 아니라 `partner.addAccessoryButton`을 달력 화면에 들어올 때 호출하고, 달력을 떠나면(설정·날짜·편집 화면) 해제 함수로 제거한다. 클릭 이벤트 리스너도 같은 시점에 등록·해제한다. 이 로직은 `useNavSettingsButton(active, onClick)` 훅 하나로 모은다.
- 이유: 설정 파일 방식은 모든 화면에 보여 설정 화면 안에서 설정 버튼이 노출되는 어색함이 생기고 클릭 시 동작도 화면별로 달라진다. 달력에서만 쓰는 편이 규칙이 단순하다.
- 대안: 항상 노출하고 화면별로 동작 분기 — 가이드의 "동작이 명확해야 함"에 어긋날 수 있어 거부.

### 2. 등록에 실패하면 하단 [설정] 버튼으로 대체
훅이 등록 상태(`pending`·`registered`·`failed`)를 돌려주고, `CalendarScreen`은 `failed`일 때만 하단 [설정] 버튼을 렌더한다. `addAccessoryButton`이 비동기라서 결과가 나오기 전(`pending`)에는 하단 버튼을 그리지 않아 버튼이 깜빡이거나 레이아웃이 튀지 않게 하고, 약 1.5초 안에 성공하지 못하면 `failed`로 보고 대체 버튼을 보여 준다(늦게 성공하면 다시 숨김). SDK 함수가 없거나 예외가 나면(구형 토스 앱, 지원하지 않는 환경) 하단 버튼이 그대로 나타난다. 등록이 성공하면 하단 버튼은 렌더되지 않는다.
- 이유: 기능 버튼이 안 보이면 설정 접근이 불가능해져 데이터 초기화·이름·테마를 못 바꾸게 되는 치명 경로다. 대체 경로를 두면 위험이 없다.
- 위험: 등록이 "성공했지만 실제로는 안 보이는" 경우는 코드로 알 수 없다 → 실기기 확인 항목으로 둔다.

### 3. 아이콘·이름·API 형태(확인 완료)
버튼 이름(`title`)은 "설정", `id`는 `"settings"`, 아이콘은 `icon-setting-mono`를 쓴다. 근거: 앱인토스 문서(내비게이션 바 설정)는 액세서리 버튼이 **모노톤 아이콘만 지원**한다고 하고 이름은 `icon-<이름>-mono` 형태이며, `@toss/tds-mobile` 패키지 문서에 `icon-setting-mono`가 TDS 아이콘 이름으로 나온다. SDK 타입은 `partner.addAccessoryButton(params): Promise<void>`, `partner.removeAccessoryButton(): Promise<void>`, `tdsEvent.addEventListener("navigationAccessoryEvent", { onEvent: ({ id }) => void, onError? })`(해제 함수 반환)이다. Devtools mock은 `button[data-ait-accessory-button-id]`를 화면 오른쪽 위에 그려 클릭하면 `__ait:navigationAccessoryEvent`를 보내므로 E2E에서 클릭으로 검증할 수 있다(아이콘 표시 자체는 검증 불가).

### 4. 배너 간격 기준을 "달력 하단 콘텐츠"로
기능 버튼이 등록된 경우 하단의 마지막 요소는 바로가기 줄이다. 배너와의 간격 32px 규칙은 그 마지막 요소 기준으로 유지한다(규칙 문장은 "[설정] 버튼"에서 "달력 하단의 마지막 조작 요소(바로가기 줄 또는 대체 [설정] 버튼)"로 수정).

## Risks / Trade-offs

- [기능 버튼이 실기기에서 안 보이거나 위치가 어색함] → 대체 하단 버튼 + 실기기 확인 항목. 확인 전에는 출시하지 않는다.
- [등록·해제 타이밍 경쟁(화면 전환 중 이벤트)] → 훅 정리 함수에서 해제를 보장하고, 클릭 시 현재 화면이 달력이 아니면 무시한다. E2E로 화면 전환 반복을 확인한다.
- [기존 사용자가 하단 [설정]을 찾음] → 내비 바 버튼에 "설정" 이름을 붙이고, 릴리즈 노트에 위치 변경을 적는다.
- [Devtools mock과 실기기 차이] → mock으로 클릭 동작·해제는 검증하되 아이콘 표시는 실기기에서만 확인할 수 있다.

## Migration Plan

- 저장 데이터 변경 없음.
- 배포: `polish-visual-design` 병합 뒤 진행(하단 영역 겹침 방지) → 단위·E2E 통과 → `build:adtest` 실기기 확인 → 다른 업데이트와 함께 한 번에 출시.
- 롤백: 콘솔에서 이전 번들로 되돌린다.
