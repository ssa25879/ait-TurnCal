# settings-persistence Specification

## Purpose

근무 패턴·기준일·주 시작 요일 설정을 기기 로컬 저장소에 버전이 있는 형식으로 저장·복원하고, 손상되거나 알 수 없는 데이터를 안전하게 다룬다.

## Requirements

### Requirement: 설정 저장 형식
설정은 앱인토스 로컬 저장소의 단일 키 `turncal.settings`에 JSON 문자열로 SHALL 저장되며, `version`(현재 3), 패턴(기준일, 근무 유형 순서 — 근무 패턴 초기화 후에는 비어 있음), 주 시작 요일, 테마 색, 사용자 호칭, 근무표 이름을 포함한다. 패턴을 "오늘부터 적용"으로 바꾼 기록이 있으면 선택 필드 `patternHistory`(이전 패턴 목록)를 추가로 포함하며, 각 항목은 이전 패턴과 그 패턴이 적용된 마지막 날의 다음 날(`until`, 이 날짜 전날까지 적용)로 구성되고 날짜순으로 저장된다. 이력이 없으면 `patternHistory`는 없거나 비어 있다. 근무 패턴 초기화 후에는 현재 패턴이 비어 있어도 이력은 유지될 수 있다. `patternHistory`를 추가해도 `version`은 3으로 MUST 유지된다. 날짜 세부 내용은 이 키에 포함하지 않는다.

#### Scenario: 저장 내용
- **WHEN** 기준일 `2026-10-13`, 패턴 `[주간, 야간, 비번, 휴무]`, 주 시작 요일 일요일, 테마 인디고, 호칭 "지수", 근무표 이름 "병동 3교대"로 저장한다
- **THEN** `turncal.settings`에 `version: 3`과 여섯 값이 모두 포함된 JSON 문자열이 저장된다

#### Scenario: 이력이 있는 저장 내용
- **WHEN** 패턴 A가 `2026-10-13` 전까지 적용되고 패턴 B가 현재 패턴인 설정을 저장한다
- **THEN** `turncal.settings`는 `version: 3`이고 현재 패턴으로 패턴 B를, `patternHistory`에 패턴 A와 `until: 2026-10-13`을 포함한다

#### Scenario: 이력 필드가 없는 기존 설정
- **WHEN** `patternHistory` 필드가 없는 기존 `version: 3` 설정으로 앱을 연다
- **THEN** 이력이 없는 설정으로 정상 복원되고 모든 날짜가 저장된 패턴으로 계산되며 저장값은 바뀌지 않는다

#### Scenario: 이전 번들에서 읽기
- **WHEN** `patternHistory`가 포함된 설정을 `patternHistory`를 모르는 이전 `version: 3` 앱이 읽는다
- **THEN** 이전 앱은 오류 없이 현재 패턴으로 모든 날짜를 계산한다

#### Scenario: 패턴 초기화 상태
- **WHEN** 근무 패턴을 초기화한다
- **THEN** `turncal.settings`에 패턴이 비어 있는 `version: 3` 설정이 저장되고 `patternHistory`·테마·주 시작 요일·이름은 유지된다

### Requirement: 시작 시 설정 복원
앱은 시작할 때 저장된 설정을 읽고 검증한 뒤 달력에 SHALL 반영한다. 저장된 값이 없으면 저장하지 않은 기본 설정으로 빈 달력을 표시한다.

#### Scenario: 재실행 복원
- **WHEN** 설정을 저장한 뒤 미니앱을 종료하고 다시 연다
- **THEN** 같은 패턴·기준일·주 시작 요일로 달력이 표시된다

#### Scenario: 저장값 없음
- **WHEN** 저장소에 `turncal.settings` 값이 없다
- **THEN** 근무 배지가 없는 빈 달력이 표시되고 `turncal.settings`는 여전히 저장되지 않은 채로 남는다

### Requirement: 저장 데이터 검증
복원 시 시스템은 version, 날짜 유효성, 근무 유형 값, 패턴 길이(1~56, 패턴이 있을 때), 주 시작 요일 값, 테마 값(version 2 이상), 호칭·근무표 이름의 형식과 길이(version 3)를 SHALL 검증한다. `patternHistory`가 있으면 각 항목의 패턴(날짜·근무 유형·길이)과 `until` 날짜가 유효하고, `until`이 날짜순으로 엄격히 증가하며, 항목이 50개 이하인지 SHALL 검증한다. 현재 패턴이 비어 있어도 유효한 이력은 허용된다. 하나라도 유효하지 않으면 손상 데이터로 MUST 처리된다.

#### Scenario: 알 수 없는 근무 유형
- **WHEN** 저장된 패턴에 정의되지 않은 근무 유형 값이 있다
- **THEN** 손상 데이터로 처리된다

