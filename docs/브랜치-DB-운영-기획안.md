# 브랜치·DB 배포 운영 기획안 (개정 1판)

- **문서 위치**: `docs/브랜치-DB-운영-기획안.md` — 브랜치·DB 운영 규칙의 **단일 출처**.
- **참조 규칙**: `CLAUDE.md`·`AGENTS.md`는 이 문서를 한 줄로 참조한다(반영은 §10 문서 동기화 단계에서).
- **최종 수정**: 2026-08-26. §8의 상태 스냅샷은 이 날짜 기준이며, §8 완료 후 그 절은 이력으로만 남는다.

## 이번 개정에서 바뀐 것 (초안 대비)

1. 이 문서 자체의 보관 위치와 참조 규칙을 명시했다 — 채팅에만 있으면 아무도 못 따른다.
2. `docs/작업큐.md`의 **생성 시점**을 명시했다: 문서 동기화 때 만들고, 폴더 리팩터링(§9)보다 먼저 있어야 §9.2의 "발견 사항 등록" 규칙이 작동한다.
3. 운영 DB push 방지를 행동 규칙에서 **절차 장치**로 보강했다(§3.4) — `supabase migration list` 사전 대조, `push` 스크립트 격리.
4. 배포 태그 규칙을 정했다(§3.2): `deploy-YYYYMMDD`.
5. §8을 실제 진행 상태에 맞게 갱신했다 — 0132·0133·0134는 이미 커밋·푸시 완료. 남은 출발점은 워킹트리 정리부터다.
6. 빈 DB 재적용의 표준 수단을 저장소의 실물로 못박았다: `packages/db/scripts/fresh-db.sh` (`pnpm --filter @sikjae/db fresh-db`).
7. 예시 중복(§2.1 `fix/duplicate-inbound` ↔ §12 hotfix 예시)을 정리했다.

---

## 1. 목적

이 문서는 다음 문제를 방지하기 위한 브랜치 및 DB 운영 기준이다.

- 하나의 기능 브랜치에 여러 메뉴와 DB 변경이 장기간 누적되는 문제
- 앱 코드보다 운영 DB 스키마가 먼저 변경되는 문제
- 병렬 DB 브랜치의 마이그레이션 번호 충돌
- 선행 기능이 병합되지 않은 상태에서 후속 기능을 개발하는 문제
- 이미 구현된 기능을 소급해서 여러 브랜치로 분리하는 위험
- 브랜치명이 지나치게 길거나 화면 ID에 의존하는 문제
- 문서와 실제 구현 상태가 달라지는 문제

핵심 원칙:

1. 브랜치는 레이어가 아닌 **완결된 사용자 기능을 세로로 관통**한다.
2. DB를 변경하는 작업 브랜치는 **동시에 하나만** 연다.
3. 마이그레이션은 기능 브랜치에서 **로컬 DB로만** 검증한다.
4. 운영 DB에는 **`main`에 포함된 마이그레이션만** 적용한다.
5. 별도 스테이징 DB가 생기기 전까지 `dev` 브랜치를 만들지 않는다.
6. 이미 구현된 기능도 수정할 때마다 **새로운 단명 브랜치**를 만든다.
7. 브랜치명은 짧게 유지하고 화면 ID는 작업 큐와 PR에서 관리한다.
8. 현재 대형 브랜치는 소급 분리하지 않고 검증 후 `main`에 병합한다.

## 2. 환경에 따른 브랜치 구조

### 2.1 현재 기본안: 단일 실 Supabase 프로젝트

별도 스테이징 DB가 없으므로 `dev`를 두지 않는다.

```
main
└─ feat/* 또는 fix/*
```

역할:

- `main`: 운영 앱과 운영 DB의 기준
- `feat/*`: 신규 기능 및 기존 기능 개선
- `fix/*`: 결함 수정
- `refactor/*`: 동작 변경 없는 구조 개선
- `docs/*` · `test/*` · `chore/*`: 문서 · 회귀 테스트 보강 · 도구/설정
- `hotfix/*`: 첫 운영 배포 이후 긴급 수정 (§12)

