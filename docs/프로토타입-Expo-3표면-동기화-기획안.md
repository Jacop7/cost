# 프로토타입·Expo 3표면 동기화 기획안

> 상태: **Opus 8차 자문 반영 · R9 재검수 대기 초안**
> 작성일: 2026-09-07
> 적용 범위: 프로토타입 · 기본 Expo 앱 · Expo 화면 카탈로그
> 실행 순서: [`프로토타입-Expo-3표면-동기화-세부실행서.md`](./프로토타입-Expo-3표면-동기화-세부실행서.md)
> 토큰 값 정본: `apps/mobile/src/theme/tokens.ts`

## 1. 목적

프로토타입의 간결한 정보 위계와 레이아웃을 실제 Expo 제품 화면에 반영하고, 서비스 오픈 전까지
다음 세 표면을 같은 화면 계약으로 관리한다.

1. **프로토타입**: 화면·팝업의 시각 명세와 상태 fixture
2. **기본 Expo**: 사용자가 실제로 쓰는 앱형 제품
3. **Expo 화면 카탈로그**: 실제 Expo 화면을 탭 메뉴로 빠르게 비교하는 개발·검수 전용 표면

이 작업은 프로토타입을 그대로 복제하거나 새 디자인 체계를 만드는 일이 아니다. 이미 확정된
기본 → 의미 → 컴포넌트 3계층 토큰과 제품 동작을 보존하면서, 프로토타입이 더 명확한 부분의
레이아웃·정보 밀도·배치 패턴을 공용 Expo 컴포넌트로 옮기는 작업이다.

## 2. 확정 방향

### 2.1 작업 환경

- 구현·검수는 최신 제품 기준선에서 분리한 짧은 개발 브랜치와 격리 worktree에서 한다.
- 앱 데이터는 로컬 또는 명시된 개발 환경만 사용한다. 운영 Supabase를 화면 카탈로그의 fixture로
  사용하지 않는다.
- 이 기획안의 완료는 운영 배포 승인이 아니다. `main` 병합, 스테이징, 운영 배포는 기존 보호 게이트와
  별도 사람 결정을 거친다.
- 오염된 기본 작업 폴더나 다른 장기 작업의 미추적 파일을 삭제·흡수·스테이징하지 않는다.

### 2.2 디자인 권위

| 대상 | 권위와 책임 |
|---|---|
| 토큰 값 | `apps/mobile/src/theme/tokens.ts` |
| 토큰 역할·집행 이력 | `docs/디자인-토큰-3계층-값-매핑-기획서.md`와 관련 감사 산출물 |
| 제품 화면 ID·라우트·구현 상태 | `apps/mobile/src/features/README.md` |
| 제품 계산·데이터 흐름 | `ARCHITECTURE.md`, DB RPC, 도메인 훅 |
| 프로토타입 화면·팝업 계약 | `docs/prototypes/full-page-flow-prototype-ui-guide.md`와 적용본 |
| 3표면 대응 관계 | 이 작업에서 만드는 기계 판독 화면 레지스트리 |

프로토타입은 토큰 정본이나 제품 계산 권위가 아니다. Expo에 없는 프로토타입 표현을 옮길 때도
`tokens.ts`와 공용 컴포넌트 계약으로 번역한다.

### 2.3 시각 방향

- 기존 브랜드, 상태색, 접근성 대비, 터치 영역, 타이포 역할은 유지한다.
- 프로토타입에서 채택할 것은 화면 gutter, 제목·요약·행동의 순서, 섹션 구분, 행 밀도, 시트와
  하단 행동 배치처럼 **정보 구조를 단순하게 만드는 패턴**이다.
- 제품 기능, 서버 계산, 라우트 의미, 입력 검증을 시각 정리와 함께 재설계하지 않는다.
- 단순화 때문에 정보가 사라지거나 행동이 숨으면 채택하지 않는다. 프로토타입과 제품이 충돌하면
  제품 계약을 보존하고 차이를 레지스트리에 기록한다.

## 3. 3표면 구조

