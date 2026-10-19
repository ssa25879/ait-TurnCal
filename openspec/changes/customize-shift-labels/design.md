# Design

## Context

- 동기는 proposal.md의 Why, 요구사항은 `specs/` 참고.
- 근무 표시값은 `src/domain/types.ts`의 정적 상수 `SHIFT_LABELS`(이름·약어)를 7개 컴포넌트가 18곳에서 직접 읽는다. 근무 색은 `src/style.css`의 `.shift-<TYPE>` 클래스가 `:root`의 `--shift-<type>-bg/fg` 변수를 읽는다.
- 테마는 `main.tsx`의 `applyTheme(document.documentElement, theme)`가 루트 요소에 CSS 변수를 넣는다. 그래서 TDS 다이얼로그·바텀시트처럼 `main.app` 밖(포털)에 그려지는 요소에도 적용된다.
- 저장: `parseV3`는 아는 필드만 골라 새 객체를 만든다 → 이전 번들은 모르는 필드를 **무시**한다(손상 처리 안 함). App의 각 저장 경로는 `settings`를 펼쳐(`...rest`) 다시 쓰므로 새 필드가 그대로 따라간다.
- 이름·근무 패턴 화면은 draft + [저장] + `onDirtyChange`로 App의 변경 폐기 확인을 쓴다. 화면 설정은 즉시 저장이고, 초기화 버튼은 `ResetAction`(확인 창 + `useCloseOnBack`).

## Goals / Non-Goals

**Goals:**
- 표시값을 한 곳(`resolveShiftLabels`)에서 만들어 모든 화면이 같은 값을 쓰게 한다.
- 저장 형식 `version: 3` 유지, 이전 번들이 읽어도 오류 없음.

**Non-Goals:**
- 유형 추가·삭제, 자유 색 선택, 유형 순서 변경.
- 근무 시간(시작·종료) 기본값 같은 유형별 속성 추가.
- 테마 색과 근무 색 연동.

## Decisions

1. **도메인 모듈 `src/domain/shiftLabels.ts`**
   - `SHIFT_PALETTE`: 색 ID → `{ name, bg, fg }` 10개. 기본 6색은 현재 값 그대로(노랑 `#fff3c4/#8a5a00`, 주황 `#ffe0cc/#a23e00`, 남색 `#dce4ff/#1e3a8a`, 보라 `#f3ddfb/#6b21a8`, 민트 `#d7f2ec/#0f6b5c`, 회색 `#f2f4f6/#4e5968`), 추가 4색 후보(분홍 `#ffe0ec/#9d174d`, 빨강 `#fde2e2/#b91c1c`, 초록 `#e3f5d8/#3f6212`, 갈색 `#efe4da/#7c4a1e`). 대비 4.5:1 이상은 단위 테스트로 계산해 고정하고, 미달이면 글자색을 어둡게 조정한다. 파랑 계열은 남색 하나뿐이며 토스 블루(`#3182F6`·`#0064FF`)와 다르다.
   - `DEFAULT_SHIFT_LABELS`: 유형 → `{ name, short, color }`. 기존 `SHIFT_LABELS`는 이 값에서 이름·약어만 뽑아 기본값으로 남겨, 테스트·저장 검증 등 비UI 코드가 그대로 쓴다.
   - `resolveShiftLabels(stored?)`: 기본값 위에 저장값을 덮어 6종 전체를 돌려준다.
   - `validateShiftLabels(full)`: 유형별 오류(`name` 길이·중복, `short` 길이·중복, 색 ID)를 돌려준다. 화면과 저장소 파싱이 **같은 함수**를 쓴다.
   - `toStoredShiftLabels(full)`: 기본값과 다른 유형만 남긴다. 비면 `undefined`(필드 생략).
   - 글자 수는 `Intl.Segmenter`(grapheme)로 세고, 없으면 `Array.from` 길이로 대신한다. 이름은 앞뒤 공백을 뺀다.
   - 대안: 색을 hex로 저장 — 팔레트 밖 값이 들어오고 대비 보장이 깨져 기각. ID 저장이면 나중에 팔레트 값을 조정해도 데이터가 따라간다.

2. **표시값 공급: React context `ShiftLabelsProvider` + `useShiftLabels()`**
   - App이 `resolveShiftLabels(settings?.shiftLabels)`를 만들어 감싼다. 7개 컴포넌트의 `SHIFT_LABELS[x]`를 `labels[x]`로 바꾼다. Provider가 없을 때는 기본값을 돌려줘 단위 테스트·단독 렌더가 깨지지 않는다.
   - 대안: props로 모든 컴포넌트에 전달 — 18곳·여러 단계 전달이라 기각.