기능 브랜치는 `main`에서 만들고 검증 후 다시 `main`으로 병합한다.

```
main
└─ feat/purchase-history-filter
       ↓ 병합
main
└─ fix/duplicate-inbound
```

### 2.2 향후 선택안: 별도 스테이징 DB 도입

다음 환경이 **전부** 준비된 시점에만 `dev`를 도입한다.

- 운영 Supabase와 분리된 스테이징 Supabase
- `dev` 앱이 스테이징 DB를 바라보는 환경 설정
- `main`만 운영 Supabase에 접근하는 배포 통제
- 브랜치별 DB push 권한 또는 CI 배포 규칙

그때의 구조와 적용 시점:

```
main          운영 코드 + 운영 Supabase
└─ dev        다음 배포 통합 + 스테이징 Supabase
   └─ feat/*  로컬 Supabase로 개발·검증
```

- `feat/*` 개발 중: 로컬 DB만 사용
- `feat/* → dev` 병합: 스테이징 DB에 마이그레이션 적용
- `dev → main` 병합: 운영 DB에 마이그레이션 적용
- 운영 앱 배포: 운영 DB 적용 이후 진행

**스테이징 DB 없이 `dev`만 두는 것은 DB 게이트 역할을 하지 못하므로 채택하지 않는다.**

## 3. DB 적용 게이트

### 3.1 절대 규칙

**기능 브랜치에서 운영 Supabase 프로젝트로 마이그레이션을 push하지 않는다.**

기능 개발 중에는 다음 환경만 사용한다 (`packages/db`의 스크립트 기준).

| 용도 | 명령 |
|---|---|
| 로컬 Supabase 기동 | `pnpm --filter @sikjae/db start` |
| 개발 DB 초기화(마이그레이션+시드) | `pnpm --filter @sikjae/db reset` |
| **빈 DB 전체 재적용** (일회용 `fresh_*` DB) | `pnpm --filter @sikjae/db fresh-db fresh_a` |
| DB 회귀 테스트 | `pnpm --filter @sikjae/db test` (새 DB 대상: `PGDATABASE=fresh_a node packages/db/tests/run.mjs`) |
| 생성 타입 갱신(로컬 기준) | `pnpm --filter @sikjae/db gen:types` |

`reset`은 손으로 하나씩 태운 개발 DB를 못 잡는 순서·시드 문제를 놓칠 수 있으므로,
**병합 전 검증은 반드시 `fresh-db`(빈 DB 전체 재적용)로 한다** — 0129·0130이 실제로 여기서만 잡혔다.

운영 DB에는 다음 조건을 **모두** 만족한 마이그레이션만 적용한다.

- 해당 마이그레이션이 `main`에 병합되어 있음
- 빈 DB 전체 재적용(`fresh-db`)이 통과함
- DB 회귀 테스트가 통과함
- 앱과 생성 타입이 해당 스키마와 일치함
- 배포 대상 커밋 또는 태그가 명확함

### 3.2 운영 배포 순서

추가형·하위 호환 마이그레이션의 기본 배포 순서:

1. 기능 브랜치를 `main`에 병합
2. 배포 태그 확정 — **`deploy-YYYYMMDD`** (같은 날 2회부터 `deploy-YYYYMMDD-2`).
   앱 스토어 배포가 시작되면 앱 버전은 semver를 병행하되, DB 배포 태그는 이 규칙을 유지한다.
3. `supabase migration list`로 로컬 이력과 운영 적용 이력 대조
4. 운영 DB에 `main`의 마이그레이션 적용
5. DB 적용 성공과 사후조건 확인
6. 앱 배포
7. 주요 사용자 흐름 점검

기존 앱을 깨뜨릴 수 있는 변경은 **확장 → 전환 → 정리** 순서로 나눈다.

