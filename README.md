# 턴캘 (TurnCal)

교대근무 반복 패턴을 등록하면 월간 달력에 근무를 자동으로 보여 주는 앱인토스 미니앱이에요. 데이터는 모두 기기에 저장돼요.

## 주요 기능
- 근무 패턴(주간·오후·야간·당직·비번·휴무)과 기준일로 월간 달력 자동 계산
- 달력 위쪽에 오늘·내일 근무 요약(바뀐 근무·시간·공휴일 이름 포함, 누르면 그 날짜 화면)
- 날짜별 세부 내용·메모, 근무표·사용자 이름, 주말·공휴일(2026~2035) 표시
- 화면 설정(색 테마 3종, 주 시작 요일), 항목별·전체 초기화
- 달력 하단 배너 광고, 앱 시작 시 사용자 식별키 저장(화면 표시·전송 없음)

## 개발
```bash
npm install
npm run dev          # 개발 서버 (Devtools mock)
npm run typecheck
npm test             # 단위 테스트
npm run test:tz      # 시간대별(서울·뉴욕·UTC) 테스트
npm run build        # 실제 광고 ID 번들 (.env.production.local 필요)
npm run build:adtest # 테스트 광고 ID 번들 — 실기기 테스트용
```

- 실제 광고 ID는 `.env.production.local`(커밋 금지)에만 둬요. 테스트에는 `build:adtest`를 써요.
- 브라우저 E2E는 `scripts/e2e/README.md`를 참고해요.
- 플랫폼 설정은 `apps-in-toss.config.ts`에서 관리해요.

## 문서
- 다음 작업·콘솔 식별자·규칙: `docs/NEXT_STEPS.md`
- 기능 명세(OpenSpec): `openspec/specs/`, 진행 중·보관된 변경은 `openspec/changes/`