3. **색 적용: `applyShiftColors(document.documentElement, labels)`** — 테마와 같은 방식으로 루트에 `--shift-<type>-bg/fg`를 넣는다. `style.css`의 기본값은 그대로 두어 첫 화면 깜빡임을 막는다. App의 `useEffect`가 설정이 바뀔 때마다 다시 적용한다. 포털(다이얼로그·세부 내용 편집) 안의 근무 칩에도 적용된다.

4. **화면 `ShiftLabelsScreen`(class `shift-labels-screen`)** — 이름 화면과 같은 draft 모델.
   - 유형마다 카드 하나: 미리보기 칩(약어+색, `aria-hidden`), TDS `TextField` 이름·약어, 색 선택 `role="radiogroup"`(견본 버튼 10개, 44px, 360px에서 5개씩 두 줄, 각 견본에 그 유형 약어를 그 색으로 표시, 접근성 이름 "<색 이름>").
   - 오류는 각 입력의 `help`/`hasError`로 표시(중복은 겹치는 두 유형 모두).
   - 하단 [저장](`bottom-action`) → `onSave(toStoredShiftLabels(draft))` → 성공 시 설정 목록. 실패 시 머무르며 오류 안내.
   - 맨 끝 `ResetAction`(title "기본값으로 되돌리기", confirm "근무 유형을 기본값으로 되돌릴까요?", 확인 버튼 "되돌리기"): `ResetAction`에 선택 prop `confirmLabel`을 더한다(기본 "초기화하기" 유지). 확인하면 `onSave(undefined)` 즉시 저장 + draft를 기본값으로 바꾸고 화면에 머무른다.
   - dirty = draft를 저장 형식으로 바꾼 값이 저장값과 다른가 → `onDirtyChange`.

5. **저장소** — `StoredSettingsV3.shiftLabels?: Partial<Record<ShiftType, { name; short; color }>>`. `parseV3`는 필드가 있으면 객체·키·값 타입을 확인하고 `resolveShiftLabels` 후 `validateShiftLabels`가 오류 없을 때만 받아들이며, 아니면 손상(`corrupt`)으로 처리한다(기존 손상 보존 규칙). `saveSettings`는 비었으면 필드를 뺀다(`patternHistory`와 같은 방식).

6. **App·메뉴·문구**
   - 뷰 `{ kind: "shift-labels" }`, 설정 목록 행 "근무 유형"(보조 문구 "기본값" / "N개 바꿈")을 "근무 패턴"과 "화면 설정" 사이에. 뒤로가기는 이름 화면과 같은 dirty 처리.
   - 초기화 문구: 전체 초기화 설명에 "근무 유형" 추가, 근무 패턴 초기화 설명을 "패턴 이력·근무 유형·화면 설정·이름·날짜 세부 내용은 남아요"로.

## Risks / Trade-offs

- [롤백 뒤 사용자 정의 소실] 이전 번들은 필드를 무시하므로 화면은 정상이지만, 이전 번들에서 아무 설정이나 저장하면 `shiftLabels`가 빠진 채 다시 쓰인다 → 롤백할 때 알려진 손실로 문서화(NEXT_STEPS), 데이터 손상은 아니다.
- [긴 이름이 좁은 곳에서 넘침] 이름 최대 4자, 달력 칸은 약어만 쓴다 → E2E에서 4자 이름으로 360px 요약 카드·날짜 화면 가로 스크롤 없음을 확인한다.
- [약어 1자 규칙이 이모지 등에서 어긋남] grapheme 단위로 세어 "1자"로 인정한다 → 단위 테스트에 한글·영문·이모지 경우를 넣는다.
- [기존 E2E가 기본 이름에 의존] 사용자 정의가 없으면 출력이 지금과 같아 기존 스크립트는 메뉴 항목 수·초기화 문구 검사만 바뀐다.
- [팔레트 대비 미달 후보] 단위 테스트가 실패하면 그 색의 글자색만 조정한다(기본 6색은 이미 쓰는 값).

## Migration Plan

마이그레이션 없음(선택 필드 추가). 롤백(`20261015-18`) 시 위 "롤백 뒤 사용자 정의 소실" 외 영향 없음.
