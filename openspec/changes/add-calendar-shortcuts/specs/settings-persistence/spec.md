# Spec Delta

## MODIFIED Requirements

### Requirement: 시작 시 설정 복원
앱은 시작할 때 저장된 설정을 읽고 검증한 뒤 달력에 SHALL 반영한다. 저장된 값이 없으면 저장하지 않은 기본 설정으로 빈 달력을 표시한다.

#### Scenario: 재실행 복원
- **WHEN** 설정을 저장한 뒤 미니앱을 종료하고 다시 연다
- **THEN** 같은 패턴·기준일·주 시작 요일로 달력이 표시된다

#### Scenario: 저장값 없음
- **WHEN** 저장소에 `turncal.settings` 값이 없다
- **THEN** 근무 배지가 없는 빈 달력이 표시되고 `turncal.settings`는 여전히 저장되지 않은 채로 남는다
