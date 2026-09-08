# 프로토타입·Expo 3표면 동기화 세부 실행서

> 상태: **P3 도메인별 개발 후보 진행. 식재료 비차단 잔여 보존 후 메뉴 진입(사용자 승인2026-09-09). P3 승계 게이트/공식 검수/네이티브는 최종 종결 전 필수.**
> 작성일: 2026-09-07
> 상위 권위: [`프로토타입-Expo-3표면-동기화-기획안.md`](./프로토타입-Expo-3표면-동기화-기획안.md)
> 이 문서는 토큰 값이나 제품 계약을 새로 정하지 않고, 승인된 기획을 실행하는 순서와 게이트만 소유한다.

## 1. 시작 기준선

### 1.1 격리 작업본

| 항목 | 값 |
|---|---|
| 권위 저장소 | `C:\Users\jacop\프로젝트\식자재관리앱` |
| 격리 worktree | `.tmp\prototype-expo-parity` |
| 작업 브랜치 | `codex/prototype-expo-parity` |
| 제품 기준선 | `3448884` |
| 디자인 토큰 완료선 | `411902b` (`04eb1de` 포함) |
| 통합 checkpoint | `7e9d308` |
| 의미 색 복원 checkpoint | `1afad14` |
| Opus R1 기획안 | `63f066a8cb406deeedf15be19a393d6a741454ed` · `CHANGES_REQUIRED` |
| Opus R2 반영안 | `9ded66e2bbc5a58486aa9ae15b226a1aa3ceff9a` · `CHANGES_REQUIRED` |
| Opus R3 반영안 | `9da4e43559ce2d953652c7b279d7584365e3a519` · `CHANGES_REQUIRED` |
| Opus R4 반영안 | `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d` · `CHANGES_REQUIRED` |
| Opus R5 반영안 | `a02dec70b273e8db692f483b62bc5fbd18f9144b` · `CHANGES_REQUIRED` |
| Opus R6 반영안 | `776e7141cb620222e8d7015c90b65d8a2cc795b3` · `CHANGES_REQUIRED` |
| Opus R7 반영안 | `6912a5ac7355237459126ffea41a1860e66f0d33` · `CHANGES_REQUIRED` |
| Opus R8 반영안 | `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e` · `CHANGES_REQUIRED` |
| P0 구현·봉인 | `25a03b1` → `dabcccc` |
| P1 최초 구현·봉인 | `827d338` → `1bb9b52` · Opus 직접 자문 `CHANGES_REQUIRED` |
| P1 보완 구현·봉인 | `8292ec9` → `af316a0` · Opus 직접 자문 `PASS` |
| P2 최초 구현·봉인 | `f0417db` → `5cd5559` · Opus 직접 자문 `CHANGES_REQUIRED` |
| P2 보완 구현·봉인 | `663adc6` → `3386262` · Opus 직접 자문 `PASS` |

기본 작업 폴더의 다른 장기 작업 변경과 `.tmp` 전체를 삭제하지 않는다. 이 실행서는 격리 worktree만
소유한다. 다른 변경을 발견하면 경로·소유 커밋을 확인하기 전 이동·삭제·스테이징하지 않는다.

### 1.2 현재 검증 사실

- 앱 타입 검사 통과
- 모바일 시험은 첫 전체 실행에서 `myHours.test.tsx` 판본 교체 단언이 `rule-9` 대신 캐시의
  `rule-1`을 읽어 232/233으로 실패했고, 단독·전체 재실행은 통과했다. 토스트가 아니라 판본 교체
  결과 자체를 `waitFor`하도록 고친 뒤 해당 파일 20회 연속(각 16/16)과 전체 233/233을 통과했다.
  최초 실패와 정정 증거를 함께 보존하며 재실행 PASS만으로 최초 실패를 지우지 않는다.
- 원인은 `qk.storeSettings + 'hours-status'`의 `status.refetch()`가 새 `rule-9`를 반환한 뒤 제품 코드가
  `setDays`·`setBase`를 예약하고 성공 toast를 이어서 예약하는 동안, 시험이 toast만 동기화점으로
  삼아 다음 저장을 먼저 누른 **test-only 스케줄링 경합**이다. 제품은 refetch 결과를 직접 검증한 뒤
  같은 응답의 schedule/base로 교체하며 query invalidation 누락은 없었다. 시험은 판본 렌더 자체를
  기다리도록 고쳤다. 측정 SHA `dc5131f90a723f3a4db9f26f952050f607201d56`, 기본 runner
  `vitest 2.1.9`·shuffle=false·seed N/A에서 전체 스위트를 10회 연속 각 233/233,
  합계 2,330/2,330으로 통과했다.
- legacy 색 별칭 0건, 색 역할 감사 통과
- 과거 S4 exact 디자인 계약은 최신 제품 화면이 기준선 이후 변경되어 현재 실패한다. 이 실패는 제품
  회귀로 확정된 것도, 무시 가능한 낡은 검사로 확정된 것도 아니다. 단계 0에서 선언별로 분류한다.
- 운영·스테이징에는 이 브랜치 변경을 적용하지 않았다.

## 2. 산출물 계획

| 산출물 | 제안 경로 | 책임 |
|---|---|---|
| 사람 선언 입력 | `apps/mobile/src/dev/surfaceRegistry.declarations.json` | fixture·상태·parity·근거·임시/마이그레이션 메타데이터를 ID별 선언 |
| 생성 레지스트리 | `apps/mobile/src/dev/surfaceRegistry.generated.json` | README·route AST·prototype와 선언을 합친 재생성 산출물 |
| 레지스트리 타입·로더 | `apps/mobile/src/dev/surfaceRegistry.ts` | schema, fail-closed validation |
| stub 이름 레지스트리 | `apps/mobile/src/dev/surfaceFixtureStubs.json` | fixture 선언의 자유 문자열을 실제 개발 전용 stub 이름과 screenId에 양방향 결속 |
| 화면 카탈로그 | `apps/mobile/catalog-app/**` 또는 별도 `apps/mobile-catalog/**` | 제품 route tree와 분리한 개발 전용 탭형 진입점 |
| fixture 경계 | `apps/mobile/src/dev/catalogFixtures/**` | `stub`과 `devSeedEntity`의 분리된 비운영 재현 경계 |
| 동기화 검사 | `scripts/three-surface-sync-check.mjs` | route·ID·prototype·catalog 양방향 대조 |
| 카탈로그 격리 시험 | `apps/mobile/tests/surfaceCatalog.test.tsx` | 중복 렌더·production 차단·fixture 검증 |
| 빌드 격리 게이트 | `scripts/surface-catalog-build-gate.mjs` | native·web prod 부재 + dev sentinel 존재 양성대조 |
| dev 의존 검사 | `scripts/mobile-dev-import-check.mjs` | 제품→`src/dev/**` 역방향 import 금지 |
| 시각 변경 검사 | `scripts/three-surface-visual-diff-check.mjs` + `docs/prototypes/three-surface-approved-visual-changes.json` | screenId·요소별 before/after와 승인 목록 차집합 |
| 시각 기준선 | `docs/prototypes/three-surface-visual-baseline/**` | 고정 환경 PNG·접근성 tree·blob SHA |
| P3→P5 대기 장부 | `docs/prototypes/three-surface-migration-backlog.json` | registry divergence와 대조하는 생성 projection, `DESIGN-SYSTEM` 소유 |
| 개발 DB allowlist | `apps/mobile/src/dev/catalogEnvironment.json` | `MOBILE-PLATFORM` 소유, dev Supabase ref/URL만 허용 |
| P4 구조 결정 | `docs/prototypes/surface-catalog-structure-decision.md` | `MOBILE-PLATFORM` 소유, 3축 증거·채택/기각안 |
| seed 계약 | `apps/mobile/src/dev/catalogFixtures/devSeedEntities.json` | seed 판본·소유자·재현 명령·RPC 결과 |
| 네이티브 증거 | `docs/prototypes/three-surface-native-evidence.json` | 플랫폼·OS·기기·exact SHA·항목별 결과·대체 승인 |
| 자문 Finding 장부 | `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.json` + 생성 `.md` | schema·checker가 Finding·처리·closing SHA 전수 대조 |
| 승인자 계약 | `docs/prototypes/three-surface-approvers.json` | `PRODUCT-OWNER` 목록, commit author와 self-approval 금지 |
| 자문 장부 검사 | `scripts/three-surface-advisory-ledger-check.mjs` | 완료 round 전수·disposition·closing SHA 검증 |
| byte 산출물 manifest | `docs/prototypes/three-surface-byte-artifacts.json` | 닫힌 경로/marker 목록, manifest 자신 포함, fixed-point·LF 검사 |
| 기준선 산출물 | `docs/prototypes/three-surface-baseline.json` | 대상 SHA·차이·예외 목록 |
| 검수 기록 | `docs/ai-review/tasks/<TASK-ID>/**` | Fable/승계 규칙에 따른 exact-SHA 검수 |

경로는 단계 1 검수에서 저장소 구조와 충돌이 발견되면 바꿀 수 있다. 단, 레지스트리를 문서와 코드에
두 벌로 만들지 않고 한 기계 원본에서 파생한다는 원칙은 고정한다.

## 3. 전체 단계

| 단계 | 목적 | 완료 증거 | 독립검수 |
|---|---|---|---|
| P0 | 기준선·옛 gate 차이 분류 | baseline JSON, 선언별 disposition | 필수 |
| P1 | 화면 레지스트리와 검사기 | orphan·duplicate·stale 0 | 필수 |
| P2 | 공용 레이아웃 pilot | 대표 5화면, 비의도 동작 diff 0 | 필수 |
| P3 | 기본 Expo 도메인별 적용 | 다섯 탭 배치 완료 | **도메인별 필수** |
| P4 | 개발 전용 Expo 카탈로그 | 실제 화면 재사용, production 차단 | 필수 |
| P5 | 프로토타입·가이드 동기화 | target 차이 0 또는 승인 예외 | 필수 |
| P6 | 전체 검증·최종 종결 | exact SHA, 게이트, 검수 | 최종 필수 |

## 4. P0 — 기준선 재확정

### 작업

1. 제품 기준선, 디자인 토큰 완료선, 통합 checkpoint의 commit·tree를 기록한다.
2. 현재 실패하는 S3a/S4 exact 계약의 각 선언을 다음 중 하나로 분류한다.
   - `preserve`: 최신 제품에도 그대로 적용해야 하는 기존 계약
   - `supersede`: 최신 제품 구조 때문에 새 동등 계약으로 승계
   - `intentionalDifference`: 제품 요구로 유지하는 차이
   - `regression`: 즉시 복구할 비의도 이탈
   `regression`은 P0에서 코드로 고치지 않고 기준선 JSON의 번호 있는 복구 backlog로만 등록한다.
   복구는 별도 P0-fix commit 또는 소유 P2/P3 배치에서 exact-SHA 검수한다.
3. 최신 화면·라우트·프로토타입 target 인벤토리를 보존된 스크립트로 다시 측정한다.
4. 기준선 JSON에 입력 commit, 스크립트 hash, 결과 hash를 결속한다.
5. Opus R1~현재 round의 모든 Finding을 JSON 장부에 옮기고 schema/checker를 실행한다. 완료 round의
   Finding 누락, disposition 누락, `closed`의 closing SHA 누락은 P0 시작 gate에서 실패한다.
6. advisory ledger Markdown 전체를 JSON에서 생성하고 두 번 생성 bytes 동일·수기 수정 실패를 단언한다.
   byte manifest 밖의 생성 산출물, manifest 자기 누락, 등록 항목의 CRLF·BOM을 각각 실패시킨다.
7. baseline 갱신은 현재 exact SHA·clean worktree·`--force`를 요구한다. 분류 개수나 inventory floor가
   달라지면 `<사유ID>@<현재 SHA>` 1회성 토큰을 별도로 요구하며, 증가·감소 어느 방향도 묵인하지 않는다.
   baseline을 삭제한 커밋에서도 직전 Git blob을 읽어 같은 래칫을 적용하고 최초 생성만 `--bootstrap`으로
   분리한다. 세 검사기와 세 음성 시험은 byte manifest 및 역방향 발견 범위에 포함한다.
8. 계획 자문 장부의 일회성 migrate/backfill 경로는 P0 뒤 폐쇄한다. 생성 Markdown 쓰기는 exact SHA·
   clean worktree·`--force`를 요구하고, 같은 회차의 Finding이 모두 같은 evidence path 집합을 쓰면 실패한다.

### 금지

- gate를 초록으로 만들기 위해 허용 목록만 넓히기
- 새 제품 화면을 감사 대상에서 제외하기
- 이전 디자인 토큰 완료를 취소했다고 표현하기

### 완료 조건

- 미분류 선언·화면·target 0건
- 기준선 재실행 가능
- 직전 기준선 대비 기존 mobile 시험 실패 0과 타입 검사 유지. 새 시험은 명시한 증분으로 기록
- `myHours.test.tsx` 판본 교체 조건을 직접 `waitFor`하고 해당 파일 20회 연속 통과
- P0 변경은 문서·감사기·정정만 포함하며 화면 시각 변경은 0건
- P0 범위에서 제품 화면 파일을 건드리면 checker가 실패
- baseline 삭제·분류 감소·검사기 자기 변조·미등록 task/script 산출물 음성 시험 통과
- 동일 기본 runner(`vitest 2.1.9`, shuffle=false, seed N/A)에서 P0 기준 233개와 이후 선언된 시험
  증분을 합친 `N/N` 전체 스위트 10회 연속 통과

## 5. P1 — 화면 레지스트리

### 작업

1. README의 표를 전용 Markdown parser로 읽어 정식 화면 ID를 얻고 expo-router 파일·component export는
   AST/파일 시스템으로 읽는다. 모든 include/exclude 경로는 `git rev-parse --show-toplevel` 기준 상대
   경로로 해석하며 repository root 이름이 `.tmp`인지와 무관하다. 다른 worktree는 root 밖이므로 입력에
   들어오지 않는다. P0 기준선의 route·ID·prototype 최소 개수 floor보다 줄면 실패하고, 같은 tree를
   기본 checkout과 worktree에서 검사한 입력 hash가 같아야 한다.
2. 프로토타입의 screen·popup registry를 파서로 읽는다. HTML 정규식 한 번으로 완료 판정하지 않는다.
3. 생성 컬럼과 사람 선언 컬럼을 분리하고, 둘을 합친 레지스트리를 재생성해 committed bytes와 대조한다.
   README의 시트·인라인 설명과 prototype의 과거 추적 ID는 AST만으로 제품 의미를 복원할 수 없으므로,
   선언 파일이 `routeBinding`·`prototypeScreenKeys`·`prototypeTargetsBinding` 연결을 소유한다. 생성기는
   실제 route·export·target 존재, target 전수 소유, 1:N·N:1의 `prototypeSharingReason`을 검증하며
   생성된 `expoRoute`·`sourceComponent`·`prototypeTargets` 값 자체는 사람이 쓰지 않는다.
   상대·tsconfig alias import를 정적으로 해석하지 못하면 graph edge를 버리지 않고 실패하며, Windows
   대소문자 비구분과 Metro의 `.js`·platform suffix를 같은 계약으로 처리한다. `sourceComponent`는 실제
   runtime export이고 해당 route의 import graph에서 도달 가능해야 한다.
4. 레지스트리에서 **예정 카탈로그 탭 projection**과 검수 대상 목록을 생성한다. 실제 카탈로그 entry는
   P4에서 대조한다.
