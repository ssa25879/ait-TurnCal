## REMOVED Requirements

### Requirement: 달력 하단 배너 위치
**Reason**: 광고 수익이 없고(누적 노출 32회, 수익 0원) 유지 비용만 있어 배너 광고를 제거한다.
**Migration**: 배너 영역이 사라지고 달력 화면은 하단 조작 요소에서 끝난다. 별도 이전 작업 없음.

### Requirement: 광고를 넣지 않는 화면
**Reason**: 광고 자체를 제거하므로 광고 노출 제한 규칙이 필요 없다.
**Migration**: 없음. 어느 화면에도 광고(배너·전면·리워드)를 넣지 않는다.

### Requirement: 배너 표시 형식
**Reason**: 배너가 없으므로 표시 형식 규칙이 필요 없다.
**Migration**: 없음.

### Requirement: 배너 숨김 조건
**Reason**: 배너가 없으므로 숨김 조건이 필요 없다.
**Migration**: 없음.

### Requirement: 배너 생명주기
**Reason**: 광고 SDK 초기화와 배너 부착을 하지 않는다.
**Migration**: 없음. 미니앱 SDK의 다른 기능(내비게이션 바, 분석, 공유, 리뷰 요청)은 그대로 쓴다.

### Requirement: 광고 ID 사용 규칙
**Reason**: 광고 ID와 테스트 광고 빌드(`build:adtest`)를 제거한다.
**Migration**: 콘솔의 광고 그룹은 출시 뒤 사용자가 정리한다. 로컬 `.env.production.local`의 광고 ID는 더 이상 쓰이지 않는다.
