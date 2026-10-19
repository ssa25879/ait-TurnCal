# Design

## Context

- 동기는 proposal.md, 요구사항은 `specs/schedule-export/spec.md`.
- 달력 칸의 근무는 `Calendar.tsx`에서 `getEffectiveShift(date, resolvePattern(date, timeline), days[date])`로 정한다. 표시값은 `useShiftLabels()`(근무 유형 사용자 정의), 날짜 격자는 `buildMonthGrid(month, weekStart)`, 요일 이름은 `getWeekdayLabels(weekStart)`.
- 달력 하단 `.bottom-action` 안에 바로가기 줄(`.shortcut-row`)과 대체 [설정]이 있다. 배너 E2E는 `.bottom-action` 아래와 배너 사이가 32px 이상인지 본다.
- SDK: `saveBase64Data({ data, fileName, mimeType })`(`isSupported()` 있음, Android 5.218.0·iOS 5.216.0), `Share.createLink({ path })` → 문자열 링크. Devtools 흉내 구현은 `saveBase64Data`를 브라우저 다운로드(`a[download]`)로, `createLink`를 `https://toss.im/share/mock<path>`로 돌려준다.
- **실기기 확인(2026-10-19, 임시 번들 `20261019-21`, 브랜치 `spike/save-location`):** Android에서 `saveBase64Data`는 기기에 바로 저장하지 않고 **파일 공유 창**을 연다(카카오톡·구글 드라이브 등으로 보냄). PNG·.ics·.txt 모두 공유 창으로 정상 전달됐다. 사용자가 공유 창을 **취소해도 Promise는 성공으로 끝난다** → 앱은 실제로 보냈는지 알 수 없다. `Share.createLink`는 링크 문자열을 정상 반환했다(복사·공유는 하지 않으므로 화면에 표시만 됨). 같은 코드로 브라우저에서 만든 PNG는 내용이 정확했다. .ics를 캘린더 앱으로 가져오는 흐름은 아직 미확인.
- 새 npm 의존성은 쓰지 않는다(번들 1.19MB 문제가 이미 있음).

## Goals / Non-Goals

**Goals:**
- 화면 표시와 같은 근무 계산을 재사용하고, 이미지·파일 생성은 화면과 무관한 순수 함수로 둬 단위 테스트한다.

**Non-Goals:**
- 기간 선택, 텍스트 공유, 세부 내용 포함, 근무 시간이 있는 일정(.ics에 시작·종료 시각), 내보낸 파일 다시 가져오기.
- 이미지를 공유 시트로 바로 보내기(SDK `share`는 텍스트만 받는다).

## Decisions