5. README 구현 상태 표식 블록을 생성 레지스트리에서 다시 만들고 수기 상태 권위를 제거한다.
6. 다음 음성 시험을 추가한다.
   - Expo route 하나 삭제·추가
   - prototype target 하나 삭제·추가
   - 중복 screenId
   - 존재하지 않는 source component
   - fixtureRef 없는 동적 route, `stub`/`devSeedEntity` 판별 합집합 위반
   - dev seed selector의 0건·복수 해석과 bare UUID·운영 ID 리터럴
   - 근거 없는 `unsupported`·`specOnly`
   - 생성 컬럼 수기 수정과 README 상태 블록 수기 수정
   - 제품 코드의 `src/dev/**` import
   - 정적·동적·`require`·type-only import와 barrel re-export 각 1건
   - registry 두 번 생성 bytes 동일, CRLF/BOM/key·array 순서 변조 실패
   - README 생성 두 번 fixed point, 상태 영역 밖 bytes 불변, CRLF·BOM 변조 실패
   - README 상태 영역 수기 수정·표식 누락·중복·ID 표 겹침
   - route↔ID, ID↔prototype, ID↔catalog 각 축에 잘못 적용한 예외
   - README ID 없는 route를 `expoOnly`로 면제하는 시도와, README ID가 있는 prototype 부재 route의
     올바른 `expoOnly` 양성 fixture
   - parity 4종의 필수·선택·금지 필드 행렬 위반, `specOnly` catalog 축 양성/음성 fixture,
     `specOnly.states`, `unsupported.states`, route의 빈 `states`, 빈 `prototypeTargets`,
     parity에 부적합한 `temporaryDivergence.axes`, 잘못된 close fixture
   - fully aligned route/fixture의 `reason`, 긴급 `expiresAt` +8일, migration deadline 초과
   - README 정식 ID에서 사라진 사람 선언 key
   - root가 `.tmp` 아래인 worktree에서도 inventory floor·입력 hash 동일

### 완료 조건

- Expo route ↔ 화면 ID ↔ prototype target ↔ 생성된 catalog projection의 차집합은 근거 있는
  `specOnly`·`expoOnly`·`unsupported` 선언 목록과 정확히 일치
- 의도된 1:N·N:1 대응은 명시적 배열과 이유로만 허용
- 레지스트리 외 수기 카탈로그 배열 0건
- P1 exact SHA 독립검수 PASS

### 구현 기록

- 최초 봉인 `1bb9b523fd22f62563b8569575aa30a36d5779fa`는 Opus 직접 자문에서 `CHANGES_REQUIRED`였다.
- 지적 범위는 spec-only catalog 누수, Windows 경로·대소문자, 미해석 import edge, route 이름 중복,
  unsupported 기본값 상속, stub/source 결속, 정렬·floor 고정이었다.
- 반영안은 P1 floor 객체의 hash를 고정하고, code-unit 정렬·tsconfig alias 기반 graph·실제 stub
  registry·route 도달성·top-level literal 제한을 음성시험으로 닫는다.
- 보완 봉인 `af316a0e600f00f719194a8d1bf08045af5621f9`는 같은 범위의 Opus 직접 자문 R2에서 `PASS`였다.
  이는 P1 구현 진행 승인이고 Fable 또는 공식 R2/R3 운영 종결 증거는 아니다.
- 후속 검사기 backlog 중 `packages/*` 경유 graph, tsconfig `extends`, `.web` suffix, trailing `/index`
  route 충돌, symlink root, TypeScript parse diagnostic은 P2에서 구현·음성 시험으로 닫았다. 임시 예외는
  P2 활성 threshold(`migrationBacklogMax=0`, `emergencyDivergenceMax=0`, deadline UTC)로 새 기본 예외를
  금지한다. 프로토타입 tracking ID는 화면 key와 route ID가 1:1이라는 거짓 가정을 두지 않는다. 한
  route ID를 여러 시각 상태 key가 공유하고 `fixed_average`처럼 교차 도메인에서 재사용되는 현행 계약을
  보존하면서 형식·target 소유·host·중복 target을 검사한다.

## 6. P2 — 공용 레이아웃 pilot

### 대표 화면

다섯 탭에서 한 화면씩 고른다. 기본 후보는 `ING-01`, `RCP-01`, `ORD-01`, `SALES-01`, `MY-01`이며
P1 레지스트리 실측 뒤 복잡도와 상태 재현 가능성으로 확정한다.

### 작업

1. 프로토타입과 제품의 정보 순서·gutter·섹션·행·행동 위치를 나란히 비교한다.
2. 중복되는 차이는 Header, Card, ListRow, Section, Sheet, Tab 같은 공용 규격에서 먼저 해결한다.
3. 기본 → 의미 → 컴포넌트 토큰 경로를 사용한다.
4. 제품 훅, route param, 저장 동작, RPC 응답 처리는 바꾸지 않는다.
5. 승인된 시각 변화 목록과 요소별 before/after를 보존한다.
6. `three-surface-visual-diff-check.mjs`가 `screenId`·요소 키별 diff를 승인 manifest와 양방향
   대조하고, 승인되지 않은 변화와 재현되지 않는 낡은 승인을 모두 실패시킨다.
7. 시각 diff 입력은 고정 기기·viewport·font scale·locale·state·pixel ratio·renderer·OS·Expo SDK
   판본에서 캡처한 PNG와
   접근성 tree에서 만든 안정적 요소 키(`screenId/state/testID-or-role+name`)다. baseline은
   `docs/prototypes/three-surface-visual-baseline/<screenId>/<state>.png`, manifest는 각 before/after
   blob SHA, 요소 키, 변경 prop, 승인자와 승인 SHA를 기록한다. baseline 갱신은 별도 승인 commit에서만
   하며 승인되지 않은 변화, 재현되지 않는 승인, hash가 바뀐 stale 승인을 각각 음성 시험한다.
   PNG 기준선은 `.gitattributes`에서 `-text -diff` binary로 고정하고 텍스트 LF 계약을 적용하지 않는다.
8. `states` 증거는 카탈로그 탭의 항목 존재가 아니라 각 상태를 선택했을 때 sourceComponent가 렌더한
   접근성 tree snapshot·스크린샷 hash·상태별 sentinel로 남긴다. 선언만 추가한 fixture는 실패한다.

### 완료 조건

- 다섯 대표 화면의 제품 기능 시험 유지
- 새 임의 색·간격·반경 팔레트 0건
- 공용화할 패턴을 화면별 복사로 구현한 사례 0건
- 320px·200% 글자·영어·Android·iOS safe-area 점검
- P2 exact SHA 독립검수 PASS 후에만 P3 확대
- 시각 diff가 승인 manifest와 정확히 일치
- baseline branch 또는 renderer·OS·Expo SDK 판본이 바뀌면 merge-base의 승인 manifest에서 새 환경으로
  재촬영하고, old/new input hash와 차집합을 별도 rebaseline commit에 보존해 다시 독립검수한다.
  product diff와 rebaseline을 섞지 않는다.

### P2 구현·자체검수 기록

- 대표 화면은 계획 후보 그대로 `ING-01`, `RCP-01`, `ORD-01`, `SALES-01`, `MY-01`로 확정했다.
- 다섯 화면의 중복 메인 헤더를 `HubHeader`·`HubHeaderAction`으로 모으고, 값은
  `TYPE`·`COLOR`·`COMPONENT.hubHeader`를 통해 소비한다. 상세 화면 `AppHeader` 계약, 제품 훅,
  query key, route, 저장/RPC 코드는 바꾸지 않았다.
- 전후 본문 텍스트는 다섯 화면 모두 byte 동일하다. 승인 manifest는 각 PNG·본문 텍스트의 Git blob
  OID, 안정 요소 key, 허용 prop, 승인 근거를 양방향으로 묶는다.
- 고정 renderer `react-native-web 0.21.2`·Chromium `151.0.7834.0`·Pretendard 4 face에서 기준선
  5/5와 반응형 20/20(`320px`, `320px+영어+글자 200%`, Android safe-area 24,
  iOS safe-area 47)을 재현했고 document overflow·viewport escape는 0이다.
- `MY-01`의 로컬 데이터 plane 404 세 경로는 정확한 allowlist로만 기록했다. 이 예외는 헤더 변경의
  제품 동작 PASS가 아니며, 시각 캡처에서 로컬 DB 판본 차이를 숨기지 않기 위한 진단 분리다.
- 공용 헤더 단위 시험 4건을 추가해 모바일 전체 29파일·237시험을 통과했다. 동기화 음성 계약은
  P1의 52건에서 57건으로 늘었고, 시각 manifest 음성 계약 9건과 캡처 재현 25건도 통과했다.
- 위 기록과 `338626231c6eef4483d32c09c9ec30c39e1b3688`의 exact-SHA Opus R2 `PASS`로 P2 독립
  재검수 조건은 충족했다. 다만 `verify --no-db`의 기존 S4 게이트가 화면별 토큰 개수를 공용
  `COMPONENT.hubHeader` 소유권으로 승계하지 못하므로, 그 계약을 별도 rebaseline commit에서 닫기 전에는
  P3를 시작하지 않는다. 이 판정은 Opus 승계 자문이며 Fable 공식 판정이 아니다.

### P2 Opus R1 반영 계약

- `three-surface-p0-check`는 `stage=P2`와 active threshold를 검사하며, P2 제품 변경은 구현 commit과
  분리한 rebaseline commit에서만 새 기준선으로 승계한다. 기준선은 직전 failure 목록과 새 목록의
  차이를 보존하고 S3A·S4·TOUCH 출력·분류·backlog를 함께 재측정한다.
- `HubHeaderAction`은 44dp 실제 Pressable과 40dp 내부 시각 상자를 분리해 소유한다. 호출부 hitSlop으로
  계약을 우회하지 않으며 감사기의 공용 컴포넌트 표와 음성 시험이 이 구조를 고정한다.
- 터치 재측정에서 기존 `MyTaxScreen`의 조건부 버튼 사이 hitSlop 중첩 1건이 드러나 하단 행동 묶음에
  `space.sm` 간격을 부여했다. 미달·형제 중첩은 0이며, 정적으로 확정할 수 없는 형제 구조 16건은
  양방향 known 목록으로 숨기지 않고 유지한다.
- 반응형 20건은 승인 manifest와 모든 필드를 완전 비교한다. safe-area는 DOM padding 조작이 아니라
  SafeAreaProvider가 실제 소비하는 inset 경로로 주입하고, 영어 부제·글자 200%의 fontSize/lineHeight,
  수평·수직 이탈과 텍스트/액션 겹침을 직접 측정한다.
- 시각 증거의 data plane은 헤더 전용이다. 로컬 DB 본문 변화는 캡처 입력에서 제외하며 서버 기동 명령과
  캡처 범위를 manifest에 결속한다. SALES 액션의 상단 정렬은 승인 prop으로 명시한다.
- P3부터 protected gate가 놓치지 않도록 `verify` ③에 P0 기준선·레지스트리 sync·시각 manifest·byte
  artifact 네 결정론적 검사를 필수로 연결한다. 브라우저 재촬영은 환경 의존 생성 단계이므로 각 배치의
  evidence commit 전에 실행하고, CI에서는 결속된 산출물 검증만 수행한다.
- Opus R2는 R1 Major 5건과 Minor 8건의 완료를 확인했다. 원문은
  `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P2-001/opus-direct-advisory-r2.md`에 보존한다.

### P2 S4 successor 승계 계약

- 기존 S4 exact 검사에서 드러난 raw 실패 54건을 숨겨 통과시키지 않는다.
  `scripts/design-token-s4-successor.json`이 exact 순서의 `sealedRawFailures`를 직접 봉인하고,
  P2가 새로 만든 차집합 6건만 `component-transfer`로, 상속된 48건은 P3 backlog로 분류한다.
- P3 backlog의 소유 분포는 COMMON 4 · MY 15 · RECIPES 17 · SALES 12다. `MyHomeScreen` 8건은
  P2 이전 P0 baseline에도 존재하므로 공용 헤더 이전으로 해소된 것이 아니며 P3-MY에 남긴다.
- 공용 소유권은 `kit/index.tsx` 전체 문자열이 아니라 `HubHeader`부터 다음 export 전까지의 구현 범위에서
  확인한다. `component-transfer`는 P2 old→new 차집합의 `added`에 있는 실패선만 허용한다.
- P0 재기준선에서 regression은 708→654로 감소했다. S4 gate가 새 successor로 PASS한 뒤에도 P3 open
  48건이 사라지지 않도록 P0 baseline은 successor 경로·텍스트 해시·raw/transfer/backlog 수와
  `654 + 48 = 702` 합산 open 수를 함께 결속한다.
- 현 판본은 P0 baseline 두 Git blob에서 만든 최초 schema v2다. 최초 판본만 그 두 P0 blob의 S4
  failureLines를 old/new 입력으로 쓴다. P3가 실패를 개선하거나 새 실패를 만들면 새 판본의
  `predecessorSuccessorBlob`에 직전 successor Git blob OID를 넣고, old 입력은 그 blob의
  `sealedRawFailures`, new 입력은 새 판본의 `sealedRawFailures`로 삼는다. `changeDelta.fromRaw`·removed·
  added·분류·계수를 함께 갱신한다. `predecessorSuccessorCommit`은 HEAD의 조상이어야 하고 그 커밋의
  `scripts/design-token-s4-successor.json` blob이 위 OID와 같아야 한다. 개선·악화·도달 불가 blob·후속
  분류 세탁을 모두 음성 시험으로 보존한다. exact SHA 독립검수 PASS 영수증이 생기기 전에는 통합
  게이트가 실패한다.
- 검수 영수증은 전용 `대상: <40자 SHA>`와 `판정: PASS` 행으로 결속한다. R3의 오분류 지적 원문은
  `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P2-001/opus-direct-advisory-r3.md`에 보존한다.
- P2 이후 헤더의 40×40+hitSlop이 44×44 Pressable로 바뀌었으므로 P3 진입 exact SHA에서 Android/iOS
  touch 1x·2x 4종, tap probe 2종, Android receipt 1종, iOS text-scale 1x·2x 2종을 실제 기기로
  재측정한다. 커밋 문자열만 바꾸는 방식으로 증거를 갱신하지 않는다.

## 7. P3 — 기본 Expo 도메인별 적용

### 배치 순서

1. 식재료
2. 레시피
3. 발주
4. 매출관리
5. MY

의존성이 더 큰 공용 컴포넌트가 확인되면 해당 컴포넌트를 먼저 별도 commit으로 처리한다. 각 배치는
기능 변경과 시각 변경을 섞지 않는다.

### 배치별 절차

#### 2026-09-09 사용자 결정 — 개발 진입과 최종 종결 분리

사용자는 한 도메인의 비차단 검증에 전체 작업이 정체되는 방식을 중단하고 다음 도메인으로
진행하도록 승인했다. 이 절은 아래 과거 체크포인트의 “다음 도메인 진입 금지”를 개발 후보에
한해 대체한다. 식재료를 완료로 올리거나 공식 검수/비용/작업 루트/배포 규칙을 면제한 결정은 아니다.

- **개발 진입 차단:** 재현된 데이터 손상·잘못된 대상 저장·필수 경로 오작동·보안 문제·공용
  토큰/컴포넌트 계약 위반. 발생 배치 또는 영향받는 공용 변경을 먼저 수정·내부 재검수한다.
- **개발 진입 비차단:** 미수행 네이티브·공식 외부검수, 기존 게이트 승계, 추가 장문/스크롤
  표본, 현재 경로에서 재현되지 않는 이론 경계. 대상·근거·검증 방법·종결 시점을 남기고
  다음 도메인 후보 작업을 계속한다. 실제 필수 경로 불능이 확인되면 차단으로 재분류한다.
- 한 배치는 소스 분류→공용 기준 구현→자체검수→Sol 페이지 검수→차단 수정으로 전진한다.
  공용 변경·반복 실패·도메인 마감은 Astra 검수로 올린다. 새로운 검사기는 다음 배치에 필요한
  근거가 없을 때만 보완하며 같은 영역의 비차단 표본 확장을 무한 반복하지 않는다.
- 진행 수는 고유 target 기준 `미착수 / 개발 중 / 내부검수 후보 / 최종 종결`을 분리한다.
  테스트 수·binding 수·작업 범위를 완료 페이지 수로 바꾸지 않는다.
- 아래 P3 완료 조건과 공식 도메인별 exact-SHA 검수·전체 verify·네이티브 조건은 유지한다.
  P4 진입·병합·배포·P3 최종 종결은 이 개발 진입 승인에 포함하지 않는다.

**승계 잔여:** 식재료44고유 target은 개발 후보이며 최종 종결 미확정. 공용 picker/메모/옵션/
이력의 키보드·네이티브·장문·추가 스크롤 잔여는 현행 잔여 목록 및 내부 검수 장부가 추적한다.
P3 게이트 승계와 Fable/Opus NOT_SENT는 전체 종결 차단으로 유지한다. 개발의 다음 배치는 메뉴다.

