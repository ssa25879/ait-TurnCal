# Tasks

## 1. 광고 ID와 SDK 초기화 (`in-app-ads`)

- [x] 1.1 `src/ads/adConfig.ts`에 테스트 ID 상수(`ait-ad-test-banner-id`)와 `resolveBannerAdGroupId({ isDev, envValue })`를 구현하고, `.env.adtest`(테스트 ID)와 `build:adtest` 스크립트(`tsc --noEmit && vite build --mode adtest && ait build`)를 추가한다 — 단위 테스트로 dev+값 없음 → 테스트 ID, 출시+값 없음 → `null`, 값 있음 → 그 값을 확인하고, `.env.production.local`이 `.gitignore`로 제외되는지 `git check-ignore`로 확인한다
- [x] 1.2 `src/ads/tossAds.ts`에 한 번만 초기화하는 `initAds()`와 상태 구독 훅 `useAdsReady()`를 구현한다(`TossAds.initialize`·`attachBanner`의 `isSupported`와 `isMinVersionSupported` 5.241.0 판정) — `vi.mock` 단위 테스트로 중복 호출 시 초기화 1회, 미지원 → `unsupported`, 실패 콜백 → `failed`를 확인한다
- [x] 1.3 `App` 최상위에서 `initAds()`를 호출한다 — Devtools mock 브라우저에서 화면을 오가도 `TossAds.initialize` 호출이 1회인지 확인한다

## 2. 배너 컴포넌트와 배치 (`in-app-ads`)

- [x] 2.1 `src/ads/bannerState.ts`에 `bannerReducer`(hidden/loading/shown, rendered·noFill·failed·reset 이벤트)를 구현하고 전이 단위 테스트를 작성한다
- [x] 2.2 `src/ads/CalendarBanner.tsx`를 구현한다(ready·ID 있을 때만 `attachBanner`, `theme: "light"`·`tone: "blackAndWhite"`·`variant: "expanded"`, 렌더링 전 높이 0, `onAdRendered` 후 96px, 실패·광고 없음 시 숨김, 언마운트 시 `destroy()`) — Devtools mock 브라우저에서 부착·제거와 높이 전이를 확인한다
- [x] 2.3 `CalendarScreen`의 [설정] 버튼 아래에 32px 이상 간격을 두고 `CalendarBanner`를 배치하고, 풀블리드 스타일(화면 전체 너비, 480px 초과 폭 대응)을 추가한다 — 390px 폭 스크린샷으로 배너 너비가 화면 너비와 같고 버튼과 떨어져 있는지 확인한다

## 3. 통합 검증

- [x] 3.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`, `npm run build:adtest`가 모두 통과하고, 실제 ID 없는 `build` 산출물에는 테스트 ID 문자열이 없고 `build:adtest` 산출물에는 있는지 확인한다
- [x] 3.2 브라우저 E2E(Devtools mock)를 확장해 실행한다: 달력에만 배너 컨테이너 1개, 초기 안내·근무 패턴·설정 목록·화면 설정·오류 화면에 0개, 화면을 반복 이동해도 초기화 1회·배너 1개, 광고 없음 시 높이 0, 기존 39+58 시나리오 회귀 — 전부 통과를 확인한다
- [x] 3.3 `build:adtest` 번들을 콘솔에 올려 QR로 실기기 확인한다: 배너 실제 노출·라이트 테마(기기 다크모드 포함)·클릭 후 복귀와 뒤로가기·홈 인디케이터 가림 없음·[설정] 버튼 오클릭 없음·달력 화면 스크롤 여부(긴 화면 기기 포함) — 결과를 기록한다

## Workflow follow-up

- 콘솔에서 광고 그룹(배너) ID를 발급하고 `.env.production.local`에 넣은 뒤 출시 빌드를 만든다(실제 ID로는 테스트하지 않는다).
- 출시 버전 준비 시 비게임 출시 가이드의 "인앱 광고" 절과 토스 애즈 SSP 정책을 포함해 전 항목을 다시 대조한다. 검토 신청은 출시 버전만.
- 리뷰 후 `/opsx:archive add-calendar-banner-ad`.
