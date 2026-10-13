# 턴캘 다음 작업 인수인계 (2026-10-13 기준)

새 세션은 이 문서를 먼저 읽고 **"1. 바로 할 일"** 순서대로 진행한다.

## 0. 현재 상태 한눈에

| 항목 | 상태 |
|---|---|
| 작업 브랜치 | `feat/v1-enhancements` (원격 미푸시, `main` 대비 6+커밋) |
| `main` | `origin/main` = `cbb1923` (MVP + 화면 설정까지) |
| OpenSpec 완료·미아카이브 | `add-day-entries-and-names` 16/16, `add-calendar-banner-ad` 9/9 |
| OpenSpec 진행 중 | `improve-calendar-weekends-and-resets` — 제안서만 작성(결정 4건 대기) |
| 정식 명세 | `openspec/specs/` 6개(display-settings, miniapp-shell, settings-persistence, shift-calendar, shift-pattern-settings, shift-schedule) |
| 테스트 | 단위 169개(+3개 시간대), 브라우저 E2E 4종 156개 — 전부 통과 |
| 실기기 | `20261013-3`(세부 내용·이름·초기화·배너, 테스트 광고 ID)까지 확인 완료 |
| 검토 신청 | **하지 않음** (출시 버전만 신청 — 아래 규칙) |

### 콘솔·광고 식별자

| 항목 | 값 |
|---|---|
| 워크스페이스 | YWS_WorkSpace `96603` (같은 곳의 냉털픽 `80586`은 다른 앱 — 업로드 금지) |
| 미니앱 | 턴캘 `miniAppId 86006`, `appName ait-turncal`, 영문명 `Turn Cal` |
| 앱 정보 | **앱 이름만 저장됨.** 최초 검토는 앱 정보 + 번들을 콘솔 웹에서 함께 제출(MCP에 `initial_review_submit` 없음) |
| 업로드한 번들 | `20261013-1`(MVP), `20261013-2`(테마·설정 목록, 광고 없음), `20261013-3`(현재 기능 전부, 테스트 광고 ID) |
| 배너 광고 그룹 | "달력 하단 배너" `ait.v2.live.319dbf4b189e4745` (BANNER / 문구 강조형, 활성) |
| 광고 노출 기한 | 2026-10-13 생성. **23일 연속 무노출이면 삭제예정, 30일이면 삭제** → 늦어도 11월 초 출시·노출 필요 |
| 로고 | `assets/logo.png`(600×600, 인디고), 원본 `assets/logo.svg` |