1. 레지스트리에서 대상 화면·상태·prototype target을 고정한다.
2. 공용 컴포넌트 변경과 화면 소비 변경을 분리해 리뷰 가능한 diff로 만든다.
3. loading·empty·error·ready와 입력·시트 상태를 검증한다.
4. 승인된 시각 변화와 비의도 변화 검사를 재실행한다.
5. prototype 차이는 해당 배치 commit의 사람 선언 파일에 `migrationPending{owner,expiresAt,targets}`로
   `DESIGN-SYSTEM` 담당자가 등록하고, 기계가 P5 대기 장부 projection을 재생성한다. P2 전
   `three-surface-baseline.json`에 `migrationBacklogMax`·`emergencyDivergenceMax`와
   `migrationDeadlineUtc`를 각각 고정한다.
   P3·P5는 전자를 쓰고 긴급 절차는 후자를 쓴다. 상한 변경은 별도 독립검수 commit이어야 하며,
   새 항목과 해당 상한 인상을 같은 commit에 담으면 checker가 실패한다. 각 migration `expiresAt`이
   `migrationDeadlineUtc`를 넘으면 실패한다.
   대기 장부는 registry의 `parity=divergent` + `migrationPending` 항목에서 생성한 projection이며
   독립 편집할 수 없다. 영구 divergent와 emergency `temporaryDivergence`는 이 장부에 들어가지 않는다.
   장부의 고아·누락·수기 수정은 양방향 검사로 실패한다.

### 완료 조건

- 다섯 도메인의 등록 화면이 새 레이아웃 계약을 소비
- 도메인 훅·query key·RPC 호출 계약 diff 0 또는 별도 승인 작업
- 화면별 하드코딩 감소가 감사 산출물로 확인되고 새 자유 스케일 0건
- 배치별 필수 시험 통과
- 배치별 시각 diff가 승인 manifest와 정확히 일치
- 각 도메인 배치별 exact SHA 독립검수 PASS. 여러 도메인을 한 검수로 묶지 않음

### P3 식재료 재접근 체크포인트 — 2026-09-08

내부 검수 분담(사용자 승인2026-09-08): 페이지별 반복 검수는 Sol high, 공용 컴포넌트·토큰 계약
변경/반복 실패/도메인 마감은 Astra high로 한다. 동일한 전후 캡처·확대·회귀시험·exact SHA 조건을
유지하고 Fable/Opus 공식 독립검수를 대체하지 않는다. 구현자는 별도의 읽기 전용 검수 결과를 받아
반영하며, 모델 변경 자체로 기존 검수 미결·게이트 차단·네이티브 미완료를 닫지 않는다.
계획은 `.codex/mission-relay/model-plan.json` 단계14에 봉인하며 전판은1c16eee Git blob으로 보존한다.

상태: **구현 후보·자체검수 진행, P3 배치 미종결**. 사용자의 공용 우선 정정에 따라 원래 Expo
`82651be53c011c9e4c48bf5bfca0eadde0ce6070`에서 다시 비교한다. 프로토타입은 정보 구조·배치
참고이며 글꼴·굵기·색·아이콘·컨트롤 규격의 정본이 아니다. 값은 기존 `tokens.ts`의 기본→의미→
컴포넌트 계층과 `kit`을 따른다. 이전 시도와 기본 작업 폴더의 다른 변경은 삭제하지 않았다.

첫 웹 후보(아래 이력): `703d46405a8df84f66458a0c9443160ea1b7ec69`. 뒤의
`8f5ba28e73be81ed963e5bcccb376a5a415f19ab`·`0af12e3b74f13b0bc3d6e2ccb99ebb27039f3ee5`는
측정 스크립트만 수정했으며 앱 파일 diff는 없다. 화면 캡처는 개발용 웹390×844·한국어이며 실제
조회 데이터가 달라질 수 있어 원본과 픽셀 diff 0을 주장하지 않는다.

| 화면 | 원래 Expo에서 보존 | 선택 적용·정정 | 전후 확인 |
|---|---|---|---|
| ING-01 | HubHeader·ScrollTabs·SortChip·IngCard·FAB | 화면 배치 유지. 공용 ScrollTabs 접근성 선택 상태만 보완 | 기본 목록·가로 카테고리·하단 탭 |
| ING-02 | Field/Input/Select/Button, 거래처·안전재고 등 실제 필드 | 공용 Input 기본 크기/굵기/패딩 불변. 프로토타입 필드 수로 축소하지 않음 | 등록 폼·단위 선택 외형 |
| ING-03 | 실제 단가/입고/메모/재고 카드 | 수정 메뉴를 기존 외형의 공용 ActionSheet로 추출, 중첩 버튼 제거 | 상세+수정 메뉴 |
| ING-03b | 입고(E1) 독립 경로, 다중행 구매처 옵션·결제액·날짜 | 구매처를 단일행 Select로 강제하지 않음 | 입고 폼·고정 버튼 |
| ING-04 | 원래 수정 폼과 기본 거래처 등 실제 필드 | 공용 Input 기본 외형 유지 | 수정 폼 |
| ING-05 | 조정/완전소진(E5)과 폐기(E2)의 의미·계산·사유·저장 payload | 로컬 InputBox→공용 Input(tone), 700→600 의도된 공용 굵기 수렴. 공용 ScrollTabs, 스크롤 본문+고정 버튼+본문 내 입고 도움말 | 조정·완전소진·폐기 3상태 |
| ING-06 | 실제 구매 옵션·URL·편집/삭제 | 더보기→공용 ActionSheet. 단일 옵션 fixture로 다중 옵션 배치 검증을 주장하지 않음 | 옵션 목록+더보기 |
| ING-07 | 실제 재고·월별 기록·통합 조회 설정 | 현재 filter.order를 공용 FilterButton으로 노출. 공용 ConditionRow 줄바꿈 | 목록+3조건 클릭 |
| ING-08 | 원래 기간/유형/정렬 통합 시트·직접 기간 | 프로토타입의 단일 유형 선택으로 기능을 줄이지 않음 | 통합 조회 설정 |
| ING-09 | 실제 지출/단가/월별 구매 이력 | 기존 공용 내역 구조 유지 | 구매 이력 |
| ING-10 | 폐기 구분·데이터·권한 | 유형 선택→공용 Sheet. 높이560 대신120+3×rowMinHeight.oneLine=300 | 목록+유형 선택 |
| ING-11 | 최근7일 정책·직접/자동 구분·연결 이력 | 기존 공용 카드와 연결 구조 유지 | 수정 이력 |

증거 루트: `docs/prototypes/three-surface-p3-ingredient-visual/`.

- `before/render-evidence.json`: 원래 Expo 비교용 `53f795abb777c51b9b9966d7e18e5205fddb5e75`,
  자체 결과 **FAIL**을 그대로 보존한다. 원래 중첩 버튼 등도 포함하며 합격 기준선이 아니다.
  `ING-03-action-menu.png`가 상세와 같은 이미지인 캡처 오류가 있어 이 한 장은 전후 증명에 쓰지 않는다.
- `candidate-4/render-evidence.json`: 앱 후보703d464의12화면+5상태. 수평 경계·폰트·오류 검사 PASS.
  사람 눈검수와 Astra 교차검수에서 보통 크기 추가 Major를 찾지 못했다. 이것은 전체 상태·네이티브 PASS가 아니다.
- `prototype-390-r3/render-evidence.json`:0af12e3에서 참조12화면+2상태를 실제 phone390×844로
  각각 단언했다. 카탈로그 높이가 화면마다 달라 브라우저 바깥 높이만 조절했으며 프로토타입 CSS는 수정하지 않았다.
  기존 ING-05가 입고 화면을 잘못 찍던 오류를 차감/폐기 경로로 정정했다.
- `responsive-1/responsive-evidence.json`:703d464,320×720 font-size만200%.6/6은 클릭·경계·도달성
  검사 통과일 뿐 가독성 PASS가 아니다. 안내문 고정 행간에 글자가 겹치는 강한 스트레스 결과를 보존한다.
- `responsive-2/responsive-evidence.json`:8f5ba28,320×720 font-size+명시 lineHeight200% 웹 근사.
  ING-07 세 칩 클릭, ING-05 세 탭 선택·도움말 스크롤·고정 버튼 총6/6 PASS. 안내문 줄 겹침 해소를
  눈으로 확인했다. 설치된 RN의 iOS `RCTAttributedTextUtils.mm`과 Android `TextAttributeProps.java`는
  행간도 확대한다. Android SP/비선형 확대와 실제 키보드는 브라우저 근사로 증명하지 않는다.

Astra의703d464 이전 두 Major(320px/200%의 ING-07 마지막 칩 이탈, ING-05 폐기 탭 이탈)는
공용 래핑/스크롤로 수정했다. ConditionRow `right`의 실제 소비처는0건이며 단위 fixture만 확인했으므로
긴 라벨+right 조합의 실제 브라우저 적합성은 미검증이다. 모바일 시험241/241, 타입검사는 통과했다.
전체 verify는 시작 후 측정 스크립트/선택 상태 보완 커밋이 전진한 진단 실행이므로 최종 exact-SHA 증거로
쓰지 않는다. 확인된③ 차단은 다음 계약 결함이며 전체 통과라고 기록하지 않는다.

#### P3 게이트 승계 누락 — 차단, 미해결

`three-surface-p0-check.mjs`는P2 판본만 허용하고 기준선 이후 제품 변경을 무조건 거부한다.
그 뒤 검사기 해시와 현재 감사 출력까지 과거 출력과 일치시켜P3 구현을 수용할 수 없다.
`three-surface-visual-diff-check.mjs`도P2 헤더5화면 전용이어서 위P3 본문/시트 캡처를 승인하지 않는다.
단순 stage 변경·경로 예외·baseline 재작성으로 통과시키지 않는다.

다음 검수 단위는 **제품 변경과 분리된 P3 승계 계약**이다. 기존P0/P2 blob·측정 tree·분류·backlog는
보존하고, 별도P3 manifest가 exact 변경 파일의 전후blob·배치 화면/상태·현재 감사의
removed/added/unchanged·현재 시각 증거·독립검수 target을 양방향으로 묶어야 한다.
다른 도메인/훅/RPC 변경, 같은 개수의 다른 실패로 교체, 조상PASS 재사용, 승인 후 한 줄 변경,
증거 삭제/누락, 상한 동시 증액을 음성시험으로 막고 필수verify/byte 목록에 등록해야 한다.
당시 이 계약과 exact-SHA 외부 독립검수, 네이티브 미완료를 다음 도메인/P4 진입 차단으로 두었다.
2026-09-09 사용자 결정에 따라 다음 도메인의 **개발 후보**는 허용하며, 이들 조건은 P3 최종
종결·P4 진입 차단으로 유지한다. 기존 게이트의 실패를 PASS로 바꾸지 않는다.

#### 전체 대상·큰 글자 재검수 후속 — 2026-09-08

최신 웹 측정 target: `044e7fb10bbe91fa10ff0d5ab11c95d6762d04ee`.
제품 수정 `ea76453`·`5c23368`·`cbd616e`, 검사 확대 `0f35ff0`·`dfbcecc`·`db93c8d`·`be6b88b`를 포함한다.
이 후속에서 `tokens.ts`, core 계산, DB/RPC는 변경하지 않았다. 전체 재접근 기준82651be와 비교하면
이전 회차의 `COMPONENT.input/actionSheet` 정의 추출은 존재하므로 "토큰 파일 전체 무변경"으로 쓰지 않는다.

**분모 정정.** 앱 화면60이라는 이전 수치는 P0 README 정규식이 suffix ID7개를 빠뜨리고 설명 속
비registry ID3개를 더한 결과(64−7+3)다. 정본 registry는 최초 판본부터 **64 surface/53 route**다.
프로토타입은 **185 고유 target = 활성182(61 screen+121 popup@host)+숨김3**이다. 도메인별 소유 합계187과
edge202는 공유 target을 중복 센 값이므로 분모로 쓰지 않는다. 식재료 소유는44(활성41+숨김3)다.
`scripts/three-surface-target-inventory.mjs`의 전수 projection을
`docs/ai-review/evidence/PROTOTYPE-EXPO-P3-TARGET-INVENTORY-20260908.json`에 보존했다(시험21/21).
이 산출물은 소유 관계의 진단 사본이지 새 정본·완료 장부가 아니다.

프로토타입14개와 앱17캡처의 비교는 **후보 상태 매핑14개**일 뿐 완료14개가 아니다. ING08은 통합
조회 시트와 단일 유형 선택의 차이, ING03 메뉴는 실제 기능 차이가 있다. ING05 완전소진은 별도
prototype target 없는 앱 상태다. 앱 전용2개 ready와 추가상태까지 있어 전체 앱 상태 분모는 아직
최종 확정하지 않았다. "약200페이지" 범위를60/64개 기본 화면만으로 축소하지 않는다.

| 발견/전후 | 정정 | 확인 범위 |
|---|---|---|
| ING03 최근 수정 배지·단가 요약 이탈(`text-200-r1`) | 배지와 날짜가 함께 축소, 요약 값 그룹 래핑 | 배지 완전 소실 방지·전체 접근성 이름 유지. 200%에서는 `현…`이므로 전체 상태 글자가 읽힌다는 주장은 하지 않음 |
| 배지를 maxWidth로만 제한한 r2는 빈 점이 됨 | badge wrapper의 flex-basis0 제거(`5c23368`) | 수평 경계0만으로 가독성 통과 못 한다는 반례로 r2 보존 |
| ING08 날짜 종료값 잘림 | 두 기간 시트가 DateRangeSummary 재사용·본문 스크롤+고정 footer | 날짜2개/마지막 정렬/버튼 도달. 기간 계산·선택 payload 불변 |
| ING01 식재료명 소실(Astra F01, 기준82651be부터 존재) | 공용 Badge 불변, 카드3행 래핑 | 이름4종 natural text rect 전체 표시. 정상390 ING01 PNG는 candidate6→7 동일 |
| ING10 폐기 배지/수량 중첩(Astra F02, 기준판부터 존재) | 날짜·배지 그룹만 래핑 | 3행 overlapArea0. 정상390 ING10 PNG도 candidate6→7 동일 |
| small320 r1에서 확대하지 않았는데25개 actual:null | 모달 전환 DOM 안정 뒤 baseline 획득 | r4에서배율오차0. DOM분리 추정이며 이전 로그만으로 제품 폰트 결함을 확정하지 않음 |

확대 이탈의 ING05/메뉴/out/waste에 반복된7노드는 가려진 ING03 host의 같은 실패였다. 모달별7건의
독립 결함으로 중복 계산하지 않는다. 현재 캡처기는 host/active-dialog를 별도 분류하지 않으므로
추후 layer와 node identity/rect를 보완해야 하며, 이번 수정은 host 단독 실패도 함께 해소했다.

최신 증거(모두044e7fb, 웹 근사이며 네이티브 검증 아님):

- `candidate-7`, `small-320-r4`, `text-200-r4`: 각12화면+5상태의 수평 경계·폰트·확대 일치·marker·오류 검사 PASS.
- `responsive-4`: 칩3·재고탭3·배지1·단가1·날짜스크롤2·이름1·폐기중첩1 = **12/12**.
- 모바일 시험 **246/246**, 앱 타입검사 PASS. 순수 P3 successor 계약 시험62/62, target inventory 시험21/21.
- Astra가 새 두 Major를 해당 web320/200% 범위에서 재검수해 CLOSED. 공식 Opus/Fable PASS가 아니다.

`three-surface-p3-successor-contract.mjs`는 exact-SHA/파일blob+mode/상태 증거/Finding identity/검수/네이티브
조건의 **순수 후보 검증 함수**다. 후속 `three-surface-p3-git-snapshot.mjs`는 exact HEAD/조상,
전체 제품 tree와 raw diff의 blob·mode 대조, tracked·비ignored untracked·index 은폐 flag 차단을
수집한다(임시 Git 시험17/17, 내부 Astra 읽기 전용 검수에서 차단 Finding 없음).
실제8f83fbe에서 기준82651be 대비 제품 tree268→277파일·변경22경로를 관측했다.
Git 환경·필터·ignore 설정을 상속하므로 이는 모든 런타임 파일이 깨끗하다는 증명이 아니다.
특히 이 값만으로 포괄적 `cleanUntrackedProduct=true`를 만들지 않는다.
상태/실행 증거/검수 영수증 어댑터, 역사 게이트 승계, byte inventory 등록, verify 연결은 아직 없다.
자기작성manifest와observed를 같게 넣어도 provenance가 증명되지 않는다.
기존 P0/P2 baseline·임계값은 수정하지 않았고 전체 verify 통과나 P3 승인을 선언하지 않는다.

