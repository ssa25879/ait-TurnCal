# Design

## Context

- 동기·범위는 proposal.md, 동작 계약은 `specs/` 참고.
- 현재 구조(MVP):
  - `App.tsx`의 `View`는 `loading | setup-intro | load-error | settings | calendar`. `settings`는 근무 패턴 설정(`SettingsScreen`) 하나이며, 저장된 설정 유무로 최초/편집 흐름을 구분한다.
  - 주 시작 요일 토글(TDS `SegmentedControl`)은 `CalendarScreen` 하단에 있고 `changeWeekStart`가 낙관적 갱신 후 `saveSettings`, 실패 시 되돌린다.
  - 강조색은 `style.css`의 `--color-primary`(인디고) 한 값, TDS는 `main.tsx`에서 `TDSMobileAITProvider brandPrimaryColor={BRAND_PRIMARY_COLOR}`로 고정 전달.
  - 저장은 `scheduleStorage.ts`의 `StoredSettingsV1`(`version: 1`), `migrate()`가 version별 분기 지점이다.
  - 뒤로가기는 `decideBackAction(state)` 순수 함수 + `registerBackHandler` 단일 리스너, 오버레이는 `overlayBack` 등록부로 먼저 닫는다.
- 제약: 라이트 모드 전용, 토스 브랜드 색 금지, `apps-in-toss.config.ts`의 `brand.primaryColor`와 로고는 인디고 유지.

## Goals / Non-Goals

**Goals:**
- 근무 확인 화면(달력)에서 설정 UI를 걷어내고 설정 목록 → 상세 2단 구조로 옮긴다.
- 테마를 한 곳(테마 정의 맵)에서 정의하고 CSS 변수와 TDS Provider 색을 같은 값으로 구동한다.
- MVP의 v1 저장값을 가진 사용자가 업데이트 후에도 그대로 이어서 쓴다.

**Non-Goals:**
- 다크모드, 사용자 지정 색(임의 hex), 근무 유형 색 변경.
- 라우터 도입(화면 수가 늘어도 상태 머신으로 충분).
- 콘솔 등록 대표색·로고의 테마별 변경.

## Decisions

### D1. 화면 상태 머신 확장
```text
 [setup-intro] --CTA--> [pattern(first)] --save--> [calendar]
                                                     |  ^
                                            설정 진입 v  | back
                                               [settings-menu]
                                                 |        |
                                     근무 패턴    v        v  화면 설정
                                  [pattern(edit)]    [display]
                                   save -> calendar   back -> menu
                                   back -> menu (dirty면 확인)
```
- `View`: `loading | setup-intro | load-error | settings-menu | pattern | display | calendar`. 기존 `settings`는 `pattern`으로 이름을 바꾼다(최초/편집 구분은 지금처럼 저장 설정 유무).
- 근무 패턴 저장 성공 시 목적지는 지금처럼 달력(변경 결과를 바로 확인). 명세(`shift-pattern-settings` 편집 내용 확정)와 일치.
- 대안: 설정 목록 없이 달력에 진입 버튼 2개 — 사용자 결정으로 기각(설정 추가 시 확장성, 저장 방식 분리).

### D2. 뒤로가기 규칙 갱신
`decideBackAction`에 화면을 추가하고 동작을 하나 늘린다(`to-settings-menu`).

| 화면 | 저장 설정 | dirty | 동작 |
|---|---|---|---|
| (오버레이 열림) | - | - | `close-overlay` |
| `pattern` | 있음 | 예 | `confirm-discard` → 확인 시 `settings-menu` |
| `pattern` | 있음 | 아니오 | `to-settings-menu` |
| `display` | 있음 | - | `to-settings-menu` |
| `settings-menu` | 있음 | - | `to-calendar` |
| 그 외(`calendar`, `setup-intro`, `load-error`, `pattern` 최초, `loading`) | - | - | `close` |

- 폐기 다이얼로그의 "버리기" 목적지도 `settings-menu`로 바꾼다.
- 순수 함수 표 테스트를 그대로 확장한다.

### D3. 테마 정의와 적용
```ts
type ThemeId = "INDIGO" | "TEAL" | "CORAL";
const THEMES: Record<ThemeId, { name: string; primary: string; primaryWeak: string }> = {
  INDIGO: { name: "인디고",      primary: "#4F46E5", primaryWeak: "#EEF2FF" },
  TEAL:   { name: "딥 틸",       primary: "#0F766E", primaryWeak: "#E6F4F2" },
  CORAL:  { name: "코랄 오렌지", primary: "#C2410C", primaryWeak: "#FFF1EA" },
};
const DEFAULT_THEME: ThemeId = "INDIGO";
```
- 정의는 `src/domain/theme.ts` 한 곳. `brand.ts`의 `BRAND_PRIMARY_COLOR`는 `THEMES.INDIGO.primary`를 가리키게 해 중복 hex를 없앤다(콘솔 `brand.primaryColor`는 설정 파일이라 문자열로 유지, 같은 값임을 주석으로 표기).
- 적용 1 — CSS: `applyTheme(target, themeId)`가 `--color-primary`, `--color-primary-weak`를 `setProperty`로 설정. `style.css`에서 하드코딩된 강조색 사용처(오늘 테두리, 선택 칸, 오늘 배지, 토요일 머리글)는 모두 이 변수를 쓰도록 정리한다.
- 적용 2 — TDS: 테마 상태를 Provider 위로 올린다. `main.tsx`의 루트 컴포넌트가 테마 상태를 갖고 `TDSMobileAITProvider brandPrimaryColor={THEMES[theme].primary}`로 전달, `App`에는 `theme`/`onThemeChange`를 내려준다. Provider가 prop 변경에 즉시 다시 그리는지 구현 첫 단계에서 확인한다(안 되면 `key={theme}`로 Provider 재마운트 — 화면 상태는 Provider 밖 상위 상태라 유지되지만, TDS 내부 포털 상태가 초기화되는 점을 감수).
- 대안: `data-theme` 속성 + CSS 셀렉터 — TDS 색은 여전히 JS로 넘겨야 해 정의가 CSS·TS 두 곳으로 갈라져 기각.
- 대비: 세 primary 모두 흰 글자 대비 4.5:1 이상(인디고 약 6.3, 딥 틸 약 5.5, 코랄 약 5.2).