```text
화면 레지스트리 ─┬─ 프로토타입 target(screen/popup)
                  ├─ Expo route + 실제 screen component
                  └─ 개발 전용 화면 카탈로그 tab

tokens.ts → 의미 역할 → kit/component → 기본 Expo와 카탈로그가 동일 구현 재사용
```

### 3.1 프로토타입

- 빠른 시각 합의와 상태 조합 확인용이다.
- `screen`·`popup` target을 유지하고 렌더·글자 확대·국제화 감사의 입력으로 쓴다.
- 실제 Expo에서 구현하지 않은 상태는 `specOnly`로, 제품과 다르게 구현된 상태는 `divergent`로
  명시한다. 둘을 구현 완료처럼 세지 않는다.

### 3.2 기본 Expo

- 기존 expo-router 구조와 다섯 하단 탭을 유지한다.
- 실제 도메인 훅과 Supabase 데이터 흐름을 그대로 사용한다.
- 화면별 복사 CSS 대신 `components/kit`, 의미 토큰, 컴포넌트 규격을 먼저 보강하고 화면이 이를
  소비하게 한다.

### 3.3 Expo 화면 카탈로그

- **개발·검수 전용**이다. 운영 빌드에서는 라우트와 진입점이 실패 폐쇄되어야 한다.
- 제품 `app/` 아래 숨은 `__catalog` route는 만들지 않는다. 구조는 P4 spike에서 다음 세 축을 함께
  비교해 정한다: ① native·web 운영 산출물 제외 증명, ② 제품과 동일한 provider 트리를 유지하는
  비용, ③ `app.json`→`app.config.ts`·router root 등 제품 구성 파일 변경량.
- 별도 catalog app root는 production bundle 제외가 증명되고 제품 구성 변경이 제한적일 때만 쓴다.
  별도 workspace를 택하면 `app/_layout.tsx`의 provider 조합을 제품 공용 모듈로 추출하는 범위를
  별도 제품 리팩터 commit으로 연다. shell·adapter만 만든다는 범위로 이 리팩터를 숨기지 않는다.
- 제품 화면의 JSX를 복사하지 않는다. 같은 Expo route 또는 같은 화면 컴포넌트를 실제로 렌더한다.
- 다섯 제품 탭과 별도로 도메인·화면 ID·상태별 탭 메뉴를 제공한다.
- 상세·수정 화면처럼 ID가 필요한 화면은 `fixtureKind=stub|devSeedEntity` 중 하나와 판별 합집합
  `fixtureRef`를 선언한다. `stub`은 `{stubName}`이고 제품 provider 바깥의 명시적 adapter 경계에서만
  쓴다. `devSeedEntity`는 `{seedVersion, entityKind, selector}`이며 resolver가 seed/RPC 결과에서 정확히
  1건을 찾아야 한다. 0건·복수 해석은 하드 실패한다. 두 갈래 모두 bare UUID·운영 ID 리터럴은 schema가
  거부하고, DB 없는 환경의 `devSeedEntity`는 `unsupported`로 표시한다.
- 카탈로그 부팅 시 Supabase URL/ref를 개발 허용 목록과 대조하고 불일치하면 렌더 전에 하드 실패한다.
  운영 ref·운영 사용자·운영 데이터 첫 행을 fixture로 고르지 않는다.
- 인증·safe-area·하단 탭·query cache가 기본 앱과 다른 결과를 만들지 않도록 같은 앱 provider를
  사용한다. 카탈로그가 provider를 복제하면 해당 차이는 별도 계약과 시험이 필요하다.

## 4. 3계층 토큰 적용 원칙

### 4.1 기본 토큰

색상, 타이포그래피, 간격, 크기, borderWidth, radius, shadow, opacity, motion, breakpoint,
zIndex의 최소 재료를 `tokens.ts`가 소유한다. 새 화면은 동일 의미의 숫자·색을 두 번째 팔레트로
추가하지 않는다.

### 4.2 의미 토큰

텍스트, spacing, line, surface, state, layout, layer, accessibility, media 역할은 기본 토큰의
별칭 또는 조합이다. 상태의 의미는 공통으로 두되 실제 pressed·disabled·selected 표현은 각
컴포넌트가 소유한다.

### 4.3 컴포넌트 규격