장시간 전체verify 진단은 exit1: ①타입·②시험·④새DB·⑤업그레이드·⑥웹번들은 각각통과,
③CLI/문서/디자인 계약 묶음은 실패했다. P0의 제품무변경 역사 계약과 현재P3의 충돌은 그대로
열려 있다. 실행 중 HEAD가 이동한 진단이므로 이 결과를044e7fb나그후SHA의 전체게이트 증거로
인용하지 않는다. 확정후 정확한SHA에서 전체 재실행이 필요하다.

남은 검수: 긴 이름/다양한 데이터/영어, 전체 스크롤 상태, Android/iOS·키보드,
P3 successor 실연결 및 exact-SHA 외부 독립검수. 소스·전후 캡처를 근거로 한 화면씩 계속 처리한다.

#### 공유 수정 이력 — 3c6c6c2 후속

`ING-11`과 `RCP-02b`는 같은 ChangeHistoryScreen이다. 기획 `식재료-레시피-수정내역-최종기획.md`
§3의 한 줄 강제는 상세의 최근 수정 행에만 적용되며 §4.3 목록 제목에는 별도 한 줄 강제가 없다.
`7c7c637`에서 목록의 내용 기반 폭 배분·제목 줄바꿈·날짜/시각 경계 분리·목록 전용 배지 축소만 바꿨다.
요약 한 줄·색·폰트 값·서버 집계·배지 ID 판정·상세 시트 배지는 유지했다. 메뉴도 같은 컴포넌트의 영향 검수이며
메뉴 도메인 전체로 P3 구현범위를 확대한 것은 아니다.

`2240209`의 `change-history-1`에서 날짜 선행 ASCII 공백이 접혀 일반 390px의 구분자 간격이 달라졌다.
`3c6c6c2fda2544cd2f9741f67d8b8e44b6bdc196`은 해당 공백만 NBSP로 보존했다.
`change-history-2`는 식재료/메뉴 × 390 기본/320 기본/320 글자·명시 행간 200% = 6캡처이며,
오류·배율 오차·가로 넘침은 모두 0이다. 식재료 일반 390px은 `candidate-7/ING-11.png`와 PNG SHA
`f90d162756b84fcc559c475c99243366a4c1182812c6499dee86e46fd04bb978`로 완전히 같다.
큰 글자의 첫 사건은 날짜 숫자 내부 분해 없이 날짜/시각 경계만 줄바꿈하며 제목 전체가 보인다.
메뉴의 변경 전 실캡처는 없으므로 메뉴 전후 동일성을 주장하지 않는다. 두 번째 이후 사건·스크롤·긴 fixture·
네이티브·상세 시트의 확대 기하 검수는 아직 별도다.

같은 `3c6c6c2`에서 모바일 250/250·tsc PASS. 신규 4시험은 ingredient/recipe와 상태 2종,
서버 집계 44와 현재 로드 4의 구분·배지 선정·실제 행 click→상세 열기·전후 값 보존을 검사한다.
이는 서버 RPC 정확성·실기기 기하의 대체 증거가 아니다.

공식 외부 검수는 아직 미전송이다. Claude CLI는 설치되어 있으나 ai-review/README.md §5의
회차별 soft-cap 초과 위험 pin과 이 프로젝트 검수 예산 범위가 확인되지 않았고, 서두의 권위 루트 전용 입력과
현재 분리 worktree 경계도 해결되지 않았다. 일반 자동 진행 지시를 비용 예외 또는 작업 루트 정책 개정으로
확장해 해석하지 않는다. 내부 Astra의 웹 검토를 공식 Fable/Opus 승인으로 대체하지 않는다.

#### 공유 수정 이력 상세·스크롤 — a436025 후속

`6cac057`에서 캡처기를 확대해 최초 로드된 식재료 2행·메뉴 1행을 각각 스크롤하고, 양쪽 첫 사건의
상세 시트 시작/끝을 390 기본·320 기본·320 글자/명시 행간 200%에서 보존했다.
`change-history-expanded-before`에서 200%의 항목명 `기준 단가`와 변경 후 값 `제육볶음`이
말줄임되는 실제 문제를 발견했다. 이 결과는 앞의 첫 viewport 검수와 별개다.

- `aacec6e`: 상세 값 행의 줄바꿈·본문 전체 표시, 상세 헤더의 내용 기반 폭 배분과 배지 축소.
- `a436025ae37f9dab8d9a62a3db213c98853cfb23`: 항목명 폭 84를 최소 폭으로 유지하고 자연 너비를
  허용했다. 상세 헤더도 공간이 부족할 때 배지를 다음 줄로 보낸다. 기존 폰트·굵기·색·formatter·
  계산·서버 배지 선택은 불변이다. 앞 회차와 달리 **상세 배지도 반응형 배분에 참여**한다.
- 긴 상품명·큰 전후값을 보존하는 양 엔터티 구조/상호작용 시험 2개 추가. 같은 SHA에서 모바일
  **252/252**. 타입검사는 신규 시험의 HTMLCollection 순회에서 TS2488로 실패했다. 최초 기록의
  타입 PASS 표기는 완료 출력을 확인하기 전 작성한 오류여서 철회한다. 후속에서 `Array.from`으로
  순회 호환성을 고치고 재검사한다. 긴 값의 실제 브라우저/네이티브 기하를 이 단위시험으로 증명하지 않는다.

재검사: `118a80a8281451e1396cc97ea523e9c922aa628a`의 깨끗한 추적 파일 상태에서
타입검사 exit 0을 확인한 뒤 모바일 시험을 이어 실행해 **252/252, exit 0**을 확인했다.
이 후속은 시험의 컬렉션 순회와 기록만 정정했으며 a436025의 제품 소스에는 차이가 없다.

전후 증거는 `three-surface-p3-ingredient-visual/change-history-expanded-before`,
`change-history-expanded-after`, `change-history-expanded-after2`에 보존했다. 각각 6조건의 목록·
행별 스크롤·상세 시작/끝 PNG 27개이며, 마지막은 a436025의 결과다. 마지막 후보는 원본과 상세 본문이
6조건 모두 같고 첫 목록 PNG도 6조건 모두 같다. 390px 상세 PNG는 식재료 2픽셀·메뉴 3픽셀 차이가 있어
완전한 pixel diff 0은 아니다(내부 검수자 비교). 200%에서는 의도한 행 배치 변화가 있다.

내부 읽기 전용 검수자 `p3_gate_contract_review`가 최신 6개 상세 PNG·JSON과 diff를 대조했다.
해당 샘플에서 상세 leaf 수평/수직 문제·배율 오차·가로 넘침·실행 오류는 0이며 추가 가독성 Finding은
발견하지 않았다. 이것은 공식 Fable/Opus 검수나 전체 P3 승인으로 쓰지 않는다.

검사 범위의 한계:

- `leafGeometry`는 자식 요소가 없는 텍스트 DOM의 Range·박스·조상 overflow만 본다. 고정 요소의
  가림·형제 중첩·읽기 순서·네이티브 터치를 증명하지 않는다.
- 목록 요약의 의도된 한 줄 말줄임은 남아 있다. 모든 leaf의 잘림 0이라고 쓰지 않는다.
- 최초 로드 행만 스크롤했으며 pagination 전체 검증은 아니다. 상세는 첫 사건 하나뿐이다.
- 상세 시작/끝 PNG가 같아 실제 긴 상세의 스크롤 이동·중간 구간은 아직 증거가 없다.
- 수집기의 exit 0은 오류·폰트·배율·document overflow에 관한 것이다. leaf 기하나 가독성의 자동
  PASS가 아니며, 원본의 말줄임 결함도 exit 0일 수 있다.
- 출처 메타행의 문구는 줄바꿈될 수 있다. 모든 문구의 단어 단위 보존을 주장하지 않는다.

#### ING02/04 공용 선택 시트 — abf1250 후속

기존 Expo의 공용 Sheet·Select·Button을 유지하고 실제 동작과 접근성 차이만 보완했다.
프로토타입의 폰트·굵기·색을 덮어쓰거나 토큰 정본을 새로 만들지 않았다.

- 원본 측정: `ec108326c21a8c9e43adf02259b0b892e455fa7f`, `pickers-before-r4`.
- 접근성 수정: `eb2973320baedf2412cc5b63cb526eabd4ff1f9b`. Unit의 button 역할·native 선택 상태,
  세 Picker의 웹 “현재 선택됨” 이름, 공용 Select의 button·선택적 필드 이름/expanded를 추가했다.
  RNWeb 0.21.2는 기존 `accessibilityState.selected`를 DOM으로 전달하지 않아 Category/Vendor도
  웹 선택 안내가 없었다. 확정 후 닫는 버튼이므로 토글 의미의 `aria-pressed`는 사용하지 않았다.
- 접근성 변경 뒤 측정 `04e7cb27c24c2fcd020b9ed61b2258c88fedab4d`, `pickers-after`:
  선택 목록 start/end 36개 PNG가 원본과 SHA-256 동일하다. 이때 새로 연 거래처 입력의 200% 상태에서
  좁은 취소 버튼이 두 줄로 갈리는 것을 발견했다. 해당 부분은 시각 무변경 완료로 처리하지 않았다.
- 최종 제품/측정: `abf1250da61dd89909ef31e91e2884ae804afe9d`, `pickers-after2`.
  VendorPicker의 취소/추가 폭만 1:2 → 1:1로 수정했다. 근거는 가이드 4.3(670행)·5.2(784행)의
  두 행동 균등 분할과 기존 공용 ConfirmSheet다. 공용 Button의 값·스타일과 저장 로직은 유지했다.
  **거래처 입력 footer의 정상 크기에서도 폭/위치가 바뀌는 의도된 변경**이다.

산출물은 `docs/prototypes/three-surface-p3-ingredient-visual/`의 위 세 폴더이며,
`scripts/three-surface-picker-capture.mjs`가 exact clean tracked SHA를 요구해 생성한다.
개발 환경 인증 POST와 읽기 RPC 4종만 관측했고, 미등록 RPC·데이터 쓰기는 전송 전에 차단한다.
실제 저장·삭제는 실행하지 않았다. 원본/최종 JSON에 script hash·브라우저 판본·PNG hash·조건별
기하·선택 변경·재열기·닫기 결과를 보존한다. 18조건은 18개 화면이 아니라
**추가/수정 2 host × 선택 시트 3종 × 웹 조건 3종(390,320,320/글자·명시행간 200%)**이다.

최종 측정 결과:

- 선택 변경·선택 항목 재열기 안내·배경 닫기 18/18, 오류·차단 요청·배율 오차·document 가로 넘침 0.
- 원본과 비교 가능한 선택 목록 PNG 36/36 동일. 거래처 입력 footer 전후 6장은 위 의도된 차이다.
- 확대된 목록에서 거래처 추가 버튼까지 스크롤하고 연 경로 6/6. 입력은 별도 reload 후 mount하고
  한 번만 확대하여 취소·재열기 빈 값 6/6을 확인했다. 입력/취소와 trigger 접근 증거를 혼동하지 않는다.
- 최종 48개 PNG 중 320/200% 취소 글자의 rect 높이는 80 → 40으로 바뀌어 두 줄이 한 줄이 됐다.
- `abf1250`에서 타입검사 exit 0, 이어 모바일 전체 35파일 **264/264**, exit 0. 신규 12시험은
  데이터/저장 훅과 Modal 표시만 mock한다. jsdom의 CSS animation 종료를 제품 코드로 우회하지 않았다.

수집기 자체도 검수했다. 재열기 배열 저장만 하던 것, 같은 값 클릭으로 변경 성공을 주장할 수 있던 것,
NaN/분리 DOM의 배율 누락을 고쳤다. 초기 인증 차단/stock_history read 차단 실행은 성공 근거가 아니며
원본 기준은 오류/차단 0의 `pickers-before-r4`다. leaf 기하는 진단값이지 가림·탭 순서·실기기
성공을 단언하는 게이트가 아니다. 위 결과는 현재 로드된 카테고리 12·거래처 4·단위 6의 샘플이며,
장목록·임의 장문·영어·실제 키보드/IME·VoiceOver/TalkBack·네이티브 터치는 미확인이다.

내부 Astra 코드 검수에서는 접근성 두 Finding이 해소됐다. 별도 검수자 `p3_gate_contract_review`는
최종 abf1250의 source/script hash·48PNG 해시·36장 동일성·18조건 상태와 vendor 6조건을 대조하고,
7PNG 시각 표본에서 추가 Finding을 발견하지 않았다. 이는 위 웹 진단 범위에 한정된 의견이다.
공식 Fable/Opus는 여전히 NOT_SENT다. 기존에 기록한 exact-round soft-cap 승인 및 권위 루트/실행
worktree 경계가 해결되기 전 내부 검수를 공식 PASS로 대신하지 않는다. 전체 P3/P4 진입 승인은 아니다.

범위 밖 후속: 수정 폼이 UnitPicker의 `base`를 전달하지 않는 기존 정책과 신규 거래처 저장 실패의
웹 Alert 경로는 기능 계약 검수로 분리한다. 디자인 적용 중 단위 변경 정책·RPC를 임의 수정하지 않았다.

#### ING03/06 구매 옵션 행·편집 단가 — b5351c6 후속

원본 Expo의 공용 Card·Badge·Input·Select·ActionSheet와 토큰 위계를 유지했다. 프로토타입의
타이포를 이식한 작업이 아니라, 구매 옵션 상태를 기존 Expo 규격 안에서 표현할 때 발견한 좁은 폭의
소실을 보완한 P3 후보다. 이 단락으로 전체 ING06 또는 해당 prototype binding을 종결하지 않는다.

| 구분 | exact SHA | 산출물 폴더 |
|---|---|---|
| 원본 진단 | `fcfc4085a442da732e0efcba32a8e6b5b8e7ecaf` | `options-before` |
| 제품 수정·첫 재측정 | `b5351c665cb9bf1029fe6bf6ab0e1359be1c6641` | `options-after` |
| ml/박스 추가 진단, 제품 동일 | `27bdfac05e1ea24bfc9b65fe677e2e748d8230ba` | `options-unit-before` |
| 긴 행 양 끝 수집 보완, 제품 동일 | `93f8b3bcf20da3a89bf7c8d0d4cf429e8a96f007` | `options-after2` |

폴더는 `docs/prototypes/three-surface-p3-ingredient-visual/` 아래다. 수집기는
`scripts/three-surface-option-capture.mjs`; exact clean tracked HEAD·새 출력 폴더를 요구한다.
개발서버 8091은 b5351c6 제품 커밋 후 재시작했고 이후 두 커밋은 수집기만 변경했다.
서버 번들 출처를 script 자체가 자동 증명한다고 주장하지 않는다.

발견과 변경:

- 320px/글자 200%에서 관리 목록의 vendor/name이 소실되고 금액이 한 글자씩 세로로 밀렸다.
  기존 고정 `height:18` 배지 자리도 확대 배지의 자연 높이를 수용하지 못했다.
- `PurchaseOptionRow`가 관리 목록과 식재료 상세의 구매 옵션 **배치만** 공유한다. 각 host의
  기존 글자 크기·굵기·색·tnum 변형은 유지하고, formatter·단가/최저/최고·브랜드 우선순위·
  조회/저장 인자·이동 경로는 원래 host에 둔다. 재고 증감용 LedgerRow를 억지로 재사용하지 않는다.
- 이름 그룹의 50% 최소 폭과 값 그룹의 자연 폭으로 함께 놓을 수 없으면 값이 다음 줄로 내려간다.
  50%는 새 primitive 토큰이나 가이드의 확정 수치가 아니라 이 도메인 행의 후보 배치 규칙이다.
  이름을 말줄임하지 않으며 배지는 자연 높이로 둔다. 기본 크기의 행 높이도 바뀔 수 있는 의도된 변경이다.
- 편집 footer의 긴 이전/새 단가를 wrap하고 화살표를 새 값과 묶었다. 비교식 `0.005`·계산·표시는
  그대로다. 200%의 긴 숫자 뒤 `원/g`가 다음 줄에 남을 수 있으며 모든 값을 한 줄로 고정하지 않는다.
