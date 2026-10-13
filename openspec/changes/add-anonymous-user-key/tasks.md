# Tasks

## 1. 식별키 저장 (`user-identity`)

- [ ] 1.1 `src/storage/userKeyStorage.ts`에 `USER_KEY`(`turncal.user`), `syncAnonymousKey(fetch)`(미지원/실패/같은 값/새 값 → `unsupported`/`failed`/`unchanged`/`saved`, 손상 값은 덮어씀, 쓰기 실패는 `failed`), `removeUserKey()`를 구현한다 — `userKeyStorage.test.ts`로 네 결과, 같은 값일 때 쓰기 없음, 손상 값 덮어쓰기, 발급 throw·쓰기 실패 시 예외 없이 `failed`를 확인한다
- [ ] 1.2 `src/platform/useAnonymousKey.ts`에 `User.getAnonymousKey`(`isSupported()` 확인)로 발급하는 함수와 앱 실행당 1회 실행하는 `useAnonymousKey()`를 만들고 `App` 최상위에 연결한다 — 단위 테스트로 미지원 시 호출 안 함·두 번 호출해도 1회 실행을 확인하고, 브라우저(Devtools mock)에서 첫 화면 정상 표시와 `turncal.user` 저장을 확인한다

## 2. 전체 초기화 (`settings-reset`)

- [ ] 2.1 `resetAll`이 세부 내용 → 설정 → 식별키 순으로 지우게 한다 — `reset.test.ts`에 식별키 삭제와 식별키 삭제 실패 시 예외 전달을 추가해 확인한다

## 3. 통합 검증

- [ ] 3.1 `npm run typecheck`, `npm test`, `npm run test:tz`, `npm run build`가 통과하고 E2E 4종(+식별키 저장·미지원 시 정상 시작·전체 초기화 후 식별키 삭제 검사)이 모두 통과하는지 확인한다
- [ ] 3.2 화면 어디에도 식별키 값이 노출되지 않고 소스에 식별키 전송 코드가 없는지 확인한다(`grep`으로 `anonymousKey` 사용처 점검)

## Workflow follow-up

- 실제 광고 ID로 새 출시 후보를 빌드·업로드(`/ait:test-on-device`)하고 실기기에서 `turncal.user` 저장 여부를 확인한다(값 출력 금지).
- `/opsx:archive add-anonymous-user-key`.
