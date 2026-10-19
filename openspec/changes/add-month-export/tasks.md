# Tasks

## 0. 저장 위치 확인(본 구현 전)

- [ ] 0.1 임시 확인용 번들(브랜치 `spike/save-location`, `main`에 병합하지 않음)로 실기기에서 `saveBase64Data`가 작은 PNG·`.ics`·`.txt`를 어디에 저장하는지, 저장 직후 토스 앱이 보여 주는 화면·알림, 갤러리·파일 앱·다운로드 폴더 표시 여부, `.ics`를 눌렀을 때 캘린더 앱으로 열리는지를 사용자가 확인한다. 확인: 결과를 `design.md` Context와 NEXT_STEPS에 기록하고, 결과에 따라 안내 문구·.ics 선택지 유지 여부를 정한 뒤 1단계로 간다.

## 1. 도메인: 날짜별 근무·.ics·인코딩

- [ ] 1.1 `src/domain/monthExport.ts`에 `buildMonthShifts`, `buildIcs`, `toBase64Utf8`, 파일 이름 함수(`turncal-YYYY-MM.png/.ics`, 인자는 연·월·확장자뿐)를 만든다. `monthExport.test.ts`: 달 길이(2월·윤년·31일), 이력 경계·패턴 없는 날 null, 세부 내용 분류 우선, .ics 구조(BEGIN/END 짝, VERSION·PRODID, 근무 있는 날만 VEVENT, 종일 DTSTART/DTEND 다음 날·월말→다음 달 1일, UID 날짜 고정, SUMMARY=사용자 정의 이름, 링크 있음/없음, CRLF, 이스케이프, 75옥텟 접기), 세부 내용 이름·메모가 결과에 없음, 파일 이름이 근무표 이름과 무관, base64 왕복(한글). 확인: `npm test`·`npm run test:tz` 통과.

## 2. 이미지 그리기

- [ ] 2.1 `src/export/renderMonthImage.ts`에 순수 배치 함수 `layoutMonthImage`(폭 1080, 주 수에 따른 높이, 칸 좌표, 범례 항목=그달에 쓰인 유형 순서)와 Canvas 그리기 `renderMonthImage`(→ base64 PNG)를 만든다. `renderMonthImage.test.ts`는 배치 함수만 검사(5주/6주 높이, 칸 42개, 범례 중복 없음·SHIFT_TYPES 순서, 주 시작 요일 반영). 확인: `npm test` 통과, `npm run typecheck` 통과.

## 3. 화면 연결

- [ ] 3.1 `ExportSheet`(TDS BottomSheet, 선택지 두 개, `useCloseOnBack`)와 `CalendarScreen`의 [이번 달 내보내기](현재 패턴 있을 때만, `.bottom-action` 안 바로가기 줄 다음), 보내기 흐름(`isSupported` 확인 → 링크 2초 제한 → `saveBase64Data` → 성공 안내 없음, 실패·미지원만 `role=alert` 안내, 달 이동·화면 이동 시 안내 지움)을 만든다. 스타일 추가. 확인: `npm run typecheck` 통과.
- [ ] 3.2 E2E 새 스크립트 `scripts/e2e/month-export.mjs`: 버튼 표시(패턴 있음)·숨김(첫 실행·패턴 초기화 뒤), 바텀시트 선택지·뒤로가기로 닫힘(저장 없음), 이미지 보내기 → 다운로드 이름 `turncal-2026-10.png`·PNG 서명·폭 1080·완료 안내 없음, 11월로 넘겨 저장 → `turncal-2026-11.png`, .ics 저장 → 이름·VEVENT 수·10/13 SUMMARY·사용자 정의 이름·바뀐 근무 반영·세부 내용 이름/메모 없음·DESCRIPTION에 mock 공유 링크(`intoss://ait-turncal`)·`intoss-private` 없음, 링크 실패(createLink를 실패시킴) → 링크 없이 저장, 저장 실패(saveBase64Data 실패) → 실패 안내·저장값 그대로, 지원 안 함(isSupported false) → 업데이트 안내·다운로드 없음, 360px 가로 스크롤 없음·버튼 글자 11px 이상. 기존 `banner`(32px 간격)·`visual-audit`(6주 격자 첫 화면·터치 영역)·`calendar-shortcuts`·`empty-calendar` 통과 확인, 필요하면 기대값 조정. 확인: 새 스크립트·기존 스크립트 통과.

## 4. 통합 확인·문서

- [ ] 4.1 `typecheck`·`npm test`·`test:tz`·E2E 전 종(13종, 개발 서버 실행 중 `src` 수정 금지)을 돌린다. 확인: 전부 통과, 개수 기록.
- [ ] 4.2 `docs/NEXT_STEPS.md`(00절 선택 사항 3번 상태·테스트 개수·이 change의 출시 가이드 대조표, docs MCP `getPage`로 원문 새로 받아 대조 — 특히 공유 링크 `intoss://`)와 `scripts/e2e/README.md`를 갱신한다. 확인: 문서 개수가 4.1 출력과 일치.
- [ ] 4.3 `npm run build:adtest` 번들을 `/ait:test-on-device`로 올려 사용자가 실기기에서 이미지 보내기(공유 창·받은 이미지 화질·내용)와 .ics 보내기·캘린더 앱 가져오기를 확인한다(검토 신청 금지). .ics 가져오기가 안 되면 선택지를 빼는 방안을 사용자와 정한다. 확인: 사용자 확인 결과를 NEXT_STEPS에 기록.

## Workflow follow-up

- 실기기 확인 뒤 `/opsx:archive add-month-export`(명세 동기화: `schedule-export` 신규).
- 브랜치 `feat/add-month-export`를 `main`에 `--no-ff`로 병합·푸시한다. 출시는 v1.2 다른 항목과 묶을지 사용자가 정한다(검토 신청은 사용자가 요청할 때만).
