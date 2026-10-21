# Tasks

## 1. 도메인: 알림 설정·.ics 알림

- [x] 1.1 새 `src/domain/calendarReminder.ts`(`REMINDER_HOURS` 18~23, `DEFAULT_REMINDER_HOUR` 21, `ReminderSetting { enabled, hour }`, `isReminderHour`, `resolveReminder`, `reminderTrigger`, `isReminderShift`, `reminderLabel`)와 `calendarReminder.test.ts`(시각 경계 17·18·23·24·20.5·"21"·null, 필드 없으면 켜짐·21, 끔+20시 유지, 문구 "전날 20:00"·"끔", 트리거 18→`-PT6H`·21→`-PT3H`·23→`-PT1H`, 대상 유형 4종/제외 2종, 문구). 확인: `npm test` 통과.
- [x] 1.2 `buildIcs`에 `reminder` 입력을 더해 대상 일정에 `VALARM`(ACTION:DISPLAY, DESCRIPTION "내일 {이름}", TRIGGER)을 `END:VEVENT` 앞에 넣는다. `monthExport.test.ts`에 추가: 기본 21시 → 야간 일정에 `-PT3H`·"내일 야간", 비번·휴무 일정에 VALARM 없음, 이름 바꾼 휴무("쉼")도 없음, 세부 내용으로 휴무가 된 날 없음, 19시 → `-PT5H`, `enabled: false` → VALARM 0개, BEGIN/END:VALARM 짝, 사용자 정의 이름 이스케이프·75옥텟 접기. 기존 테스트는 `reminder` 인자만 보충. 확인: `npm test`·`npm run test:tz` 통과.

## 2. 저장

- [x] 2.1 `src/storage/scheduleStorage.ts`: `StoredSettingsV3.icsReminderEnabled?: false`·`icsReminderHour?`, v3 파서 검증(잘못된 값은 손상), `saveSettings`에서 켜짐이면 `icsReminderEnabled` 생략·21이면 `icsReminderHour` 생략. `scheduleStorage.test.ts`: 20 저장/복원, 끔+20 저장/복원(두 필드 함께), 켜짐·21이면 두 필드 없음, 필드 없는 기존 설정 그대로, 시각 17·24·20.5·"21"·null과 `icsReminderEnabled` true·"false" 손상 처리. 확인: `npm test` 통과.

## 3. 화면 연결

- [x] 3.1 새 `CalendarReminderScreen`(TDS `Switch` "캘린더 파일에 알림 넣기", 안내 문단, radiogroup 여섯 시각·"기본" 표시·꺼지면 비활성, 오류 `role=alert`), `SettingsMenu`에 "캘린더 알림" 행(화면 설정 다음, 보조 문구 `reminderLabel`), `App.tsx`에 뷰 `{ kind: "reminder" }`·뒤로가기(설정 목록으로)·`updateReminder`(낙관적 반영, 실패 시 되돌림·"캘린더 알림을 저장하지 못했어요. 다시 시도해 주세요."), `exportMonth`·`ExportSheet`에 설정 전달과 안내 한 줄, 전체 초기화 경고 문구에 "캘린더 알림" 추가, 스타일. 확인: `npm run typecheck` 통과.
- [x] 3.2 E2E 새 스크립트 `scripts/e2e/calendar-reminder.mjs`: 설정 목록 여섯 항목·순서·보조 문구 "전날 21:00", 화면 기본 상태(토글 켜짐·21시 선택)·안내 문구, 20시 선택 → 목록 문구·새로고침 후 유지·저장값 `icsReminderHour: 20`, 21시로 되돌리면 필드 없음, 토글 끄기 → 목록 "끔"·시각 선택지 비활성(눌러도 안 바뀜)·저장값 `icsReminderEnabled: false`·바텀시트 문구, 다시 켜면 20시 그대로, 뒤로가기 → 설정 목록, .ics 다운로드에 VALARM(기본 `-PT3H`, 비번·휴무 없음, 끄면 0개), 저장 실패(저장소 쓰기 실패 주입) → 되돌림·안내, 패턴 초기화 뒤 설정 유지, 전체 초기화 뒤 기본값, 360px 가로 스크롤 없음·선택지 높이 44px·글자 11px 이상. 기존 `display-settings`·`shift-labels`·`navbar-settings`·`month-export`·`empty-calendar`(설정 목록 항목 수·초기화 문구·바텀시트 안내)의 기대값 조정. 확인: 새 스크립트·기존 스크립트 통과.

## 3A. 실기기에서 드러난 기존 버그(2026-10-21)

- [x] 3A.1 캘린더 파일 보내기가 v1.2 라이브에서도 "파일이 이미 존재해요"로 실패(진단 번들 `20261021-25`, 브랜치 `spike/ics-export-error` — **병합·출시 금지**). 같은 이름(`turncal-YYYY-MM.ics`)이 기기에 있으면 토스 앱이 저장을 거부한다. 파일 이름을 `turncal-YYYY-MM-YYYYMMDDHHMMSS.<확장자>`(보낸 현지 시각)로 바꾸고(PNG 포함) `schedule-export` "저장 파일 이름"·"달력 이미지 보내기"·"캘린더 파일 보내기" 명세 수정, 단위·`month-export` E2E 갱신. 확인: 단위 367·E2E month-export 28·calendar-reminder 32 통과.

## 4. 통합 확인·문서

- [x] 4.1 `typecheck`·`npm test`·`test:tz`·E2E 전 종(14종, 개발 서버 실행 중 `src` 수정 금지)을 돌린다. 확인: 전부 통과, 개수 기록.
- [ ] 4.2 `docs/NEXT_STEPS.md`(00절 상태·테스트 개수·이 change의 출시 가이드 대조표 — docs MCP `getPage`로 원문 새로 받아 대조)와 `scripts/e2e/README.md`를 갱신한다. 확인: 문서 개수가 4.1 출력과 일치.
- [ ] 4.3 `npm run build:adtest` 번들을 `/ait:test-on-device`로 올려 사용자가 실기기에서 .ics를 보내 받은 뒤 캘린더 앱(가능하면 삼성 캘린더와 구글 캘린더 둘 다)으로 가져와 근무 일정에 전날 21:00 알림이 들어가는지, 비번·휴무에는 없는지, 설정 화면·바텀시트 문구를 확인한다(검토 신청 금지). 알림이 무시되면 안내 문구 조정 방안을 사용자와 정한다. 확인: 사용자 확인 결과를 NEXT_STEPS에 기록.

## Workflow follow-up

- 실기기 확인 뒤 `/opsx:archive add-ics-evening-reminder`(명세 동기화: `calendar-reminder` 신규, `schedule-export`·`display-settings`·`settings-persistence`·`settings-reset`·`miniapp-shell` 수정).
- 브랜치 `feat/add-ics-evening-reminder`를 `main`에 `--no-ff`로 병합·푸시한다(브랜치는 지우지 않는다). 출시 여부와 시점은 사용자가 정한다(검토 신청은 사용자가 요청할 때만).
