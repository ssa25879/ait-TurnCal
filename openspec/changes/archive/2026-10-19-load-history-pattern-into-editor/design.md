# Design

## Context

- 동기는 proposal.md의 Why 참고. 요구사항은 `specs/pattern-history/spec.md`.
- 설정 화면(`SettingsScreen`)은 편집 내용을 `PatternDraft { cycle, todayIndex }`로만 들고 있고 [저장]을 눌러야 `onSave(pattern, scope)`로 반영한다. 적용 범위 선택은 `saved !== null && dirty`일 때만 보이고, dirty는 `isDraftDirty(draft, saved, today)`로 계산해 `onDirtyChange`로 App에 올린다. App은 이 값으로 뒤로가기 때 변경 폐기 확인 창을 띄운다.
- 이력 목록(`PatternHistoryList`)은 `describeTimeline(timeline)`의 행을 `<li>`로만 그린다(버튼 없음). App은 `timeline={pattern ? timeline : null}`로 넘겨 **패턴 초기화 뒤에는 목록이 숨는다**(`App.tsx:347`).
- 오버레이는 `useCloseOnBack(open, onClose)`(`src/platform/overlayBack.tsx`)로 뒤로가기에 닫힌다. `ResetAction`이 같은 방식으로 TDS `ConfirmDialog`를 쓴다.
- 기존 E2E `scripts/e2e/pattern-history.mjs`에 "이력 항목 누르기: 화면·창 변화 없음 + 행 안에 button 없음" 검사가 있다(이번 변경으로 뒤집힌다).

## Goals / Non-Goals

**Goals:**
- 이전 패턴 행을 눌러 draft의 근무 순서를 교체(오늘 위치 null)하고, 저장은 기존 경로만 쓴다.
- 편집 중이면 확인 창, 뒤로가기는 그 창만 닫는다.
- 초기화 뒤에도 이력이 있으면 목록 표시.

**Non-Goals:**
- 저장 형식·`applyPatternChange` 규칙·이력 상한 변경.
- 이력 행 수정·삭제, 불러올 때 오늘 위치 자동 추정, 바로 저장(퀵스왑).
- 달력 화면 등 설정 화면 밖에서의 불러오기.

## Decisions

1. **불러오기 = 순수 함수 `loadCycleIntoDraft(cycle): PatternDraft`** (`settingsDraft.ts`), 결과는 `{ cycle: [...cycle], todayIndex: null }`.
   - 단위 테스트로 "오늘 위치 비움·원본 배열과 분리"를 고정한다. 기존 `canSaveDraft`가 `todayIndex === null`이면 저장을 막으므로 "고르기 전 저장 불가"는 추가 코드 없이 성립한다.
   - 대안: 이전 패턴의 기준일로 이어 간 위치를 미리 선택 — 사용자 결정(2026-10-19)으로 기각. 확인 없이 저장하면 근무가 어긋난다.

2. **행 렌더링: 이전 패턴 행만 `<button type="button">`**, 현재 행은 지금처럼 정적 `<li>` 내용.
   - `PatternHistoryList`에 선택 prop `onLoad?(cycle: ShiftType[])`를 추가한다. prop이 없으면 지금처럼 정적 목록(재사용·테스트 단순).
   - 버튼의 접근성 이름은 기존 `aria-label`(기간 + 근무 순서)에 "편집기에 불러오기"를 붙인다. 내부 칩은 `aria-hidden` 유지.
   - 터치 영역은 행 전체(높이 44px 이상)라 기존 기준을 만족한다. 누를 수 있다는 단서로 행 오른쪽에 "불러오기" 글자(11px 이상)를 둔다 — chevron 글리프는 쓰지 않는다.
   - 대안: 행마다 별도 [불러오기] 버튼 — 360px에서 56칸 칩과 겹치고 터치 영역이 작아져 기각.

3. **확인 창은 `SettingsScreen` 안에서 관리.** `pendingLoad: ShiftType[] | null` 상태를 두고, `dirty`이면 `pendingLoad`를 세팅해 TDS `ConfirmDialog`(제목 "편집 중인 내용을 바꿀까요?", 설명 "저장하지 않은 근무 순서가 불러온 패턴으로 바뀌어요.", 버튼 [취소]/[불러오기])를 연다. `useCloseOnBack(pendingLoad !== null, cancel)`로 뒤로가기는 창만 닫는다. dirty가 아니면 바로 `setDraft(loadCycleIntoDraft(cycle))`.
   - "dirty" 판정은 기존 `isDraftDirty` 그대로(저장된 패턴과 다른가). 초기화 뒤(`saved === null`)에는 근무를 하나라도 넣었으면 dirty.
   - 불러온 뒤에는 todayIndex가 null이라 항상 dirty가 되어, App의 기존 변경 폐기 확인이 그대로 동작한다(명세 "불러온 뒤 화면 나가기").
   - 대안: App의 기존 폐기 확인 창 재사용 — 그 창은 화면 이탈용 문구·흐름이라 기각.

4. **불러온 뒤 편집기 위치로 스크롤.** 목록은 화면 아래쪽이라 불러온 결과가 안 보인다. `PatternEditor` 섹션에 ref를 두고 `scrollIntoView({ block: "start", behavior: "smooth" })`, 그리고 오늘 위치 섹션 근처에 `role="status"` 안내 "불러온 근무 순서예요. 오늘에 해당하는 칸을 골라 주세요."를 보여 준다(다음 편집 또는 저장 시 사라짐).

5. **App: 이력이 있으면 초기화 뒤에도 `timeline` 전달.** `timeline={pattern || (timeline?.history.length ?? 0) > 0 ? timeline : null}`. `describeTimeline`은 이미 `current === null`이면 현재 행을 생략한다. 재등록 시 적용 범위를 묻지 않는 것은 기존 `askScope = saved !== null && dirty` 규칙 그대로다.

## Risks / Trade-offs

- [불러오기를 저장으로 오해] → 오늘 위치를 비워 [저장] 비활성 + 안내 문구로 "아직 저장 안 됨"이 드러난다. E2E에서 불러온 직후 저장값이 그대로인지 확인한다.
- [초기화 뒤 목록이 보여 "패턴이 남아 있다"고 오해] → 현재 행이 없고 각 행에 "…까지" 기간이 붙는다. 근무 패턴 초기화 안내 문구는 이미 "패턴 이력은 남아요"라고 알린다.
- [기존 E2E "읽기 전용" 검사 실패] → 같은 그룹 작업에서 시나리오를 불러오기 검사로 바꾼다. 초기화 뒤 목록 행 수를 세는 검사도 함께 갱신한다.
- [smooth 스크롤이 E2E 타이밍을 흔듦] → E2E는 스크롤 위치가 아니라 draft 내용(편집기 칩)·저장값으로 판정한다.

## Migration Plan

저장 형식 변경이 없어 마이그레이션은 없다. 번들 롤백(`20261015-18`) 시 불러오기 UI만 사라지고 데이터는 그대로 읽힌다.
