# Design

## Context

- 동기·범위는 proposal.md, 동작 계약은 `specs/in-app-ads/spec.md` 참고.
- 현재 구조: `main.tsx`의 `Root`(테마·TDS Provider) → `App`(화면 상태 머신) → `CalendarScreen`(월 이동 헤더, `Calendar` 격자, 하단 [설정] 버튼). `.app`은 최대 너비 480px, 좌우 여백 20px, `#app`에 SafeArea 상·하단 여백이 걸려 있다.
- 설치된 SDK 3.7.0에 `TossAds.initialize`·`attachBanner`·`destroyAll`(각각 `isSupported`)와 `isMinVersionSupported`가 있고, AIT Devtools mock도 `TossAds`를 제공해 브라우저에서 흐름을 확인할 수 있다.
- 공식 배너 문서 제약: 초기화는 앱에서 한 번, 컨테이너 너비는 화면 너비(100%), 고정형 높이 96px 권장, 토스 앱 5.241.0 미만은 빈 화면 가능성 → 예외 처리, 테스트는 테스트 ID(`ait-ad-test-banner-id`)만, 샌드박스 미지원(콘솔 QR로 테스트), SDK 자동 갱신(10초+가시성 변화)이므로 앱이 새로고침하지 않음.
- `.gitignore`에 `*.local`이 이미 있어 `.env.production.local`은 커밋되지 않는다.

## Goals / Non-Goals

**Goals:**
- 광고 관련 코드를 `src/ads/` 한 곳에 모으고, 판정 로직(광고 ID 결정, 배너 상태 전이)은 순수 함수로 두어 Vitest로 검증한다.
- 광고가 없거나 실패해도 달력 화면 레이아웃이 흔들리지 않게(빈 공간 없이) 한다.
- 실제 광고 ID로 테스트하는 정책 위반 경로를 빌드 구성 수준에서 막는다.

**Non-Goals:**
- 전면·리워드 광고, 달력 외 화면 광고, 광고 성과 이벤트 로깅·분석.
- 광고 노출 빈도 조절, A/B 테스트.

## Decisions

### D1. 광고 그룹 ID는 빌드 모드별 환경 변수로 주입
```text
npm run dev              -> VITE_TOSS_BANNER_AD_GROUP_ID 없으면 테스트 ID 사용
npm run build:adtest     -> vite build --mode adtest  (.env.adtest = 테스트 ID, 커밋)  -> 콘솔 QR 테스트용 번들
npm run build            -> .env.production.local 의 실제 ID (커밋 안 함). 없으면 배너 미표시
```
- `resolveBannerAdGroupId({ isDev, envValue })` 순수 함수: 값이 있으면 그대로, 없으면 개발 모드일 때만 테스트 ID, 그 외 `null`.
- 대안: 코드에 실제 ID 상수 — 테스트 번들에도 실제 ID가 들어가 정책 위반 위험이 있어 기각.
- 출시 번들을 만들 때 `.env.production.local` 존재·값을 확인하는 단계를 출시 절차(작업 목록)에 둔다.

### D2. SDK 초기화는 App 최상위에서 한 번
- `src/ads/tossAds.ts`의 `initAds()`가 모듈 수준 상태(`idle | pending | ready | unsupported | failed`)를 두고 한 번만 `TossAds.initialize`를 호출한다. React StrictMode의 이중 effect에도 중복 호출되지 않는다.
- 지원 판정: `TossAds.initialize.isSupported() && TossAds.attachBanner.isSupported() && isMinVersionSupported({ android: "5.241.0", ios: "5.241.0" })`. 하나라도 거짓이면 `unsupported`(배너 영역 숨김).
- 구독: `useAdsReady()` 훅이 상태 변화를 구독해 `ready` 여부를 돌려준다.

