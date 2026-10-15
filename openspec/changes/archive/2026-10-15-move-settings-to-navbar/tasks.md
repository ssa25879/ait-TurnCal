# Tasks

## 1. 선행 정리·SDK 확인

- [x] 1.1 `add-calendar-shortcuts`가 `main`에 병합된 뒤 시작하는지 확인하고, 그 change가 추가한 `shift-calendar`의 "근무 패턴·이름 수정 바로가기" 요구사항 문장("[설정] 버튼 바로 위")을 이 change의 `specs/shift-calendar/spec.md`에 MODIFIED로 추가한다(기능 버튼이 등록된 환경에서는 바로가기 줄이 맨 아래, 대체 환경에서는 [설정] 버튼 바로 위). 확인: `openspec validate move-settings-to-navbar` 통과.
- [x] 1.2 `@apps-in-toss/web-framework`의 `partner.addAccessoryButton`·`tdsEvent` 타입과 Devtools mock 동작, 설정에 쓸 공식 아이콘 이름을 문서(docs MCP)와 설치된 패키지 타입에서 확인하고 `design.md` 3번의 열린 질문을 해소한다(아이콘 이름을 지어내지 않는다). 확인: design.md에 결정한 아이콘 이름과 근거 기록.

## 2. 내비 바 기능 버튼

- [x] 2.1 `src/platform/`에 `useNavSettingsButton(active, onClick)` 훅을 만든다: `active`일 때만 기능 버튼을 등록하고 클릭 이벤트를 연결하며, 정리 시 해제하고, 등록 성공 여부를 돌려준다(함수가 없거나 예외면 실패). 단위 테스트(등록·해제·실패 시 false·active 전환)를 추가한다. 확인: `npm test`·`npm run test:tz` 통과.
- [x] 2.2 `App.tsx`에서 달력 화면일 때만 훅을 켜고 클릭 시 설정 목록으로 이동한다(달력이 아니면 무시). `CalendarScreen`의 하단 [설정] 버튼은 등록이 성공하지 못한 경우에만 렌더한다. 확인: 개발 서버(Devtools mock)에서 버튼 노출·클릭·화면 전환 시 해제, 대체 경로(함수 없음)에서 하단 버튼.

## 3. 브라우저 E2E·문서

- [x] 3.1 E2E: mock 액세서리 클릭 → 설정 목록, 달력에서만 노출(설정·날짜·편집·이름 화면에서는 해제), 설정 목록 뒤로가기 후 다시 노출, 지원하지 않는 환경에서 하단 [설정] 버튼, 하단 [설정]을 누르던 기존 E2E 수정, 배너 간격 기준을 새 하단 요소로 수정. 확인: 새 시나리오와 기존 E2E 전부 통과.
- [x] 3.2 `docs/NEXT_STEPS.md`(상태 표·테스트 개수·00절)와 `scripts/e2e/README.md`를 갱신한다. 확인: 문서의 테스트 개수가 실제 출력과 일치한다.
- [x] 3.3 `typecheck`·`npm test`·`test:tz`·E2E 전 종을 실행하고 `build:adtest` 번들을 실기기에서 확인한 뒤(기능 버튼의 아이콘·이름·위치, 더보기 옆 배치, 클릭 동작을 사용자가 확인) 출시 가이드 대조표를 갱신한다(기능 버튼 최대 1개, 클릭 동작 명확, 최초 화면 뒤로가기 종료 유지). 확인: 모두 통과·확인 필요 항목 보고.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive move-settings-to-navbar`(명세 동기화: `miniapp-shell` 추가, `in-app-ads`·`today-summary`·`shift-calendar` 수정).
- 브랜치(`feat/move-settings-to-navbar`)를 `main`에 `--no-ff`로 병합·푸시한다.
- 이번 업데이트도 다른 업데이트와 함께 한 번에 출시한다(사용자 계획).
