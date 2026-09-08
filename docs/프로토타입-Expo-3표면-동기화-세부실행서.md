# 프로토타입·Expo 3표면 동기화 세부 실행서

> 상태: **P3 식재료 공용 우선 재접근·웹 검수 후보. P3 승계 게이트/외부 검수/네이티브 미완료, 다음 도메인 진입 전**
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
이 계약과 exact-SHA 외부 독립검수, 네이티브 증거가 열려 있으므로 다음 도메인과P4로 넘어가지 않는다.

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