#### Scenario: JSON 파싱 실패
- **WHEN** 저장된 값이 JSON으로 해석되지 않는다
- **THEN** 손상 데이터로 처리된다

#### Scenario: 알 수 없는 테마
- **WHEN** `version: 2` 이상 설정의 테마 값이 정의된 세 테마가 아니다
- **THEN** 손상 데이터로 처리된다

#### Scenario: 이름 길이 초과
- **WHEN** `version: 3` 설정의 근무표 이름이 20자를 넘는다
- **THEN** 손상 데이터로 처리된다

#### Scenario: 이력 날짜 순서 오류
- **WHEN** `patternHistory`의 `until` 값이 날짜순으로 증가하지 않는다
- **THEN** 손상 데이터로 처리된다

#### Scenario: 이력 항목 값 오류
- **WHEN** `patternHistory` 항목의 패턴이 비어 있거나 `until`이 유효한 날짜가 아니다
- **THEN** 손상 데이터로 처리된다

#### Scenario: 패턴 초기화 후 이력만 남음
- **WHEN** 현재 패턴이 비어 있고 `patternHistory`에 유효한 항목이 있다
- **THEN** 정상 설정으로 복원되고 근무 패턴 등록 안내가 표시되며 이력은 보존된다

#### Scenario: 이력 개수 초과
- **WHEN** `patternHistory`에 항목이 51개 있다
- **THEN** 손상 데이터로 처리된다

### Requirement: 손상·상위 버전 데이터 보존
손상 데이터나 현재 앱이 모르는 상위 version 데이터를 만나면 시스템은 앱을 중단하지 않고 오류를 SHALL 안내하며, 사용자가 명시적으로 다시 설정해 저장하기 전에는 기존 저장값을 삭제하거나 덮어써서는 MUST NOT 된다.

#### Scenario: 손상 데이터
- **WHEN** 손상된 설정이 저장된 상태로 앱을 연다
- **THEN** 오류 안내와 [다시 설정] 선택지가 표시되고 저장값은 그대로 남아 있다

#### Scenario: 상위 버전 데이터
- **WHEN** `version: 4` 이상의 설정이 저장된 상태로 이 버전의 앱을 연다
- **THEN** 손상 데이터와 같은 안내가 표시되고 저장값은 삭제되지 않는다

#### Scenario: 다시 설정 후 저장
- **WHEN** 사용자가 [다시 설정]을 선택해 새 설정을 [저장]한다
- **THEN** 그때 비로소 기존 저장값이 새 설정으로 덮어써진다

### Requirement: 저장 실패 처리
저장소 읽기·쓰기 실패 시 시스템은 오류를 SHALL 안내하고 앱 실행을 계속한다.

#### Scenario: 읽기 실패
- **WHEN** 시작 시 저장소 읽기가 실패한다
- **THEN** 오류 안내가 표시되고 앱은 중단되지 않는다

### Requirement: 이전 버전 설정 마이그레이션
`version: 1`·`version: 2` 설정은 손상 데이터가 아니라 유효한 이전 버전으로 SHALL 복원된다. 없는 값은 기본값(테마 인디고, 호칭·근무표 이름 없음)으로 채운다. 복원만으로는 저장값을 다시 쓰지 않고(MUST NOT), 사용자가 다음에 설정을 저장할 때 `version: 3`으로 기록된다.

#### Scenario: v1 설정으로 실행
- **WHEN** MVP에서 저장한 `version: 1` 설정이 있는 상태로 새 버전 앱을 연다
- **THEN** 같은 패턴·기준일·주 시작 요일로 달력이 표시되고 테마는 인디고, 이름은 비어 있으며 저장값은 그대로 `version: 1`이다

#### Scenario: v2 설정으로 실행
- **WHEN** `version: 2` 설정(테마 딥 틸)이 있는 상태로 새 버전 앱을 연다
- **THEN** 같은 패턴·주 시작 요일·딥 틸 테마로 표시되고 저장값은 그대로 `version: 2`이다

#### Scenario: v1 이후 첫 저장
- **WHEN** v1 설정으로 실행한 뒤 테마를 딥 틸로 바꾼다
- **THEN** 저장값이 기존 패턴·주 시작 요일을 유지하고 테마는 딥 틸, 이름은 비어 있는 `version: 3` 설정으로 바뀐다

#### Scenario: v2 이후 첫 저장
- **WHEN** v2 설정으로 실행한 뒤 이름을 저장한다
- **THEN** 저장값이 기존 패턴·주 시작 요일·테마를 유지하고 이름이 들어간 `version: 3` 설정으로 바뀐다

