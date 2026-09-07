# 프로토타입·Expo 3표면 동기화 세부 실행서

> 상태: **Opus 자문 검수 대기 초안**
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

기본 작업 폴더의 다른 장기 작업 변경과 `.tmp` 전체를 삭제하지 않는다. 이 실행서는 격리 worktree만
소유한다. 다른 변경을 발견하면 경로·소유 커밋을 확인하기 전 이동·삭제·스테이징하지 않는다.

### 1.2 현재 검증 사실

- 앱 타입 검사 통과
- 모바일 시험 233/233 통과
- legacy 색 별칭 0건, 색 역할 감사 통과
- 과거 S4 exact 디자인 계약은 최신 제품 화면이 기준선 이후 변경되어 현재 실패한다. 이 실패는 제품
  회귀로 확정된 것도, 무시 가능한 낡은 검사로 확정된 것도 아니다. 단계 0에서 선언별로 분류한다.
- 운영·스테이징에는 이 브랜치 변경을 적용하지 않았다.

## 2. 산출물 계획

| 산출물 | 제안 경로 | 책임 |
|---|---|---|
| 화면 레지스트리 | `apps/mobile/src/dev/surfaceRegistry.json` | 세 표면의 기계 판독 대응 관계 |
| 레지스트리 타입·로더 | `apps/mobile/src/dev/surfaceRegistry.ts` | schema, fail-closed validation |
| 화면 카탈로그 | `apps/mobile/catalog-app/**` 또는 별도 `apps/mobile-catalog/**` | 제품 route tree와 분리한 개발 전용 탭형 진입점 |
| fixture 경계 | `apps/mobile/src/dev/catalogFixtures/**` | 동적 화면의 비운영 재현 데이터 |
| 동기화 검사 | `scripts/three-surface-sync-check.mjs` | route·ID·prototype·catalog 양방향 대조 |
| 카탈로그 격리 시험 | `apps/mobile/tests/surfaceCatalog.test.tsx` | 중복 렌더·production 차단·fixture 검증 |
| 기준선 산출물 | `docs/prototypes/three-surface-baseline.json` | 대상 SHA·차이·예외 목록 |
| 검수 기록 | `docs/ai-review/tasks/<TASK-ID>/**` | Fable/승계 규칙에 따른 exact-SHA 검수 |

경로는 단계 1 검수에서 저장소 구조와 충돌이 발견되면 바꿀 수 있다. 단, 레지스트리를 문서와 코드에
두 벌로 만들지 않고 한 기계 원본에서 파생한다는 원칙은 고정한다.

## 3. 전체 단계

| 단계 | 목적 | 완료 증거 | 독립검수 |
|---|---|---|---|
| P0 | 기준선·옛 gate 차이 분류 | baseline JSON, 선언별 disposition | 구조 checkpoint |
| P1 | 화면 레지스트리와 검사기 | orphan·duplicate·stale 0 | 필수 |
| P2 | 공용 레이아웃 pilot | 대표 5화면, 비의도 동작 diff 0 | 필수 |
| P3 | 기본 Expo 도메인별 적용 | 다섯 탭 배치 완료 | 배치별 또는 묶음 |
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
3. 최신 화면·라우트·프로토타입 target 인벤토리를 보존된 스크립트로 다시 측정한다.
4. 기준선 JSON에 입력 commit, 스크립트 hash, 결과 hash를 결속한다.

### 금지

- gate를 초록으로 만들기 위해 허용 목록만 넓히기
- 새 제품 화면을 감사 대상에서 제외하기
- 이전 디자인 토큰 완료를 취소했다고 표현하기

### 완료 조건

- 미분류 선언·화면·target 0건
- 기준선 재실행 가능
- 기존 mobile 시험 233/233와 타입 검사 유지
- P0 변경은 문서·감사기·정정만 포함하며 화면 시각 변경은 0건

## 5. P1 — 화면 레지스트리

### 작업

1. `apps/mobile/src/features/README.md`의 정식 화면 ID와 expo-router 파일을 AST/파일 시스템으로 읽는다.
2. 프로토타입의 screen·popup registry를 파서로 읽는다. HTML 정규식 한 번으로 완료 판정하지 않는다.
3. 기획안 §5의 필드를 갖는 레지스트리를 만든다.
4. 레지스트리에서 카탈로그 탭 항목과 검수 대상 목록을 생성한다.
5. 다음 음성 시험을 추가한다.
   - Expo route 하나 삭제·추가
   - prototype target 하나 삭제·추가
   - 중복 screenId
   - 존재하지 않는 source component
   - fixtureRef 없는 동적 route
   - 근거 없는 `unsupported`·`specOnly`

