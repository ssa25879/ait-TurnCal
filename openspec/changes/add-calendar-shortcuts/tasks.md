# Tasks

## 1. 출처 분기

- [ ] 1.1 `App.tsx`의 `names` 뷰에 `fromCalendar`를 추가하고 달력 바로가기 진입 헬퍼를 만든다. 뒤로가기 핸들러(`toSettingsMenu`)·폐기 확인 목적지(`DiscardTarget`)·`saveNames` 저장 후 이동을 "달력 출처이면 달력"으로 분기하고 패턴 뷰의 기존 분기도 같은 헬퍼로 맞춘다. 설정 목록 경로는 바꾸지 않는다. 확인: `npm run typecheck`·`npm test`·`npm run test:tz` 통과(기존 테스트 무변경).

## 2. 달력 바로가기 화면

- [ ] 2.1 `CalendarScreen`에 [근무 패턴 수정]·[이름 수정] 버튼 줄을 이름 헤더 아래에 추가하고 콜백(`onEditPattern`·`onEditNames`)을 `App`에서 연결한다. 패턴이 없으면(`timeline.current === null`) [근무 패턴 수정]을 숨기고 [이름 수정]만 보인다. `style.css`에 한 줄 균등 분할 스타일을 추가한다(글자 11px 이상, 토스 브랜드 색·다크 모드 없음). 확인: 개발 서버에서 390×844·360×740 스크린샷에 겹침·가로 스크롤 없음, 오늘·내일 카드와 배너·[설정] 간격 유지.

## 3. 브라우저 E2E·문서

- [ ] 3.1 `calendar-shortcuts` E2E 시나리오를 추가한다: 패턴·이름 바로가기가 설정 목록을 거치지 않고 열림, 변경 없이 뒤로가기·폐기 확인 후 달력 복귀·폐기 취소 시 편집 유지·이름 저장 후 달력에 즉시 반영·패턴 저장·패턴 초기화 후 달력, 설정 목록 경로의 계층 불변, 달력에서 한 번 더 뒤로가기 시 종료, 패턴 없는 달력(수정 숨김·이름 수정 표시), 긴 이름 360px. 확인: 새 시나리오와 기존 E2E 8종 전부 통과.
- [ ] 3.2 `scripts/e2e/README.md`·`docs/NEXT_STEPS.md`(상태 표·테스트 개수·00절의 ③ 항목)를 갱신한다. 확인: 문서의 테스트 개수가 실제 출력과 일치한다.
- [ ] 3.3 `npm run typecheck`·`npm test`·`npm run test:tz`·E2E 전 종을 실행하고, `build:adtest` 번들을 실기기에서 확인한 뒤(사용자 확인 결과를 기록) 출시 가이드 대조표를 갱신한다(새 오버레이·외부 이동·권한 없음, 최초 화면 뒤로가기 종료 유지). 확인: 모두 통과·확인 필요 항목 보고.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive add-calendar-shortcuts`(명세 동기화: `shift-calendar`·`miniapp-shell`·`schedule-names` 추가).
- `feat/add-calendar-shortcuts`를 `main`에 `--no-ff`로 병합·푸시한다.
- 이번 업데이트도 다른 업데이트와 함께 한 번에 출시한다(사용자 계획).