Button, Icon, Input, Select, Checkbox, Switch, Chip, Card, Header, Sheet, Tab이 실제 화면 계약을
소유한다. 프로토타입의 배치 차이를 화면마다 하드코딩하지 않고 먼저 이 규격으로 설명할 수 있는지
검토한다. 설명할 수 없으면 새 토큰보다 컴포넌트 변형이 필요한지 먼저 판단한다.

## 5. 화면 레지스트리

세 표면을 손으로 따로 관리하지 않도록 하나의 기계 판독 레지스트리를 추가한다. 최소 필드는 다음과
같다.

| 필드 | 뜻 |
|---|---|
| `screenId` | `ING-`·`RCP-`·`ORD-`·`SALES-`·`MY-` 정식 ID |
| `domain` | 다섯 제품 탭 중 소유 도메인 |
| `expoRoute` | 실제 expo-router 경로 |
| `sourceComponent` | 기본 앱과 카탈로그가 공유할 화면 컴포넌트 |
| `prototypeTargets` | 대응하는 prototype `screen`·`popup` target 목록 |
| `catalogMode` | `route`·`fixture`·`unsupported` 중 하나 |
| `fixtureKind` | `stub`·`devSeedEntity` 중 하나. fixture가 없으면 생략 |
| `fixtureRef` | `stub → {stubName}` 또는 `devSeedEntity → {seedVersion, entityKind, selector}`. bare UUID 금지 |
| `states` | loading·empty·error·ready 등 검수 상태 |
| `parity` | `aligned`·`divergent`·`specOnly`·`expoOnly` |
| `reason` | 불일치·제외의 근거와 후속 책임 |
| `temporaryDivergence` | 정상 parity와 직교하는 임시 예외 객체 `{axes, owner, approvedBy, expiresAt, targets}` |
| `migrationPending` | P3→P5 단계적 수렴 객체 `{owner, expiresAt, targets}`. `parity=divergent`에서만 허용 |
| `routeBinding` | README가 독립 route가 아닌 시트·인라인 상태를 가리킬 때, AST로 검증할 host route와 source component의 의미 연결 |
| `prototypeScreenKeys`·`prototypeTargetsBinding` | 제품 화면 ID와 prototype의 과거 추적 ID가 같지 않은 경우를 위한 명시적 의미 연결. 실제 target 존재와 전수 소유는 생성기가 검증 |
| `routeExclusions` | 독립 화면이 아닌 expo-router redirect만 허용하는 닫힌 예외. AST에 `Redirect`가 없으면 실패 |

컬럼 소유를 분리한다. `screenId`·`domain`·`expoRoute`·`sourceComponent`·`prototypeTargets`는
README의 정식 ID, Expo route/AST, prototype registry에서 생성한다. 다만 서로 다른 권위의 ID 사이에는
코드만으로 의미를 추론할 수 없으므로 사람 선언은 `routeBinding`·`prototypeScreenKeys`·
`prototypeTargetsBinding`으로 **연결만** 소유한다. 생성기는 그 연결을 실제 route·export·target과 대조해
생성 컬럼으로 확장하고 orphan·중복 공유를 검사한다. 1:N·N:1 공유에는 `prototypeSharingReason`이 필수다.
`catalogMode`·`fixtureKind`·
`fixtureRef`·`states`·`parity`·`reason`·`temporaryDivergence`·`migrationPending`만 ID별 선언 파일에서 사람이 쓴다.
검사기는 두 입력을 합쳐 최종 레지스트리를 재생성하고 committed bytes와 일치하는지 확인한다.
생성 컬럼의 수기 편집은 실패한다. README의 구현 상태 블록은 최종 레지스트리에서 생성해 상태의
이중 권위를 없앤다.

`fixtureKind=stub`의 `stubName`은 자유 문자열로 끝나지 않는다. 개발 전용 stub registry의 실제 key와
screenId를 양방향 대조하고, `sourceComponent`는 export 존재뿐 아니라 결속된 Expo route의 import
graph에서 도달 가능해야 한다. 상대·tsconfig alias specifier를 해석하지 못하면 edge를 버리지 않고
실패한다.