```
1차: 새 컬럼·새 함수 추가        (구 앱도 동작)
2차: 앱이 새 계약 사용
3차: 구 계약 제거               (구 앱이 더 없을 때)
```

한 단계가 한 브랜치다. 세 단계를 한 브랜치에 합치지 않는다.

### 3.3 운영 DB가 이미 `main`보다 앞선 경우

현재 기능 브랜치의 마이그레이션이 실 프로젝트에 이미 적용됐다면 다음 순서로 정리한다.

1. `supabase migration list`로 운영 DB에 적용된 마이그레이션 목록 확인
2. 해당 파일이 현재 기능 브랜치에 모두 존재하는지 확인
3. 로컬 빈 DB(`fresh-db`)에서 동일 순서로 재적용
4. 전체 테스트
5. 기능 브랜치를 신속하게 `main`에 병합
6. `supabase migration list`로 운영 DB와 `main`의 이력 일치 확인

**공유 DB에 적용된 마이그레이션은 수정·삭제·이름 변경·순서 변경하지 않는다.**

### 3.4 운영 push 사고 방지 장치

체크리스트만으로는 부족하다. 실수 한 번의 비용이 크므로 절차를 장치로 만든다.

- **운영 push는 배포 절차(§3.2) 안에서만** 실행한다. 습관적 `db push`를 금지한다.
- push 전에 **반드시 `supabase migration list`를 먼저** 실행해 적용될 파일 목록을 눈으로 확인한다.
- `packages/db`의 `push` 스크립트는 현재 `supabase db push` 그대로 노출되어 있다.
  오타·습관 실행을 막기 위해 **`push` → `push:prod` 등 의도가 드러나는 이름으로 변경**하는
  작업을 `docs/작업큐.md`에 등록한다(코드 변경이므로 이 문서에서는 규칙만 정한다).
- 평소 개발은 `start`/`reset`/`fresh-db`/`test`/`gen:types`만 사용한다 — 전부 로컬 대상이다.

## 4. 마이그레이션 직렬화

### 4.1 동시 작업 제한

**DB를 변경하는 작업 브랜치는 동시에 하나만 연다.**

DB 변경으로 보는 범위: 마이그레이션 추가 · 테이블/컬럼/제약 변경 · RPC 추가/수정 · RLS 변경 ·
트리거/DB 함수 변경 · 생성 DB 타입 변경 · seed 구조 변경.

첫 번째 DB 브랜치가 `main`에 병합되기 전에는 다음 DB 브랜치를 시작하지 않는다.

```
main
└─ feat/business-hours-break
       ↓ 병합 완료
main
└─ feat/partial-inbound
```

DB를 건드리지 않는 문서나 독립 UI 작업은 병렬 진행할 수 있다.
다만 동일 화면이나 import 경로를 건드리면 순차 진행한다.

### 4.2 마이그레이션 번호

- 날짜+순번 규칙(`YYYYMMDD000NNN_이름.sql`)을 유지한다.
- **의도된 결번은 그대로 둔다** — 결번(089, 094~097, 099~100, 103~104, 112, 126 등)은 오류가 아니다.
- 이미 사용한 번호를 다시 사용하지 않고, 번호를 당기지 않는다.
- 공유 DB에 적용된 파일은 수정·삭제·개명·순서 변경하지 않는다.
- 충돌이 발생하면 기존 이력을 바꾸지 않고 **새 번호로 보완 마이그레이션**을 추가한다.
- 파일 순서와 의존성은 `fresh-db`(빈 DB 전체 재적용)로 검증한다.

### 4.3 DB 브랜치 필수 구성

DB 기능 브랜치는 필요한 레이어를 **한 브랜치에** 함께 포함한다.

```
feat/partial-inbound
├─ apps/mobile                     화면·훅·쿼리 무효화
├─ packages/db/supabase/migrations 마이그레이션
├─ packages/db/tests               DB 회귀 테스트
├─ packages/db/src/database.types.ts 생성 타입
├─ packages/core (+tests)          동일 공식 미러·검산
├─ packages/types                  데이터 계약
└─ 관련 문서                        features/README.md 인벤토리 등
```