### 완료 조건

- Expo route ↔ 화면 ID ↔ prototype target ↔ catalog entry 양방향 차집합 0
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

### 완료 조건

- 다섯 대표 화면의 제품 기능 시험 유지
- 새 임의 색·간격·반경 팔레트 0건
- 공용화할 패턴을 화면별 복사로 구현한 사례 0건
- 320px·200% 글자·영어·Android·iOS safe-area 점검
- P2 exact SHA 독립검수 PASS 후에만 P3 확대

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
5. prototype 차이는 아직 수정하지 않고 P5 대기 목록에 자동 등록한다.

### 완료 조건

- 다섯 도메인의 등록 화면이 새 레이아웃 계약을 소비
- 도메인 훅·query key·RPC 호출 계약 diff 0 또는 별도 승인 작업
- 화면별 하드코딩 감소가 감사 산출물로 확인되고 새 자유 스케일 0건
- 배치별 필수 시험 통과

## 8. P4 — Expo 화면 카탈로그

### 선택 구조

1. 먼저 SDK 54에서 별도 Expo Router app root와 build profile이 production route manifest와 bundle에서
   카탈로그 파일을 실제로 제외하는지 최소 spike로 증명한다.
2. 증명되면 `apps/mobile/catalog-app/**`를 사용하고, 증명되지 않으면 별도 workspace
   `apps/mobile-catalog/**`로 분리한다. 제품 `app/` 아래 숨은 `__catalog` route는 채택하지 않는다.
3. 카탈로그 shell과 기계 생성한 얇은 route adapter만 새로 만들고, 화면 내용은 등록된
   `sourceComponent`를 재사용한다. adapter에 제품 JSX나 데이터 계산을 복제하지 않는다.
- 탭은 도메인 → 화면 ID → 상태 순으로 탐색한다.
- 화면 전환은 deep link를 복사할 수 있어야 하며 동일 화면·상태를 다시 열 수 있어야 한다.

### 운영 차단

1. production route manifest와 bundle에 catalog route·fixture module이 포함되지 않아야 한다.
2. 개발 플래그 이름과 기본값을 하나로 고정하고 기본값은 false다.
3. 운영 Supabase ref, 운영 사용자, 임의 첫 행 조회를 fixture로 금지한다.
4. fixture 데이터는 계산 정본을 흉내 내지 않는다. 서버 계산 결과가 필요한 화면은 개발 DB의
   명시적 seed/RPC 결과를 사용한다.

### 완료 조건

- 기본 Expo와 카탈로그 사이 제품 화면 JSX 복사 0건
- 등록 가능 화면 전부 탭에서 접근 가능, 미지원 화면은 이유 표시
- production 플래그 음성 시험 PASS
- 동적 화면 fixture 결정성 시험 PASS
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
- 카탈로그 web smoke와 production 차단 시험
- Android·iOS 실기기 또는 승인된 동등 증거에서 safe-area·키보드·터치·200% 글자 확인

### 최종 독립검수

- Fable을 기본 엔진으로 exact target commit을 검수한다.
- Opus direct advisory를 Fable PASS로 표기하지 않는다.
- bytes가 바뀌면 이전 PASS는 무효이며 successor 또는 새 Task로 변경 diff를 재검수한다.
- R2/R3·운영 종결은 `docs/ai-review/README.md`의 Fable 복구 표본 또는 사람 exact-SHA 위험 수용
  조건을 그대로 적용한다.

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

## 12. 롤백

- 단계별 commit을 선형으로 유지하고 되돌릴 때 `git revert`를 사용한다.
- DB migration이 없으므로 화면 단계 롤백은 앱 코드·레지스트리·prototype 동기화 commit의 역적용이다.
- 카탈로그에 문제가 생기면 production 차단을 유지한 채 카탈로그 route만 비활성화할 수 있다.
- 공용 컴포넌트 롤백으로 여러 화면이 영향을 받으면 해당 컴포넌트와 소비 배치를 함께 되돌리고
  레지스트리 parity를 이전 상태로 복원한다.
- 기본 작업 폴더나 다른 worktree를 삭제하는 방식으로 롤백하지 않는다.
