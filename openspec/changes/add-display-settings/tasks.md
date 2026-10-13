# Tasks

## 1. 테마 정의와 적용 (`display-settings`)

- [ ] 1.1 `src/domain/theme.ts`에 `ThemeId`, `THEMES`(인디고 `#4F46E5`·딥 틸 `#0F766E`·코랄 오렌지 `#C2410C`, 이름·`primaryWeak`), `DEFAULT_THEME`, `isThemeId`를 정의하고, `brand.ts`의 `BRAND_PRIMARY_COLOR`가 `THEMES.INDIGO.primary`를 쓰도록 바꾼다 — `theme.test.ts`로 세 테마 hex와 기본값, `isThemeId` 판정, 토스 블루 계열(`#3182F6`, `#0064FF`) 미포함을 확인한다
- [ ] 1.2 `applyTheme(target, themeId)`를 구현해 `--color-primary`·`--color-primary-weak`를 설정하고, 가짜 style 대상 단위 테스트로 세 테마 값이 정확히 들어가는지 확인한다
- [ ] 1.3 `style.css`의 강조색 하드코딩(오늘 테두리, 오늘 배지, 선택 칸, 토요일 머리글 등)을 `--color-primary`/`--color-primary-weak`로 정리한다 — `grep -niE "#4f46e5|#eef2ff"`로 `:root` 기본값 외 직접 사용이 없는지 확인한다
- [ ] 1.4 `main.tsx`에 테마 상태를 갖는 루트 컴포넌트를 두고 `TDSMobileAITProvider brandPrimaryColor`를 선택된 테마로 전달한다 — 개발 서버에서 테마 값을 바꿨을 때 TDS 버튼 색이 즉시 바뀌는지 확인하고, 안 바뀌면 design D3대로 `key={theme}` 재마운트로 처리한 뒤 다시 확인한다

## 2. 저장 스키마 v2 (`settings-persistence`)

- [ ] 2.1 `scheduleStorage.ts`를 `StoredSettingsV2`(`version: 2`, `theme`)와 `CURRENT_VERSION = 2`로 올리고 `migrate()`에 v1 → v2(테마 인디고) 변환, v2 테마 검증, v3 이상 거부를 구현한다
- [ ] 2.2 `scheduleStorage.test.ts`를 갱신해 v2 저장 형식, v1 저장값 복원 시 테마 인디고·저장소 무기록, 알 수 없는 테마 → corrupt, `version: 3` → corrupt·보존, 기존 손상 시나리오 유지를 확인한다(`npm test` 통과)

## 3. 화면 흐름과 뒤로가기 (`miniapp-shell`, `display-settings`)

- [ ] 3.1 `useBackHandler.ts`의 `Screen`에 `settings-menu`·`pattern`·`display`를 반영하고 `decideBackAction`에 `to-settings-menu`를 추가해 design D2 표대로 동작하게 한다 — 표 기반 단위 테스트(오버레이 우선 포함)로 모든 조합을 확인한다
- [ ] 3.2 `App.tsx`의 `View`를 design D1대로 확장하고(`settings` → `pattern`, `settings-menu`·`display` 추가), 폐기 확인 "버리기"의 목적지를 설정 목록으로 바꾼다 — `npx tsc --noEmit` 통과와 브라우저에서 화면 전환을 확인한다
- [ ] 3.3 `App`의 즉시 저장 로직을 `updateDisplaySettings(patch)` 하나로 합쳐 테마와 주 시작 요일이 같은 낙관적 갱신·실패 시 복원·오류 안내 경로를 쓰게 한다 — 브라우저에서 저장소 쓰기를 실패시켜 두 값 모두 되돌아가고 안내가 뜨는지 확인한다

## 4. 화면 구현 (`display-settings`, `shift-calendar`)

- [ ] 4.1 `SettingsMenu.tsx`를 만든다(제목 "설정", TDS `ListRow` "근무 패턴"·"화면 설정", 현재 값 요약 보조 문구, TDS 화살표 요소) — 브라우저에서 두 항목이 각 화면을 여는지 확인한다
- [ ] 4.2 `DisplaySettingsScreen.tsx`를 만든다(테마 색 라디오 목록: 견본·이름·선택 표시, `role="radiogroup"`; 달력 섹션: 주 시작 요일 `SegmentedControl`) — 브라우저에서 테마 선택 즉시 강조색·TDS 버튼 색이 바뀌고, 주 시작 요일 변경이 달력에 반영되는지 확인한다
- [ ] 4.3 `CalendarScreen.tsx`에서 주 시작 요일 토글을 제거하고 하단 버튼을 "설정"(설정 목록 진입)으로 바꾼다 — 달력 화면에 주 시작 요일 선택 UI가 없는지 확인한다

## 5. 통합 검증

- [ ] 5.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`가 모두 통과하는지 확인한다
- [ ] 5.2 브라우저 E2E(Devtools mock)를 갱신해 실행한다: 설정 목록 진입과 뒤로가기 계층(화면 설정 → 목록 → 달력 → 종료, 근무 패턴 dirty → 확인 → 목록), 테마 변경 즉시 반영·재실행 유지·근무 유형 색 불변, 주 시작 요일 이동, v1 저장값 주입 후 실행(인디고, 무기록)과 첫 변경 시 v2 기록, MVP 기존 시나리오 회귀 — 전부 통과를 확인한다
- [ ] 5.3 세 테마로 달력·설정 목록·화면 설정·근무 패턴 화면 스크린샷을 찍어 강조색이 일관되게 바뀌고 근무 유형 칸과 구분되는지, 토스 브랜드 색·서체가 없는지 확인한다

## Workflow follow-up

- 실기기 확인은 출시 버전 준비 시 비게임 출시 가이드 검증과 함께 진행한다(검토 신청은 출시 버전만).
- 리뷰 후 change를 아카이브한다(`/opsx:archive add-display-settings`).