- 구매처 Select의 필드/현재값 이름과 펼침 상태만 공용 API에 연결했다. 단위 2:1 컨트롤은
  kg·ml·박스 선택 후 390/320/200% 표본에서 문제를 확인하지 못했으므로 수정하지 않았다.

검증:

- 원본/첫 재측정 각각 **24조건·36PNG**, 최종 수집 **24조건·60PNG**. 조건은
  normal/long 합성 옵션 2종 × 목록/상세/편집/kg 선택후 4 host × 웹 3조건이다. 24개 제품 페이지가 아니다.
- 옵션 fixture는 실제 앱의 읽기 응답 `options`만 바꾼다. 긴 한·영 이름과 큰 금액은 스트레스 입력이지
  서버가 수용한 실제 구매 데이터가 아니다. 별도 ml/박스 6조건·6PNG도 선택 후 표시만 검증한다.
- 원본과 최종의 대응 텍스트 leaf **162개**에서 전체 문자열·fontSize·fontWeight 차이 0.
  최종 오류·차단 요청·배율 불일치·document 가로 넘침 0, PretendardApp 5 face 적재 확인.
  수집한 root의 가로 leaf/union-rect 중첩 진단도 0이지만 이것을 화면 전체 기하 PASS로 쓰지 않는다.
- 검수자가 첫 after의 긴 영문 행 끝이 고정 footer 아래에 남았다고 지적했다. 수집기를 고쳐
  list/detail 각 행의 첫/마지막 텍스트를 따로 스크롤했다. 최종 **48끝점**이 viewport/조상 스크롤
  경계 안에 들어왔고, 가장 긴 관리 행의 `최고`·`2kg`·최종 단가 끝 PNG를 확인했다.
- b5351c6 타입 검사 exit 0·모바일 **36파일 274/274**, 신규 구매 옵션 시험 **10/10**.
  93f8b3b 타입 검사도 exit 0. 시험은 데이터·mutation 및 Modal visibility를 mock하며 실제
  저장하지 않는다. Text에 전달된 선언과 브라우저 computed font를 별도 대조한다.

한계: 입력값 내부 스크롤/키보드·IME, 아이콘 영역, 다른 root의 가림, 모든 길이·모든 번역,
네이티브 200%/터치/스크린리더는 미검증이다. Range의 통합 사각형 중첩은 말줄임/여러 줄에서
오탐할 수 있다. 수집기 exit 0은 실행/폰트/배율/끝점 확인이며 모든 기하·기능의 자동 PASS가 아니다.
추가 폼·loading/error/missing/empty·단위 환산은 mock 시험 범위다. 브라우저 진단에서는 저장/삭제를
실행하지 않았고, 단위 base 미전달·웹 Alert 삭제/저장실패 경로는 기존 기능 계약 후속으로 남겼다.
공식 Fable/Opus NOT_SENT와 기존 전송 경계는 유지하며 내부 검수로 P3/P4 승인을 대체하지 않는다.

최종 내부 재검수: Astra는 16PNG(일반390/320 양 host, 장문200% 시작/끝, 편집 단가,
kg/ml/박스200%, 원본390 비교)를 직접 보고 요청한 시각 표본 범위 PASS·추가 차단 Finding 없음으로
판정했다. 별도 검수자는 최종60PNG hash·script/source·48끝점과 제품 소스 불변을 대조하고
가장 긴 행의 start/end 2장 내용이 이어지며 최종 값까지 노출됨을 확인해 증거 부족 지적을 닫았다.
이 판정은 전체60PNG 시각 전수 또는 네이티브/키보드 종결을 뜻하지 않는다.

#### ING03 메모 · ING06 빈 목록/추가 폼 — 60e86ef

제품 변경은 공용 `MemoEditSheet`의 두 줄뿐이다. 명시적 입력 이름 `메모`를 추가하고 완료 버튼의
`flex:1.4`를 `1`로 바꿨다. 취소/완료의 기존 공용 Button variant·글자·색과 Sheet를 유지한다.
근거는 가이드 5.2(784행)의 두 행동 1:1 계약이다. 식재료/메뉴 상세가 같은 컴포넌트를 쓰므로
한 곳에서 수정했고, 이번 변경에 한해 양쪽 소비처에 적용된다. 실제 메뉴 상세 통합 측정은 아직 아니다.

| 단계 | source SHA | 증거 |
|---|---|---|
| 원본 유효 측정 | `9632f32f58e5895222c2906912d4b173a7528acc` | `forms-before-r2` 9조건·21PNG |
| 제품 수정·재측정 | `60e86efe9c8276f7a619730e0a8828540485b8f1` | `forms-after` 9조건·21PNG |

위 폴더는 `docs/prototypes/three-surface-p3-ingredient-visual/` 아래이며 기존 옵션 수집기에
`--form-states`를 추가해 생성한다. 초기 `forms-before`는 메뉴 시트가 닫히며 메모 시트가 열리는
동안 두 Modal이 공존해 strict locator 오류로 끝났다. 유효 원본이 아니며 삭제/덮어쓰기하지 않는다.
9632f32에서 단일 Modal과 실제 animation 종료를 기다리도록 고쳤다. 제품 수정 후 8091 서버도 재시작했다.

9조건은 빈 목록·미저장 추가 폼·메모 × 390/320/320 글자·명시행간 200%의 웹 표본이다.
응답의 옵션을 빈 배열, 메모를 `검수 원본 메모`로만 교체했으며 주변 화면 데이터는 실제 읽기 데이터다.
추가 폼은 빈 입력에서 저장 불가를 확인하고 이름/용량/금액/URL을 채워 `5.00원/g` 미리보기와
위/아래 필드 접근을 확인했다. 추가나 메모 저장·삭제는 실행하지 않았으며, 미등록 RPC/쓰기 요청은
전송 전에 차단한다. 이 테스트를 서버 저장 성공 또는 키보드/IME 검증으로 쓰지 않는다.

메모는 100자 draft의 실제 inputValue 일치를 단언한 뒤 한 번 확대한다. textarea 내부 시작/끝을
각각 스크롤하고 `actual/expected` 차이 1px 이하를 단언한다. 취소 후 다른 진입점인 수정 메뉴에서
다시 열어 원본 복원을 확인했다(3/3). 재열린 시트는 상태 확인용이지 두 번째 확대 측정이 아니다.
textarea의 textContent는 실제 편집 텍스트의 Range가 아니므로 일반 leaf에서 빼고 controls의
value·scroll·box로 기록한다. 원본의 해당 Range 경고는 실제 가로 넘침으로 해석하지 않는다.

결과:

- 최종 오류·차단 요청·배율 불일치·document 가로 넘침 0, PretendardApp 5 face 적재 확인.
- 메모 버튼 폭은 390에서 양쪽171px, 320 및200%에서 양쪽136px이다. 원본 비율과 다른 의도된 시각 변경이다.
- 빈 목록/추가 폼은 제품 수정 없음. 비교 가능한12PNG 중9장은 동일하다. 추가390의3장은
  첫 입력 상자 위 모서리 주변25pixel 차이가 있어 완전 무변경이라고 쓰지 않는다.
- 전용 시험은 수정 전 새9시험 중 이름2·비율1이 실패하고6개 통과, 수정 후9/9 통과.
  공백 trim·빈 값·120자 기존 메모 비절단·cancel/reopen·saving footer·maxLength override를 확인한다.
  두 문구로 만든 GenericHost는 실제 RecipeDetail 통합 시험이 아니다. native Modal은 표시 stub이다.
- 60e86ef에서 타입검사 exit0·모바일37파일 **283/283**. 전체 verify/P3 최종 게이트 통과를 뜻하지 않는다.
- Astra는 전용9시험과 시각8PNG 표본을 직접 검수해 입력 이름/버튼 비율 두 Finding을 닫았다.

미해결 동작 계약은 디자인 수정과 분리한다: dirty draft의 바깥/Back 닫기 확인, saving 중 바깥 닫기,
열린 중 value 재조회에 따른 draft 덮임, 전체 입력 폼과 공용 Memo 사이의 최대 길이 불일치.
100자 초과 기존 메모를 임의로 자르지 않았다. 실제 메뉴 상세·영어·네이티브·키보드·저장실패 Alert도
남아 있으며 공식 Fable/Opus NOT_SENT 및 전송 경계는 그대로다. 두 디자인 Finding 해소가 전체 메모
동작 또는 P3/P4 승인은 아니다.

별도 수집기 재검수자는 전후42PNG·source/script hash와 실제100자3조건을 전수 대조했다.
내부 스크롤 끝은390/100%56px·320/100%56px·320/200%440px로 각각 최대값과 일치하고,
취소/메뉴 재열기 복원3건과 입력/스크롤 불일치 시 exit1 경로를 확인해 측정 누락 두 지적을 닫았다.
이 범위에서 추가 Finding은 없으며 원본과 다른 add390 PNG의 원인은 단정하지 않았다.

#### ING07/08/09/10 조회 연결 · 공용 요약 헤더 — 743807b

필터 동작과 요약 레이아웃은 별도 제품 커밋으로 나눴다. `89be36d`는 웹 선택 안내와
조회 상태 처리, `faffc63`은 공용 `SummaryCard` 헤더 배치다. 기존 Expo `Sheet`·버튼·토큰·
formatter와 서버 날짜/잔량/금액을 유지하며, prototype의 취소 기능이나 별도 디자인 체계를 추가하지 않았다.

| 발견 | 반영 및 경계 |
|---|---|
| 웹 선택 상태 누락 | 기존 공용 picker처럼 웹 선택 항목의 이름에 `현재 선택됨`을 붙였다. Native selected는 유지. HistoryFilterSheet 기간/유형/정렬과 폐기 유형 선택에 적용 |
| 상세 실패 + 이력 성공 | 구매/폐기 QueryState가 상세 로딩·오류도 소비하고 재시도 시 양쪽을 다시 읽는다. 단위를 모르는 상태에서 기본 g로 목록을 그리던 경로 차단. 계산/RPC 변경 없음 |
| 200% 요약 제목·금액 압축 | SummaryCard의 제목과 값/보조 그룹에 wrap. `기준단가`, `전체 합계`, `4.00원/g`, `400원`을 역할 단위로 배치. 폰트·굵기·색·metrics 계산 불변 |

`ingredientHistoryFilters.test.tsx`는 가짜 필터 Host가 아니라 실제 StockHistoryScreen·
PurchaseHistoryScreen·DiscardHistoryScreen과 BusinessDateGate·공용 시트를 렌더한다. Modal visibility와
도메인 읽기는 mock이다. 서버 날짜 fixture는 기기 날짜와 다른 `2030-07-15`다. draft 미조회·
backdrop/header 닫기 복원·비기본 적용값 복원·날짜 인자·유형/정렬·원장 잔량·전체 기간 from 생략·
폐기 전/후 및 reverted 제외·상세/이력 혼합 오류를 21시험으로 보존했다. 수정 전 상세 loading/error
4개 RED → 수정 후 GREEN을 재현했고, 선택 이름 및 양쪽 retry도 단언한다. 실제 DB/캐시/네이티브
동작까지 통과했다는 뜻은 아니다.

보존 폴더는 `docs/prototypes/three-surface-p3-ingredient-visual/` 아래다.

| 증거 | 출처 | 범위 |
|---|---|---|
| history-before | 37201bd | 실패 로그만. note 끝 `입고`를 공용 formatter가 제거하는데 원문 exact match를 기대한 수집기 오류 |
| history-before-r2 | 733246d | 수정 전 3 host × 3 웹 조건 = 9조건/27PNG |
| history-after | 89be36d | 필터 수정 후 9조건/27PNG. 전후 27장 hash 동일, 웹 선택 이름만 변경 |
| history-summary-after | faffc63 | 요약 배치 후 9조건/27PNG |
| summary-change-hosts-after | faffc63 | 추가 소비처인 식재료/메뉴 수정 내역, 각390/320/320글자200% = 6조건/6PNG. 실제 개발 읽기 데이터, 수정 후 표본 |
| history-summary-final | 743807b | 수집기 가드 보완 후 9조건/27PNG 재실행 |

history 수집기는 원장/구매 응답과 서버 local_date(`2026-09-08`)를 합성 입력으로 바꾼다.
그 밖의 주변 데이터는 실제 읽기 값이다. 날짜 인자에 따라 fixture 응답을 거르므로 SQL 정확성 시험이
아니다. draft·취소·적용·목록 순서를 먼저 검증하고, 새 문서에서 시트를 연 뒤 글자/명시 행간을
한 번만 확대한다. 따라서 200% 상태에서 모든 클릭을 수행했다거나 Native Dynamic Type 검수라고
쓰지 않는다. 각 실행에서 조회 날짜/반환 fixture ID 27건을 기록하며 RPC 전체 인자를 저장하지 않는다.
저장·삭제는 누르지 않았다. 최종 가드는 read RPC 이름과 HTTP 방식(GET/POST/HEAD/OPTIONS)을
함께 제한하고, 확대 후 노드 연결·유한수·기대값을 단언한다. 최초 가드의 두 누락은 독립 검수로
찾아 `743807b`에서 정정했으며, 실제 악성 네트워크 요청 음성시험을 실행한 것으로 쓰지 않는다.

요약 변경 전후 27장에 기록된 텍스트 관측 489개(고유 문자열 수 아님)의 text/fontSize/fontWeight는
모두 같았다. 신규 구조 시험4건과 기존 수정 내역6건을 재현했다. 초기 jsdom computed font-size
기대가 실제 브라우저/소스와 다르게 나와 글꼴 판정은 구조 시험에서 제외하고 이 브라우저 대조로
분리했다. Astra는 필터21시험과 요약4시험을 직접 실행하고, 요약 소비처5 host의 정상390 및
320/200% 총10PNG를 직접 검수해 각 수정 범위의 추가 차단 Finding 없음을 확인했다.

`743807b` 검증: 모바일39파일308/308, 타입 통과. `pnpm verify --no-db`는 ①타입·②시험·⑥웹 번들
통과, ③은 기존 P0 제품 변경 금지 계약이 P3 변경을 막아 **FAIL(exit1)**, ④⑤DB는 건너뛰었다.
core는194통과/12건너뜀이다. P0 기준선을 덮어쓰거나 게이트를 끄지 않았으며 전체 verify PASS가 아니다.

최종 수집기 재검수: 별도 검수자가743807b의 코드 가드와9조건27PNG/source별script SHA를 대조했다.
faffc63 대비27PNG 바이트·텍스트/크기/굵기·fixture·조회/checks가 전부 동일하며 오류/차단/확대실패0이다.
이는 통상9상태와 코드 검증이며 금지 HTTP방식의 실제 음성요청 검증은 아니다.

아직 열려 있는 이력행 말줄임/펼치기 계약, 더 긴 metrics/단가, 배지 부모18px와 확대 표본 밖 조합,
스크롤 끝·네이티브·키보드·오류 실네트워크 검증은 별도다. 이번 표본에서 배지와 단가의 명확한
겹침은 관측하지 않았으므로 이를 확정 결함으로 쓰지 않는다. 공식 Fable/Opus는 승인된 해당 회차
실행 경계가 해결되지 않아 **NOT_SENT**, 전체 P3는 미종결이다.

#### ING03/07/09/10 긴 이력행 · 음수 잔량 — ca129a2

원래 Expo의 Row·Badge·토큰을 유지한 웹 구현 후보다. 제품 커밋은
`ca129a2865ed249f8bb33010b4c7f2b615a8dfb5`, 수정 전 수집기는
`e2db16bc75385964a91863242854b11b53608fa3`다. 프로토타입 글꼴·굵기·색으로 바꾸지 않았다.

