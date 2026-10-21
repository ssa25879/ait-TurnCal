# Spec Delta

## ADDED Requirements

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
