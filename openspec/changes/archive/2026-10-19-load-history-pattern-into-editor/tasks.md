# Tasks

## 1. 불러오기 도메인 함수

- [x] 1.1 `src/domain/settingsDraft.ts`에 `loadCycleIntoDraft(cycle)`를 추가한다(`{ cycle: 복사본, todayIndex: null }`). `settingsDraft.test.ts`에 오늘 위치 비움·원본 배열과 분리·결과가 `canSaveDraft`에서 "오늘에 해당하는 칸" 사유로 막힘·저장된 패턴 대비 `isDraftDirty` true(같은 근무 순서여도)를 추가한다. 확인: `npm test`·`npm run test:tz` 통과.

## 2. 이력 목록·설정 화면

- [x] 2.1 `PatternHistoryList`에 선택 prop `onLoad?(cycle)`을 추가해, prop이 있으면 이전 패턴 행만 행 전체 `<button type="button">`(접근성 이름 = 기간 + 근무 순서 + "편집기에 불러오기", 오른쪽 "불러오기" 글자)으로 그리고 현재 행은 정적으로 둔다. `src/style.css`에 버튼 행 스타일(높이 44px 이상, 글자 11px 이상, 눌림 상태)을 추가하고 머리 주석의 "누르는 동작 없음" 설명을 고친다. 확인: `npm run typecheck` 통과, 개발 서버에서 이전 행만 포커스·클릭 가능.
- [x] 2.2 `SettingsScreen`에 불러오기 흐름을 넣는다: dirty가 아니면 바로 `setDraft(loadCycleIntoDraft(cycle))`, dirty면 `pendingLoad` 상태로 TDS `ConfirmDialog`("편집 중인 내용을 바꿀까요?" / [취소]·[불러오기])를 열고 `useCloseOnBack`으로 뒤로가기에 닫는다. 불러온 뒤 편집기 섹션으로 스크롤하고 `role="status"` 안내("불러온 근무 순서예요. 오늘에 해당하는 칸을 골라 주세요.")를 보이며, 다음 편집·저장 때 안내를 지운다. 확인: 개발 서버에서 편집 전·편집 중 두 경로와 확인 창 뒤로가기 동작.
- [x] 2.3 `App.tsx`에서 현재 패턴이 없어도 이력이 있으면 `SettingsScreen`에 `timeline`을 넘긴다(이력도 패턴도 없으면 `null`). 확인: 패턴 초기화 뒤 설정 화면에 현재 행 없이 이전 패턴만 보이고, 전체 초기화 뒤에는 목록이 없다(개발 서버).

## 3. 브라우저 E2E·문서

- [x] 3.1 `scripts/e2e/pattern-history.mjs`를 갱신한다: "읽기 전용(행 안에 button 없음)" 검사를 바꿔 — 현재 행은 눌러도 변화 없음, 이전 행을 누르면 편집기 칩이 그 근무 순서·오늘 위치 미선택·[저장] 비활성·저장값 불변, 편집 중 누르면 확인 창(취소·뒤로가기 시 편집 유지, 확인 시 교체), 불러와 오늘 위치를 고르고 "오늘부터 적용" 저장 시 이력 규칙대로 저장, 불러온 뒤 뒤로가기 시 변경 폐기 확인, 패턴 초기화 뒤 목록 표시·불러와 재등록(적용 범위 미표시, 기존 이력 유지), 360px에서 버튼 행 가로 스크롤 없음·글자 11px 이상. 초기화 뒤 행 수를 세는 기존 검사도 맞춘다. 확인: `pattern-history.mjs` 전부 통과.
- [x] 3.2 E2E 전 종(`scripts/e2e/README.md` 절차, 개발 서버 실행 중 `src` 수정 금지)과 `typecheck`·`npm test`·`test:tz`를 돌린다. 확인: 전부 통과, 단위·E2E 개수를 기록.
- [x] 3.3 `docs/NEXT_STEPS.md`(00절 선택 사항 1번 상태·테스트 개수·이 change의 출시 가이드 대조표)를 갱신한다. 대조는 docs MCP `getPage`로 비게임 출시 가이드 원문을 새로 받아 한다. 확인: 문서의 테스트 개수가 3.2 출력과 일치하고 대조표에 확인 필요 항목이 명시된다.
- [x] 3.4 `npm run build:adtest`(테스트 광고 ID) 번들을 `/ait:test-on-device`로 올려 사용자가 실기기에서 불러오기·확인 창·뒤로가기를 확인한다(검토 신청 금지). 확인: 사용자 확인 결과를 NEXT_STEPS에 기록.

## Workflow follow-up

- 실기기 확인 뒤 `/opsx:archive load-history-pattern-into-editor`(명세 동기화: `pattern-history` 요구사항 이름 변경·수정·추가).
- 아카이브 때 `openspec/specs/pattern-history/spec.md`의 Purpose 문장 "읽기 전용으로 확인"을 "확인하고 편집기에 다시 불러올 수 있게"로 직접 고친다(델타의 Purpose는 반영되지 않음).
- 브랜치 `feat/load-history-pattern-into-editor`를 `main`에 `--no-ff`로 병합·푸시한다. 출시는 v1.2 다른 항목과 묶을지 사용자가 정한다(검토 신청은 사용자가 요청할 때만).