앱·DB·core·types를 레이어별 브랜치로 분리하지 않는다.

## 5. 작업 큐

### 5.1 단일 관리 문서

모든 예정 작업과 브랜치 메타데이터는 **`docs/작업큐.md`** 한 파일에서 관리한다.

- 이 파일은 **§10 문서 동기화 단계에서 생성**한다. §9 폴더 리팩터링보다 먼저 있어야
  §9.2의 "발견된 개선은 작업큐에 등록" 규칙이 작동한다.
- 초기 항목으로 최소한 다음을 등록한다:
  ① 폴더 경계 리팩터링(§9) ② `push` 스크립트 개명(§3.4) ③ 문서 동기화 잔여분(§10).
- 브랜치는 실제 작업을 시작할 때만 생성한다. 큐에 이름이 있다고 미리 브랜치를 만들지 않는다.

### 5.2 작업 항목 형식

```yaml
title: 구매 이력 기간 필터
status: 대기            # 대기 | 진행 | 병합 완료
planned_branch: feat/purchase-history-filter
base: main
screen_ids: [ING-09]
depends_on: []
touches:
  - apps/mobile/src/features/ingredients
  - packages/db
propagation: [E1]
migration: required
database_target: local-only
acceptance:
  - 기간 필터가 서버 조회에 반영됨
  - 입고 후 구매 이력이 갱신됨
  - fresh-db 재적용 통과
  - DB 회귀 테스트 통과
notes:
  - 기존 ING-09의 후속 개선
```

화면 ID는 브랜치명이 아니라 `screen_ids`에서 관리한다.

### 5.3 작업 시작 조건

다음을 확인한 뒤 브랜치를 생성한다.

- 선행 작업(`depends_on`)이 `main`에 병합됨
- 다른 DB 변경 브랜치가 열려 있지 않음
- 작업 범위와 완료 조건(`acceptance`)이 작성됨
- 영향받는 전파 이벤트가 기록됨
- 마이그레이션 필요 여부가 정해짐
- 로컬 DB 검증 환경이 준비됨

## 6. 브랜치 의존 순서

브랜치 목록은 평평한 병렬 트리가 아니라 **순차 작업 큐**다.
아래는 기존 기능을 다시 구현하라는 뜻이 아니라, **해당 영역에 후속 개선이 생겼을 때
어떤 계약이 먼저 필요한지**를 보여 주는 의존 참조표다.

```
공통 업무 규칙          ├─ 그 규칙을 소비하는 메뉴 기능
                        └─ 그 규칙의 화면 개선

재고 원장 계약          ├─ 부족 판정 후속 개선
                        ├─ 발주 후보 후속 개선
                        └─ 판매 소진 후속 개선

영업일 계약             ├─ 발주일·입고일 후속 개선
                        ├─ 폐기·실사일 후속 개선
                        └─ 월 손익 후속 개선

세금 계약               ├─ 레시피 손익 후속 개선
                        ├─ 매출 세금 상세 후속 개선
                        └─ 기타 매출 세금 후속 개선
```

선행 계약이 아직 병합되지 않았다면 후속 브랜치를 만들지 않는다.

## 7. 브랜치 명명 규칙

### 7.1 기본 형식

```
<작업유형>/<기능영역>-<변경목적>
```

예: `feat/purchase-history-filter` · `fix/tax-rounding` · `feat/partial-inbound` ·
`fix/overnight-date` · `refactor/settings-hooks`

### 7.2 길이 기준

`/` 뒤 이름은:

- 2~4개 단어, 20~40자 안쪽 권장
- 짧게 읽어도 작업 목적이 구분되어야 함
- 저장소 안에서 자명한 상위 도메인은 생략 가능
- 전체 화면명·폴더 경로·화면 ID를 넣지 않음

