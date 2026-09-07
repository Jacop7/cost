# 프로토타입·Expo 3표면 동기화 기획안

> 상태: **Opus 1차 자문 반영 · 재검수 대기 초안**
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
- 상세·수정 화면처럼 ID가 필요한 화면은 `fixtureKind=stub|devSeedEntity` 중 하나와 `fixtureRef`를
  선언한다. `stub`은 제품 provider 바깥의 명시적 adapter 경계에서만 사용하고, `devSeedEntity`는
  버전 고정 seed/RPC 절차로 만든 ID만 받는다. DB 없는 환경에서는 후자를 `unsupported`로 표시한다.
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
| `fixtureRef` | stub 이름 또는 버전 고정 seed 엔터티 선택 규칙 |
| `states` | loading·empty·error·ready 등 검수 상태 |
| `parity` | `aligned`·`divergent`·`specOnly`·`expoOnly`·`temporaryDivergence` |
| `reason` | 불일치·제외의 근거와 후속 책임 |
| `owner`·`approvedBy`·`expiresAt` | 임시 차이의 담당·승인자·만료일 |

컬럼 소유를 분리한다. `screenId`·`domain`·`expoRoute`·`sourceComponent`·`prototypeTargets`는
README의 정식 ID, Expo route/AST, prototype registry에서 생성한다. `catalogMode`·`fixtureKind`·
`fixtureRef`·`states`·`parity`·`reason`과 임시 차이 메타데이터만 ID별 선언 파일에서 사람이 쓴다.
검사기는 두 입력을 합쳐 최종 레지스트리를 재생성하고 committed bytes와 일치하는지 확인한다.
생성 컬럼의 수기 편집은 실패한다. README의 구현 상태 블록은 최종 레지스트리에서 생성해 상태의
이중 권위를 없앤다.

검사기는 레지스트리와 Expo 라우트, 화면 ID 인벤토리, 프로토타입 target을 양방향 대조한다. 미등록
라우트나 target, 중복 ID, 존재하지 않는 파일, 근거 없는 제외는 실패한다. 다만 `specOnly`·
`expoOnly`·`unsupported`처럼 근거가 있는 선언 예외는 차집합에서 제외하지 않고 별도 목록으로
정확히 대조한다. 카탈로그의 탭 목록은 최종 레지스트리에서 생성하고 별도 배열을 두지 않는다.

의존 방향은 `src/dev/** → 제품 화면·provider` 단방향이다. 제품 화면, kit, hook, 공용 provider는
`src/dev/**`를 import할 수 없다. 의존 그래프 검사와 위반 fixture가 이를 실패 폐쇄한다.

## 6. 동기화 운영

서비스 오픈 전 **정상 운영 UI 변경**은 다음 순서로 한 변경 단위에서 처리한다.

1. 화면 ID와 세 표면 영향 범위를 레지스트리에서 확인한다.
2. 공용 토큰·컴포넌트 계약을 먼저 수정한다.
3. 기본 Expo에서 제품 동작과 시각을 검증한다.
4. 같은 구현을 소비하는 카탈로그에서 상태별 렌더를 검증한다.
5. 프로토타입 target과 가이드를 갱신하거나, 의도된 차이면 `divergent` 근거를 기록한다.
6. 레지스트리·렌더·접근성·국제화 감사를 재실행하고 정확한 SHA로 검수받는다.

어느 한 표면만 바꾼 커밋은 완료가 아니다. P2~P5 마이그레이션 중에는 항목별 담당·만료일과
미해결 상한을 가진 P5 대기 장부를 사용하며, 상한 초과 또는 만료 시 다음 배치가 실패한다.

제품 긴급 수정은 지정된 승인자가 승인한 경우 먼저 배포할 수 있다. 이때 레지스트리에
`temporaryDivergence`, `owner`, `approvedBy`, `expiresAt`, 영향 target을 남긴다. 만료 초과 또는
동시 예외 상한 초과는 검사기가 실패한다. 긴급 경로는 production 차단·Supabase allowlist·검사기
코드를 수정할 수 없고 후속 정상 commit에서 세 표면을 다시 맞춘다.

## 7. 품질 계약

- 기존 계산·RPC·원장 시험 결과가 바뀌지 않는다.
- 기본 Expo와 카탈로그는 동일 화면 컴포넌트를 사용한다. adapter는 route param·fixture 주입·provider
  연결만 허용하며 제품 JSX element tree·StyleSheet·데이터 계산을 선언하면 검사기가 실패한다.
- 카탈로그 sentinel, route, fixture module은 native와 web **운영 산출물에 존재하지 않아야 한다**.
  런타임의 production 거부는 이 부재 검사의 보조 방어일 뿐 대체 증거가 아니다.
- 동일 빌드 게이트가 production export/route manifest에서 sentinel 부재를, 개발 카탈로그
  export에서 sentinel 존재를 양성 대조한다. Vitest 플래그 시험과 번들 게이트를 분리한다.
- 제품 코드의 `src/dev/**` import 0건이며 위반 음성 시험이 통과한다.
- 운영 Supabase ref를 주입하면 카탈로그 부팅이 하드 실패한다.
- 화면 ID·라우트·prototype target·catalog entry의 양방향 미등록이 0건이다.
- 새 legacy 색 별칭과 임의 팔레트가 0건이며 3계층 토큰 계약을 통과한다.
- 320px, 글자 200%, 영어 스트레스, Android·iOS safe-area와 터치 영역을 검증한다.
- loading·empty·error·ready를 지원한다고 적은 화면은 각 상태가 실제로 렌더돼야 한다.
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
- 이 초안은 구현 전에 Opus의 `OPUS_DIRECT_ADVISORY` 검수를 받는다. 이는 사용자 요청에 따른
  계획 자문이며 Fable 승계나 R2/R3 종결 증거가 아니다. 자문 대상 exact SHA와 판정을 기록하고,
  자문 뒤 문서 bytes가 바뀌면 P0 착수 전에 같은 범위로 재확인한다.
- 구현 단계의 독립검수 기본 엔진은 `docs/ai-review/README.md`에 따라 Fable이다. 허용된 구조화
  한도·rate·capacity 승계가 아닌 수동 Opus 호출로 Fable 판정을 대체하지 않는다.
- 최소 검수점은 레지스트리 확정, 공용 레이아웃 pilot, **P3 각 도메인 배치**, 화면 카탈로그,
  프로토타입 동기화, 최종 종결이다. P3 묶음 검수는 하지 않는다.
- 각 검수는 정확한 target commit과 변경 파일을 명시하고, 검수 뒤 bytes가 바뀌면 다시 검수한다.

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