`docs/prototypes/three-surface-byte-artifacts.json`이 텍스트 byte-normative 산출물의 닫힌 목록과
README marker range를 소유하며 manifest 자체도 첫 항목으로 등록한다. 최소 목록은 두 registry JSON,
baseline, 시각 승인 목록, native evidence, approvers, migration backlog, advisory ledger JSON과 생성 MD,
3표면 검사기·음성 시험, 계획·P0 검수 task 디렉터리,
README 생성 영역이다. 등록 산출물은 UTF-8(BOM 없음), LF, 파일 끝 개행 1개, key 고정 순서, 배열의
Unicode codepoint 오름차순, 2-space indent로 고정한다. 두 번 연속 생성한 bytes가 같아야 하며
`.gitattributes`가 전체 파일 항목의 LF를 고정한다. 미등록 생성 산출물은 checker가 실패한다.
CRLF·BOM·key/array 순서 변화는 의미가 같아도 gate가 실패한다.

README에는 `<!-- THREE-SURFACE-STATUS:START -->`와 `<!-- THREE-SURFACE-STATUS:END -->`로 생성
상태 영역을 지정한다. ID parser는 이 영역을 입력에서 제외하고 정식 ID 표와 영역이 겹치면 실패한다.
순서는 `README 정식 ID + route/prototype + 사람 선언 → registry 생성 → README 상태 생성`으로
고정한다. 두 차례 재생성의 idempotency, 생성 영역 수기 수정, 표식 누락·중복을 음성 시험한다.

검사기는 레지스트리와 Expo 라우트, 화면 ID 인벤토리, 프로토타입 target을 양방향 대조한다. 미등록
라우트나 target, 중복 ID, 존재하지 않는 파일, 근거 없는 제외는 실패한다. 앱 루트의 화면 없는
`Redirect`만 `routeExclusions`의 AST 검증된 예외로 허용한다. 다만 `specOnly`·
`expoOnly`·`unsupported`처럼 근거가 있는 선언 예외는 차집합에서 제외하지 않고 별도 목록으로
정확히 대조한다. 카탈로그의 탭 목록은 최종 레지스트리에서 생성하고 별도 배열을 두지 않는다.

예외는 축별로만 작동한다.

| 차이 축 | 허용 근거 | 다른 축에 미치는 영향 |
|---|---|---|
| route ↔ 정식 ID | `parity=specOnly`과 `reason` | catalog·prototype 차이를 면제하지 않음 |
| 정식 ID ↔ prototype target | `parity=specOnly`·`expoOnly`·`divergent`와 `reason` | route·catalog 차이를 면제하지 않음 |
| 정식 ID ↔ catalog entry | `catalogMode=unsupported` 또는 `parity=specOnly`와 `reason` | route·prototype 차이를 면제하지 않음 |

핵심 필드 계약은 다음과 같다. `R`은 필수, `O`는 선택, `F`는 금지다. `expoOnly`는 README 정식
ID와 Expo route가 있지만 prototype target만 없는 상태다. README ID 없는 route는 무조건 실패하며
`expoOnly`로 면제할 수 없다.

| parity | `expoRoute` | `sourceComponent` | `prototypeTargets` | `catalogMode` | `states` |
|---|---:|---:|---:|---:|---:|
| `aligned` | R | R | R | R | R* |
| `divergent` | R | R | R | R | R* |
| `specOnly` | F | F | R | F | F |
| `expoOnly` | R | R | F | R | R* |

사람 선언 필드 계약은 별도 표가 소유한다. `C`는 아래 의존 규칙에 따라 필수 또는 금지다.

| parity | `reason` | `fixtureKind` | `fixtureRef` | `temporaryDivergence` | `migrationPending` |
|---|---:|---:|---:|---:|---:|
| `aligned` | C | C | C | O | F |
| `divergent` | R | C | C | O | O |
| `specOnly` | R | F | F | O | F |
| `expoOnly` | R | C | C | O | F |

