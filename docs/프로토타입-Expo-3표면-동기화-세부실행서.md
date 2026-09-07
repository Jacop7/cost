# 프로토타입·Expo 3표면 동기화 세부 실행서

> 상태: **Opus 2차 자문 반영 · R3 재검수 대기 초안**
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
  기다리도록 고쳤다. 동일 기본 runner(`vitest 2.1.9`, shuffle=false, seed 미사용) 전체 스위트 10회
  연속 통과를 추가 완료 조건으로 둔다.
- legacy 색 별칭 0건, 색 역할 감사 통과
- 과거 S4 exact 디자인 계약은 최신 제품 화면이 기준선 이후 변경되어 현재 실패한다. 이 실패는 제품
  회귀로 확정된 것도, 무시 가능한 낡은 검사로 확정된 것도 아니다. 단계 0에서 선언별로 분류한다.
- 운영·스테이징에는 이 브랜치 변경을 적용하지 않았다.

## 2. 산출물 계획

| 산출물 | 제안 경로 | 책임 |
|---|---|---|
| 사람 선언 입력 | `apps/mobile/src/dev/surfaceRegistry.declarations.json` | fixture·상태·parity·근거만 ID별 선언 |
| 생성 레지스트리 | `apps/mobile/src/dev/surfaceRegistry.generated.json` | README·route AST·prototype와 선언을 합친 재생성 산출물 |
| 레지스트리 타입·로더 | `apps/mobile/src/dev/surfaceRegistry.ts` | schema, fail-closed validation |
| 화면 카탈로그 | `apps/mobile/catalog-app/**` 또는 별도 `apps/mobile-catalog/**` | 제품 route tree와 분리한 개발 전용 탭형 진입점 |
| fixture 경계 | `apps/mobile/src/dev/catalogFixtures/**` | `stub`과 `devSeedEntity`의 분리된 비운영 재현 경계 |
| 동기화 검사 | `scripts/three-surface-sync-check.mjs` | route·ID·prototype·catalog 양방향 대조 |
| 카탈로그 격리 시험 | `apps/mobile/tests/surfaceCatalog.test.tsx` | 중복 렌더·production 차단·fixture 검증 |
| 빌드 격리 게이트 | `scripts/surface-catalog-build-gate.mjs` | native·web prod 부재 + dev sentinel 존재 양성대조 |
| dev 의존 검사 | `scripts/mobile-dev-import-check.mjs` | 제품→`src/dev/**` 역방향 import 금지 |
| 시각 변경 검사 | `scripts/three-surface-visual-diff-check.mjs` + `docs/prototypes/three-surface-approved-visual-changes.json` | screenId·요소별 before/after와 승인 목록 차집합 |
| 개발 DB allowlist | `apps/mobile/src/dev/catalogEnvironment.json` | `MOBILE-PLATFORM` 소유, dev Supabase ref/URL만 허용 |
| P4 구조 결정 | `docs/prototypes/surface-catalog-structure-decision.md` | `MOBILE-PLATFORM` 소유, 3축 증거·채택/기각안 |
| seed 계약 | `apps/mobile/src/dev/catalogFixtures/devSeedEntities.json` | seed 판본·소유자·재현 명령·RPC 결과 |
| 네이티브 증거 | `docs/prototypes/three-surface-native-evidence.json` | 플랫폼·OS·기기·exact SHA·항목별 결과·대체 승인 |
| 자문 Finding 장부 | `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001/advisory-ledger.md` | Finding별 제기·처리·검증 SHA |
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
- 동일 기본 runner(`vitest 2.1.9`, shuffle=false, seed N/A) 전체 스위트 10회 연속 233/233

## 5. P1 — 화면 레지스트리

### 작업

1. README의 표를 전용 Markdown parser로 읽어 정식 화면 ID를 얻고 expo-router 파일·component export는
   AST/파일 시스템으로 읽는다. `.tmp/**`와 모든 Git worktree 복제 경로는 스캔 입력에서 제외한다.