| 확인한 문제 | 반영 | 남는 경계 |
|---|---|---|
| ING03만 음수 원장 잔량을 회색/400으로 표시 | 기존 toLedgerView의 balanceNegative를 공용 LedgerRow의 balNeg에 전달. ING07과 같은 음수 색/800 | 잔량 값·부호·RPC·계산 불변, 증감 부호로 잔량을 추정하지 않음 |
| 큰 수량/단가가 날짜·제목을 한 글자 폭으로 압축 | identity 최소50% 후보 + root wrap, 값 그룹은 끝 정렬을 유지해 필요하면 아래로 이동 | 50%는 해당 행의 웹 검증 후보이며 전역 토큰/모든 길이의 보장 아님 |
| 구매/폐기 메모·거래처명 한 줄 생략 | 가이드 Row의 최대 두 줄까지 허용 | 무제한 확장 아님. 두 줄 초과 원문 접근 계약은 미완료 |
| 구매 단가 위 배지 부모 고정18px | minHeight18로 바꿔 원래 Badge의 글자 확대 높이를 수용. 날짜/상태도 wrap | Badge 폰트·색·반경 불변 |
| 폐기 수량·금액과 액션 겹침 | 값과 기존44px 메뉴 영역을 한 그룹으로 이동, 액션 flexShrink0 | 메뉴 eligibility·삭제 로직 불변. 실제 삭제를 실행하지 않았으며 Native 터치 재검수 아님 |

`ingredientLedgerBalance.test.tsx`는 실제 두 화면→실제 formatter→실제 LedgerRow를 사용한다.
도메인 읽기/Modal만 fixture 처리하고 RNW Text에 전달되는 style을 관찰한다. 수정 전 ING03 음수
1 RED/대조3 PASS → 수정 후4/4 PASS. 양수·0 및 증감과 잔량 부호가 반대인 사례를 포함한다.
jsdom 픽셀/Native/DB 정확성 증거로 사용하지 않는다.

증거 루트 `docs/prototypes/three-surface-p3-ingredient-visual/`:

| 폴더 | sourceCommit | 조건/PNG | 용도 |
|---|---|---|---|
| history-rows-before | f8e3cdf | 0/0, 실패 로그 | 상세 LossCard와 Ledger의 같은 note를 중복 선택한 수집기 오류. 보존하되 유효 비교에서 제외 |
| history-rows-before-r2 | e2db16b | 12/66 | ING03/07/09/10 ×390·320·320글자/명시행간200%, 합성 장문·큰 값 수정 전 |
| history-rows-after | ca129a2 | 12/66 | 같은 fixture의 수정 후. 서버는 이 제품 SHA에서 재시작 |
| history-rows-filter-regression | ca129a2 | 9/27 | 기존 필터 draft/취소/적용/조회인자/목록 회귀 |

수집기는 `--row-stress`와 exact SHA를 요구하며 시작/끝 tracked clean 상태를 확인한다.
상세 원장은 footer 액션의 Card로 먼저 범위를 좁혀 LossCard 중복 note를 배제한다. 현재 네 host에서
note/vendor의 두 번째 ancestor가 실제 행임을 소스와 교차 확인했다. 원장·구매·서버 local_date만
합성하고 주변은 실제 읽기 데이터이므로 전체 페이지의 데이터/계산 검증이 아니다. 큰 단가/수량은
폭 스트레스용이며 합성 amount/volume과 회계적 일치까지 의도한 입력이 아니다. read RPC/HTTP
guard를 유지하며 쓰기 제출은 없다. 웹 글자/명시 행간200%는 Native Dynamic Type이 아니다.

전후 각각336 leaf 관측의 문자열/크기는 동일하다. 굵기/색 차이는 ING03 음수 두 잔량의
3조건×시작/끝=12관측(회색400→음수빨강800)뿐이다. Range 수평불일치는58→12관측으로 줄었으며
잔존은 200% 장문 두 줄 생략이다. 시작/끝 중복 관측이므로 12개 고유 결함/페이지라는 뜻이 아니다.
leaf-only 측정은 중첩 단위 Text의 부모 숫자 부분을 놓치므로 모든 숫자/전체 잘림 통과를 주장하지
않는다. endpoint 가시성은 실패 단언이 아니라 기록이며 전후132기록 true다. PNG로 큰 값과 그룹
배치를 따로 검수했다. 문서overflow0은 수정 전에도0이었으므로 이것만으로 성공을 판단하지 않는다.

자체 실행: 모바일40파일312/312, 타입 통과. exact ca129a2의 `verify --no-db`는①②⑥통과,
③기존 P0 제품 변경 금지 FAIL(exit1),④⑤생략; core194통과/12생략. P0 기준선/게이트는 변경하지
않았다. 별도 검수자는4시험 GREEN,132PNG hash와 source별script SHA,336 leaf 전후 및5PNG
표본을 확인했다. 공식 Fable/Opus NOT_SENT 및 전체P3 미종결은 그대로이며 다음 도메인/P4 승인이 아니다.

Astra가 제품4파일·음수4시험을 별도로 재검수하고 전후15PNG를 직접 비교해 이번 변경 범위의
추가 차단 회귀 없음을 확인했다. 다만 구매 packSummary의 `4,000`/`원` 줄 분리는 수정 전에도
존재하며320/200%에 잔존한다. 이는 가이드 숫자·단위 동행의 별도 보완 대상이다. 구매 요약의
기간 최고 값 말줄임도 행 바깥 잔존이며 두 항목을 이번 행 수정 PASS로 닫지 않는다.

#### 공용 SummaryCard 긴 metrics · 열 정렬 재검수 — 61491e4

앞 절에서 남긴 기간 최고 말줄임을 별도 공용 수정으로 보완했다. 기존2열의 한 줄 제한을 없애고
긴 값은 칸 전체가 아래로 이동하도록 한다. `1d4afb3`의 자동 너비 후보는 정상390의 오른쪽 열이
판매 소진 x194.515625/조정 x211.703125로 갈라지는 새 Minor를 Astra가 발견해 승인하지 않았다.
`61491e417d0949ebb1f3e7ddc96c3bfe74852045`에서 부모 onLayout 실측 폭에서 양옆 padding과
열 gap(space.md×3)을 빼고2로 나눈 공통 최소 열폭을 사용했다. 정상390은 두 열 모두x201,
정상320은x166으로 이전 정렬을 복원했다. 최초 layout 이전45%는 일시 fallback이며 전역토큰이 아니다.
유한 양수 폭만 소비하고 리사이즈 때 다시 계산한다. fontSize/weight/color/formatter 변경은 없다.

`historySummaryLayout.test.tsx`8시험(헤더4+metrics1~4개4)은 순서·0·부호·칸 단위 wrap을,
`historySummaryColumns.test.tsx`1시험은 onLayout 크기 변경과 무효 폭 거부를 검증한다.
이는 구조/콜백 시험이며 실제 줄 배치와 Native 기하 증거로 대체하지 않는다. 홀수 placeholder는
시험만 했고 임의 장문 홀수 레이아웃은 실측하지 않았다.

| 증거 폴더 | sourceCommit | 범위 |
|---|---|---|
| history-metrics-before | dffaa585 | 12조건72PNG: 행66+구매 요약 시작/끝6 |
| history-metrics-after | 1d4afb3 | 같은12조건72PNG. 새 열 정렬 Minor가 있는 후보로 보존 |
| history-metrics-after-r2 | 61491e4 | 같은12조건72PNG 재검수 후보 |
| metrics-change-hosts-after | 61491e4 | 추가 ChangeHistory 소비처 식재료/메뉴 각각390/320/320글자200%,6조건6PNG |

앞 세 실행의216PNG hash를 재계산해 일치하고 대응72샷의 leaf text/fontSize/fontWeight/color
목록은 동일함을 확인했다. 구매320/200%의 기간 최고 `12,345,678.90원/g`가 전문 표시되며
색/굵기를 낮추지 않는다. 수집기는 별도 summaryShots를 기록하고 총PNG수에 포함한다. 추가
ChangeHistory는 기존 읽기 전용 캡처로 현재 개발 데이터를 읽었으며 baseline과 동일 DB snapshot은
아니다. 주 에이전트가200% 두PNG를 직접 확인했다. 이6장은 전체 수정 이력·pagination검수가 아니다.

Astra가 새 Minor를 재검수해 정상390 열 시작선 동일·긴 구매값 표시 유지·9시험 직접PASS를 확인하고
해당 Finding을 닫았다. 내부 범위PASS이며 공식Fable/Opus NOT_SENT는 유지한다. 최신 자체 게이트는
모바일41파일317/317·타입·웹 번들PASS, `verify --no-db`①②⑥PASS/③기존P0제품금지FAIL/
④⑤skip(exit1), core194PASS/12SKIP다. 전체P3 종결이 아니다.

구매 packSummary의 숫자/원 줄 분리,2줄 초과 메모의 접근,Native/키보드 및 임의 길이·다양한 국가
포맷은 계속 미완료다. 이번 공용 값을 바로잡은 것을 이유로 다른185target을 검수한 것으로 세지 않는다.

추가 내부검수: Astra가 ChangeHistory 두entity의390/320글자200% 총4PNG를 직접 확인해
요약 제목·건수·2열 라벨/값의 새 겹침·잘림 없음을 확인했다. 아래 이력행 자체의 배지/말줄임은 범위 밖이다.

#### ING03b 빠른 입고 — c804f753 내부 PASS

`c804f75312d7c04549e211c8ab381f1d5996823d`는 서버 재고 after가 음수이면 기존 음수 색을
사용하고, 구매 옵션의 접근성 이름에 구매처·금액·단가·현재 선택을 연결한다. 진입 버튼은 현재값과
expanded를 노출한다. 요약/미리보기/입고 정보는 기존 Expo 글자·굵기·색 역할을 유지하며 wrap한다.
계산·RPC·저장·날짜·멱등키를 변경하지 않았다. 긴 옵션의 2줄 초과는 여전히 생략된다.

별도 Astra 검수의 Major2건(음수 after 색/동명 옵션 식별)을 수정했다. 실제 화면+공용 kit를 쓰고
도메인 훅만 격리한14시험은 RED 재현 후 GREEN이며, Astra도14/14를 직접 재현했다. 저장 성공/실패,
거래처 실패·단위 변환 인자·서버 날짜·선택 재진입은 mock host 계약이지 실DB·네이티브 검증이 아니다.

`three-surface-p3-ingredient-visual/` 보존:

| 디렉터리 | source SHA | 범위 |
|---|---|---|
| quick-inbound-before | d812ee07 | initial/picker/negative/positive ×390/320/320글자200%,12조건24PNG |
| quick-inbound-before-r2 | de76107c | 같은12조건, 재고 미리보기 위치 추가30PNG |
| quick-inbound-after | c804f753 | 같은12조건30PNG |

세 JSON의84PNG hash를 주 에이전트가 재계산해 모두 일치했다. 오류/차단/documentOverflow/확대
불일치0이며 쓰기 요청은 없다. 음수/양수 재고와 옵션은 합성 읽기 응답, 주변 자료는 live 읽기다.
수집기는 직접 text node를 기록하며, documentOverflow0은 내부 잘림·가림 전수 통과가 아니다.
전체 페이지 캡처 수를 완료 target 수로 세지 않는다. Astra는 전후9PNG에서390기본 배치 보존,
320/200% 재고·단가 그룹 줄바꿈과 음수빨강을 확인해 내부 PASS했다.

모바일42파일331/331·타입·웹번들PASS. `verify --no-db`는①②⑥PASS/③기존P0제품금지FAIL/
④⑤생략(exit1), core194PASS/12SKIP. 공식Fable/Opus NOT_SENT·P3미종결은 그대로다.
옵션 index/refetch, 멱등키, preview loading/error 정책, 기존 중첩 스크롤과 새 옵션 링크의 큰 글꼴
아이콘 배치, Native/키보드는 별도 미완료다. 이번 디자인 수정으로 업무 정책을 임의 결정하지 않았다.

#### 공용 거래처 추가 실패 안내 — 20b1406 / 85c0fca

PC 재시작 후 기존 DB·서비스8개를 재시작했다. DB 초기화/볼륨 삭제 없이 pg_isready와 Expo8091
HTTP200을 확인했다. `20b1406`에서 브라우저 기본 alert를 공용 ConfirmSheet로 통일했다.
2026-09-08 정정: 종전의 “실패 안내가 없었다”는 진단은 철회한다. 앱 루트의 installWebAlert는
before 81efd88에서도 window.alert를 설치했다. 기존 수집기는 browser dialog를 기록하지 않아
DOM 오류 부재만 관측했으며, 실제 무안내의 근거가 아니다. 오류 중 원 picker는 숨기되
컴포넌트의 입력·선택 state는 유지하며, 확인/backdrop 닫기 후 picker로 복귀한다. 성공의 기존
추가입력 초기화·선택 유지·부모 저장 미호출 정책, payload·RPC는 바꾸지 않았다.

ING02/04/06/ORD02 격리 host의16시험: 수정 전 공용 오류 DOM 8RED/기존정책8PASS→수정후16/16PASS.
이 시험은 앱 루트 웹 보정을 설치하지 않으므로 실제 앱의 무반응 재현으로 해석하지 않는다.
기존 picker12시험도PASS. 처음 시험의 배열 첫값 타입오류를128799a에서 명시적 존재 검사로 고쳤다.
마지막85c0fca는 수집기의 오류 Modal 실제 표시 대기이며 제품 소스는20b1406과 같다.

보존 `three-surface-p3-ingredient-visual/`:

| 디렉터리 | 상태·범위 |
|---|---|
| vendor-failure-before | 2f74e34, 추가 버튼 중복 locator 실패0조건. dialog 범위로 정정 |
| vendor-failure-before-r2 | 166839b,5조건 뒤 확대 불일치. 원인 미확정·상세 없음 |
| vendor-failure-before-r3 | 81efd88, ING02/04×390/320/320글자200%=6조건6PNG 성공. 확대 상세 보존으로 재실행, 앞 실패는 재현 안 됨 |
| vendor-failure-after | 128799a,1조건 뒤 오류 표시 단발 검사 실패. waitFor visible 추가 |
| vendor-failure-after-r2 | 85c0fca,같은6조건6PNG 성공·입력/선택 복귀 대조 |

주 에이전트가 보존18PNG hash를 재계산해 전부 일치했다. 성공 전후 각각6조건의 documentOverflow,
확대 불일치,pageErrors,차단0이며, 실패fixture HTTP400의 consoleErrors는 각각6건이다(0으로 쓰지 않음).
save_vendor는 클릭 전 route.fulfill400으로 대체해 실제 네트워크 저장이 없고 주변 자료는 실제읽기다.
오류창은 새토큰 없이 기존 ConfirmSheet의 글자·버튼을 쓴다. 직접390/320/200% 표본에서 오류문과
버튼을 확인했으나 임의 장문/가림 전수판정은 아니다. 복귀picker의 재확대 캡처와 Native/키보드는
미완료다. 테스트는 확인·backdrop 경로이며 footer 닫기까지 각각 실행한 것으로 세지 않는다.

128799a 실행: 모바일43파일347/347·타입·웹번들PASS, verify--no-db①②⑥PASS,
③기존P0제품금지FAIL·④⑤생략(exit1),core194PASS/12SKIP. 공식 외부검수 NOT_SENT·P3미종결 유지.

Astra85c0fca 최종 내부PASS: source/수집기SHA/after6PNG hash 대조, 전2/후4PNG 직접비교,
28/28 직접 재실행. 후6조건 단일오류모달·입력/선택 보존, 메시지/버튼 표본 확인. ING06·ORD02의
브라우저 캡처 및 복귀picker200%·Native는 이 PASS 범위 밖이다.

#### ING02/04 저장 오류 공용 UI — 9c6005b

브라우저 기본 alert를 기존 ConfirmSheet로 통일했다. 새 토큰·색·버튼을 만들지 않았고,
입력·카테고리·거래처·환산·payload·성공 이동 정책은 변경하지 않았다. 화면 로컬 saveError만
추가하고 확인·닫기·backdrop은 오류만 해제한다. 타입 검사에서 처음 사용한 onClose가 공용
계약과 다름을 찾아 onCancel로 수정했으며, 확인 경로만의 시험을 닫기 두 경로까지 넓혔다.
실제 화면을 렌더한 격리 시험27/27, 전체 모바일44파일374/374, 타입 검사PASS다.

수집기 `1aca6bc`는 save 응답과 progressbar 소멸 뒤 폰트/확대를 측정하며 browser dialog를
별도 기록한다. `ingredient-save-before`는 비동기 spinner DOM 분리 때문에0조건 실패한 기록을
보존한다. `ingredient-save-before-r2`(1aca6bc)와 `ingredient-save-after`(9c6005b)는
ING02/04 × 390×844 / 320×720 / 320×720 글자200% 각각6조건이다.

