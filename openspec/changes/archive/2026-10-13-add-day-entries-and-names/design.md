# Design

## Context

- 동기·범위는 proposal.md, 동작 계약은 `specs/` 참고.
- 현재 구조: `Root`(테마·TDS) → `App`(View: `loading | setup-intro | load-error | calendar | settings-menu | pattern | display`) → 화면 컴포넌트. 뒤로가기는 `decideBackAction` 순수 함수 + 단일 `backEvent`, 오버레이는 등록부로 먼저 닫음. 저장은 `scheduleStorage`(`turncal.settings`, v2, `migrate()` 분기). 달력 월 상태는 `CalendarScreen` 내부 state라 화면을 떠나면 초기화된다.
- `Storage`는 문자열 키-값(`getItem/setItem/removeItem`). TDS에는 텍스트 입력(`TextField`, `TextArea`)과 확인 다이얼로그가 있다.
- 같은 v1에 들어갈 `add-calendar-banner-ad`가 `CalendarScreen` 하단을 함께 수정한다.

## Goals / Non-Goals

**Goals:**
- "그날 근무"를 결정하는 규칙을 순수 함수 하나로 모아 달력·날짜 화면·테스트가 같은 결과를 쓰게 한다.
- 설정과 세부 내용을 다른 키로 나눠, 세부 내용이 늘거나 손상돼도 설정·달력은 영향받지 않게 한다.
- 화면이 늘어도 기존 상태 머신·뒤로가기 표 방식을 그대로 확장한다.

**Non-Goals:**
- 반복 일정, 알림, 세부 내용 검색·통계, 다른 기기 동기화.
- 하루 단위가 아닌 기간(여러 날) 일정.

## Decisions

### D1. 데이터 모델과 저장 키
```ts
// turncal.settings (v3)
interface StoredSettingsV3 {
  version: 3;
  pattern: WorkPattern | null;        // 근무 패턴 초기화 후 null
  weekStart: WeekStart;
  theme: ThemeId;
  userName: string | null;            // 1~10자
  scheduleName: string | null;        // 1~20자
}
// turncal.entries (v1)
interface StoredEntriesV1 {
  version: 1;
  days: Record<string /* YYYY-MM-DD */, { items: DayEntry[]; shiftSourceId?: string }>;
}
interface DayEntry {
  id: string;            // crypto.randomUUID(), 미지원 시 시간+난수
  name: string;          // 1~20자
  start?: string;        // HH:MM
  end?: string;          // HH:MM (start 있을 때만)
  memo?: string;         // ~500자
  shift?: ShiftType;     // 분류
  createdAt: number;     // 작성 순서(ms)
}
```
- 빈 날짜(`items` 0개)는 저장 시 키에서 지운다.
- 대안: 설정 키에 세부 내용까지 한 JSON — 항목 하나 저장할 때마다 설정 전체를 다시 쓰고, 세부 내용 손상이 설정 복원을 막아 기각.
- `migrate()`는 v1 → v3(테마 인디고, 이름 null), v2 → v3(이름 null)로 변환만 하고 쓰지 않는다. v4 이상은 상위 버전.

### D2. 그날 근무·표시 규칙은 순수 함수
```ts
sortEntries(items)                       // 시작 시간 있는 것 시간순 → 없는 것 createdAt순
getShiftSource(day): DayEntry | null     // shiftSourceId 항목이 분류를 가지면 그것, 아니면 createdAt이 가장 이른 분류 항목
getEffectiveShift(date, pattern, day)    // { shift, overridden }
getCellMarker(day): string | null        // 정렬 첫 항목 이름 첫 글자 + (n>1 ? `+${n-1}` : "")
formatTimeRange(start, end)              // "09:00~18:00", "22:00~다음 날 07:00", "09:00"
```
- 위치: `src/domain/dayEntries.ts`(+ test). 이름 첫 글자는 `Array.from(name)[0]`로 서로게이트 쌍(이모지 등)을 깨뜨리지 않는다.
- 시간 검증: `HH:MM`(00~23:00~59), 종료만 있는 경우 거부.

### D3. 화면 상태와 뒤로가기
- `View` 추가: `names`, `reset`, `day { date }`, `entry { date, entryId | null }`.
- `pattern === null`이면 저장 설정이 있어도 최초 흐름(`setup-intro` → `pattern(first)`)으로 간다. 뒤로가기 표의 `hasSavedSettings`는 "패턴이 있는 설정"으로 정의를 바꾼다.

| 화면 | 동작 |
|---|---|
| (오버레이 열림) | `close-overlay` |
| `names`·`pattern`(dirty) | `confirm-discard` → `settings-menu` |
| `names`·`pattern`·`display`·`reset` | `to-settings-menu` |
| `settings-menu`, `day` | `to-calendar` |
| `entry`(dirty) | `confirm-discard` → `day` |
| `entry` | `to-day` |
| 그 외 최초 화면 | `close` |
- 폐기 다이얼로그는 목적지를 인자로 받는 하나로 일반화한다.
- 달력에서 보던 달을 유지하기 위해 `month` 상태를 `CalendarScreen`에서 `App`으로 올린다.