| 판정 | 예 |
|---|---|
| 좋음 | `feat/purchase-history-filter` · `fix/sale-stock-refresh` · `refactor/business-date` |
| 김 | `feat/ingredient-purchase-history-date-filter` |
| 모호 | `feat/filter` · `fix/error` · `fix/calculation` |

### 7.3 화면 ID 관리

화면 ID는 **작업 큐(`screen_ids`)와 PR 제목**에서 관리한다.

```
PR 제목: [ING-09] 구매 이력 기간 필터 추가
여러 화면: [SALES-01·ING-01·ORD-01] 판매 후 재고 갱신 수정  (branch: fix/sale-stock-refresh)
```

### 7.4 작업 유형별 예시

- feat: `feat/profit-history-detail` · `feat/comparison-period` · `feat/business-hours-break`
- fix: `fix/purchase-history-price` · `fix/duplicate-inbound` · `fix/overnight-date`
- refactor: `refactor/domain-boundaries` · `refactor/settings-hooks`
- 기타: `docs/project-state` · `test/inbound-regression` · `chore/db-test-runner`

### 7.5 기존 기능 수정

기존 기능은 계속 수정할 수 있지만 최초 구현 브랜치를 다시 사용하지 않는다.
기능의 현재 상태는 `main`에 있고, 작업 브랜치는 **이번 변경만** 담는다.

```
구매 이력
├─ 최초 구현 브랜치              병합 후 삭제
├─ feat/purchase-history-filter
├─ fix/purchase-history-price
└─ refactor/history-pagination
```

### 7.6 브랜치 종료

다음을 충족한 뒤 브랜치를 삭제한다.

- 대상 브랜치에 병합됨 · 로컬/CI 검증 통과 · 관련 문서 갱신
- **로컬 브랜치와 원격 브랜치 모두 삭제**
- `docs/작업큐.md`의 해당 항목을 `병합 완료`로 변경

## 8. 현재 대형 브랜치 처리

`feat/locale-currency-settings`는 **소급 분리하지 않는다.**
범위가 언어·통화를 넘어 실데이터 전환·재고 원장·손익·발주/입고·매출/분석·수정 이력·
세금/고정지출·영업일/영업시간·음수 재고·영업 규칙 버전 관리까지 확장됐지만,
마이그레이션과 후속 수정의 순차 의존성이 커서 나누는 쪽이 더 위험하다.

### 8.0 상태 스냅샷 (2026-08-26 기준)

- `main` 대비 **131커밋**, 마이그레이션 **123개**(~`0134_lock_order_and_truncate`), DB 테스트 26개.
- 0132(규칙 쓰기 가드)·0133·0134는 **이미 커밋·푸시 완료**(`d6d8961`, origin 동기화됨).
- 빈 DB 재적용 스크립트 `packages/db/scripts/fresh-db.sh`가 저장소에 반영됨.
- 워킹트리 잔여: `.claude/settings.json`(+10줄) · `fresh-db.sh` 후속 수정 — 아래 1단계의 대상.
- 운영 Supabase에는 이 브랜치의 마이그레이션이 이미 적용되어 있다 → §3.3 상황이며,
  아래 절차가 그 정리 순서다.

### 8.1 남은 처리 순서

1. **워킹트리 정리**: `.claude/settings.json`(로컬 권한 설정)과 `fresh-db.sh` 수정분의
   포함/제외를 판단해 커밋 또는 되돌리기 — 병합 대상에 의도치 않은 파일이 없어야 한다.
2. 새로운 기능 개발 중단 (병합 완료까지)
3. 빈 DB 전체 재적용: `pnpm --filter @sikjae/db fresh-db fresh_merge`
4. DB 테스트 전체 통과: `PGDATABASE=fresh_merge node packages/db/tests/run.mjs`
5. core 검산·SQL 패리티 테스트, 앱 타입 검사, 주요 화면 흐름 검증
6. `supabase migration list`로 운영 DB 적용 이력과 브랜치 파일 대조 (§3.3)
7. `feat/locale-currency-settings → main` **일반 merge** (squash 금지)
8. 병합 후 운영 DB와 `main`의 이력 일치 재확인
9. 로컬 브랜치 및 `origin/feat/locale-currency-settings` 삭제
10. 문서 동기화 (§10) — **이때 `docs/작업큐.md` 생성**
11. 폴더 경계 리팩터링 (§9)
12. 다음 기능 작업 시작 (§5.3 조건 확인 후)