| 관측 | before | after |
|---|---|---|
| 브라우저 기본 alert | 조건마다1 | 0 |
| DOM 오류 시트 | 없음 | 6조건 표시 |
| 입력6개·카테고리 유지 | 6조건 일치 | 확인 후6조건 일치 |
| documentOverflow·폰트실패·확대불일치·pageErrors·차단 | 0 | 0 |
| 합성 save_ingredient HTTP400 콘솔 | 6 | 6 |

저장은 사전 route.fulfill400으로 대체해 실제 도메인 write가 없다. 카테고리 read만 합성하고
주변 데이터는 실제 read다. 수집기 이름은 vendor-failure이지만 JSON subject=ingredient로 구분한다.
원본 PNG12개 SHA-256은 주 검수자가 전부 재계산해 일치했고, 320글자200%/390 표본에서
제목·오류문·확인/닫기 버튼을 직접 확인했다. 임의 장문 잘림 전수·Native·키보드·복귀 화면의
재확대 캡처는 이 증거에 포함되지 않는다. served source는 커밋 후 서버 재시작으로 관리했으며
서버 빌드 자체의 암호학적 결속 증명은 아니다.

9c6005b verify--no-db: ①타입·②시험·⑥웹번들PASS, ③기존P0제품변경금지FAIL,
④⑤생략(exit1); core194PASS/12SKIP. 공식 외부검수NOT_SENT·P3미종결을 유지한다.

Sol high 별도 읽기 전용 검수는 9c6005b 범위PASS(Finding 없음). 27/27 및 관련
ingredientPickers/vendorPickerFailure 포함55/55를 독립 재실행하고 PNG12개 해시와
390/320글자200% 표본을 직접 확인했다. 캡처 폴더는 후속 증거 커밋으로 보존한다.
이는 Native/IME·공식 Fable/Opus 승인이나 ING02/04 모든 상태 완료 판정이 아니다.

#### ING03 메모 실제 host 시험 — f439091

제품 변경 없이 실제 IngredientDetailScreen → 공용 ActionSheet/MemoEditSheet의 시험14개를
추가했다. 직접/메뉴 진입, trim/null 및 메모 외 exact payload 보존, 성공 callback 후에만 닫힘,
실패 draft·재시도, 취소/backdrop 뒤 반대 경로 재열기, isPending footer 차단을 확인했다.
주 검수자와 Sol high가 각각 기존 공용9개를 포함23/23 재실행했다. Sol 범위PASS/Finding 없음.
Alert는 API 인자 spy이며 실제 browser/native 표시나 hook→RPC 저장을 입증하지 않는다.
편집 중 refetch draft 덮어쓰기·저장 중 backdrop/Back·Native/IME는 여전히 별도 미완료다.
테스트만 추가한 커밋으로 시각 변경은 없으며 이전 메모 PNG를 현 SHA 측정본으로 승격하지 않는다.

#### ING06 늦은 삭제 응답 — 41de887

실제 PurchaseOptionScreen을 사용하는 생명주기 시험에서 f439091 제품은12PASS/1RED였다.
o1 삭제 승인 → 응답 대기 중 목록으로 돌아감 → o2 편집 초안 입력 → o1 성공 callback이
o2 폼까지 닫았다. callback이 삭제 시작 당시 editingId를 캡처한 것이 원인이다.
현재 편집 ID를 ref로 추적하고 삭제 성공 때 그 ID와 삭제 대상을 비교하도록 수정했다.

| 상태 재현 | 변경 전 | 변경 후 |
|---|---|---|
| o1 삭제 성공, 계속 o1 편집 | 목록 복귀 | 동일 |
| o1 삭제 성공, 이미 o2 편집 | o2 폼까지 닫힘(RED) | o2 초안 유지 |
| o1 삭제 성공, 이미 신규 추가(null) | 동일한 stale 조건으로 닫을 수 있음 | 새 폼·모든 입력 및 id:undefined 저장 유지 |

새14시험은 빈 목록/추가/수정의 저장 성공·실패·재추가 초기화, 삭제 취소·정확ID·동일대상 성공,
Error/nonError 실패, 다른옵션/신규폼 전환을 검사한다. 전체 모바일46파일402/402와 타입PASS.
형상·색·폰트·레이아웃·RPC 선언은 바꾸지 않았다. 위 전후는 host callback 시험이지 새 PNG나
실제 삭제 서버·Native 검증이 아니다. 아래 후속 검수에서 재조회 경로가 같은 결함에 연결되어
41de887은 부분 수정으로 판정됐다. 이 판본만으로 draft 보존을 종결하지 않는다.

Sol P1 후속 `6f6a815`: 실제 delete hook가 상세 쿼리를 무효화하면 배열에서 삭제된 첫 항목 뒤의
o2 객체 참조가 달라질 수 있다. 원래 hydration effect는 editing 객체 변경마다 초안을 덮었다.
폼 진입/대상 ID 전환 때만 초기화하고, 닫기 또는 신규 추가(null) 때 초기화 표식을 해제하도록
고쳤다. 실제 host에 callback-first/refetch-first 두 순서를 주입해 fresh o2의 모든 필드가
초안과 달라도 보존됨을 검사한다. 취소 후 같은 옵션을 재열 때는 새 서버값으로 초기화하며,
최초 조회가 늦게 도착하는 경우도 유지한다. 새 시험17/17·타입PASS; 이는 실제 hook invalidate
실행이 아니라 전달된 응답 순서의 host 검증이다. 스타일·RPC 변경은 없다.

Sol 재검수에서 effect 이전 응답 경쟁이 추가로 확인돼 `6f6a815`도 최종 종결하지 않았다.
목록에서 다른 옵션/신규 추가를 고르는 이벤트와 이전 삭제 성공을 같은 act에 넣은2시험이 RED였다.
`d0923ee`는 openEditor에서 state와 현재 ID ref를 동기 갱신하고 closeEditor에서 hydration
표식을 즉시 해제한다. 새19+기존10=29시험PASS·타입PASS, Astra high가 동일29개를 직접
재실행하고 해당 범위PASS(Finding 없음)로 교차검수했다. same-act는 효과 실행 전 경계 시험이지
실제 네트워크 타이밍 재현이 아니다. 늦은 저장 응답·Native·공식 외부검수는 종결 범위 밖이다.

Sol이 별도 late SAVE를 확인했다. 이전 저장을 보낸 뒤 목록으로 나가 다른/동일 ID 또는 새 폼을
열면 이전 onSuccess가 새 편집창을 닫았다. `9e8b29e`는 open/close마다 동기 증가하는 편집 세대와
저장 시점 세대가 같을 때만 닫는다. payload·RPC·스타일·정상 성공 정책은 불변이다.
신규6시험 인스턴스 RED→PASS(고유 전이는5종: add→new/same은 같은 null 재진입 경로),
전체 lifecycle25+기존10=35/35·타입PASS. Sol high가35/35, Astra high가 공용메모9 포함44/44를
독립 재실행해 이 Finding을 닫았다. 주 에이전트 전체 모바일46파일413/413 PASS.
이는 실제 hook/RPC·Native 또는 ING06 모든 상태 종결을 뜻하지 않는다.

#### 공용 메모 재조회 초안 보호 — 2df3e05

기존 공용 시트의 [visible,value] effect가 작성 중인 초안을 배경 재조회로 덮는 것을
공용 saving false/true와 ING03 직접/메뉴 진입 총4 RED로 재현했다. 마지막 수용값 baseline과
입력 이벤트의 동기 dirty ref로 미수정 초안만 재수화한다. 닫고 재열면 최신 서버값을 받는다.
Astra 사전 검토에 따라 실제 두 소비처(식재료/메뉴 상세)에 대상 ID key를 붙여 같은 메모값을
가진 다른 대상에도 이전 초안이 넘어가지 않게 했다. 메뉴 도메인 전체 작업으로 확대하지 않는다.
공용14+식재료 실제 host18=32/32·타입·웹 export PASS. Astra high가32/32를 직접 재실행해
해당 범위 내부PASS. 스타일·토큰·maxLength·trim/null·서버 payload는 바꾸지 않았다.
위 f439091의 dirty/refetch 미완료 항목은 이 범위에서 보완됐지만, 저장 중 backdrop/Back,
늦은 성공 callback·dirty 이탈 확인·Native/IME는 이 PASS에 포함하지 않는다.
전후 동작 시험을 기록했으며 옛 PNG를 이 커밋의 재촬영으로 표시하지 않는다.

실제 RecipeDetailScreen 소비경계4시험을 `2a67927`에 추가했다. 공용14+식재료18+메뉴4=36/36,
타입PASS. Astra high는 신규184줄 전부와 실제 소비 경계를 읽고36/36 독립 재실행해 해당 범위
최종 내부PASS로 판정했다. 메뉴 도메인 훅/라우터/Modal과 세금 보조영역은 격리했으므로
메뉴 상세 전체 기능 검수나 공식 Fable/Opus·Native 승인으로 확대하지 않는다.

#### 간편 입고 옵션 재조회 — 3dadf50 / 49abc9e

별도 소스 검수에서 Choice.idx가 재조회된 options 배열의 다른 구매처를 가리키는 P1이 나왔다.
예를 들어 [A,B]에서 A를 고른 뒤 [B,A]가 오면 B 구매처와 A 용량/금액이 섞여 저장됐다.
선택 항목이 사라져도 canSave가 이를 검사하지 않았다. root는 순서 변경/앞 항목 삭제/선택 항목
삭제 후 다른 항목만 잔존/빈 목록의4 RED를 재현한 뒤 optionId 조회와 존재 검사로 수정했다.
기존14+신규4=18/18·타입PASS. 편집한 숫자·개수·날짜는 보존하고, 현재 목록에서 선택ID가 없으면
미선택 색 역할·재선택 안내·저장 차단을 적용한다. 같은ID가 다시 나타나면 선택은 다시 유효해진다.
다른 옵션을 자동으로 고르지 않으며 정상 옵션/직접 입력·서버 preview·RPC payload·멱등키 산식은
유지했다. Sol과 별도 교차검수자가18/18·타입을 독립 재실행하여 idx/삭제 Finding 해소를 확인했다.

교차검수는 같은 optionId의 vendorId가 바뀌면 기존 입력과 새 구매처가 섞이는 별도 경계를 찾았다.
이를 추가1 RED로 재현하고 `49abc9e`에서 선택 당시 vendorId도 보관하도록 보완했다. 현재 값과
다르면 입력은 보존하되 재선택 안내·저장 차단·선택 표시0을 적용한다. 같은 옵션을 명시 재선택하면
최신 용량/금액/구매처를 받는다. Sol/교차검수자 모두19/19·타입 직접 재실행, 범위PASS/Finding 없음.
기존 null 구매처 허용 및 멱등키 정책은 불변이며 그 정확성을 추가 보증하지 않는다.

`24858c3` clean tracked verify--no-db는 모바일47파일430/430·core194PASS/12SKIP 및①②⑥PASS,
③기존P0제품금지FAIL·④⑤생략(exit1). `49abc9e` 후 전체 모바일431/431·타입PASS다.
개발 웹 서버를49abc9e로 재시작하고 기존 quick-inbound 수집기로 initial/picker/negative/positive
×390/320/320글자2배의12조건·30PNG를 다시 보존했다(quick-inbound-after-identity).
주 검수자30해시일치·가로넘침/폰트실패/확대불일치/errors/차단0. 이전 c804f753 표본과 browser
151.0.7922.34 및30PNG SHA256이 모두 동일하다. 이는 해당 정상4상태 UI가 그대로라는 표본이며
신규 재조회 무효선택 안내·저장 RPC·Native를 촬영한 것은 아니다. CSS 글자2배에서 탭바 JS
fontScale 반영·장문2줄초과 생략·전체클리핑은 별도 한계로 유지한다.

Sol 독립 검수도30PNG hash/전후 동일성과6시각표본을 확인해 정상4상태 범위PASS로 판정했다.
수집기 미발견/source=현재HEAD라는 첫 설명은 재검산 후 철회했다. 실제 scripts 경로의49abc9e
Git blob SHA256은 manifest와 일치하며 이 SHA는 증거011a0d2의 직접 부모다. 최신 HEAD와 같다는
뜻이 아니다. 정정값·해시는 내부 검수 장부에 보존했다.

#### 공유 수정 내역 혼합 조회 — dcdabe2

ING11/RCP02b는 이름과 이력을 따로 읽지만 이름 오류를 화면 상태에 연결하지 않아 빈 이름과
재시도 누락이 생겼다. 실제 공유 화면18시험(식재료/메뉴 각9)의12 RED를 재현하고 두 조회를 기존
QueryState의 loading/error/retry에 함께 연결했다. 기존 Loading→Error→Empty와 스타일·토큰·
조회 구현·서버 요약값은 그대로다. root25/25, Astra 독립32/32 재실행·추가Finding 없음/범위PASS.
전체 모바일48파일449/449·타입·웹 export PASS. 실제 React Query/RPC 재시도·원자적 스냅샷·
pagination·열린 상세의 대상 전환·네이티브는 별도이며 공식 외부검수/승계 게이트는 계속 미완료다.

후속 c75ee15는 제품 무변경으로 페이지 연결 시험7개를 추가했다. 실제 RNW FlatList 렌더에
제품 onEndReached를 직접 호출하는 host 시험이며 guard4조합·추가로딩·두 entity의 append/
월경계/첫summary/배지/끝안내·링크를 확인한다. Astra 독립7/7 PASS. 실제 scroll·가상화·cursor
RPC 또는 전체 pagination 완료가 아니다. Sol의 상세 상태 검토는 정상 router.push 진입이 새
stack 인스턴스인 점을 확인했고 강제 same-host rerender의 이론 경계만으로 제품을 바꾸지 않았다.
동일 대상 재조회 오류에서 열린 snapshot 유지 정책·Native는 별도 한계다.

전체 재실행에서는 기존 MY45009 시험이455/456으로 실패했다(rule9 기대/rule1 관측).
§1.2의 과거 DOM 대기 보완 뒤에도 재발했으며 단독16/16은 통과했다. 제품은 동일 refetch 응답의
schedule/base를 연속 갱신한다. RNW press config는 passive effect에서 갱신되므로 React act가
없는 DOM polling과 다음 클릭의 경합으로 판단했다. 최초 실행의 두 번째 호출 수는 미기록이다.
시험만 deferred 응답+async act+저장2회 단언으로 보완했다. Sol 독립16/16·반복5/5·타입PASS,
root 전체49파일456/456 연속3회·타입PASS. MY 제품 변경이나 새로운 도메인 적용은 없다.
실제 장치 조회(adb devices)는 연결0건이며 Native 실측은 진행하지 않았다.

#### P3 읽기 전용 증거 진단 후보 — b90a27d

`three-surface-p3-evidence-audit.mjs`는 registry 전체 소유 binding을 읽고 현재 지원하는
ingredient-save JSON/PNG/원본 script blob을 대조한다. 새로운 상태 대응을 추정하지 않으며,
명시된 상태 계약이 없으면 UNMAPPED·PARTIAL로 남긴다. 기본 ready/aligned를 검수 완료로 세지 않는다.
증거 보존 HEAD(--expect-commit)와 비교할 제품 SHA(--source-target)를 분리했다. CURRENT는
명시한 제품 SHA와 관측 SHA 일치만 뜻하며 HEAD 승계나 승인 표기가 아니다.

상한은 CANDIDATE_ONLY·fullP3Complete=false이며 공식검수/Native는 UNVERIFIED다.
기존 P0/P2/verify는 수정하지 않았다. packet은 선택한 증거 커밋 원본, 스크립트는 source 커밋
원본, PNG는 실제 파일과 Git blob/보존 hash를 대조한다. raw script hash의 CRLF 불일치는 자동
완화하지 않는다. source/PNG 결속이 서버가 실제 제공한 번들을 증명하지 않는 한계도 표시한다.
작성자 및 주 검수자의 합성 Git 시험28/28 PASS. 상태 분모 없는 모든 페이지를 완료시키는
도구가 아니며 현재 다른 캡처 포맷 지원·공식검수 영수증·verify 연결은 포함하지 않는다.

