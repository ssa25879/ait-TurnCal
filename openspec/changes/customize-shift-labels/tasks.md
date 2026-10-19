# Tasks

## 1. 도메인: 팔레트·검증·병합

- [x] 1.1 `src/domain/shiftLabels.ts`에 `SHIFT_PALETTE`(10색, 기본 6색은 현재 값), `DEFAULT_SHIFT_LABELS`, `resolveShiftLabels`, `validateShiftLabels`, `toStoredShiftLabels`, 글자 수 함수(grapheme, 대체 `Array.from`)를 만들고, `types.ts`의 `SHIFT_LABELS`는 기본값에서 이름·약어를 뽑도록 바꾼다(값 동일). `shiftLabels.test.ts`: 팔레트 모든 짝 대비 4.5:1 이상·토스 블루 hex 없음·10개, 이름 1~4자(공백 제거), 약어 정확히 1자(한글·영문·이모지), 이름 중복·약어 중복은 두 유형 모두 오류, 색 중복 허용, 팔레트 밖 색 오류, `toStored`는 다른 유형만 남기고 비면 `undefined`, `resolve`는 저장값 덮어쓰기. 확인: `npm test`·`npm run test:tz` 통과(대비 미달 색은 글자색 조정 후 통과). (구현 메모: 순환 import를 피하려고 반대로 했다 — 기본 이름·약어 원본은 `types.ts`의 `SHIFT_LABELS`, 새 모듈의 `DEFAULT_SHIFT_LABELS`가 그것을 읽는다.)

## 2. 저장소

- [x] 2.1 `scheduleStorage.ts`: `StoredSettingsV3.shiftLabels?` 추가, `parseV3`가 필드를 검증(키·타입·`validateShiftLabels`)해 유효하면 담고 아니면 손상 처리, `saveSettings`는 비었을 때 필드 생략. `scheduleStorage.test.ts`: 필드 없는 기존 v3 그대로 복원, 유효 필드 복원·저장 왕복, 알 수 없는 키·5자 이름·두 글자 약어·약어 중복·팔레트 밖 색은 손상, 빈 객체 저장 시 필드 없음, `version` 3 유지. 확인: `npm test` 통과.

## 3. 표시값 공급과 색 적용

- [x] 3.1 `ShiftLabelsProvider`·`useShiftLabels`(Provider 없으면 기본값)와 `applyShiftColors(root, labels)`를 만들고, App이 저장값으로 Provider를 감싸며 `useEffect`로 색을 루트에 적용한다. `Calendar`·`DayScreen`·`EntryEditor`·`PatternEditor`·`PatternHistoryList`·`TodayPositionPicker`·`TodaySummary`의 `SHIFT_LABELS[...]` 18곳을 훅 값으로 바꾼다(접근성 이름 포함). 확인: `npm run typecheck` 통과, `grep -rn "SHIFT_LABELS\[" src --include=*.tsx`가 0건, 개발 서버에서 사용자 정의 없는 화면이 지금과 같음.

## 4. 근무 유형 화면·설정 목록·초기화 문구

- [x] 4.1 `ShiftLabelsScreen`(카드 6개: 미리보기 칩, 이름·약어 `TextField`, 10색 radiogroup 44px·360px 두 줄, 입력 옆 오류, 하단 [저장], 맨 끝 [기본값으로 되돌리기])을 만들고 `src/style.css`에 스타일을 추가한다. `ResetAction`에 선택 prop `confirmLabel`(기본 "초기화하기")을 더한다. 확인: `npm run typecheck` 통과.
- [x] 4.2 App에 뷰 `shift-labels`·저장(`shiftLabels` 갱신, 성공 시 설정 목록)·되돌리기(즉시 저장, 화면 유지)·dirty 뒤로가기를 연결하고, `SettingsMenu`에 "근무 유형" 행(보조 문구 "기본값"/"N개 바꿈")을 "근무 패턴"과 "화면 설정" 사이에 넣는다. 전체 초기화·근무 패턴 초기화 설명 문구에 "근무 유형"을 넣는다. 확인: 개발 서버에서 메뉴 다섯 항목·화면 열림·저장 후 달력 반영·되돌리기.
- [x] 4.3 E2E 새 스크립트 `scripts/e2e/shift-labels.mjs`: 메뉴 순서·보조 문구, 처음 상태 6종 기본값, 이름·약어·색 바꿔 저장 → 달력 칸·요약·날짜 화면·세부 내용 분류·패턴 편집기·이력·접근성 이름 반영과 저장값(`shiftLabels`만 추가, `version` 3, 패턴·이력·`turncal.entries` 불변), 저장 전 반영 없음, 길이·중복 오류로 [저장] 비활성, 같은 색 허용, 변경 후 뒤로가기 폐기 확인(취소·버리기), 되돌리기 확인·취소·뒤로가기, 저장 실패 시 머무름, 패턴 초기화 뒤 유지, 전체 초기화 뒤 기본값, 손상 `shiftLabels` → 오류 안내·저장값 보존, 필드를 뺀 같은 데이터(이전 앱 관점) 정상, 360px 가로 스크롤 없음·글자 11px 이상·견본 44px, 4자 이름 요약 카드 넘침 없음, 팝업 안 근무 칩 색 적용. 기존 `navbar-settings`·`empty-calendar`(메뉴 항목)·`pattern-history`(패턴 초기화 문구)·`visual-audit`(새 화면 감사 추가)를 맞춘다. 확인: 새 스크립트·수정한 스크립트 통과.

## 5. 통합 확인·문서

- [x] 5.1 `typecheck`·`npm test`·`test:tz`·E2E 전 종(새 스크립트 포함 12종, 개발 서버 실행 중 `src` 수정 금지)을 돌린다. 확인: 전부 통과, 개수 기록.
- [x] 5.2 `docs/NEXT_STEPS.md`(00절 선택 사항 2번 상태·테스트 개수·롤백 시 사용자 정의 소실 주의·이 change의 출시 가이드 대조표, docs MCP `getPage`로 원문 새로 받아 대조)와 `scripts/e2e/README.md`(새 스크립트·개수)를 갱신한다. 확인: 문서 개수가 5.1 출력과 일치.
- [ ] 5.3 `npm run build:adtest` 번들을 `/ait:test-on-device`로 올려 사용자가 실기기에서 근무 유형 화면(입력·색 선택·되돌리기)과 달력·요약·날짜 화면 반영을 확인한다(검토 신청 금지). 확인: 사용자 확인 결과를 NEXT_STEPS에 기록.

## Workflow follow-up

- 실기기 확인 뒤 `/opsx:archive customize-shift-labels`(명세 동기화: `shift-labels` 신규, `shift-schedule`·`display-settings`·`settings-persistence`·`settings-reset`·`miniapp-shell` 수정).
- 브랜치 `feat/customize-shift-labels`를 `main`에 `--no-ff`로 병합·푸시한다. 출시는 v1.2 다른 항목과 묶을지 사용자가 정한다(검토 신청은 사용자가 요청할 때만).