### 8.2 병합 방식

- 일반 merge commit. **squash 금지.**
- 근거: 커밋이 설계 결정의 이력(0125~0134의 수정 순서)이고, 마이그레이션과 후속 보완의
  관계 추적·장애 시 원인 커밋 추적에 필요하다.
- 향후 단명 브랜치는 작업 성격에 따라 squash할 수 있다 (§11).

## 9. 폴더 경계 리팩터링

대형 브랜치를 `main`에 병합한 **직후**, 새 기능을 시작하기 **전에**
`refactor/domain-boundaries` 단독 브랜치로 수행한다.

### 9.1 이동 대상

```
features/sales/businessDay.ts                → features/business-day/businessDay.ts
features/sales/components/BusinessDateGate.tsx → features/business-day/components/BusinessDateGate.tsx
features/sales/period.ts의 순수 날짜 함수      → src/lib/date.ts
features/my/hooks.ts의 공용 설정 조회          → features/settings/hooks.ts
features/my/hooks.ts의 카테고리·거래처·채널     → features/master-data/hooks.ts
features/ingredients/components/HistoryLayout.tsx → components/history/HistoryLayout.tsx
```

고정지출·세금은 사용 범위를 기준으로 `features/fixed-costs` · `features/tax` 분리를 검토한다.

### 9.2 제한

- 동작 변경 금지 · 마이그레이션 추가 금지 · RPC 계약 변경 금지 · 화면 기능 추가 금지
- import 경로와 모듈 책임만 정리
- 전체 타입 검사와 주요 화면 진입 검증
- **`features/README.md`의 화면 인벤토리 경로 갱신을 이 브랜치에 포함**한다(경로가 바뀌므로)
- 작업 중 발견된 기능 개선은 고치지 말고 `docs/작업큐.md`에 등록한다

## 10. 문서 동기화

동기화 대상 (순서대로):

1. **`docs/브랜치-DB-운영-기획안.md`** — 이 문서. §8 완료 시 8.0 스냅샷에 완료 표시.
2. **`docs/작업큐.md`** — 신규 생성 (§5.1의 초기 항목 포함).
3. `CLAUDE.md` — 4탭 → **5탭(식재료·레시피·발주·매출·MY)**, `SALES-` ID 추가,
   "데이터는 `demoData.ts`(임시)" 문구 삭제(실데이터 전환 완료), "Supabase 연결 예정" 제거,
   `fresh-db` 검증 절차와 이 문서 참조 추가.
4. `AGENTS.md` — 탭 구조·절대 원칙 최신화, 이 문서 참조 추가.
5. `README.md` — 프로젝트 소개·시작 방법 최신화.
6. `ARCHITECTURE.md` — 데이터 흐름·전파 계약을 최신 범위(E1~E10, E6 없음)로.
7. `apps/mobile/src/features/README.md` — 화면 인벤토리 **단일 출처** 유지.
8. `packages/db/README.md` — 마이그레이션 운영·결번은 오류가 아님·`fresh-db` 사용법.

반영할 현재 사실: 5탭 · `SALES-` 체계 실재 · `demoData.ts` 전부 삭제됨 · 주요 화면 실데이터 사용 ·
전파 이벤트 최신 범위 · 마이그레이션/테스트 구조 · 의도된 결번.
화면 구현 상태는 `features/README.md`를 단일 출처로 하고 다른 문서는 참조만 한다.

## 11. 병합 정책

