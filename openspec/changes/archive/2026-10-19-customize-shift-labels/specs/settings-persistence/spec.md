# Spec Delta

## ADDED Requirements

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
