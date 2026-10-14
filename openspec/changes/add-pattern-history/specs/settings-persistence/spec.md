# Spec Delta

## MODIFIED Requirements

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