| 대상 | 방식 |
|---|---|
| 현재 대형 브랜치 → `main` | 일반 merge, **squash 금지**, 이력 보존, 병합 후 로컬·원격 삭제 |
| 향후 단명 브랜치 → `main` | squash 허용. 중요한 DB 설계 이력이 있으면 일반 merge |
| `hotfix/*` → `main` | §12 절차. `dev` 도입 후에는 `main → dev` 역병합 |
| (`dev` 도입 후) `feat/* → dev` | squash 또는 일반 merge |
| (`dev` 도입 후) `dev → main` | **squash 금지** |

병합된 기능 브랜치는 로컬·원격 모두 삭제한다.

## 12. Hotfix 정책

첫 운영 배포 전에는 hotfix 레인을 활성화하지 않는다.
첫 운영 배포 이후 긴급 장애에만 사용한다. 예: `hotfix/close-day-crash`

1. `main`에서 분기 → 2. 최소 범위 수정 → 3. 로컬 DB(`fresh-db`)와 회귀 테스트 →
4. `main` 병합 → 5. 운영 배포(§3.2 태그 포함) → 6. `dev`가 있으면 역병합 → 7. 원격 브랜치 삭제

**DB hotfix도 운영 DB에서 직접 SQL을 수정하지 않고 마이그레이션 파일로 남긴다.**

## 13. 작업별 검증 기준

**DB 변경 작업**

- `fresh-db` 빈 DB 전체 재적용 통과
- DB 테스트 전체 통과 (`pnpm --filter @sikjae/db test` + 새 DB 대상 재실행)
- `supabase migration list` 이력 확인
- 생성 타입 갱신 (`gen:types`, 로컬 기준)
- core 공식과 SQL 공식 일치 (검산 기준값 3종 포함)
- 관련 전파 이벤트 검증
- **운영 DB push 없음 확인 (§3.4)**

**앱 기능 작업**

- 타입 검사 · 저장 후 재조회 · 로딩/오류/재시도 상태
- 관련 쿼리 무효화 · 영향받는 다른 메뉴 갱신
- `features/README.md` 화면 인벤토리 갱신

**`main` 병합 전**

- 워킹트리 범위 확인(로컬 설정 파일 제외 확인)
- 전체 회귀 테스트 + `fresh-db` 재적용
- 배포 순서(§3.2) 확인 · 문서 갱신 · 원격 브랜치 삭제 계획 확인

## 14. 최종 운영 원칙

1. 현재는 **`main` + 단명 브랜치** 구조를 사용한다.
2. 별도 스테이징 DB가 생길 때만 `dev`를 도입한다.
3. 기능 브랜치에서는 운영 DB에 마이그레이션을 적용하지 않는다.
4. 운영 push는 배포 절차 안에서만, `migration list` 대조 후 실행한다.
5. DB 변경 브랜치는 동시에 하나만 연다.
6. 브랜치는 작업 착수 시 생성하고 병합 후 로컬·원격 모두 삭제한다.
7. 기존 기능 수정도 매번 새로운 브랜치에서 진행한다.
8. 브랜치명은 기능 영역과 변경 목적을 2~4개 단어로 표현한다.
9. 화면 ID는 브랜치명이 아니라 작업 큐와 PR 제목에서 관리한다.
10. 여러 화면에 걸치는 기능은 업무 규칙이나 전파 이름을 사용한다.
11. 앱·DB·core·types를 레이어별 브랜치로 분리하지 않는다.
12. 선행 의존성은 `docs/작업큐.md`에 기록하고, 선행 미병합 시 착수하지 않는다.
13. 이미 구현된 기능 이름은 후속 개선의 의존 참조로만 사용한다.
14. 현재 대형 브랜치는 소급 분리하거나 squash하지 않는다.
15. 마이그레이션 결번은 유지하고 `fresh-db` 재적용으로 검증한다.
16. 운영 배포는 `deploy-YYYYMMDD` 태그로 남긴다.
17. 폴더 경계 리팩터링은 대형 브랜치 병합 직후 단독으로 수행한다.
18. 문서는 이 문서와 `features/README.md`를 단일 출처로 실제 코드와 지속 동기화한다.
