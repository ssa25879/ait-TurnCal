# Tasks

## 1. 도메인 규칙 (`day-entries`)

- [ ] 1.1 `src/domain/dayEntries.ts`에 `DayEntry`·`DayRecord` 타입, `sortEntries`, `getShiftSource`, `getEffectiveShift`, `getCellMarker`, `formatTimeRange`, 이름(1~20자)·시간(`HH:MM`, 종료만 금지)·내용(500자) 검증을 구현한다 — `dayEntries.test.ts`로 명세의 정렬·자정 넘김·종료만 입력·분류 기본값(먼저 작성)·적용 항목 선택·분류 제거 후 패턴 복귀·`병`/`병+2` 표시·서로게이트 문자 첫 글자를 확인한다

## 2. 저장소 (`settings-persistence`, `day-entries`)

- [ ] 2.1 `scheduleStorage.ts`를 `StoredSettingsV3`(`pattern: null` 허용, `userName`·`scheduleName`)로 올리고 v1·v2 → v3 무기록 변환, 이름 형식·길이 검증, v4 이상 거부를 구현한다 — 테스트로 v3 형식, v1·v2 복원 후 저장값 불변, 이후 첫 저장이 v3, 이름 21자 → corrupt, `version: 4` → corrupt·보존을 확인한다
- [ ] 2.2 `src/storage/entriesStorage.ts`에 `turncal.entries`(v1) `load`(empty/ok/corrupt/error, 손상 시 무기록)·`save`(빈 날짜 키 제거)·`remove`를 구현한다 — `vi.mock` 테스트로 저장·복원, 빈 날짜 제거, 손상·읽기 실패 시 쓰기 없음, 쓰기 실패 전달을 확인한다
- [ ] 2.3 초기화 함수(`resetPattern`, `resetDisplay`, `resetAll`)를 구현하고 `resetAll`은 entries → settings 순서로 삭제하며 실패 시 오류를 전달한다 — 테스트로 각 초기화의 저장 결과와 중간 실패 시 오류 전달을 확인한다

## 3. 화면 흐름과 뒤로가기 (`miniapp-shell`)

- [ ] 3.1 `decideBackAction`에 `names`·`reset`·`day`·`entry` 화면과 `to-day` 동작을 추가하고 `hasSavedSettings`를 "패턴이 있는 설정"으로 정의한다 — design D3 표 기반 단위 테스트로 모든 조합(오버레이 우선 포함)을 확인한다
- [ ] 3.2 `App`의 `View`를 확장하고(`names`·`reset`·`day`·`entry`), 달력 `month` 상태를 `App`으로 올리며, 폐기 다이얼로그를 목적지 인자를 받도록 일반화하고, 세부 내용 로드·저장 상태를 연결한다. `pattern === null`이면 최초 등록 흐름으로 보낸다 — `npx tsc --noEmit` 통과와 브라우저에서 화면 전환·날짜 화면에서 돌아올 때 보던 달 유지를 확인한다

## 4. 화면 구현

- [ ] 4.1 `Calendar`의 칸을 `<button>`(고정 높이, 44px 이상 터치 영역, `aria-label`에 날짜·근무·항목 수)으로 바꾸고 바뀐 근무 글자·변경 점·이름 앞글자/`+n` 표시를 추가한다(`shift-calendar`, `day-entries`) — 브라우저에서 칸 누르기와 표시를 확인한다
- [ ] 4.2 `CalendarScreen` 상단에 근무표 이름(기본 "내 근무표")과 "{호칭}님"을 표시하고, 세부 내용 손상 시 안내 한 줄을 표시한다(`schedule-names`, `day-entries`) — 브라우저에서 이름 유무별 표시를 확인한다
- [ ] 4.3 `DayScreen`을 만든다(날짜 제목, 그날 근무와 변경 전후 표시, 정렬된 항목 목록, 분류 항목 2개 이상일 때 "그날 근무로 적용" 선택, [세부 내용 추가], 손상 시 편집 차단과 [비우고 새로 시작] 확인) — 브라우저에서 목록·적용 항목 선택·손상 동작을 확인한다
- [ ] 4.4 `EntryEditor`를 만든다(이름 TextField, 시작·종료 시간 입력 컴포넌트 분리, 내용 TextArea, 분류 칩+없음, 저장·검증 안내, 기존 항목 삭제 확인, dirty 추적) — 브라우저에서 추가·수정·삭제·검증 안내·저장 실패 시 입력 유지를 확인한다
- [ ] 4.5 `NamesScreen`을 만든다(호칭 10자·근무표 이름 20자, 공백 제거, 저장, dirty 추적) — 브라우저에서 저장 후 달력 상단 반영과 길이 초과 안내를 확인한다
- [ ] 4.6 `ResetScreen`을 만든다(세 초기화, 지워지는 범위 설명, 확인 다이얼로그, 전체 초기화는 danger 색, 실패 안내) — 브라우저에서 세 초기화 결과와 취소 시 무변경을 확인한다
- [ ] 4.7 `SettingsMenu`를 이름·근무 패턴·화면 설정·초기화 순서로 갱신한다(`display-settings`) — 브라우저에서 네 항목이 각 화면을 여는지 확인한다

## 5. 통합 검증

- [ ] 5.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`가 모두 통과하는지 확인한다
- [ ] 5.2 브라우저 E2E(Devtools mock)를 확장해 실행한다: 날짜 화면 진입, 항목 추가·수정·삭제, 분류로 근무 변경·적용 항목 선택·분류 제거 복귀, 칸 표시(`병`·`병+2`·점), 이름 표시, 세 초기화, 뒤로가기 전 경로(편집 dirty 포함), 세부 내용 손상, v1·v2 저장값 실행, 기존 39+58 회귀 — 전부 통과를 확인한다
- [ ] 5.3 세 테마로 달력(세부 내용 있음)·날짜 화면·편집 화면·이름·초기화 화면 스크린샷을 찍어 칸 표시가 겹치지 않고 격자 높이가 일정한지, 토스 브랜드 색·서체가 없는지 확인한다

## Workflow follow-up

- `add-calendar-banner-ad`와 함께 v1 출시 후보를 만들고, 실기기에서 시간 입력·텍스트 입력 키보드·칸 터치를 확인한 뒤 비게임 출시 가이드 전 항목을 다시 대조한다. 검토 신청은 출시 버전만.
- 리뷰 후 `/opsx:archive add-day-entries-and-names`.