### D4. 화면 구성
- **달력:** 하단 `SegmentedControl` 제거, 하단 버튼을 "설정"(설정 목록 진입)으로 바꾼다.
- **설정 목록(`SettingsMenu`):** 제목 "설정", TDS `ListRow` 두 줄 — "근무 패턴"(보조 문구: 현재 패턴 길이, 예 "6일 주기"), "화면 설정"(보조 문구: 현재 테마 이름 · 주 시작 요일). 오른쪽 화살표는 TDS 제공 요소를 쓴다(텍스트 꺾쇠 금지).
- **화면 설정(`DisplaySettingsScreen`):** 섹션 "테마 색" — 세 선택지를 색 견본 + 이름 + 선택 표시의 라디오 목록으로(`role="radiogroup"`). 섹션 "달력" — 주 시작 요일 `SegmentedControl`(기존 컴포넌트 이동). 각 섹션 아래 저장 실패 안내 자리.
- 즉시 저장 로직은 `App`의 `updateDisplaySettings(patch)` 하나로 합친다: 낙관적 갱신 → `saveSettings` → 실패 시 이전 값 복원 + 오류 메시지. 테마와 주 시작 요일이 같은 경로를 쓴다.

### D5. 저장 스키마 v2와 마이그레이션
```ts
interface StoredSettingsV2 { version: 2; pattern: WorkPattern; weekStart: WeekStart; theme: ThemeId }
```
- `CURRENT_VERSION = 2`. `migrate()`:
  - `version: 1` → `parseV1` 후 `{ ...v1, version: 2, theme: "INDIGO" }`로 변환해 `ok` 반환. 저장소에 쓰지 않는다.
  - `version: 2` → `parseV2`(v1 검증 + `theme` 검증).
  - `version >= 3` → 상위 버전(corrupt, 삭제 안 함).
- 앱 내부 타입은 항상 v2. 다음 `saveSettings` 호출(패턴 저장, 테마·주 시작 변경)이 자연스럽게 v2로 기록한다.
- 대안: 로드 직후 v2로 즉시 재기록 — 실패 경로가 하나 늘고, 명세상 "복원만으로 쓰지 않음"과 충돌해 기각.

### D6. 테스트 전략
- 순수 함수: `decideBackAction` 표 확장, `migrate` v1→v2·v2 테마 검증·v3 거부, `applyTheme`(가짜 style 대상).
- 저장소: 기존 `vi.mock` 메모리 Storage 테스트에 v2 형식·v1 복원 무기록·알 수 없는 테마 추가.
- 브라우저(E2E, 저장소 밖 스크립트): 설정 목록 진입·뒤로가기 계층, 테마 변경 즉시 반영과 재실행 유지, TDS 버튼 색 변경, 주 시작 요일 이동, v1 저장값 주입 후 실행, 저장 실패 되돌림.

## Risks / Trade-offs

- [TDS Provider가 `brandPrimaryColor` 변경을 즉시 반영하지 않을 수 있음] → D3대로 확인 후 `key` 재마운트로 대체. 재마운트 시 열린 오버레이가 닫히는 정도만 감수(테마 변경은 오버레이가 없는 화면에서 일어남).
- [설정 목록 단계가 하나 늘어 근무 패턴 수정 경로가 길어짐] → 사용자 결정. 목록 항목에 현재 값 요약을 보여 진입 전 상태를 알 수 있게 한다.
- [v1 → v2 이후 사용자가 구버전 앱으로 돌아가면 v2를 상위 버전으로 보고 안내] → MVP의 상위 버전 보존 규칙 덕분에 데이터는 지워지지 않는다. 미니앱은 단일 라이브 버전이라 실제 가능성은 낮다.
- [테마 색이 오늘 강조 등에서 근무 유형 색과 겹쳐 보일 수 있음(예: 딥 틸 vs 비번 청록)] → 오늘 강조는 테두리, 근무 유형은 칸 배경이라 형태로 구분된다. 구현 후 스크린샷으로 확인.
- [하드코딩된 강조색이 남아 테마가 일부만 바뀜] → `style.css`에서 hex 직접 사용을 grep으로 점검하는 작업을 둔다.

## Migration Plan

- 배포 후 첫 실행에서 v1 사용자는 자동으로 인디고 테마로 이어진다(무기록). 첫 설정 저장 시 v2로 기록.
- 되돌릴 때 이전 번들로 롤백하면 v2 저장값은 상위 버전 안내 대상이 되므로, 롤백이 필요하면 v2 저장 전(테마·설정 변경 전) 사용자만 영향이 없다는 점을 릴리즈 노트에 남긴다.