### 지켜야 할 규칙
- **검토 신청은 출시 버전만**, 그리고 사용자가 요청할 때만. 출시 버전은 비게임 출시 가이드 원문(docs MCP `getPage` https://developers-apps-in-toss.toss.im/checklist/app-nongame)을 매번 새로 받아 항목별 통과/해당 없음/확인 필요 표를 만들고, 확인 필요가 남으면 신청하지 않는다.
- **실제 광고 ID로 테스트 금지.** 실제 ID는 출시 빌드 직전 `.env.production.local`(커밋 안 됨)에만 넣는다. 테스트 번들은 `npm run build:adtest`(테스트 ID).
- 브랜드: 대표색 인디고 `#4F46E5`, 테마 딥 틸 `#0F766E`·코랄 `#C2410C`. 토스 블루(`#3182F6`·`#0064FF` 계열)·`Toss Product Sans` 금지. 다크모드 없음(라이트 전용이 출시 필수 항목).
- 커밋은 기능 브랜치에서, 병합은 `--no-ff`로 `main`에.

## 1. 바로 할 일 (순서대로)

### 1-1. 완료된 두 change 아카이브
```text
/opsx:archive add-day-entries-and-names    # Sync now 선택 — 새 명세 day-entries·schedule-names·settings-reset 생성, 4개 명세 수정
/opsx:archive add-calendar-banner-ad       # Sync now 선택 — 새 명세 in-app-ads 생성
```
- 두 change 모두 작업이 끝났고 실기기 확인도 마쳤다. 아카이브해야 3번째 change가 `settings-reset`·`day-entries` 명세를 수정하는 delta를 쓸 수 있다.

### 1-2. 실기기 피드백 반영: `improve-calendar-weekends-and-resets`
사용자 요청(2026-10-13):
- 달력에 **주말·휴일 표기가 없다.**
- 초기화가 별도 카테고리에 있어 **찾기 어렵다** → 각 옵션(근무 패턴, 화면 설정) **아래에 초기화 버튼**을 두고, **전체 초기화는 현재 상태 유지**.

먼저 아래 결정을 사용자에게 확인한다(제안서 Impact 참고):

| 결정 | 권장안 |
|---|---|
| 공휴일 데이터 범위·출처 | 2026~2030년 대한민국 공휴일(대체공휴일 포함)을 앱 안 표로. 출처는 정부 발표(우주항공청 월력요항 등)로 날짜를 검증하고 표에 출처·기준일 주석. 임시공휴일·이후 연도는 앱 업데이트로 갱신 |
| 토요일 색 | 지금처럼 테마 강조색(테마 따라 변함). 고정 파랑은 토스 블루와 혼동 위험 |
| 초기화 화면 구성 | 전체 초기화만 남김(근무 패턴·화면 설정 초기화는 각 화면으로 이동해 중복 제거). 설정 목록 항목 이름은 "전체 초기화" 또는 "초기화" 유지 |
| 공휴일 표시 위치 | 날짜 숫자를 일요일과 같은 색으로 + 날짜 화면에 공휴일 이름. 달력 칸 공간이 좁아 칸에는 이름을 넣지 않음 |

그다음 `/opsx:propose`가 아니라 **이미 만든 change의 나머지 문서(specs·design·tasks)를 작성**하고(`openspec status --change improve-calendar-weekends-and-resets`), `/opsx:apply improve-calendar-weekends-and-resets`로 구현한다.
- 공휴일 날짜는 반드시 공식 자료로 검증한다(기억에 의존 금지).
- 근무 패턴 초기화 버튼은 저장된 패턴이 있을 때(편집 흐름)만 보인다. 최초 등록 화면에는 없다.
- E2E: `scripts/e2e/day-entries.mjs`의 초기화 경로를 새 위치로 고치고 주말·공휴일 표시 검사를 추가한다.

### 1-3. v1 출시 후보
1. `.env.production.local`에 `VITE_TOSS_BANNER_AD_GROUP_ID=ait.v2.live.319dbf4b189e4745` 작성(커밋 금지, `git check-ignore`로 확인).
2. `npm run build` → 산출물에 실제 ID가 있고 테스트 ID가 없는지 `dist/assets/*.js`에서 확인.
3. `/ait:test-on-device` 절차로 업로드(`bundle_upload` → PUT → `bundle_upload_complete` → `bundle_list`로 CREATED → `bundle_test_push`). 실제 광고는 **열어 확인만**, 반복 클릭·새로고침 금지.
4. 출시 가이드 원문 대조표 작성. 지금까지 판정(2026-10-13):
   - 확인 필요: **사용자 식별키 발급 항목이 로컬 저장만 쓰는 앱에도 해당하는지**(문서 요약 도구는 "필수", 원문은 "사용자별 데이터 관리용"으로만 설명 — 앱인토스 문의 또는 `User.getAnonymousKey()` 저장만 하는 최소 구현으로 해소), **콘솔 앱 정보·고객센터 정보 입력 후 더보기(⋯) 메뉴·내비게이션 바 로고/이름 확인**, 메모리·네트워크 사용(광고 SDK 포함) 실기기 확인.
   - 해당 없음: 주요 기능(앱 내 기능)·스킴 미등록, 토스 로그인·인앱 결제·토스페이, 공유, 기기 권한.
   - 인앱 광고 절(11개)이 이번부터 적용된다: 배너는 스크롤 화면에만(390×844·430×932·360×640에서 스크롤 확인함), Ad 표기 유지, 같은 화면 같은 포맷 1개, 사전 로딩·종료 후 복귀 등.
5. 콘솔 웹 등록 정보(최초 검토 시 함께 입력): 부제 "교대근무 달력 자동 계산", 카테고리 생활 > 편의 > 도구, 키워드 교대근무·근무표·달력·교대·3교대·야간근무·비번, 로고 `assets/logo.png`, 상세 설명(아래), 고객문의 이메일, 확약 5개(사용자 동의 완료 2026-10-13). 새 기능(세부 내용·이름·초기화)을 반영해 상세 설명을 갱신할 것.
   > 주간·오후·야간·당직·비번·휴무를 반복 순서대로 등록하고 오늘이 몇 번째 근무인지 고르면, 월간 달력에서 지난 근무와 앞으로의 근무를 자동으로 보여 줘요. 날짜를 하나하나 입력할 필요 없이 이전·다음 달로 넘기며 근무를 확인하고, 주 시작 요일(일·월)도 바꿀 수 있어요. 설정은 이 기기에 저장돼요.

### 1-4. 병합·푸시
- `feat/v1-enhancements` → `main` `--no-ff` 병합, `npm test` 확인 후 `git push origin main`.

### 1-5. 검토 신청
- 사용자가 요청할 때만. 출시 버전 하나만 제출.

## 2. 알려진 개선 후보 (v1 이후)
- 달력 이전/다음 달 버튼이 텍스트 꺾쇠(‹ ›) — 디자인 기준상 아이콘으로 교체 권장.
- `public/appsintoss-logo.png`(약 300KB, 템플릿 잔재)가 번들에 포함 — 제거 검토.
- 배포 번들 JS 약 1.1MB(TDS·lottie) — 코드 분할 검토.
- 시간 입력은 WebView 기본 `<input type="time">` — 실기기에서 정상 확인됨. 문제 시 `TimeInput`만 TDS 휠로 교체.
- 편집 직후 같은 프레임의 뒤로가기는 dirty 반영 전일 수 있음(실사용 영향 없음, MVP부터 동일).

## 3. 참고 위치
| 무엇 | 어디 |
|---|---|
| 기획서 원본 | `C:\Users\USER\Downloads\TurnCal_개발_계획서.md` (v1.3) |
| 정식 명세 | `openspec/specs/*/spec.md` |
| 아카이브된 change | `openspec/changes/archive/` |
| E2E 스크립트·실행법 | `scripts/e2e/README.md` |
| 광고 설정 | `src/ads/`, `.env.adtest`, `package.json`의 `build:adtest` |
| 저장 형식 | 설정 `turncal.settings`(v3), 세부 내용 `turncal.entries`(v1) — `src/storage/` |
