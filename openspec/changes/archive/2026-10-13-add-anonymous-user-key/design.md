# Design

## Context

- 요구사항은 `specs/user-identity`, `specs/settings-reset` 참고. 동기는 proposal.md - Why.
- SDK 3.7.0에는 두 형태가 있다: 최상위 `getAnonymousKey()`(deprecated, `'ERROR'`/`undefined` 반환)와 `User.getAnonymousKey()`(권장, 실패 시 `UNSUPPORTED_APP_VERSION`/`UNKNOWN_ERROR`를 throw, `isSupported()` 제공). 성공 값은 `{ type: "HASH", hash }`.
- 저장소는 `Storage`(`@apps-in-toss/web-framework`)를 쓰고, 키마다 모듈(`scheduleStorage`, `entriesStorage`)이 있다. 광고 초기화는 `useInitAds()`처럼 `App` 최상위 훅에서 한 번 실행한다.
- Devtools mock(`@apps-in-toss/devtools`)이 식별키 발급을 흉내 낸다 — 브라우저 E2E로 저장 흐름을 확인할 수 있다.

## Goals / Non-Goals

**Goals:**
- 출시 가이드 "사용자 식별자 값을 확인하여 저장하고, 미니앱이 정상적으로 시작돼요"를 코드로 충족한다.
- 실패·미지원이 어떤 화면 동작도 바꾸지 않는다.

**Non-Goals:**
- 식별키로 데이터를 나누거나 서버에 동기화하는 것(기기 변경 시 이전은 서버가 필요해 범위 밖).
- 식별키 검증 API(mTLS 서버 필요).

## Decisions

### D1. `User.getAnonymousKey` + `isSupported()` 사용
- deprecated 최상위 함수 대신 `User.getAnonymousKey`를 쓴다. `isSupported()`가 false면 호출하지 않는다. 호출은 `try/catch`로 감싸 throw를 삼킨다.
- 대안: 최상위 `getAnonymousKey()` — 반환값 분기가 쉽지만 deprecated라 이후 SDK에서 사라질 수 있다.

### D2. 저장 형식과 모듈
- `src/storage/userKeyStorage.ts`: 키 `turncal.user`, 값 `{"version":1,"anonymousKey":"<hash>"}`. `syncAnonymousKey(fetch)`가 (1) 발급 (2) 기존 값 읽기 (3) 다르면 쓰기를 하고 결과(`saved`/`unchanged`/`unsupported`/`failed`)를 돌려준다. 읽은 값이 손상돼도 새 값으로 덮어쓴다(식별키는 다시 받을 수 있는 값이라 보존할 이유가 없다 — 설정·세부 내용의 손상 보존 규칙과 다름).
- 발급 함수를 인자로 받아 SDK 없이 단위 테스트한다.

### D3. 시작 시 1회, 화면과 분리
- `src/platform/useAnonymousKey.ts`의 `useAnonymousKey()`를 `App` 최상위에서 호출한다. 모듈 단위 플래그로 StrictMode 이중 effect에도 한 번만 실행한다. 결과는 상태로 올리지 않아 렌더링에 영향이 없다.
- 실패는 `console.warn` 한 줄만 남긴다(화면 안내 없음). 식별키 값은 로그에도 찍지 않는다.

### D4. 전체 초기화
- `resetAll`이 `turncal.user`도 지운다(세부 내용 → 설정 → 식별키 순). 같은 세션에서 다시 받지 않고, 다음 실행 때 다시 저장된다. 식별키 삭제 실패도 기존처럼 예외로 전달해 "초기화하지 못했어요"를 보인다.

## Risks / Trade-offs

- [검수자가 "저장"만으로 충분하다고 보지 않을 수 있음] → 출시 가이드 문구(확인·저장·정상 시작)는 모두 충족한다. 반려되면 피드백에 맞춰 활용 범위를 넓힌다.
- [시작 시 SDK 호출 지연] → 화면 표시와 분리된 비동기 호출이라 첫 화면을 기다리게 하지 않는다.
- [Devtools mock 값은 가짜] → 실제 값은 실기기 테스트 번들에서 저장 여부만 확인한다(값은 출력하지 않음).

## Migration Plan

- 새 키만 추가되고 기존 키 형식은 그대로다. 롤백 시 `turncal.user`는 남아도 무해하다.