2. 프로토타입의 screen·popup registry를 파서로 읽는다. HTML 정규식 한 번으로 완료 판정하지 않는다.
3. 생성 컬럼과 사람 선언 컬럼을 분리하고, 둘을 합친 레지스트리를 재생성해 committed bytes와 대조한다.
4. 레지스트리에서 **예정 카탈로그 탭 projection**과 검수 대상 목록을 생성한다. 실제 카탈로그 entry는
   P4에서 대조한다.
5. README 구현 상태 표식 블록을 생성 레지스트리에서 다시 만들고 수기 상태 권위를 제거한다.
6. 다음 음성 시험을 추가한다.
   - Expo route 하나 삭제·추가
   - prototype target 하나 삭제·추가
   - 중복 screenId
   - 존재하지 않는 source component
   - fixtureRef 없는 동적 route
   - 근거 없는 `unsupported`·`specOnly`
   - 생성 컬럼 수기 수정과 README 상태 블록 수기 수정
   - 제품 코드의 `src/dev/**` import
   - 정적·동적·`require`·type-only import와 barrel re-export 각 1건
   - registry 두 번 생성 bytes 동일, CRLF/BOM/key·array 순서 변조 실패
   - README 상태 영역 수기 수정·표식 누락·중복·ID 표 겹침
   - route↔ID, ID↔prototype, ID↔catalog 각 축에 잘못 적용한 예외

### 완료 조건

- Expo route ↔ 화면 ID ↔ prototype target ↔ 생성된 catalog projection의 차집합은 근거 있는
  `specOnly`·`expoOnly`·`unsupported` 선언 목록과 정확히 일치
- 의도된 1:N·N:1 대응은 명시적 배열과 이유로만 허용
- 레지스트리 외 수기 카탈로그 배열 0건
- P1 exact SHA 독립검수 PASS

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

### 완료 조건

- 다섯 대표 화면의 제품 기능 시험 유지
- 새 임의 색·간격·반경 팔레트 0건
- 공용화할 패턴을 화면별 복사로 구현한 사례 0건
- 320px·200% 글자·영어·Android·iOS safe-area 점검
- P2 exact SHA 독립검수 PASS 후에만 P3 확대
- 시각 diff가 승인 manifest와 정확히 일치

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
5. prototype 차이는 P5 대기 장부에 담당·만료·target과 함께 자동 등록한다. 미해결 상한은 배치
   시작 전에 정하고 초과하면 다음 도메인 배치를 막는다.

### 완료 조건

- 다섯 도메인의 등록 화면이 새 레이아웃 계약을 소비
- 도메인 훅·query key·RPC 호출 계약 diff 0 또는 별도 승인 작업
- 화면별 하드코딩 감소가 감사 산출물로 확인되고 새 자유 스케일 0건
- 배치별 필수 시험 통과
- 배치별 시각 diff가 승인 manifest와 정확히 일치
- 각 도메인 배치별 exact SHA 독립검수 PASS. 여러 도메인을 한 검수로 묶지 않음

## 8. P4 — Expo 화면 카탈로그

### 선택 구조

1. 최소 spike 입력에 현재 정적 `app.json`, `expo-router/entry`, router root 옵션, native·web export,
   제품 `app/_layout.tsx` provider 트리를 포함한다.
2. 다음 세 축을 증거 표로 비교한다: 운영 산출물 제외(native·web export와 route manifest), provider
   동일성 유지 비용, 제품 구성 파일 변경량.
   결과는 `docs/prototypes/surface-catalog-structure-decision.md`에 `MOBILE-PLATFORM`이 기록하고,
   채택안·기각안·근거를 첫 P4 구현 commit 전에 커밋한다.
3. 별도 app root는 `app.config.ts`/router root 변경과 운영 제외를 함께 증명할 때만 채택한다.
   별도 workspace는 provider 공용 모듈 추출이 필요하면 그 제품 리팩터를 별도 commit·검수 단위로 연다.