후속 독립 검수에서 동일 packet을 다른 경로로 복사해 두 상태에 연결할 수 있는 P2 진단무결성
문제가 재현됐다. `88c5ba7`은 경로 대신 sourceCommit·script blob·host/viewport/pass·PNG 해시의
관측 identity로 중복 소비를 차단한다. 작성자·주 검수자·독립 검수자가30/30 재실행 PASS.
복제본의 JSON 설명/phase/PNG 이름을 바꿔도 실패한다. 인증된 run identity가 없어 독립 실행의
동일 픽셀도 보수적으로 중복 판정한다는 한계를 명시했다. 공식 승인 우회 발견으로 과장하지 않는다.

실제 clean tracked `2df3e05` CLI 실행 결과는
`docs/ai-review/evidence/PROTOTYPE-EXPO-P3-EVIDENCE-DIAGNOSTIC-20260908.json`에 선택 필드로 보존했다.
registry64 surface·204 binding은 모두 UNMAPPED, 명시 state 계약 없음·상태0·미대응 관측12,
PARTIAL/CANDIDATE_ONLY/fullP3Complete=false였다. 선택 제품9c6005b 대비 전6관측은 STALE,
후6관측은 CURRENT이고 형식/해시 오류0이다. CURRENT는 최신 HEAD 승계가 아니고204는 고유
prototype 페이지 수가 아니다. 상태 계약 미연결을 미구현 또는 검수 완료로 바꾸지 않는다.

#### 식재료 잔여 검수 순서 (현행 목록)

e36fbf1 registry 기준 12 surface의 48 binding은 고유 prototype target 44개다. `ready`·`aligned`는
기본값 상속 선언이지 44개 상태별 실행 검수 완료가 아니다. 다음 순서는 내부 읽기 전용 소스 분류에
따르며, 아래 미측정 항목을 미구현으로 간주하지 않는다.

1. ING02/04 공용 Category/Unit/VendorPicker의 위 웹 샘플은 보완했다. 장목록·임의 장문·네이티브/
   키보드는 남았다. 거래처 선택/추가는 prototype 44개 밖의 앱 상태이며 수를 합쳐 완료율을 늘리지 않는다.
2. ING06 목록/편집 단가와 ING03 구매 옵션 행, 빈 목록/미저장 추가 폼은 위 웹 표본을 보완했다.
   거래처 mock 시험과 실렌더 범위를 구분한다. 신규 거래처 실패는 위4host 시험/2host 웹 표본을
   보완했으나 실제 성공·삭제 확인·키보드·네이티브 검증이 남았다.
   ActionSheet 표시와 삭제 확인을 분리하고 실제 삭제/저장은 격리 fixture 없이 실행하지 않는다.
3. ING03 메모 직접/메뉴 진입 취소복원과 dirty/refetch·엔터티 분리는 위 공용36시험으로 보완했다.
   pending 이탈·늦은 저장 응답·삭제 확인·구매 옵션 empty/filled의 남은 상태가 남았다.
   QuickInbound는 후속19 host 시험과12조건 웹 표본을 보완했으나 확인/오류 실렌더·키보드·
   Native 등 미결은 남았다. index/refetch는 위
   49abc9e에서 ID/구매처 기반으로 수정했으며 해당 host 시험은 내부 재검수 PASS다.
   registry binding만 보고 StockEditSheet와 같은 구현이라고 추정하지 않는다.
4. ING07/08/09/10 필터의 host별 적용·조회 날짜·목록 결과와 공용 요약 헤더는 위 표본을 보완했다.
   긴 행의 위 웹 표본은 보완했으나 두 줄 초과 펼치기·임의 metrics·네이티브·스크롤 끝 검증은 남았다. ING07 prototype 취소 메뉴는 현재
   읽기 목록과 제품 계약이 다르므로 디자인 작업으로 취소 기능을 추가하지 않는다.
5. 공유 수정 이력의 긴 상세 웹 표본과 혼합 조회18시험은 보완했다. 다양한 데이터·pagination·
   열린 상세의 대상 전환·네이티브를 별도 검증한다.

## 8. P4 — Expo 화면 카탈로그

### 선택 구조

1. 최소 spike 입력에 현재 정적 `app.json`, `expo-router/entry`, router root 옵션, native·web export,
   제품 `app/_layout.tsx` provider 트리를 포함한다.
2. 다음 세 축을 증거 표로 비교한다: 운영 산출물 제외(native·web export와 route manifest), provider
   동일성 유지 비용, 제품 구성 파일 변경량.
   결과는 `docs/prototypes/surface-catalog-structure-decision.md`에 `MOBILE-PLATFORM`이 기록하고,
   채택안·기각안·근거와 채택 구조별 production 강제 연결 절차·기대 sentinel 산출물을 첫 P4 구현
   commit 전에 커밋한다. 채택한 catalog root·fixture root 합집합도 exact path로 기록하고 decision
   commit SHA와 `mobile-dev-import-check.mjs` 설정을 결속한다.
3. 별도 app root는 `app.config.ts`/router root 변경과 운영 제외를 함께 증명할 때만 채택한다.
   별도 workspace는 provider 공용 모듈 추출이 필요하면 그 제품 리팩터를 별도 commit·검수 단위로 연다.
4. 카탈로그 shell과 기계 생성한 얇은 route adapter만 새로 만들고, 화면 내용은 등록된
   `sourceComponent`를 재사용한다. adapter grammar는 허용 provider JSX 집합과 정확히 한 개의
   sourceComponent, provider snapshot의 최대 중첩·순서만 허용한다. props는 route param·fixture·provider
   연결로 제한하고 다른 JSX, `StyleSheet`, inline style, 계산을 AST 검사기가 실패시킨다. 최소 허용
   adapter 양성 fixture와 extra JSX·중첩 초과·style 음성 fixture를 둔다.
- 탭은 도메인 → 화면 ID → 상태 순으로 탐색한다.
- 화면 전환은 제품 scheme과 분리한 `margincook-catalog://screen/<screenId>?state=<state>` 형식의
  개발 전용 deep link를 복사할 수 있어야 한다. production manifest에는 이 scheme가 없어야 하며
  제품 route가 이를 처리하면 실패한다.

### 운영 차단

1. transform 뒤에도 보존되는 전용 sentinel을 정하고 native·web에 대해 세 legs를 독립 실행한다.
   정상 production export/route manifest에서는 부재, 같은 production 구성에서 카탈로그를 강제 켜면
   존재, development catalog export에서는 존재해야 한다. 각 leg는 별도 PASS line과 산출물 hash를 낸다.
2. 개발 플래그 이름과 기본값을 하나로 고정하고 기본값은 false다.
3. 카탈로그 부팅 시 Supabase URL/ref allowlist를 검사하고 운영 ref·미등록 ref면 하드 실패한다.
   allowlist는 `apps/mobile/src/dev/catalogEnvironment.json`에 두며 운영 ref는 schema상 허용할 수 없다.
4. `fixtureKind=stub`은 provider adapter 경계·결정성 단위 시험을 요구하고 계산 정본을 흉내 내지
   않는다. `fixtureKind=devSeedEntity`는 버전 고정 seed 소유자·재현 명령·RPC 결과를 기록하며 DB 없는
   환경에서는 `unsupported`로 표시한다.

### 완료 조건

- 기본 Expo와 카탈로그 사이 제품 화면 JSX 복사 0건
- 등록 가능 화면 전부 탭에서 접근 가능, 미지원 화면은 이유 표시
- Vitest production 플래그 거부 시험 PASS
- 별도 빌드 게이트에서 native·web production sentinel 부재 + development sentinel 존재 PASS
- 운영 Supabase ref 주입 하드 실패 시험 PASS
- stub 결정성 시험과 devSeedEntity seed 재현 시험 PASS; DB 없는 환경의 unsupported 판정 PASS
- 실제 catalog entry와 P1 projection 양방향 대조 PASS
- 각 `route|fixture` entry가 렌더한 module path가 registry의 `sourceComponent`와 정확히 일치
- 제품과 카탈로그의 해석된 provider module identity/path와 order-sensitive chain snapshot 일치.
  provider 추가·삭제·순서 변경 음성 시험 PASS
- `src/dev/**`와 decision record의 catalog/fixture root 합집합을 제품 코드가 import하지 않으며,
  채택 root를 대상으로 정적·동적·require·type-only·barrel 중 최소 1건 이상의 추가 음성 시험 PASS
- `fixtureRef` resolver가 버전 고정 seed 선택 규칙으로 같은 엔터티를 재현하고 bare UUID를 거부
- selector가 정확히 1건을 찾으며 0건·복수 해석은 하드 실패
- `catalogMode=route|fixture`의 각 비어 있지 않은 선언 state에 접근성 tree·screenshot·sentinel 렌더
  증거가 exact SHA에 결속. `unsupported`는 `states` 선언 금지
- P4 exact SHA 독립검수 PASS

## 9. P5 — 프로토타입·가이드 동기화

### 작업

1. P3의 승인된 제품 레이아웃을 prototype target과 가이드에 반영한다.
2. 프로토타입만 가능한 fixture 표현과 실제 제품 동작을 구분한다.
3. 3표면 레지스트리의 `parity`와 `reason`을 갱신한다.
4. prototype render/design/i18n 감사 산출물을 새 적용본 SHA에 다시 결속한다.

### 완료 조건

- prototype 감사의 stale manifest 0건
- 만료 전 `temporaryDivergence`에 등록된 축을 제외한 `aligned` target의 구조적 차이 0건
- `divergent`·`specOnly`·`expoOnly`는 이유·담당·후속 조건 필수
- 마이그레이션 P5 대기 장부 0건. `temporaryDivergence` 객체는 axes·담당·승인자·만료일·영향 target
  필수이며, 제거만으로 원래 parity가 복원되고 고정 상한·만료 검사 통과
- P5 exact SHA 독립검수 PASS

P5 시험에는 유효한 `aligned+temporaryDivergence{axes:[prototype]}` 양성 fixture, 예외 없는 aligned
구조 차이와 만료된 aligned temporary divergence 음성 fixture를 포함한다.

## 10. P6 — 최종 검증과 종결

### 로컬 게이트

```bash
corepack pnpm verify
```

DB 실행 환경이 없는 중간 checkpoint에서 `--no-db` 또는 `--no-bundle`을 썼다면 전체 통과로 적지
않는다. 최종 후보는 AGENTS.md의 전체 게이트와 정확한 Node·Supabase CLI 계약을 따른다.

추가로 다음을 실행한다.

- 화면 레지스트리 양방향 검사
- 디자인 토큰·색 역할·터치·대비 감사
- prototype render/design/i18n 감사
- 카탈로그 web smoke와 native·web production export 차단/개발 양성대조
- Android·iOS 실기기에서 safe-area·키보드·터치·200% 글자 확인. 동등 증거가 필요하면 제품
  소유자가 exact SHA·플랫폼·대체 범위를 명시 승인한 경우에만 사용. 승인자는
  `docs/prototypes/three-surface-approvers.json`의 `PRODUCT-OWNER`에 등록되고 commit author와 달라야 한다.

P4 구조 spike는 route manifest·app config·provider graph의 정적 diff gate만 실행한다. 첫
sentinel·route·fixture가 들어간 commit부터 `prototype:catalog:isolation`과
`prototype:catalog:imports`는 exact review SHA와 protected pre-merge의 필수 gate다. 문서 전용 중간
commit에는 번들을 요구하지 않지만 검수·병합 후보와 긴급 commit은 면제하지 않는다. 두 task는
production native·web 2 legs와 force-enabled production·development 양성대조, 다섯 import edge를
각각 실행하며 `--no-bundle`로 대체할 수 없다.

### 최종 독립검수

- Fable을 기본 엔진으로 exact target commit을 검수한다.
- Opus direct advisory를 Fable PASS로 표기하지 않는다.
- bytes가 바뀌면 이전 PASS는 무효이며 successor 또는 새 Task로 변경 diff를 재검수한다.
- R2/R3·운영 종결은 `docs/ai-review/README.md`의 Fable 복구 표본 또는 사람 exact-SHA 위험 수용
  조건을 그대로 적용한다.
- P6의 로컬 완료는 R0/R1까지이며 R2/R3·운영 승인을 포함한다고 표현하지 않는다.

### 종결 산식

```text
완료 = 레지스트리 차이 0
     + 기본 Expo 기능 회귀 0
     + 카탈로그 중복 구현 0
     + production 노출 0
     + 미기록 3표면 차이 0
     + 필수 게이트 PASS
     + exact-SHA 독립검수 종결
```

## 11. 커밋·검수 단위

| 단위 | 한 commit에 허용 | 섞지 않을 것 |
|---|---|---|
| 기준선 | 감사기·산출물·문서 정정 | 제품 시각 변경 |
| 레지스트리 | schema·loader·checker·시험 | 화면 스타일 변경 |
| P4 구조 spike | app config/router root/provider tree의 최소 실험과 3축 증거 | 제품 화면 스타일·실제 catalog route |
| 공용 규격 | 한 컴포넌트군과 소비 pilot | 여러 도메인의 무관 수정 |
| 도메인 배치 | 한 탭의 승인된 화면 적용 | DB/RPC·다른 탭 기능 변경 |
| 카탈로그 | shell·fixture·격리 시험 | 제품 전용 우회 구현 |
| 프로토타입 동기화 | target·가이드·감사 산출물 | 미승인 제품 기능 변경 |

각 검수 요청에는 baseline SHA, target SHA, 허용 경로, 제외 경로, 실행한 게이트, 알려진 예외와
완료 조건을 적는다.

## 12. 긴급 차이 절차

1. `three-surface-approvers.json`의 `PRODUCT-OWNER` 승인자가 제품 긴급 수정과 후속 기한을 승인한다.
   `approvedBy`는 목록에 있고 commit author와 달라야 한다.
2. 정상 parity는 유지하고 직교 `temporaryDivergence{axes,owner,approvedBy,expiresAt,targets}`를 같은
   commit에 기록한다. `expiresAt`은 UTC ISO-8601, committer date +7일 이내이며 검사 평가 시각은
   산출물에 따로 기록한다. `emergencyDivergenceMax`는 P2 전 baseline에 고정하고 같은 commit의 상한
   인상을 금지한다. migration 장부 포화 여부는 별도 `migrationBacklogMax`이므로 이 기록을 막지 않는다.
   migration 항목의 만료는 별도 `migrationDeadlineUtc`를 적용하며 긴급 7일 규칙을 적용하지 않는다.
3. 긴급 commit은 카탈로그 production 차단, Supabase allowlist, 동기화 검사기,
   `three-surface-approvers.json`, baseline의 두 상한과 `migrationDeadlineUtc`를 수정할 수 없다.
   승인자·상한·deadline 변경은 별도
   독립검수 commit으로만 허용한다.
4. 만료 초과 시 checker가 실패하고, `owner`가 후속 정상 commit에서 prototype·앱·catalog를 맞춘 뒤
   객체만 삭제해 예외를 닫는 것만 remediation으로 허용한다. 긴급 commit도 protected pre-merge
   격리·동기화 gate와 사후 독립검수를 면제받지 않는다.
5. 음성 시험은 긴급 commit의 승인자 파일 변경·상한 인상 동반을 실패시키고, migration 장부가
   포화돼도 emergency 상한 안의 새 긴급 예외는 통과시키며 emergency 상한 초과는 실패시킨다.
   긴급 +8일과 migration deadline 초과도 각각 실패시킨다.
6. checker는 과거 exact SHA 재현용 `commit-time` 모드와 현재 운영 유효성용 `current-time` 모드를
   별도 PASS line으로 낸다. revert가 만료 예외를 되살리면 commit-time 증거와 무관하게 current-time은
   실패하며, 같은 revert/remediation commit에서 세 표면 동기화와 예외 객체 삭제를 함께 해야 한다.

## 13. 롤백

- 단계별 commit을 선형으로 유지하고 되돌릴 때 `git revert`를 사용한다.
- DB migration이 없으므로 화면 단계 롤백은 앱 코드·레지스트리·prototype 동기화 commit의 역적용이다.
- 카탈로그에 문제가 생기면 production 차단을 유지한 채 카탈로그 route만 비활성화할 수 있다.
- 공용 컴포넌트 롤백으로 여러 화면이 영향을 받으면 해당 컴포넌트와 소비 배치를 함께 되돌리고
  레지스트리 parity를 이전 상태로 복원한다.
- 기본 작업 폴더나 다른 worktree를 삭제하는 방식으로 롤백하지 않는다.
