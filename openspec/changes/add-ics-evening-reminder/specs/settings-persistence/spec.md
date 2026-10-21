# Spec Delta

## ADDED Requirements

### Requirement: 캘린더 알림 설정 저장
캘린더 알림을 기본값(전날 21:00)이 아닌 값으로 바꾸면 `turncal.settings`는 선택 필드 `icsReminderHour`를 SHALL 포함한다. 값은 18~23 사이 정수(전날 그 시각) 또는 `null`("알림 안 함")이다. 기본값이면 필드를 두지 않으며, 필드가 없으면 기본값으로 복원한다. 필드를 추가해도 `version`은 3으로 MUST 유지된다. 복원 시 값이 18~23 정수나 `null`이 아니면 손상 데이터로 SHALL 처리한다.

#### Scenario: 바꾼 시각 저장
- **WHEN** 캘린더 알림을 "전날 20:00"으로 바꾼다
- **THEN** `turncal.settings`는 `version: 3`이고 `icsReminderHour: 20`을 포함하며 나머지 설정 값은 그대로이다

#### Scenario: 알림 안 함 저장
- **WHEN** 캘린더 알림을 "알림 안 함"으로 바꾼다
- **THEN** `turncal.settings`에 `icsReminderHour: null`이 저장된다

#### Scenario: 기본값이면 필드 없음
- **WHEN** 캘린더 알림을 "전날 21:00"으로 되돌린다
- **THEN** `turncal.settings`에 `icsReminderHour` 필드가 없다

#### Scenario: 필드가 없는 기존 설정
- **WHEN** `icsReminderHour`가 없는 기존 `version: 3` 설정으로 앱을 연다
- **THEN** 캘린더 알림이 "전날 21:00"으로 표시되고 저장값은 바뀌지 않는다

#### Scenario: 잘못된 값
- **WHEN** `icsReminderHour`가 17, 24, 20.5, 문자열 "21" 중 하나이다
- **THEN** 손상 데이터로 처리되어 오류 안내가 표시되고 저장값은 지워지지 않는다

#### Scenario: 이전 번들에서 읽기
- **WHEN** `icsReminderHour`가 포함된 설정을 이 필드를 모르는 이전 `version: 3` 앱이 읽는다
- **THEN** 이전 앱은 오류 없이 동작한다
