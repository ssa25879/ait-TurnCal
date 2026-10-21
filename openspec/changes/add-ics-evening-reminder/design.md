# Design

## Context

- 캘린더 파일은 `src/domain/monthExport.ts`의 `buildIcs`가 만든다. 근무가 있는 날마다 `DTSTART;VALUE=DATE`/`DTEND;VALUE=DATE` 종일 일정 하나, 제목은 근무 이름, 알림(`VALARM`)은 없다. `src/export/exportMonth.ts`가 링크를 만들고 `saveBase64Data`로 공유 창에 넘긴다.
- 실기기(Android, 2026-10-19): 공유 창에는 캘린더 앱이 없고, 메신저 등으로 받은 .ics를 열면 캘린더 앱으로 가져올 수 있었다. **가져올 때 `VALARM`이 유지되는지는 아직 확인한 적 없다** — 이 change의 핵심 위험이다.
- 설정은 `turncal.settings` 한 키(`version: 3`)에 저장하고, 새 값은 선택 필드로 더해 왔다(`patternHistory`, `shiftLabels`). 화면 설정은 [저장] 없이 즉시 저장, 실패 시 되돌림(`App.tsx` `updateDisplaySettings`).
- 푸시는 서버·동의문이 필요해 보류(2026-10-21). 사용자 결정(2026-10-21): 기본 전날 21:00, 설정에서 변경 가능, 비번·휴무 제외.

## Goals / Non-Goals

**Goals:**
- 알림 대상 근무 일정마다 전날 설정 시각에 울리는 표시 알림을 .ics에 넣는다.
- 알림은 기본으로 켜 두되, 사용자가 토글로 끌 수 있게 한다(2026-10-21 사용자 결정). 시각(18~23시)도 고르며 둘 다 바로 저장한다.
- 이전 번들·기존 저장값과 호환(`version: 3` 유지).

**Non-Goals:**
- 푸시·서버·앱 안 알림, 근무별 시작 시각 입력, 분 단위 시각, 근무 유형별 알림 켜기/끄기.
- 이미 캘린더 앱에 가져온 일정을 고치는 일(다시 보내야 반영 — 같은 UID라 앱이 지원하면 갱신된다).

## Decisions