### D4. 화면 구성
- **달력:** 상단에 근무표 이름(제목, 기본 "내 근무표")과 "{호칭}님"(있을 때). 각 칸을 `<button>`으로 바꾸고 칸 높이를 고정(근무 글자 + 표시 줄)해 표시 기호 유무로 격자가 흔들리지 않게 한다. 바뀐 근무는 근무 글자 오른쪽 위 점(강조색). `aria-label`에 날짜·근무·세부 내용 개수를 포함한다.
- **날짜 화면(`DayScreen`):** 제목 "10월 20일 (화)", 그날 근무(바뀐 경우 "패턴: 야간 → 휴무"), 항목 목록(시간·이름·분류 칩), 분류 항목이 2개 이상이면 "그날 근무로 적용" 라디오, [세부 내용 추가] 버튼.
- **편집 화면(`EntryEditor`):** 이름(TDS TextField, 20자), 시작·종료(`<input type="time">` — 토스 WebView 표시를 실기기로 확인, 문제가 있으면 TDS Wheel 기반 시간 선택으로 교체), 내용(TDS TextArea, 500자), 분류(근무 유형 6종 + "없음" 칩), [저장], (기존 항목이면) [삭제 → 확인]. 저장 전에는 달력·날짜 화면이 바뀌지 않는다.
- **이름 화면(`NamesScreen`):** 호칭·근무표 이름 입력 + [저장], 미리보기 한 줄.
- **초기화 화면(`ResetScreen`):** 세 가지를 위험도 순(근무 패턴 → 화면 설정 → 전체)으로 나열하고 각 설명에 지워지는 범위를 적는다. 실행은 TDS 확인 다이얼로그(전체 초기화 버튼은 danger 색).
- **설정 목록:** 이름(요약: 근무표 이름 또는 "설정 안 함") · 근무 패턴 · 화면 설정 · 초기화 순.

### D5. 초기화 구현
- 근무 패턴: `{ ...settings, pattern: null }` 저장 → `setup-intro`.
- 화면 설정: `{ ...settings, theme: "INDIGO", weekStart: "SUN" }` 저장.
- 전체: `Storage.removeItem("turncal.entries")` → `Storage.removeItem("turncal.settings")` → 상태 초기화 → `setup-intro`. 중간 실패 시 저장소를 다시 읽어 실제 상태로 화면을 맞추고 오류를 안내한다(부분 초기화가 화면과 어긋나지 않게).
- 대안: `Storage.clearItems()` — 미니앱 저장소 전체를 지우므로 앞으로 다른 키가 생겨도 함께 지워져 의도는 맞지만, 개발 mock·다른 용도 키까지 지울 수 있어 명시적 키 삭제를 택함.

### D6. 세부 내용 손상 처리
- `entriesStorage.load()`는 `empty | ok | corrupt | error`를 반환(설정과 같은 패턴). `corrupt`/`error`면 달력은 패턴만으로 표시하고 상단에 안내 한 줄, 날짜 화면은 편집을 막고 [세부 내용 비우고 새로 시작] 확인 버튼만 제공한다. 사용자가 이를 확인해야만 키를 덮어쓴다(명세의 "새로 저장하기 전까지 덮어쓰지 않음").

### D7. 테스트 전략
- 순수 함수: `sortEntries`, `getShiftSource`, `getEffectiveShift`, `getCellMarker`, `formatTimeRange`, 시간·이름 검증, v1/v2 → v3 마이그레이션, `decideBackAction` 표 확장.
- 저장소: `entriesStorage` 저장·복원·손상·무기록, `scheduleStorage` v3 형식·이름 검증·v4 거부·`pattern: null`.
- 브라우저(Devtools mock): 칸 누르기 → 날짜 화면, 항목 추가·수정·삭제, 분류로 근무 변경과 적용 항목 선택, 칸 표시(`병`, `병+2`, 점), 이름 표시, 세 가지 초기화, 뒤로가기 전 경로, 세부 내용 손상 시 동작, 기존 39+58 회귀.
- 실기기: `<input type="time">`·텍스트 입력 키보드, 칸 터치 영역, 저장소 유지.

## Risks / Trade-offs

- [`<input type="time">`이 토스 WebView에서 기대와 다르게 보일 수 있음] → 실기기 확인 후 TDS Wheel 기반 선택으로 교체할 수 있게 입력 컴포넌트를 분리해 둔다.
- [달력 칸이 버튼이 되어 터치 오입력 증가] → 칸 전체를 터치 영역으로(44px 이상), 스크롤 중 탭 오인 방지를 위해 기본 버튼 동작만 사용.
- [배너 광고와의 관계] → 배너는 [설정] 버튼 아래라 칸과 떨어져 있다. 두 change를 함께 구현하므로 통합 스크린샷으로 간격을 다시 확인한다.
- [세부 내용이 쌓여 저장 값이 커짐] → 항목 길이 제한(이름 20·내용 500). 공식 문서상 Storage 값·전체 용량 한도는 없으나 큰 값의 동작 보장도 없어, 저장 실패는 기존 실패 경로(편집 유지·오류 안내)로 처리하고 개수 상한은 두지 않는다.
- [패턴 초기화 후 남은 세부 내용의 분류가 새 패턴과 어긋날 수 있음] → 명세대로 세부 내용은 날짜 기준이라 유지한다. 초기화 설명에 "날짜 세부 내용은 남아요"를 적는다.
- [전체 초기화 중간 실패로 일부만 지워짐] → D5대로 저장소를 다시 읽어 화면을 실제 상태에 맞춘다.

## Migration Plan

- v1·v2 사용자는 첫 실행에서 무기록 변환, 다음 설정 저장 때 v3로 기록. `turncal.entries`는 새 키라 없으면 `empty`.
- 롤백 시 v3 설정은 이전 앱에서 상위 버전 안내 대상이 된다(데이터 보존). v1 출시 전이므로 실사용자 영향은 없다.