4. 카탈로그 shell과 기계 생성한 얇은 route adapter만 새로 만들고, 화면 내용은 등록된
   `sourceComponent`를 재사용한다. adapter는 param·fixture·provider 연결 외 JSX tree·StyleSheet·계산을
   선언할 수 없고 AST 검사기가 위반을 실패시킨다.
- 탭은 도메인 → 화면 ID → 상태 순으로 탐색한다.
- 화면 전환은 deep link를 복사할 수 있어야 하며 동일 화면·상태를 다시 열 수 있어야 한다.

### 운영 차단

1. 전용 sentinel을 정하고 native·web production export와 route manifest에서 catalog route·fixture·
   sentinel이 부재해야 한다. 같은 검사에서 development catalog export의 sentinel 존재를 양성 대조한다.
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
- P4 exact SHA 독립검수 PASS

## 9. P5 — 프로토타입·가이드 동기화

### 작업

1. P3의 승인된 제품 레이아웃을 prototype target과 가이드에 반영한다.
2. 프로토타입만 가능한 fixture 표현과 실제 제품 동작을 구분한다.
3. 3표면 레지스트리의 `parity`와 `reason`을 갱신한다.
4. prototype render/design/i18n 감사 산출물을 새 적용본 SHA에 다시 결속한다.

### 완료 조건

- prototype 감사의 stale manifest 0건
- `aligned` target의 구조적 차이 0건
- `divergent`·`specOnly`·`expoOnly`는 이유·담당·후속 조건 필수
- 마이그레이션 P5 대기 장부 0건. `temporaryDivergence`는 담당·승인자·만료일·영향 target 필수이며
  동시 상한·만료 검사 통과
- P5 exact SHA 독립검수 PASS

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
  소유자가 exact SHA·플랫폼·대체 범위를 명시 승인한 경우에만 사용

P4가 생긴 commit부터 `prototype:catalog:isolation`과 `prototype:catalog:imports`는 모든 commit의
필수 gate다. 두 task는 production native·web export와 development 양성대조, 다섯 import edge를
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
| 공용 규격 | 한 컴포넌트군과 소비 pilot | 여러 도메인의 무관 수정 |
| 도메인 배치 | 한 탭의 승인된 화면 적용 | DB/RPC·다른 탭 기능 변경 |
| 카탈로그 | shell·fixture·격리 시험 | 제품 전용 우회 구현 |
| 프로토타입 동기화 | target·가이드·감사 산출물 | 미승인 제품 기능 변경 |

각 검수 요청에는 baseline SHA, target SHA, 허용 경로, 제외 경로, 실행한 게이트, 알려진 예외와
완료 조건을 적는다.

## 12. 긴급 차이 절차

1. 지정 승인자가 제품 긴급 수정과 동기화 후속 기한을 승인한다.
2. 레지스트리에 `temporaryDivergence`, `owner`, `approvedBy`, `expiresAt`, 영향 target을 같은 commit에
   기록한다. `expiresAt`은 UTC `YYYY-MM-DD`를 빌드 시계로 평가한다. 동시 예외 상한은 3건이며
   초과 시 새 긴급 예외를 열 수 없다.
3. 긴급 commit은 카탈로그 production 차단, Supabase allowlist, 동기화 검사기를 수정할 수 없다.
4. 만료 초과 시 checker가 실패하고, `owner`가 후속 정상 commit에서 prototype·앱·catalog를 맞춘 뒤
   예외를 닫는 것만 remediation으로 허용한다.

## 13. 롤백

- 단계별 commit을 선형으로 유지하고 되돌릴 때 `git revert`를 사용한다.
- DB migration이 없으므로 화면 단계 롤백은 앱 코드·레지스트리·prototype 동기화 commit의 역적용이다.
- 카탈로그에 문제가 생기면 production 차단을 유지한 채 카탈로그 route만 비활성화할 수 있다.
- 공용 컴포넌트 롤백으로 여러 화면이 영향을 받으면 해당 컴포넌트와 소비 배치를 함께 되돌리고
  레지스트리 parity를 이전 상태로 복원한다.
- 기본 작업 폴더나 다른 worktree를 삭제하는 방식으로 롤백하지 않는다.