1. **트리거는 일정 시작 기준 상대값 `TRIGGER:-PT{24-h}H`.** 종일 일정의 `DTSTART;VALUE=DATE`는 기기 현지 0시이므로 21시는 `-PT3H`, 18시는 `-PT6H`. 절대 시각(`VALUE=DATE-TIME`)은 시간대(`TZID`/UTC)를 정해야 해서 floating 날짜 일정과 어긋날 수 있다. 상대값은 받는 기기의 현지 시각을 따르므로 서울·해외 모두 "전날 그 시각"이 된다.
2. **`VALARM` 구성:** `BEGIN:VALARM` / `ACTION:DISPLAY` / `DESCRIPTION:내일 {근무 이름}`(이스케이프·접기 기존 함수 사용) / `TRIGGER:-PT3H` / `END:VALARM`을 `END:VEVENT` 바로 앞에 둔다. RFC 5545상 DISPLAY는 DESCRIPTION이 필수다. 일정당 알림 하나.
3. **대상 판정은 내부 유형:** `REMINDER_SHIFTS = DAY, EVENING, NIGHT, DUTY`. 이름을 바꿔도 유형 ID로 판정한다. 세부 내용 분류로 바뀐 근무(`getEffectiveShift`)를 그대로 따르므로 야간인 날이 "휴무"로 바뀌면 알림이 빠진다.
4. **새 도메인 모듈 `src/domain/calendarReminder.ts`:** `REMINDER_HOURS = [18..23]`, `DEFAULT_REMINDER_HOUR = 21`, `type ReminderHour = 18|…|23`, `interface ReminderSetting { enabled: boolean; hour: ReminderHour }`, `isReminderHour`, `resolveReminder(settings) → ReminderSetting`(필드 없으면 `{ enabled: true, hour: 21 }`), `reminderTrigger(hour) → "-PT3H"`, `isReminderShift(shift)`, `reminderLabel(setting) → "전날 21:00" | "끔"`. `buildIcs`는 입력에 `reminder: ReminderSetting`을 받는다(필수 — 호출부가 하나뿐이고 빠뜨리면 타입 오류로 드러나게). `enabled: false`면 VALARM을 넣지 않는다.
5. **저장: 켜기/끄기와 시각을 독립된 두 선택 필드로.** `icsReminderEnabled?: false`(끈 경우만 둠), `icsReminderHour?: 18|19|20|22|23`(21이 아닌 경우만 둠). 한 필드에 `null`로 끄기를 담으면 끄는 순간 고른 시각이 사라져 다시 켤 때 21시로 돌아가므로 나눴다. 기본값이면 `saveSettings`에서 두 필드를 지운다(`shiftLabels`와 같은 방식). 파서는 `icsReminderEnabled`는 `false`만, `icsReminderHour`는 18~23 정수만 허용하고(21도 허용 — 직접 고친 값 대비) 그 밖은 손상 처리.
6. **화면: 새 `CalendarReminderScreen`, 설정 목록 "화면 설정"과 "초기화" 사이.** 맨 위에 TDS `Switch`("캘린더 파일에 알림 넣기", 접근성 이름 동일, 행 높이 44px 이상), 그 아래 안내 문단, 그 아래 테마 선택과 같은 `role="radiogroup"` 버튼 목록 여섯 개(각 높이 44px 이상, "전날 21:00" 옆에 "기본" 표시). 토글이 꺼지면 선택지는 `disabled`·`aria-disabled`로 비활성 표시하고 선택 값은 유지한다. 즉시 저장 + 실패 시 되돌림·`role=alert` 안내 — `updateDisplaySettings`와 같은 흐름을 일반화하지 않고 `updateReminder(patch)`로 따로 둔다(필드 생략 규칙이 달라서). 되돌리기 버튼은 두지 않는다(토글 켜기 + "전날 21:00 (기본)" 고르기가 되돌리기).
7. **화면 설정에 넣지 않은 이유:** "화면 설정 초기화"가 테마·주 시작 요일만 되돌린다는 기존 규칙과 문구를 바꾸지 않기 위해서다. 바텀시트 안 선택은 사용자가 "설정에서"를 골랐다.
8. **바텀시트 안내 한 줄 추가:** 캘린더 파일 선택지 안내 두 줄 아래에 현재 설정 문장. `ExportSheet`에 `reminder` prop을 넘긴다.

## Risks / Trade-offs

- [캘린더 앱이 가져온 파일의 알림을 무시] → 실기기에서 삼성 캘린더·구글 캘린더로 확인(tasks 4.3). 무시되면 화면 안내 문구를 "캘린더 앱에 따라 알림이 들어가지 않을 수 있어요"로 바꾸는 방안을 사용자와 정한다.
- [캘린더 앱의 기본 알림과 중복] → 앱에 따라 가져온 일정에 기본 알림을 더할 수 있다. 막을 방법이 없어 안내하지 않는다.
- [이미 가져온 일정은 바뀌지 않음] → 화면 안내에 "다시 보내야 반영"을 적는다.
- [롤백] → 이전 번들(`20261019-23`)은 필드를 무시하고 알림 없는 .ics를 만든다. 이전 번들에서 설정을 저장하면 `icsReminderEnabled`·`icsReminderHour`가 빠져 기본값(켜짐·21시)으로 돌아간다(데이터 손상 아님 — 다만 알림을 꺼 둔 사용자는 다시 켜진다).
- [기본으로 켜짐] → 업데이트 뒤 처음 보내는 파일부터 알림이 들어가 원치 않는 사용자가 있을 수 있다. 바텀시트 안내 한 줄과 설정 토글로 바로 끌 수 있게 한다.
- [설정 목록 여섯 항목] → 360px에서 첫 화면 안에 들어오는지 E2E로 확인.

## Migration Plan

- 저장 형식 `version: 3` 유지, 마이그레이션 없음. 기존 사용자는 필드가 없어 기본값(전날 21:00)으로 동작한다 — 업데이트 후 처음 보내는 .ics부터 알림이 들어간다. 출시 노트에 적는다.