### Requirement: 근무 유형 표시 설정 저장
근무 유형을 바꾼 기록이 있으면 `turncal.settings`는 선택 필드 `shiftLabels`를 SHALL 포함한다. `shiftLabels`는 근무 유형 값을 키로, 그 유형의 이름·약어·팔레트 색 ID를 값으로 가지며 기본값과 다른 유형만 담는다. 바꾼 유형이 없으면 필드를 두지 않는다. 필드를 추가해도 `version`은 3으로 MUST 유지된다. 복원 시 키가 6종 중 하나인지, 이름·약어가 입력 규칙(길이·6종 사이 중복 없음)을 지키는지, 색이 팔레트 ID인지 SHALL 검증하고, 하나라도 어기면 손상 데이터로 처리한다.

#### Scenario: 바꾼 유형만 저장
- **WHEN** 오후를 "저녁"·"저"로만 바꿔 저장한다
- **THEN** `turncal.settings`는 `version: 3`이고 `shiftLabels`에 오후 한 항목만 있으며 나머지 설정 값은 그대로이다

#### Scenario: 되돌리면 필드 없음
- **WHEN** [기본값으로 되돌리기]를 확인한다
- **THEN** `turncal.settings`에 `shiftLabels` 필드가 없다

#### Scenario: 필드가 없는 기존 설정
- **WHEN** `shiftLabels`가 없는 기존 `version: 3` 설정으로 앱을 연다
- **THEN** 모든 유형이 기본 이름·약어·색으로 표시되고 저장값은 바뀌지 않는다

#### Scenario: 잘못된 값
- **WHEN** `shiftLabels`에 알 수 없는 유형 키, 5자 이름, 두 글자 약어, 다른 유형과 겹치는 약어, 팔레트에 없는 색 중 하나가 있다
- **THEN** 손상 데이터로 처리되어 오류 안내가 표시되고 저장값은 지워지지 않는다

#### Scenario: 이전 번들에서 읽기
- **WHEN** `shiftLabels`가 포함된 설정을 이 필드를 모르는 이전 `version: 3` 앱이 읽는다
- **THEN** 이전 앱은 오류 없이 기본 이름·약어·색으로 표시한다

### Requirement: 캘린더 알림 설정 저장
캘린더 알림 설정은 `turncal.settings`의 두 선택 필드로 SHALL 저장한다. 알림을 끄면 `icsReminderEnabled: false`를 두고, 켜져 있으면(기본값) 이 필드를 두지 않는다. 시각을 기본값(21)이 아닌 18~23 사이 정수로 바꾸면 `icsReminderHour`에 그 값을 두고, 21이면 필드를 두지 않는다. 두 필드는 서로 독립이라 알림을 꺼도 고른 시각은 남는다. 필드가 없으면 기본값(켜짐, 21시)으로 복원한다. 필드를 추가해도 `version`은 3으로 MUST 유지된다. 복원 시 `icsReminderEnabled`가 `false`가 아니거나 `icsReminderHour`가 18~23 정수가 아니면(필드가 있는 경우) 손상 데이터로 SHALL 처리한다.

#### Scenario: 바꾼 시각 저장
- **WHEN** 캘린더 알림 시각을 "전날 20:00"으로 바꾼다
- **THEN** `turncal.settings`는 `version: 3`이고 `icsReminderHour: 20`을 포함하며 `icsReminderEnabled`는 없고 나머지 설정 값은 그대로이다

#### Scenario: 끄기 저장
- **WHEN** 시각이 20시인 상태에서 알림 토글을 끈다
- **THEN** `turncal.settings`에 `icsReminderEnabled: false`와 `icsReminderHour: 20`이 함께 저장된다

#### Scenario: 기본값이면 필드 없음
- **WHEN** 알림을 켜고 시각을 "전날 21:00"으로 되돌린다
- **THEN** `turncal.settings`에 `icsReminderEnabled`와 `icsReminderHour` 필드가 모두 없다

#### Scenario: 필드가 없는 기존 설정
- **WHEN** 두 필드가 없는 기존 `version: 3` 설정으로 앱을 연다
- **THEN** 캘린더 알림이 켜짐·"전날 21:00"으로 표시되고 저장값은 바뀌지 않는다

#### Scenario: 잘못된 값
- **WHEN** `icsReminderHour`가 17, 24, 20.5, 문자열 "21", `null` 중 하나이거나 `icsReminderEnabled`가 `true`나 문자열이다
- **THEN** 손상 데이터로 처리되어 오류 안내가 표시되고 저장값은 지워지지 않는다

#### Scenario: 이전 번들에서 읽기
- **WHEN** 두 필드가 포함된 설정을 이 필드를 모르는 이전 `version: 3` 앱이 읽는다
- **THEN** 이전 앱은 오류 없이 동작한다