### D3. 배너 컴포넌트와 상태 전이
```text
 [hidden: 높이 0] --attach--> [loading: 높이 0] --onAdRendered--> [shown: 96px]
                                   |  onNoFill / onAdFailedToRender
                                   v
                               [hidden]
 언마운트 -> destroy()
```
- `CalendarBanner`는 `ready`이고 광고 ID가 있을 때만 부착한다. 컨테이너는 DOM에 존재하되 렌더링 전까지 높이 0 + `overflow: hidden`으로 빈 공간을 만들지 않고, `onAdRendered` 후 96px로 연다.
- 상태 전이는 순수 리듀서(`bannerReducer`)로 두고 단위 테스트한다.
- `attachBanner` 옵션: `theme: "light"`(다크모드 추종 금지), `tone: "blackAndWhite"`, `variant: "expanded"`. 콜백은 상태 전이에만 쓰고 SDK 이벤트를 가공·재발행하지 않는다.
- 대안: 렌더링 전부터 96px 자리 확보 — 광고 없음이 잦으면 빈 공간이 남아 명세 위반이라 기각.

### D4. 배치와 레이아웃
- `CalendarScreen`의 [설정] 버튼 블록 아래에 `CalendarBanner`를 둔다. 버튼과 배너 사이 상단 여백 32px 이상.
- 전체 폭: `.app`의 좌우 여백을 벗어나도록 `width: 100vw; margin-left: calc(50% - 50vw)`(풀블리드). 데스크톱 폭(>480px)에서는 `.app` 폭에 맞추는 미디어 쿼리를 둔다(실기기에서는 화면 폭 = 뷰포트).
- 하단 SafeArea 여백은 기존 `#app` 패딩이 처리하므로 배너가 홈 인디케이터에 가리지 않는다.

### D5. 테스트 전략
- 단위: `resolveBannerAdGroupId`(dev/env 조합), `bannerReducer`(전이), `initAds`(한 번만 호출, 미지원·실패 → 상태) — `vi.mock('@apps-in-toss/web-framework')`.
- 브라우저(Devtools mock, 저장소 밖 스크립트): 달력에만 배너 컨테이너 1개, 다른 화면 0개, 화면을 오가도 `TossAds.initialize` 1회·배너 1개, 렌더링 전 높이 0, 기존 39+58 시나리오 회귀.
- 실기기(콘솔 QR, `build:adtest` 번들): 실제 노출, 라이트 테마, 클릭 후 복귀·뒤로가기, 홈 인디케이터 가림 없음, 긴 화면 기기의 스크롤 여부.

## Risks / Trade-offs

- [높이 0 컨테이너에서 SDK가 렌더링·노출 측정을 못 할 수 있음] → Devtools mock과 실기기에서 `onAdRendered`/`onAdImpression` 도달을 확인. 안 되면 렌더링 동안만 화면 밖이 아닌 최소 높이(1px)로 두거나, 96px 자리를 두되 `onNoFill` 시 접는 방식으로 바꾸고 design을 갱신한다.
- [출시 가이드 "배너는 스크롤 가능한 화면에만"] → 배너 96px 추가로 대부분 기기에서 달력 화면이 스크롤된다. 매우 긴 화면 기기에서 스크롤이 생기지 않을 수 있어 실기기로 확인하고, 필요하면 출시 전 앱인토스에 해석을 문의한다.
- [광고 영역이 [설정] 버튼 근처라 오클릭 우려] → 32px 이상 간격, 배너는 버튼 아래(손가락이 버튼을 누르러 가는 경로 밖). 실기기에서 터치 확인.
- [실제 ID 누락으로 출시 빌드에 배너가 안 나옴] → 명세상 의도된 안전 동작. 출시 절차에 `.env.production.local` 확인을 넣는다.
- [광고 SDK 네트워크 사용] → 출시 가이드 "네트워크 사용량 급증" 항목을 실기기에서 함께 확인.

## Migration Plan

- 저장 데이터 변경 없음. 배포 후 광고 그룹 ID가 주입된 출시 빌드부터 배너가 노출된다.
- 문제 시 실제 ID 없이 다시 빌드하면 배너가 꺼지는 안전한 롤백 경로가 생긴다(코드 되돌림 불필요).

## Open Questions

- 콘솔 광고 그룹(배너) ID 발급 시점 — 구현·테스트는 테스트 ID로 진행 가능하므로 출시 빌드 직전까지 미뤄도 된다.
