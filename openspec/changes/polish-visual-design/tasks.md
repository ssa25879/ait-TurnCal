# Tasks

## 1. 기준 스크린샷과 기준값

- [x] 1.1 현재 화면의 "전" 스크린샷을 360×740·390×844로 저장한다(달력: 패턴 있음·없음·20자 이름·공휴일 있는 달, 날짜 화면, 세부 내용 편집, 설정 목록·패턴·이름·화면 설정·초기화, 오류 화면; 테마 3종). 확인: 파일 목록을 기록한다(저장소에는 커밋하지 않음).
- [x] 1.2 `style.css`에 `--radius-*`·`--space-*`·`--font-*` 변수를 추가하고 기존 값을 가장 가까운 단계로 옮긴다(화면은 거의 그대로). 확인: 전후 스크린샷 비교에서 의도하지 않은 차이 없음, `typecheck`·단위 테스트·E2E 9종 통과.

## 2. 가이드 위반(P0)

- [x] 2.1 10px 글자(`.cycle-item-order`, `.today-badge`)를 11px 이상으로, `.month-nav-button`과 `.time-clear`의 누르는 영역을 44px 이상으로, `.calendar-holiday` 글자색 대비를 4.5:1 이상으로, `.calendar-cell.is-outside` 투명도를 올린다. 확인: E2E에 11px 미만 글자·44px 터치 영역 검사 추가, 360px 가로 스크롤 없음, 모든 E2E 통과(일요일 숫자 색 등 기존 기대값 유지).

## 3. 달력 첫 화면

- [x] 3.1 칸 높이·줄 간격을 줄이고 배지 크기를 통일하고 오늘 표시(테두리 유지 + 연한 배경)를 칸·카드에 맞춘다. 이름 헤더를 한 줄 위계로 정리한다. 확인: 360×740·390×844에서 6주 격자가 스크롤 없이 모두 보임, 20자 이름 겹침 없음, 배너·[설정] 간격 32px 유지, E2E 통과(필요한 선택자·기대값만 수정).
- [x] 3.2 하단 버튼 줄(바로가기 2개 + [설정])의 무게·크기를 맞춘다(동작·순서 유지). 확인: `calendar-shortcuts`·`banner` E2E 통과, 터치 영역 44px 이상 또는 사용자 승인한 크기.

## 4. 날짜·편집·설정 화면

- [x] 4.1 `.option-card`·`.is-selected` 공용 스타일을 만들고 `.theme-option`·`.scope-option`·`.category-option`을 같은 규칙으로 묶는다. DayScreen의 "그날 근무로 적용"이 `.theme-*`를 쓰지 않게 한다. 분류 선택지 줄바꿈을 정리한다. 확인: `day-entries`·`display-settings`·`pattern-history` E2E 통과.
- [x] 4.2 SettingsScreen·DisplaySettingsScreen의 [저장]을 [초기화] 영역 위로 올리고 초기화를 위험 영역으로 구분한다. 날짜 화면·세부 내용 편집의 간격·위계를 기준값으로 정리한다. 확인: 스크롤 없이도 주 동작이 보임(360×740), E2E 통과.

## 5. 문서·최종 검증

- [ ] 5.1 `docs/NEXT_STEPS.md`(상태 표·테스트 개수·00절)와 `scripts/e2e/README.md`를 갱신한다. 확인: 문서의 테스트 개수가 실제 출력과 일치한다.
- [ ] 5.2 `typecheck`·`npm test`·`test:tz`·E2E 전 종을 실행하고 `build:adtest` 번들을 실기기에서 확인한 뒤(사용자 확인 결과를 기록) 출시 가이드 대조표를 갱신한다. 확인: 모두 통과·확인 필요 항목 보고.

## Workflow follow-up

- 실기기 확인 후 `/opsx:archive polish-visual-design`(명세 변경이 없어 동기화 없음, `skip_specs`).
- `feat/polish-visual-design`을 `main`에 `--no-ff`로 병합·푸시한다.
- 이번 업데이트도 다른 업데이트와 함께 한 번에 출시한다(사용자 계획).