`R`은 필드가 존재하고 배열이면 비어 있지 않다는 뜻이다. `R*`은 `catalogMode=route|fixture`일 때
비어 있지 않은 필수이고, `catalogMode=unsupported`일 때 금지다. 생성기는 이 행렬로 필드를
생성·보존·거부한다. 각 parity마다 필수 필드 누락, 금지 필드 삽입,
선택 필드의 잘못된 형식을 음성 fixture로 검증한다. `specOnly`는 parity 자체가 catalog 축 부재의
근거이며 `states`는 prototype target 쪽 상태 표현을 사용하므로 레지스트리에서는 금지한다.
`reason`은 `aligned+route|fixture`에서 금지하고 `aligned+unsupported`에서 필수다. fixture 두 필드는
`catalogMode=fixture`에서만 필수이고 나머지 mode에서 금지한다. `migrationPending`은 divergent에서만
선택 가능하다. `aligned.reason`과 각 `C` 의존 위반을 음성 fixture로 검증한다.
`temporaryDivergence`는 parity 값이 아니므로 어느 parity와도 공존할 수 있지만 `axes`가 비어 있으면
실패한다. 허용 축은 `routeId`·`prototype`·`catalog`·`visual`·`state`뿐이며 축별 영향 target을 요구한다.
`aligned|divergent`는 다섯 축, `specOnly`는 `prototype|visual|state`, `expoOnly`는
`routeId|catalog|visual|state`만 허용한다. 부적합 조합은 실패한다. 만료 후에는 이 객체만 삭제해 정상 parity를
복원하고 parity 자체를 바꾸지 않는다. 잘못된 축, 빈 축, 엉뚱한 후속 commit을 음성 시험한다.

`catalogMode=route`는 fixture 필드를 금지한다. `catalogMode=fixture`는 `fixtureKind`와 `fixtureRef`를
모두 요구한다. `catalogMode=unsupported`는 두 fixture 필드를 금지한다. 잘못된 축의 예외와 각
필드 의존 위반은 축별 음성 fixture로 실패시킨다.

의존 방향은 개발 전용 소스 → 제품 화면·provider 단방향이다. 금지 대상은 `src/dev/**`와 P4 decision
record가 확정한 catalog root·fixture root의 합집합이며, 이 root 집합을 decision commit SHA와 함께
검사기 설정에 결속한다. 제품 화면, kit, hook, 공용 provider는 이 집합을 import할 수 없다.
의존 그래프 검사와 위반 fixture가 이를 실패 폐쇄한다.
검사는 정적 import, 동적 `import()`, `require`, type-only import와 barrel re-export를 모두 해석한다.

## 6. 동기화 운영

서비스 오픈 전 **정상 운영 UI 변경**은 다음 순서로 한 변경 단위에서 처리한다.

1. 화면 ID와 세 표면 영향 범위를 레지스트리에서 확인한다.
2. 공용 토큰·컴포넌트 계약을 먼저 수정한다.
3. 기본 Expo에서 제품 동작과 시각을 검증한다.
4. 같은 구현을 소비하는 카탈로그에서 상태별 렌더를 검증한다.
5. 프로토타입 target과 가이드를 갱신하거나, 의도된 차이면 `divergent` 근거를 기록한다.
6. 레지스트리·렌더·접근성·국제화 감사를 재실행하고 정확한 SHA로 검수받는다.

어느 한 표면만 바꾼 커밋은 완료가 아니다. P2~P5 마이그레이션 중에는 항목별 담당·만료일과
미해결 상한을 가진 `three-surface-migration-backlog.json`을 사용한다. 이는 registry의
`migrationPending` 객체에서만 생성하는 읽기 전용 projection이며 고아·누락·수기 수정은 실패한다.
영구 divergent와 emergency `temporaryDivergence`는 포함하지 않는다. 상한 초과 또는 만료 시 다음
배치가 실패한다.

제품 긴급 수정은 지정된 승인자가 승인한 경우 먼저 배포할 수 있다. 승인자는
`docs/prototypes/three-surface-approvers.json`의 `PRODUCT-OWNER` 역할이어야 하고 `approvedBy`는 목록에
있으며 commit author와 달라야 한다. 승인자 목록과 baseline의 두 상한·migration deadline은 긴급 commit에서 수정할 수
없고 각각 별도 독립검수 commit으로만 바꾼다. 이때 레지스트리에 `temporaryDivergence` 객체를 남긴다. 만료 초과 또는
동시 예외 상한 초과는 검사기가 실패한다. 긴급 경로는 production 차단·Supabase allowlist·검사기
코드·승인자 목록·baseline의 두 상한·migration deadline을 수정할 수 없고 후속 정상 commit에서 세 표면을 다시
맞춘다. 승인자·상한 변경은 별도 독립검수 commit으로만 허용한다.