1. **`src/domain/monthExport.ts`(순수 함수)**
   - `buildMonthShifts(month, timeline, days)`: 1일~말일 `{ date, shift: ShiftType | null }[]`. 달력과 같은 `getEffectiveShift`·`resolvePattern`을 쓴다.
   - `buildIcs({ month, shifts, labels, scheduleTitle, link })`: RFC 5545 문자열. `VCALENDAR`(VERSION 2.0, PRODID `-//TurnCal//KO`, CALSCALE GREGORIAN, `X-WR-CALNAME`=제목), 근무가 있는 날마다 `VEVENT`(UID `turncal-YYYYMMDD@ait-turncal`, `DTSTAMP`, `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE`=다음 날, `SUMMARY`=근무 이름, `TRANSP:TRANSPARENT`, 링크가 있으면 `DESCRIPTION`·`URL`). 줄바꿈 CRLF, 텍스트는 `\`·`;`·`,`·줄바꿈 이스케이프, 75옥텟 넘는 줄은 접는다(UTF-8 기준).
   - `DTSTAMP`는 인자로 받은 시각을 쓴다(테스트 고정, 호출부는 현재 시각).
   - `toBase64Utf8(text)`: `TextEncoder` → 바이트 → `btoa`. 한글 SUMMARY가 깨지지 않는다.
   - 대안: 근무별 RRULE 반복 일정 — 바뀐 근무·이력 경계를 표현하려면 EXDATE가 늘어 복잡하고 캘린더 앱마다 해석이 달라 기각. 날짜별 단일 일정이 가장 확실하다.

2. **이미지: `src/export/renderMonthImage.ts` — Canvas 2D로 직접 그림**
   - 폭 1080px 고정, 높이는 주 수(5~6주)에 따라 계산. 흰 배경, 제목(근무표 이름 · 연월), 요일 줄(토·일 색은 앱과 같음), 날짜 칸(숫자 + 근무 약어 칩, 칩 색은 `SHIFT_PALETTE[labels[t].color]`), 다른 달 칸은 비움, 범례(그달에 쓰인 유형만 "약어 이름"), 하단 "턴캘 교대근무 달력".
   - 글꼴은 앱 본문과 같은 시스템 글꼴 스택(Toss Product Sans 금지 규칙 유지).
   - `canvas.toDataURL("image/png")`에서 접두어를 떼어 base64로 넘긴다.
   - 그리는 좌표 계산(`layoutMonthImage`)은 순수 함수로 분리해 단위 테스트(칸 수·높이·범례 항목)한다. 실제 픽셀은 E2E에서 다운로드한 PNG의 크기·서명으로 확인한다.
   - 대안: DOM을 이미지로 바꾸는 라이브러리(html-to-image 등) — 의존성 추가·WebView 폰트/CORS 문제로 기각.

3. **UI: `ExportSheet`(TDS `BottomSheet` + `BottomSheet.Select` 대신 버튼 두 개)**
   - `CalendarScreen`의 `.bottom-action` 안, `.shortcut-row` 다음에 `Button size="medium" variant="weak" display="full"` [이번 달 내보내기](`timeline.current !== null`일 때만). 바텀시트는 `useCloseOnBack`으로 뒤로가기에 닫힌다.
   - 시트 안 두 버튼("달력 이미지 보내기" / "캘린더 파일 보내기", 각 설명 한 줄)과 "공유 창에서 카카오톡·드라이브 등 보낼 곳을 골라요" 안내. 누르면 시트를 닫고 공유 창을 열며, 진행 중에는 버튼을 막는다.
   - 성공 안내는 띄우지 않는다(취소해도 성공으로 돌아오므로 "저장했어요"는 거짓일 수 있다). 실패·미지원만 달력 화면 `notice-inline`(`role="alert"`) 한 줄로 알리고, 다른 화면으로 가거나 달을 바꾸면 지운다.
   - `saveBase64Data.isSupported()`가 false면 시도하지 않고 "토스 앱을 업데이트하면 저장할 수 있어요."
   - 링크: 저장 직전 `Share.createLink({ path: "intoss://ait-turncal" })`, 실패하거나 지원하지 않으면 `null`로 진행.

4. **App 연결** — `CalendarScreen`에 이미 `timeline`·`days`·`month`·`weekStart`·`scheduleName`이 있다. 근무 유형 표시값은 훅으로 읽는다. App 변경은 없거나 최소.

## Risks / Trade-offs

- [공유 창 결과를 알 수 없음] 취소와 전송을 구분할 수 없다 → 완료 안내를 하지 않는다(명세 "내보내기 결과 안내").
- [.ics 가져오기 흐름이 기기·앱마다 다름] 공유 창에 캘린더 앱이 보이지 않을 수 있다(드라이브·파일 앱을 거쳐 열어야 할 수 있음) → 실기기 확인 항목으로 둔다. 문제가 있으면 .ics 선택지를 빼고 이미지만 출시할 수 있도록 두 기능을 독립적으로 구현한다.
- [Canvas 글꼴이 로드 전이면 기본 글꼴로 그려짐] 시스템 글꼴만 써서 로드 대기가 필요 없다.
- [이미지 메모리] 1080×약 1500 한 장(수 MB 이하), 그린 뒤 canvas 참조를 버린다.
- [링크 생성 지연] `createLink`가 느리면 저장이 늦어진다 → 2초 시간 제한 후 링크 없이 진행.
- [하단 버튼 추가로 첫 화면 높이 증가] 6주 격자는 버튼 위에 있으므로 첫 화면 기준(격자 끝 ≤ 뷰포트)은 그대로다. `visual-audit`·`banner`로 확인한다.

## Migration Plan

저장 형식 변경 없음. 롤백 시 버튼만 사라진다.