P2 전 `three-surface-baseline.json`에 `migrationBacklogMax`·`emergencyDivergenceMax`와
`migrationDeadlineUtc`를 각각 한 번
고정하며, 상한 변경은 별도 검수 commit에서만 허용한다. 같은 commit에서 상한을 높여 새 항목을
통과시키면 실패한다. P3·P5 항목의 `expiresAt`은 고정된 `migrationDeadlineUtc`보다 늦을 수 없다.
긴급 `temporaryDivergence.expiresAt`은 UTC ISO-8601이고
검사기는 committer date 기준 재현 모드와 현재 시각 운영 모드를 별도 PASS line으로 낸다. 평가 시각은
byte-stable 산출물 hash와 별도 필드로 기록한다. 만료일은 committer date보다 최대 7일 뒤까지만
허용한다. 두 종류 모두 현재 시각 만료 시 후속 동기화 commit 외 변경을 차단한다. 긴급 +8일과
마이그레이션 deadline 초과를 각각 음성 시험한다.

## 7. 품질 계약

- 기존 계산·RPC·원장 시험 결과가 바뀌지 않는다.
- 기본 Expo와 카탈로그는 동일 화면 컴포넌트를 사용한다. adapter JSX는 허용 provider 집합과 정확히
  한 개의 `sourceComponent`만 쓸 수 있고, 최대 중첩 깊이와 순서는 provider chain snapshot이 정한다.
  prop은 route param·fixture·provider 연결만 허용한다. 그 밖의 JSX, `StyleSheet`, inline style,
  데이터 계산은 실패한다. 허용 경계 양성 fixture와 추가 JSX·중첩 초과·style 음성 fixture를 둔다.
- 카탈로그 sentinel, route, fixture module은 native와 web **운영 산출물에 존재하지 않아야 한다**.
  런타임의 production 거부는 이 부재 검사의 보조 방어일 뿐 대체 증거가 아니다.
- 빌드 게이트는 transform 뒤에도 보존되는 sentinel로 ① 정상 production에서 부재, ② 채택 구조의
  decision record가 정한 production 강제 연결 절차에서 존재, ③ development에서 존재를 각기 독립
  PASS line으로 증명한다.
  Vitest 플래그 시험과 native·web bundle/route manifest 게이트를 분리한다.
- 제품 코드의 `src/dev/**` import 0건이며 위반 음성 시험이 통과한다.
- 운영 Supabase ref를 주입하면 카탈로그 부팅이 하드 실패한다.
- P4 구조 spike는 route manifest·app config·provider graph의 정적 diff gate만 실행한다. 첫 catalog
  sentinel·route·fixture가 들어간 뒤 exact review SHA와 protected pre-merge 환경에서
  `prototype:catalog:isolation`과 `prototype:catalog:imports`를 필수 실행한다. 문서 전용 중간 commit마다 번들을 요구하지 않지만,
  긴급 commit도 검수·병합 후보에서는 면제하지 않는다. `--no-bundle`은 두 gate를 충족하지 않는다.
- 화면 ID·라우트·prototype target·catalog entry의 양방향 미등록이 0건이다.
- 새 legacy 색 별칭과 임의 팔레트가 0건이며 3계층 토큰 계약을 통과한다.
- 320px, 글자 200%, 영어 스트레스, Android·iOS safe-area와 터치 영역을 검증한다.
- `catalogMode=route|fixture`에서 loading·empty·error·ready를 지원한다고 적은 화면은 각 상태가 실제로
  렌더돼야 한다. `unsupported`는 `states`를 선언할 수 없고 prototype 상태는 `prototypeTargets`가 소유한다.
- 동일 provider 계약은 import 문자열뿐 아니라 해석된 module identity/path와 order-sensitive provider
  chain snapshot이 일치해야 한다. provider 추가·삭제·순서 변경 음성 fixture를 둔다.
- 최신 제품 변경 때문에 과거 디자인 토큰 exact gate가 어긋난 부분은 삭제하거나 우회하지 않고,
  선언별로 기존 계약 유지·새 계약 승계·의도된 제외 중 하나로 분류해 새 기준선에 결속한다.

## 8. 범위 밖

- DB schema, RPC 공식, 운영 데이터 변경
- Expo SDK 업그레이드와 배포 인증서 작업
- 디자인 토큰 전면 재설계
- 프로토타입을 제품 코드로 직접 변환하는 작업
- 화면 카탈로그를 최종 사용자 기능이나 운영 관리자 화면으로 제공하는 작업
- 모든 화면을 한 커밋에서 일괄 치환하는 작업

## 9. 위험과 대응

| 위험 | 대응 |
|---|---|
| 최신 제품 화면이 완료된 디자인 기준선 이후 바뀜 | 단계 0에서 선언별 차이를 재분류하고 옛 exact gate를 조용히 완화하지 않음 |
| 카탈로그가 화면 복사본으로 분기 | source component 단일성 검사와 금지 규칙 |
| 카탈로그가 운영 데이터를 노출 | 별도 app root/build profile, 개발 계정·fixture만 허용, 운영 bundle 제외를 기계 검증 |
| dev 모듈이 제품 그래프로 역유입 | 제품→`src/dev/**` import 금지와 의존 그래프 음성 시험 |
| 동적 ID 화면이 재현되지 않음 | fixtureRef 필수, fixture 없는 화면은 `unsupported`로 가시화 |
| safe-area·탭바가 이중 반영 | 기본 앱과 같은 provider·좌표계 사용, 네이티브 측정 포함 |
| 프로토타입이 두 번째 디자인 정본이 됨 | 토큰 값은 `tokens.ts`만 수정하고 프로토타입은 소비·검증 대상으로 유지 |
| 범위가 커 검수 불가능 | 공용 규격 → 다섯 도메인 배치 → 카탈로그 → 최종 동기화로 커밋·검수 분리 |

## 10. 승인·검수 경계

- Opus 1차 자문 대상은 `63f066a8cb406deeedf15be19a393d6a741454ed`이며 판정은
  `CHANGES_REQUIRED`였다. 이 판본은 운영 격리·레지스트리 권위·fixture 경계·단계 게이트와
  `myHours.test.tsx` flake를 정정한 뒤 새 exact SHA로 재확인한다.
- Opus 2차 자문 대상은 `9ded66e2bbc5a58486aa9ae15b226a1aa3ceff9a`이며 판정은
  `CHANGES_REQUIRED`이다. Finding별 상태는
  자문 장부가 소유한다.
- Opus 3차 자문 대상은 `9da4e43559ce2d953652c7b279d7584365e3a519`이며 판정은
  `CHANGES_REQUIRED`이다. 기계 권위는 `advisory-ledger.json`, Markdown은 생성 projection이다.
  schema는 `findingId`·`round`·`severity`·`targetSection`·`disposition`·`closingSha`·`verifier`를
  요구한다. 완료 round의 모든 Finding이 있어야 하며 `closed`는 closing SHA 없이는 실패한다.
  `open|deferred|rejected-with-rationale`도 근거를 요구하고 P0 전 checker가 전수 대조한다.
- Opus 4차 자문 대상은 `08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d`, Opus 5차 자문 대상은
  `a02dec70b273e8db692f483b62bc5fbd18f9144b`이며 둘 다 `CHANGES_REQUIRED`였다. 대응은 같은
  기계 장부에 이어서 기록하고 새 exact SHA로 재검수한다.
- Opus 6차 자문 대상은 `776e7141cb620222e8d7015c90b65d8a2cc795b3`이며 `CHANGES_REQUIRED`였다.
- Opus 7차 자문 대상은 `6912a5ac7355237459126ffea41a1860e66f0d33`이며 `CHANGES_REQUIRED`였다.
- Opus 8차 자문 대상은 `7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e`이며 `CHANGES_REQUIRED`였다.
- 이 초안은 구현 전에 Opus의 `OPUS_DIRECT_ADVISORY` 검수를 받는다. 이는 사용자 요청에 따른
  계획 자문이며 Fable 승계나 R2/R3 종결 증거가 아니다. 자문 대상 exact SHA와 판정을 기록하고,
  자문 뒤 문서 bytes가 바뀌면 P0 착수 전에 같은 범위로 재확인한다.
- 구현 단계의 독립검수 기본 엔진은 `docs/ai-review/README.md`에 따라 Fable이다. 허용된 구조화
  한도·rate·capacity 승계가 아닌 수동 Opus 호출로 Fable 판정을 대체하지 않는다.
- 최소 검수점은 **P0 기준선·옛 gate 차이 분류**, 레지스트리 확정, 공용 레이아웃 pilot,
  **P3 각 도메인 배치**, 화면 카탈로그,
  프로토타입 동기화, 최종 종결이다. P3 묶음 검수는 하지 않는다.
- 각 검수는 정확한 target commit과 변경 파일을 명시하고, 검수 뒤 bytes가 바뀌면 다시 검수한다.
- P2 최초 구현 대상 `5cd55597dc1d464d514c81092e925b8facc3d03b`의 Opus 직접 자문 R1은
  `CHANGES_REQUIRED`였다. Finding 원문과 완료 조건은
  `docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P2-001/opus-direct-advisory-r1.md`에 보존한다.
  반영 exact SHA `338626231c6eef4483d32c09c9ec30c39e1b3688`의 R2는 `PASS`이며 원문은 같은
  디렉터리의 `opus-direct-advisory-r2.md`에 보존한다. 이는 Opus 승계 자문이지 Fable 공식 판정이 아니다.
  P3 진입 전에는 기존 S4 파일별 개수 계약이 공용 `COMPONENT.*` 소유권 이동을 검증하도록 별도
  rebaseline commit에서 승계 규칙을 닫는다.
- P3 최종 배치 승인 전 필수 CI 범위는 P0 기준선, 화면 레지스트리 sync, 시각 승인 manifest, byte artifact의
  네 결정론적 검사다. Playwright 재촬영은 고정 환경 evidence 생성 단계로 분리하고, protected gate는
  커밋된 blob·manifest·반응형 계약의 결속을 검증한다.
- **2026-09-09 사용자 승인:** 비차단 잔여를 보존하고 다른 도메인의 개발 후보 작업을 이어간다.
  개발 이동과 최종 종결을 분리하며, 위 CI·도메인별 공식 검수·네이티브·P4 조건을 면제하지 않는다.
  재현된 데이터 손상·필수 경로 오작동·공용 계약 위반은 먼저 수정한다. 세부 분류와 미완료 이관은
  세부실행서 §7의 현행 절차가 소유하며 과거 “P3 확대 전” 문구를 무한 개발 대기로 적용하지 않는다.

## 11. 완료 조건

다음이 모두 충족돼야 이 작업을 완료로 표시한다.

1. 기계 판독 화면 레지스트리와 양방향 검사기가 통과한다.
2. 기본 Expo 화면이 승인된 prototype 정보 구조를 공용 컴포넌트로 반영한다.
3. Expo 화면 카탈로그가 실제 제품 화면을 중복 없이 탭 메뉴로 렌더한다.
4. 카탈로그의 production 실패 폐쇄와 개발 fixture 격리가 시험으로 고정된다.
5. 프로토타입·기본 Expo·카탈로그의 미해결 차이가 0건이거나, 근거·담당·만료가 있는 예외로 정확히
   등록돼 있다.
6. 토큰·타입·모바일 시험·웹 번들·접근성·국제화·네이티브 검증과 프로젝트 필수 게이트가 통과한다.
7. 단계별 독립검수 Finding이 닫히고 최종 exact SHA가 기록된다. R0/R1은 계약상 허용된 로컬
   종결까지만 다루며, R2/R3와 운영 종결은 Fable 복구 표본 또는 사람의 exact-SHA 위험 수용을
   추가로 요구한다.
8. 운영 배포 여부는 별도 릴리스 결정으로 남아 있으며, 이 완료 선언에 포함되지 않는다.
