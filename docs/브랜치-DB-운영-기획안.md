# 브랜치·DB 배포 운영 기획안 (개정 3판)

> **짝 문서**: [서버 확장 아키텍처 기획안](./서버-확장-아키텍처-기획안.md)
>
> 이 문서는 변경을 **어떻게 개발·검증·배포·복구하는가**의 단일 출처다.
> 서버 구성, 실행 위치, Queue·Edge Function·외부 Worker의 책임과 분리 조건은 짝 문서를 따른다.

- **문서 위치**: `docs/브랜치-DB-운영-기획안.md`
- **최종 수정**: 2026-08-29
- **현재 상태**: 개정 3판 승인·Git 추적 완료. 대형 기능 브랜치와 `TEST-1`, §10 폴더 경계
  리팩터링(`cceafb9`), §11 저장소 문서 동기화(`01c5358`)를 `main`에 fast-forward 병합했다.
  P1-1 감사 도구와 P1-2 CLI v2 로컬 전환 검증을 완료했고, 계정 삭제와 원장 보존 분리
  `P0-1`은 0173 전용 브랜치에서 구현·검증 중이다. 운영·스테이징 적용 이력은 아직 미확인이다.

## 문서 책임

| 문서                                                        | 답하는 질문                             | 단일 출처                                                   |
| ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| 이 문서                                                     | 변경을 어떻게 개발·검증·배포·복구하는가 | 브랜치, 환경, 마이그레이션, 배포 순서, 운영 권한, 복구 절차 |
| [서버 확장 아키텍처 기획안](./서버-확장-아키텍처-기획안.md) | 무엇을 어디서 실행하고 언제 분리하는가  | Supabase 구성, Queue·Edge·Worker, API 경계, 확장 조건       |
| `ARCHITECTURE.md`                                           | 도메인 데이터가 어떻게 계산·전파되는가  | 원장, 계산 권위, 전파 이벤트, 데이터 흐름                   |
| `apps/mobile/src/features/README.md`                        | 어떤 화면이 구현됐는가                  | 화면 ID와 구현 인벤토리                                     |

책임이 겹쳐 보일 때 최신 수정일이 아니라 **질문의 종류**로 단일 출처를 판단한다.

- 구조·분리 판단: 서버 확장 아키텍처 기획안
- 브랜치·배포·복구 방법: 이 문서
- 계산·원장 정합성: `ARCHITECTURE.md`, `AGENTS.md`, 마이그레이션과 회귀 시험
- 화면 구현 상태: `apps/mobile/src/features/README.md`

## 개정 이력

### 개정 3판 (2026-08-27)

1. 병합 전 저장소를 다시 측정했다: `main` 대비 189커밋, 마이그레이션 161개(~0172), DB 회귀
   시험 32개. 병합 후 결과는 §9.1에 갱신했다.
2. `pnpm verify`의 6단계를 로컬과 GitHub Actions `full-db-required`에서 실행하고,
   Node 20.19.4·24의 `--no-db` 4단계 빠른 검사와 구분했다.
3. 운영 DB 적용 여부를 단정하지 않고 원격 프로젝트 링크와 `migration list` 확인 전까지
   **미확인**으로 명시했다.
4. `main`이 직접 조상임을 확인하고 squash/rebase 없는 **fast-forward 병합**을 완료했다.
5. 스테이징 도입 시점을 “DB 작업 대기”가 아니라 **첫 실매장 데이터 이전**으로 앞당겼다.
6. 운영 Supabase 유료 전환, 백업·복구, ACL, Cron·Queue·Edge Function 배포 단위를 추가했다.
7. 서버 구조 상세는 짝 문서로 분리하고 이 문서에는 환경·검증·배포 게이트만 남겼다.

개정 1·2판의 유효한 원칙인 단명 기능 브랜치, DB 변경 직렬화, 마이그레이션 불변,
확장→전환→정리, 작업 큐, 폴더 경계 리팩터링은 유지한다.

---

## 1. 목적과 절대 원칙

이 문서는 다음 사고를 방지한다.

- 하나의 기능 브랜치에 여러 도메인과 DB 변경이 장기간 누적되는 문제
- 앱 코드보다 운영 DB 스키마가 먼저 변경되는 문제
- 병렬 DB 브랜치의 마이그레이션 번호 충돌
- 운영 데이터에서 직접 SQL을 고치고 이력이 저장소와 갈리는 문제
- DB·Edge Function·Cron·Queue·앱을 서로 다른 시점에 배포해 계약이 깨지는 문제
- 배포는 성공했지만 백업·복구·권한·관측 절차가 없는 문제
- 문서와 실제 저장소 상태가 달라지는 문제

핵심 원칙은 다음과 같다.

1. 브랜치는 레이어가 아니라 **완결된 사용자 기능을 세로로 관통**한다.
2. DB를 변경하는 작업 브랜치는 **동시에 하나만** 연다.
3. 기능 브랜치는 로컬 또는 스테이징에서 검증하고 운영 DB에 직접 push하지 않는다.
4. 운영에는 **`main`에 포함된 이력만** 적용한다.
5. 적용된 마이그레이션은 고치지 않고 새 마이그레이션으로 전진 복구한다.
6. 서버 단계가 바뀌어도 계산·재고·손익의 권위는 기존 DB RPC에 둔다.
7. 서버 구조 변경도 짝 문서의 책임 경계를 정한 뒤 이 문서의 작업 큐·검증·배포 게이트를 통과한다.
8. 운영 데이터가 들어간 뒤에는 “되돌리기”보다 **확장→전환→정리**와 전진 복구를 기본으로 한다.

## 2. 환경과 브랜치 구조

### 2.1 환경은 세 개로 구분한다

| 환경              | 목적                                            | 데이터             | 배포 주체                |
| ----------------- | ----------------------------------------------- | ------------------ | ------------------------ |
| 로컬 Supabase     | 기능 개발, 마이그레이션, 파괴적 시험, 경합 시험 | 시드·합성 데이터   | 개발자 로컬 명령         |
| 스테이징 Supabase | 운영과 같은 계약의 통합 검증                    | 합성·익명화 데이터 | CI 또는 승인된 배포 절차 |
| 운영 Supabase     | 실제 매장 서비스                                | 실제 데이터        | `main`의 승인된 배포만   |

운영 Supabase 유료 전환과 Git `dev` 브랜치 도입은 별개의 결정이다. 운영 프로젝트가 유료라고
장기 `dev` 브랜치를 만들 필요는 없다.

### 2.2 현재와 권장 브랜치 구조

기본 구조는 계속 단순하게 유지한다.

```text
main                         항상 배포 가능한 기준
└─ feat/* · fix/* · refactor/*   짧은 작업 브랜치
```

- 기능 브랜치는 `main`에서 만들고 완료 후 `main`으로 병합한다.
- `docs/*`, `test/*`, `chore/*`도 실제 작업을 시작할 때만 만든다.
- 별도 스테이징은 Git 브랜치가 아니라 **독립 Supabase 환경**으로 먼저 도입할 수 있다.
- `dev`는 여러 기능을 다음 배포 묶음으로 장기간 통합해야 하고, 그 브랜치만 보는 지속 스테이징이
  실제로 준비됐을 때만 검토한다.

### 2.3 스테이징과 운영 유료 프로젝트 도입 시점

다음 중 가장 이른 시점 전에 운영과 분리된 스테이징을 준비한다.

- 첫 외부 매장 또는 복구하기 어려운 실데이터 수집
- 첫 외부 공급사·알림·Webhook 연계
- 두 번째 개발자 또는 자동 배포 주체 참여
- 운영 DB에서 검증할 수 없는 마이그레이션 증가

운영 프로젝트는 **첫 실매장 데이터 유입 전** 유료 플랜으로 전환하고 자동 백업, 프로젝트 중지 여부,
리전, 보안 설정을 확인한다. 구체적인 구독·컴퓨트 승급 조건은
[서버 확장 아키텍처 기획안 §11](./서버-확장-아키텍처-기획안.md#11-구독컴퓨트분리-승급-조건)을 따른다.

Supabase Branching을 사용할 경우 운영 데이터 복제가 아니라 독립 환경과 합성 시드를 원칙으로 한다.
[Supabase Branching](https://supabase.com/docs/guides/deployment/branching)

## 3. 변경 단위와 작업 큐

### 3.1 세로 기능 브랜치

DB 기능 브랜치는 필요한 레이어를 한 브랜치에 함께 포함한다.

```text
feat/supplier-order-submit
├─ apps/mobile                         화면·훅·오류 처리
├─ packages/core                       미리보기·검산 공식
├─ packages/types                      앱·서버 계약
├─ packages/db/supabase/migrations     스키마·RPC·RLS·Cron·Queue
├─ packages/db/tests                   회귀·권한·경합 시험
├─ packages/db/src/database.types.ts   생성 타입
├─ packages/db/supabase/functions       Edge Function(필요한 경우)
├─ services/integration-worker         외부 Worker(분리 조건 충족 시에만)
└─ docs                                관련 기획안·인벤토리
```

앱·DB·core·types를 레이어별 브랜치로 분리하지 않는다. Queue·Edge·Worker가 추가돼도 같은 사용자 기능의
배포 단위로 묶되, 실제 운영 배포 순서는 §5의 하위 호환 순서를 따른다.

### 3.2 작업 큐

예정 작업과 의존성은 [`docs/작업큐.md`](./작업큐.md) 한 파일에서 관리한다. 대형 브랜치 병합 뒤
2026-08-27에 생성했으며, 이 절은 초기 등록 범위만 고정한다. 상태·완료 조건·실행 순서는 작업 큐가
단일 출처다.

- P0-1 인증 계정 삭제와 매장·거래 원장 보존 분리
- P0-2 DB 전체 검증 ④·⑤를 CI 또는 관리 러너의 병합 필수 체크로 이전
- P0-3 운영 `push` 스크립트 명시적 개명과 프로젝트 ref 검증
- P0-4 운영 Supabase·스테이징·백업·복구 훈련 준비
- P1-1 첫 원격 프로젝트 연결 전 `admin-acl.sh --remote audit` 구현과 회귀시험
- P1-2 Supabase CLI `2.116.0` 정확 고정과 로컬 전환 검증(완료)
- P1-3 §11 저장소 문서 전체 동기화(루트·앱·`packages/db` README 포함, `01c5358` 완료)

병합 후 22시대 재검증에서 발견한 DB 시험의 늦은 개점 시간 의존성은 `TEST-1`로 별도 등록했고,
`3a9f2d1`에서 완료했다.

권장 항목 형식:

```yaml
title: 공급사 주문 전송
status: 대기 # 대기 | 진행 | 병합 완료
planned_branch: feat/supplier-order-submit
base: main
screen_ids: [ORD-03]
depends_on: []
touches:
  - apps/mobile/src/features/orders
  - packages/db
architecture_ref:
  - 서버-확장-아키텍처-기획안.md §7
deployment_units:
  - db
  - queue
  - edge-function
environment_targets:
  - local
  - staging
  - production
migration: required
development_db_target: local-only
rollback:
  - 신규 전송 경로 비활성화
  - 구 계약 유지
acceptance:
  - 저장과 outbox가 같은 트랜잭션이다
  - 중복 요청이 한 번만 반영된다
  - 실패 재시도와 수동 재처리가 가능하다
  - pnpm verify 6단계가 통과한다
```

브랜치는 `depends_on`, 완료 조건, 영향 이벤트, 마이그레이션 필요 여부가 정해진 뒤에만 만든다.

## 4. 마이그레이션과 DB 적용 게이트

### 4.1 DB 변경 브랜치는 동시에 하나

다음은 모두 DB 변경으로 본다.

- 테이블·컬럼·제약·인덱스·파티션
- RPC·트리거·RLS·권한
- Cron·Queue·Webhook·Vault 참조
- 생성 타입·시드·마이그레이션 시험
- 이벤트 envelope 또는 `schema_version` 변경

첫 DB 브랜치가 `main`에 병합되기 전에 다음 DB 브랜치를 시작하지 않는다. 문서·독립 UI는 병렬로
진행할 수 있지만 같은 화면이나 import 경로를 건드리면 순차 진행한다.

### 4.2 마이그레이션 불변

- `YYYYMMDD000NNN_name.sql` 정렬 규칙을 유지한다.
- 의도된 결번은 그대로 둔다.
- 이 문서에서 공유 환경은 재생성하지 않고 이력을 보존하는 운영·스테이징 DB를 뜻한다. 그 환경에
  적용된 파일은 수정·삭제·개명·순서 변경하지 않는다.
- 충돌과 결함은 새 번호의 보완 마이그레이션으로 해결한다.
- 원격 환경에 미적용이고 `main`에도 병합되지 않은 파일은 로컬·폐기 가능한 개발 DB를 재생성할 수
  있다는 전제에서, 명시적인 검토 지시에 따라 제자리 수정할 수 있다. 원격 Git push만으로 “적용된
  마이그레이션”이 되지는 않는다.
- 스키마 변경 후 `pnpm db:types`로 생성 타입을 갱신한다.
- 미배포 파일을 제자리 수정했더라도 최종 상태만 보지 않고 빈 DB 전체 적용과 이미 공유한 중간
  버전의 업그레이드 경로를 모두 검증한다.

### 4.3 로컬 전체 검증과 CI 범위

병합 전 표준은 루트 `pnpm verify`다.

```text
① 타입
② core · db · mobile 시험
③ CLI 고정 계약·ACL 보안
④ 새 DB 전체 마이그레이션 + DB 시험 + 2세션 경합 + 실 DB parity
⑤ 중간 버전 업그레이드 경로
⑥ 웹 번들
```

GitHub Actions는 Node 20.19.4·24에서 `pnpm verify --no-db` 빠른 검사를 실행하고, 별도
`full-db-required` job이 격리된 Supabase에서 `pnpm verify` 6단계를 실행한다. `protected-gate`는
두 선행 job이 모두 성공한 정확한 SHA에만 성공하며, `main` ruleset의 유일한 required context다.
`--no-db` 결과만을 전체 6단계 통과라고 표현하지 않는 원칙은 그대로 유지한다.

그전까지 PR에는 로컬 전체 검증 실행 환경·시각·결과를 기록한다.

### 4.4 운영 push 사고 방지

- 기능 브랜치에서 운영 프로젝트로 `db push`하지 않는다.
- 일반 `push` 명령은 두지 않는다. `db:deploy:staging:plan`·`db:deploy:production:plan`으로
  `migration list`와 dry-run의 적용 예정 파일을 먼저 확인한다.
- 배포 가드는 실제 링크 project ref와 환경별 기대 ref, 깨끗한 `main`, `origin/main`, 사람이 승인한
  40자리 SHA, 동일 SHA의 `protected-gate` 성공을 모두 대조한다. 하나라도 없거나 다르면 실패한다.
- 실제 적용은 계획과 같은 가드에서 대상·project ref·SHA를 모두 포함한 확인 문구를 추가로 요구한다.
- 운영 프로젝트 링크, 대상 프로젝트 ref, 배포 SHA를 배포 기록에 남긴다.
- Dashboard에서 직접 SQL을 고치지 않는다. 긴급 수정도 마이그레이션으로 남긴다.

```bash
# 스테이징 계획 예시. 운영은 STAGING/staging을 PRODUCTION/production으로 바꾼다.
SIKJAE_APPROVED_DEPLOY_SHA=<40자리-main-SHA> \
SIKJAE_STAGING_PROJECT_REF=<20자리-project-ref> \
corepack pnpm db:deploy:staging:plan

# 위 계획을 검토한 뒤에만 추가한다.
SIKJAE_DEPLOY_CONFIRM=APPLY:staging:<project-ref>:<40자리-main-SHA> \
corepack pnpm db:deploy:staging:apply
```

계획 실행은 출력만 남기고 저장소를 바꾸지 않는다. 계획 기록이 worktree를 더럽혀 동일 SHA의 적용을
막지 않기 위해서다. 실제 적용 성공 뒤에만 `docs/deployments/`에 `APPLIED` 기록을 만든다. 기록은
CLI 출력 원문 대신 SHA-256과 migration 파일명을 저장하며 비밀번호·토큰·DB URL을 포함하지 않는다.

### 4.5 호스티드 Supabase ACL 능력 분기

`supabase_admin`은 Supabase의 업그레이드·자동화용 내부 롤이고, 호스티드 프로젝트의 `postgres`에는
일반적인 superuser 권한이 제공되지 않는다. 따라서 `admin-acl.sh --remote fix`가 모든 호스티드
프로젝트에서 성공한다고 가정하지 않는다.

`admin-acl.sh --remote audit`과 회귀시험은 P1-1에서 구현했다. 이 모드는 `supabase_admin`으로
전환하거나 영구 객체를 남기지 않고 앱 롤 공격면을 판정하며, 프로브는 같은 트랜잭션에서
rollback한다. 정확한 facade RPC 시그니처 외 authenticated 실행 권한, RLS 비활성 앱 표, 원장
직접 쓰기 경로도 실패로 판정한다. 2026-08-28 개발 DB 실측은 RLS 비활성 앱 표 `0개`, 원장 직접
쓰기 조합 `32개`, 미승인 함수 `87개`였다. 뒤의 두 항목은 `P0-5`에서 권한을 줄여야 할 배포 차단
사유다. 접근 가능한 호스티드 프로젝트가 아직 없어 **실제 원격 실행은 미확인**이다.
첫 원격 배포의 ACL 단계는 아래 순서의 실측 결과가 없으면 중단한다.

구현 후 첫 원격 연결에서는 다음 순서로 확인한다.

1. `admin-acl.sh --remote audit`을 먼저 실행한다. 이 모드는 `supabase_admin`으로 전환하지 않고
   `current_user`, `rolsuper`, `pg_has_role(current_user, 'supabase_admin', 'member')` 세 값을 그대로
   출력하고 아래 앱 롤 감사를 수행한다.
2. 전환 가능하고 `audit`에서 기본 권한이 열려 있으면 `fix` 후 `check`를 실행한다. 최종 `check`
   종료 코드 0을 게이트로 삼는다.
3. 전환 불가능하면 `fix|check`를 반복하지 않는다. `audit`의 앱 롤 폐쇄 결과를 대체 게이트로 사용하고,
   `supabase_admin` 기본 권한은 플랫폼 관리 영역으로 기록한다.

대체 ACL 게이트는 최소한 다음을 증빙한다.

- ACL 마이그레이션 `0166`·`0167`이 원격 이력에 있다.
- 현재 `public` 테이블 전체에서 `anon`·`authenticated`의 유효
  `TRUNCATE`·`TRIGGER`·`REFERENCES` 권한이 0건이다.
- `postgres`로 트랜잭션 안에서 만든 프로브 테이블도 같은 권한이 0건이고 소유자가 `postgres`다.
  프로브는 rollback한다.
- 애플리케이션 소유 `public` 객체 중 `supabase_admin` 소유 객체가 0건이다.
- RLS 비활성 public 앱 표와 원장·확정값 테이블의 앱 롤 직접 쓰기 경로가 0건이다.
- 보호 테이블의 직접 쓰기와 integration·ops·Queue 원본의 Data API 노출이 닫혀 있고 승인된 RPC만
  실행할 수 있다.
- 확인하지 못한 `supabase_admin` 기본 권한은 “통과”로 위장하지 않고 플랫폼 예외로 배포 기록과
  작업 큐에 남긴다.

이 분기는 `fix` 실패를 무시하는 우회가 아니다. **플랫폼 내부 롤을 바꿀 수 없는 경우 앱이 실제로
사용하는 롤의 공격면을 별도 게이트로 닫는 절차**다. 결과 명칭도 `애플리케이션 ACL 통과`로 기록하며
`supabase_admin ACL 통과`라고 쓰지 않는다. 앱 롤의 실제 노출이나 `supabase_admin` 소유 애플리케이션
객체가 한 건이라도 있으면 배포를 중단한다. 내부 롤 기본 권한까지 폐쇄해야 하는 정책이라면 대체
게이트를 승인하지 않고 Supabase 지원 경로가 확보될 때까지 중단한다.

- [Supabase Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase Roles and superuser access](https://supabase.com/docs/guides/database/postgres/roles-superuser)
- [Supabase API default privileges](https://supabase.com/docs/guides/api/securing-your-api#revoke-default-privileges)

## 5. 스테이징·운영 배포 순서

### 5.1 공통 원칙

서버 구성과 분리 조건은
[서버 확장 아키텍처 기획안 §4](./서버-확장-아키텍처-기획안.md#4-단계별-서버-진화)의 단계,
[§7](./서버-확장-아키텍처-기획안.md#7-outboxqueueinbox-계약)의 비동기 계약,
[§11](./서버-확장-아키텍처-기획안.md#11-구독컴퓨트분리-승급-조건)의 승급 조건을 따른다.
조건이 충족돼도 이 문서의 작업 큐, 스테이징, 검증, 배포 게이트 전에는 운영에 적용하지 않는다.

### 5.2 확장형 변경의 기본 순서

```text
1차  DB·Queue 구조 추가                       Producer·새 Cron·Webhook 비활성
2차  비밀값 배포                              Consumer가 읽을 비밀 준비
3차  Edge/Worker Consumer 배포·health 확인     아직 새 메시지는 생산하지 않음
4차  Producer·Cron·Webhook 활성화             제한된 canary부터 시작
5차  앱이 새 계약 사용                        구 앱·구 경로 유지
6차  관측 후 구 경로 제거                     구 앱 소멸 확인 후 별도 배포
```

구 계약 제거, 컬럼 삭제, 타입 축소는 추가와 같은 배포에 넣지 않는다.

새 integration Cron의 “비활성”은 문구가 아니라 실제 상태로 구현한다. 같은 마이그레이션에서
`v_job_id := cron.schedule(...)`로 등록한 직후 `cron.alter_job(v_job_id, active := false)`를 호출하고,
`cron.job.active = false`를 사후조건으로 확인한다. 실패를 warning으로 넘기지 않는다. §5.3·§5.4의
canary 단계에서 정확한 `jobname`만 `active := true`로 바꾸고 전후 조회를 배포 기록에 남긴다.
Producer·Webhook도 기본값 `false`인 integration feature flag를 사용한다.

`cron.database_name` 일치 여부는 실행 환경 선택이지 기능 활성화 장치가 아니다. Consumer 활성화 전에는
outbox 생성·Queue enqueue·외부 요청이 0건이라는 사후조건을 둔다. 기존 `sikjae-close-due`,
`sikjae-apply-breaks`, `sikjae-purge-changes`는 이 신규 integration Cron 활성화 규칙의 대상이 아니다.

### 5.3 스테이징 배포

1. 브랜치에서 로컬 `pnpm verify` 6단계 통과
2. 대상 SHA의 `protected-gate` `completed/success`와 변경 범위 확인
3. 스테이징 백업·마이그레이션 상태 확인
4. 추가형 DB·Queue 구조를 **비활성 상태**로 적용
5. Vault·Project Secrets·Storage 정책과 비밀값 준비
6. §4.5의 원격 ACL 능력 분기와 해당 게이트 통과
7. Edge Function·외부 Worker Consumer 배포와 health check
8. canary Producer·Cron·Webhook을 마지막에 활성화
9. 앱 스테이징 빌드 배포
10. 정상·중복·재시도·권한·실패 복구 흐름 점검
11. 결과를 PR 또는 배포 기록에 남김

### 5.4 운영 배포

1. 스테이징 검증 완료
2. `main` 병합 후 배포 대상 SHA를 기록하고 이후 배포 범위를 고정
3. 운영 자동 백업 생성 여부와 복구 가능 시점 확인
4. `supabase migration list`로 로컬·운영 이력 대조
5. `db:deploy:production:plan`으로 dry-run과 적용 목록 검토
6. 추가형 DB·Queue 구조를 **비활성 상태**로 적용
7. Vault·Project Secrets·Storage 정책과 비밀값 준비
8. §4.5의 원격 ACL 능력 분기와 해당 게이트 통과
9. Edge Function·외부 Worker Consumer 배포와 health check
10. canary Producer·Cron·Webhook을 마지막에 활성화
11. 앱 배포
12. 핵심 사용자 흐름과 Cron·Queue·오류율 점검
13. 성공한 배포 SHA에 annotated tag `deploy-YYYYMMDD-<shortSHA>` 생성·push
14. 앱 버전·DB 태그·마이그레이션 범위·담당자·검증 결과 기록

2~5단계의 대상 고정과 DB 적용은 §4.4의 배포 가드를 사용한다. 계획 출력은 적용 증거가 아니며,
`APPLIED` 기록도 1단계 스테이징과 3단계 백업·복구 확인을 대신하지 않는다.

`main` ruleset의 저장소 선언은 `.github/rulesets/main-required.json`이다. `corepack pnpm ruleset:check`로
원격과 대조하고, 선언을 바꿀 때만 정확한 현재 SHA의 `protected-gate` 성공 뒤
`corepack pnpm ruleset:fix`를 실행한다. ruleset은 bypass 없이 `protected-gate`를 required context로
요구하고 force-push와 삭제를 막는다. 실패한 검사, 다른 SHA의 성공 검사나 로컬 보고로 우회하지 않는다.

운영 ACL 스크립트는 비밀번호 없는 명시적 접속 변수와 `ADMIN_DB_PASSWORD` 또는 `PGPASSFILE`을
사용한다. 실제 운영 연결은 현재 환경에서 검증되지 않았으므로 첫 운영 배포 전에 §4.5의 `audit` 우선
분기를 실행해 결과를 보관한다.

활성화 후 문제가 생기면 **Producer·Cron·Webhook부터 중단**하고 Consumer를 마지막에 내린다. 이미
Queue에 저장된 메시지는 삭제하지 않고 원인을 고친 뒤 재처리한다. 기존 자동 영업 종료·브레이크 Cron은
새 integration Producer가 아니므로 이 활성화 순서의 대상이 아니다.

## 6. 서버 구성 변경의 검증 기준

### 6.1 DB·RPC

- `pnpm verify` 6단계
- 생성 타입 갱신과 앱 계약 검증
- RLS·매장 경계·권한·판본 충돌 시험
- 원장 합계와 현재 상태 검산
- 기존 고정 검산값 불변
- 동일 요청 재호출과 2세션 경합 시험

### 6.2 Queue·Outbox·Inbox

- 업무 상태와 outbox가 같은 트랜잭션인지
- 동일 `event_id`·`idempotency_key` 재호출이 중복 반영되지 않는지
- visibility timeout 후 재시도되는지
- 최대 재시도 후 dead letter 또는 수동 재처리 경로가 있는지
- 모바일이 Queue를 직접 소비할 권한이 없는지
- payload의 `schema_version` 호환성이 유지되는지

### 6.3 Edge Function·Webhook·Worker

- JWT 또는 파트너 서명 검증
- 내부 Worker 자격과 앱 사용자 자격 분리
- 중복 Webhook 수신 시험
- timeout·429·5xx·부분 실패 재시도
- 비밀값이 저장소·응답·로그에 노출되지 않음
- 외부 서비스 실패가 재고·판매 핵심 저장을 막지 않음
- Worker가 테이블을 직접 수정하지 않고 권위 RPC를 호출함

### 6.4 배포 후 증빙

배포 직전·직후 같은 시간 범위의 지표 스냅샷, health 결과, Cron·Queue 마지막 성공, 핵심 원장 검산,
담당자와 판정 결과를 배포 기록에 남긴다. 어떤 지표를 재고 어떤 임계치로 서버 단계를 올릴지는
[서버 확장 아키텍처 기획안 §11](./서버-확장-아키텍처-기획안.md#11-구독컴퓨트분리-승급-조건)과
[§13](./서버-확장-아키텍처-기획안.md#13-관측성과-운영-지표)을 단일 출처로 사용한다.

## 7. 전진 복구와 데이터 보존

### 7.1 기본 복구 원칙

- 적용된 마이그레이션 파일을 고쳐서 되돌리지 않는다.
- 신규 기능 경로를 비활성화할 수 있는 플래그 또는 구 계약 유지 기간을 둔다.
- 스키마 결함은 새 보완 마이그레이션으로 전진 복구한다.
- 앱 롤백이 필요한 동안 DB는 구 앱과 새 앱을 모두 받아야 한다.
- DB 전체 복원은 일반 롤백이 아니라 마지막 재해 복구 수단이다.
- 복원하면 복원 시점 이후의 정상 판매·입고도 사라질 수 있으므로 책임자 승인과 RPO/RTO가 필요하다.

### 7.2 백업과 복구 훈련

- 첫 실매장 이전 자동 백업 활성화 확인
- 월 1회 또는 주요 스키마 변경 후 복구 훈련
- 복구 대상, 소요 시간, 누락 데이터, 담당자 기록
- PITR은 “하루치 판매·재고 손실을 받아들일 수 없는가”를 기준으로 결정
- 영수증·거래명세서·상품 이미지 같은 Storage 객체는 DB 백업만으로 복구되지 않을 수 있으므로
  별도 보존·내보내기 정책을 둔다. [Supabase Backups](https://supabase.com/docs/guides/platform/backups)

### 7.3 계정 삭제와 원장 보존

0173은 `auth.users` 삭제의 연쇄 삭제를 `stores.owner_id ON DELETE SET NULL`로 바꾸고, 탈퇴·폐점 시
매장 접근만 끊은 채 거래 원장을 보존한다. `store_lifecycle_events`는 매장 FK 없이 남아 물리 삭제 후에도
절차를 되짚을 수 있다. 물리 삭제는 보존 종료·승인·백업 근거가 있는 service role 전용 두 단계 절차다.

배포 전에는 전체 백업과 복구 가능 여부를 확인한다. 장애 시 0173을 되돌려 CASCADE를 복구하지 않고,
새 전진 마이그레이션으로 접근 상태·함수·권한만 교정한다. 0172→0173 업그레이드 시험은 기존 판매·재고
행 수를 굳힌 뒤 계정을 삭제해 매장 archive·행 수 불변·감사 이벤트를 확인한다. 목표 원칙은
[서버 확장 아키텍처 기획안 §10.4](./서버-확장-아키텍처-기획안.md#104-계정-탈퇴와-데이터-보존)를
따르고, 이 문서에서는 작업 큐 등록·마이그레이션·복구 시험·배포 증빙을 강제한다.

## 8. 브랜치 명명·병합·종료

### 8.1 명명

```text
<작업유형>/<기능영역>-<변경목적>
```

예: `feat/supplier-order-submit`, `fix/tax-rounding`, `refactor/domain-boundaries`,
`docs/server-evolution`, `test/webhook-idempotency`.

- `/` 뒤 2~4개 단어, 20~40자 권장
- 화면 ID와 전체 경로를 브랜치명에 넣지 않음
- 화면 ID는 작업 큐와 PR 제목에 기록

### 8.2 병합 방식

| 대상                      | 방식                                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| 이번 대형 브랜치 → `main` | **fast-forward 완료**, squash·rebase 없이 기존 SHA 유지                      |
| 향후 단명 브랜치 → `main` | squash 허용. DB 설계 순서가 중요하면 일반 merge                              |
| `hotfix/*` → `main`       | 최소 범위, 전체 검증, 운영 배포 후 즉시 정리                                 |

병합된 기능 브랜치는 로컬·원격 모두 삭제하고 작업 큐를 `병합 완료`로 바꾼다.

이번 대형 브랜치는 GitHub의 “Rebase and merge”를 사용하지 않았고, `origin/main`이 HEAD의 직접
조상임을 확인한 뒤 다음 경로로 SHA를 그대로 유지했다. 향후 같은 조건의 대형 브랜치에도 적용한다.

```bash
set -e
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin feat/locale-currency-settings:main
git switch main
git pull --ff-only origin main
```

조상 확인이 실패하거나 원격 보호 규칙이 직접 push를 막으면 강제 push하지 않는다. 일반 merge
commit으로 이력을 보존하거나 보호 규칙에 맞는 별도 절차를 사용한다. 현재 CI는 모든 브랜치 push에
실행된다. **feature HEAD의 `protected-gate`가 `completed/success`인 것을 확인하기 전에는 `main`을
이동하지 않는다.** `queued`·`in_progress`는 통과가 아니다. GitHub ruleset은 `protected-gate`가
없는 SHA의 직접 push, force-push와 삭제를 차단한다. `main` push 뒤 같은 SHA의 결과도 다시 확인한다.
로컬 `main`을 원격과 fast-forward한
뒤에만 로컬 feature 브랜치를 삭제한다.

## 9. 대형 브랜치 병합 결과와 후속 정리

### 9.1 병합 후 상태 스냅샷 (2026-08-27)

| 항목                    | 확인값                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| 기능 병합 기준          | `main` · `origin/main` = `86db920`, 차이 `0 0`                       |
| `TEST-1` 병합 기준      | `3a9f2d1` — 동일 SHA CI 확인 당시 `origin/main`과 차이 `0 0`        |
| 문서 작업 브랜치        | `codex/docs-post-merge-baseline`, `86db920`에서 분기                  |
| 병합 방식               | `840ae15` 이후 192커밋 선형 fast-forward · merge commit 0개          |
| 기능 브랜치             | 로컬·원격 삭제 완료, 원격 작업 브랜치는 `main`만 남음                |
| 기획안 추적             | `744784d`에서 두 기획안만 최초 커밋                                  |
| 마이그레이션            | 161개, 최신 `20260826000172_settings_revision_noop_tax.sql`          |
| DB 회귀 시험            | 번호 파일 32개 · 야간 `TEST-1` 후 개발·새 DB 모두 32/32             |
| core · mobile 시험      | core 176 passed · 2 skipped, mobile 173/173                          |
| 로컬 전체 검증          | `3a9f2d1`에서 6/6 · 업그레이드 8/8 · 임시 DB 0개                    |
| GitHub Actions          | `3a9f2d1` feature·`main`의 Node 20.19.4·24 모두 `completed/success`  |
| 운영 Supabase 적용 이력 | **미확인** — 원격 프로젝트 링크와 `migration list` 확인 전           |
| 배포 태그               | 없음 — 운영 배포를 하지 않았으므로 정상                              |
| 스냅샷 작성 워킹트리    | `.claude/settings.json` 수정 + 이 기획안 수정 + `작업큐.md` 신규     |

- **확인 시각**: `2026-08-27T23:21:59+09:00`
- **재검증 환경**: Windows `10.0.26200.0` · Node `24.15.0` · pnpm `9.12.0` · 로컬 Supabase
- **기능 병합 CI 근거**:
  - [feature 최종 성공 run](https://github.com/Jacop7/cost/actions/runs/33072549823)
  - [`main` 동일 SHA 성공 run](https://github.com/Jacop7/cost/actions/runs/33072723599)
- **TEST-1 CI 근거**:
  - [feature 성공 run](https://github.com/Jacop7/cost/actions/runs/33081474853)
  - [`main` 동일 SHA 성공 run](https://github.com/Jacop7/cost/actions/runs/33081709783)
- **절차 이탈 기록**: `bc6bd75`는 feature CI가 끝나기 전에 `main`으로 이동해 `main` CI가 실패했다.
  `86db920`에서 수정하고 feature CI의 모든 workflow matrix job이 성공한 뒤 두 번째 fast-forward를
  수행했다. 이 이력을 근거로 §8.2는 `queued`·`in_progress`를 통과로 보지 않으며, feature와 `main`의
  **동일 SHA** 성공을 각각 확인하도록 고정한다.
- **병합 후 발견 및 해결**: `2026-08-27T22:04+09:00` 야간 재검증에서 여섯 DB 시험이 종료 시각 없는
  직접 개점으로 `45015 LATE_OPEN`을 받아 개발·새 DB가 26/32로 실패했다. 제품 규칙의 오류가 아니라
  시험 준비와 중간 버전 seed 재생의 벽시각 의존성이었다. `05b0cce`는 `45015`만 처리하는 시험 헬퍼를
  만들고 여섯 시험과 `_prelude.sql`의 두 개점 경로를 통일했으며, `00:01~00:02` 강제 회귀시험으로
  폴백을 검증했다. `3a9f2d1`은 `0150` 중간 상태 seed·업그레이드 야간 호환을 보정했다. 그 결과 로컬
  검증 6/6, 개발·새 DB 32/32, 업그레이드 8/8, 임시 DB 0개와 동일 SHA feature·`main` CI 성공을
  확인했다.
- **근거 명령**:

```powershell
git fetch origin --prune
git status --short --branch
git branch --show-current
git branch --all
git rev-parse --short HEAD
git rev-parse --short origin/main
git rev-list --left-right --count main...origin/main
git merge-base --is-ancestor 840ae15 main; "old-main-is-ancestor exit=$LASTEXITCODE"
git rev-list --count 840ae15..main
git rev-list --merges 840ae15..main --count
git tag --list 'deploy-*'
$migrationFiles = Get-ChildItem -LiteralPath 'packages/db/supabase/migrations' -Recurse -File -Filter '*.sql'
$migrationFiles.Count
($migrationFiles | Sort-Object FullName | Select-Object -Last 1).Name
(@(git ls-files -- 'packages/db/tests' | Select-String '^packages/db/tests/[0-9]{2}_.*\.sql$')).Count
Test-Path packages/db/supabase/.temp/project-ref
Select-String -LiteralPath '.github/workflows/verify.yml' -Pattern 'node:|pnpm verify --no-db'
Select-String -LiteralPath 'scripts/verify.mjs' -Pattern 'step\(|--no-db'
corepack pnpm verify
$testSha = '3a9f2d17ef127ccf40db5f5ed9d3812e7f93135e'
$runs = Invoke-RestMethod -Headers @{ 'User-Agent' = 'repo-status-check' } `
  -Uri "https://api.github.com/repos/Jacop7/cost/actions/runs?head_sha=$testSha"
$runs.workflow_runs | Select-Object head_branch, status, conclusion, html_url
```

운영 프로젝트는 연결되지 않았으므로 `migration list`와 백업·복구 상태를 확인하지 않았다. 이를 로컬
검증 결과로 대체하거나 운영 적용 완료로 표현하지 않는다.

### 9.2 처리 결과와 남은 순서

| 단계 | 상태        | 결과 |
| ---- | ----------- | ---- |
| 1    | 완료        | 두 기획안 검토와 Git 추적 승인 |
| 2    | 완료        | `744784d`에 두 문서만 커밋, `.claude/settings.json` 제외 |
| 3    | 완료        | 대형 기능 브랜치의 기능 변경 중단 |
| 4    | 완료        | 야간 결함을 `TEST-1` `3a9f2d1`로 해결. 로컬 6/6·DB 32/32·업그레이드 8/8 회복 |
| 5    | 완료        | 주요 앱 흐름 수동 점검 |
| 6    | 미확인      | 운영 프로젝트 미연결. `migration list`·백업 상태를 추정하지 않음 |
| 7    | 완료        | 옛 `main` `840ae15`가 최종 HEAD의 직접 조상임을 확인 |
| 8    | 완료        | 최종 `86db920`까지 선형 fast-forward. 최초 이탈은 §9.1에 기록 |
| 9    | 해당 없음   | 운영 배포가 없어 배포 태그를 만들지 않음 |
| 10   | 완료        | 로컬·원격 feature 브랜치 삭제 |
| 11   | 완료        | [`docs/작업큐.md`](./작업큐.md) 생성, P0 4건·P1 3건 등록 |
| 12   | 완료        | §10 폴더 경계 리팩터링 `REF-1`을 `cceafb9`에서 완료 |
| 13   | 완료        | §11의 README·아키텍처·화면 인벤토리 동기화 `P1-3` (`01c5358`) |

운영 DB가 이미 feature 마이그레이션을 포함했다면 파일을 고치지 말고, 운영 이력과 저장소 이력을
대조한 뒤 신속히 `main`을 맞춘다.

## 10. 폴더 경계 리팩터링

`REF-1` 전용 브랜치에서 수행해 `cceafb9`로 `main`에 반영했다. 아래는 완료한 이동 범위다.

완료한 이동:

```text
features/sales/businessDay.ts
  → features/business-day/businessDay.ts
features/sales/components/BusinessDateGate.tsx
  → features/business-day/components/BusinessDateGate.tsx
features/sales/period.ts의 순수 날짜 함수
  → src/lib/date.ts
features/my/hooks.ts의 공용 설정
  → features/settings/hooks.ts
features/my/hooks.ts의 카테고리·거래처·채널·부자재
  → features/master-data/hooks.ts
features/ingredients/components/HistoryLayout.tsx
  → components/history/HistoryLayout.tsx
```

제한:

- 동작·RPC·스키마 변경 금지
- import 경로와 모듈 책임만 정리
- `features/README.md` 인벤토리 경로 갱신
- 발견된 기능 개선은 즉시 고치지 않고 작업 큐에 등록
- 전체 타입·시험·번들 검증

향후 서버 코드도 논리 경계를 먼저 두되, 실제 서비스 분리는 짝 문서의 분리 조건을 만족할 때만 한다.

## 11. 문서 동기화

대형 브랜치 병합 후 다음 순서로 갱신한다.

1. `docs/브랜치-DB-운영-기획안.md` — 병합 결과와 운영 상태
2. `docs/서버-확장-아키텍처-기획안.md` — 채택 단계와 측정값
3. `docs/작업큐.md` — 상태·의존성·완료 조건의 단일 출처로 갱신
4. `CLAUDE.md`·`AGENTS.md` — 탭·데이터·검증·짝 문서 참조
5. `README.md`·`apps/mobile/README.md` — 저장소·앱 시작, 검증, 배포 환경
6. `ARCHITECTURE.md` — 현재 원장·전파 이벤트·검산값
7. `apps/mobile/src/features/README.md` — 화면 인벤토리
8. `packages/db/README.md` — 마이그레이션·fresh DB·ACL·업그레이드 경로

`P1-3`은 `01c5358`에서 루트·앱·DB README, `CLAUDE.md`·`AGENTS.md`, `ARCHITECTURE.md`,
두 기획안과 화면 인벤토리를 같은 측정값으로 맞췄다. 로컬 6/6과 동일 SHA의 feature·`main` CI를
확인했으며, 상세 결과와 run id는 [`docs/작업큐.md`](./작업큐.md#p1-3-저장소-문서-동기화)에 남겼다.

문서 상태 스냅샷에는 확인 시각과 근거 명령을 함께 남긴다. 검증하지 못한 운영 상태는 “미확인”으로
쓰고 추정으로 채우지 않는다.

## 12. Hotfix

첫 운영 배포 이후 사용자 저장 차단, 원장 불일치, 인증 우회처럼 즉시 대응이 필요한 장애에만
`hotfix/*`를 사용한다.

```text
main에서 분기
→ 최소 범위 수정
→ 로컬 전체 검증
→ 스테이징 가능 시 재현
→ main 병합
→ §5.4 운영 배포
→ 관측·전진 복구
→ 브랜치 삭제
```

DB hotfix도 Dashboard 직접 SQL이 아니라 마이그레이션으로 남긴다. 외부 연동은 필요하면 Queue 소비를
멈추되 이미 저장된 메시지를 삭제하지 않는다.

## 13. 서버 단계 변경과 이 문서의 상호작용

짝 문서에서 다음 단계로 이동하기로 결정하면 반드시 아래 절차를 거친다.

1. `docs/작업큐.md`에 아키텍처 절 번호와 측정 근거 등록
2. 한 개의 세로 기능 브랜치 생성
3. 로컬·스테이징 환경과 비밀값·권한 준비
4. 확장형 DB 계약과 관측 지표부터 배포
5. Queue·Edge·Worker·앱 순으로 소비자 전환
6. 중복·재시도·장애 복구 검증
7. 안정화 기간 후 구 계약 정리
8. 두 문서와 `ARCHITECTURE.md` 갱신

비밀값은 짝 문서가 **누가 읽는지**를 정하고, 이 문서가 **어떻게 배포·교체·검증하는지**를 정한다.
모니터링은 짝 문서가 지표와 승급 조건을 정하고, 이 문서가 배포 전후 점검 절차를 정한다.

## 14. 최종 운영 원칙

1. 현재는 `main` + 단명 브랜치를 사용한다.
2. 운영·스테이징 Supabase 환경과 Git `dev` 브랜치를 같은 것으로 보지 않는다.
3. 첫 실매장 데이터 전 운영 유료 프로젝트와 분리된 검증 환경을 준비한다.
4. DB 변경 브랜치는 동시에 하나만 연다.
5. 기능 브랜치에서 운영 DB에 push하지 않는다.
6. 운영에는 `main` 이력만 적용한다.
7. 운영·스테이징 DB에 적용된 마이그레이션은 수정하지 않는다.
8. 로컬과 `full-db-required`의 전체 검증은 6단계이며 `--no-db` 빠른 검사는 4단계라는 차이를 숨기지 않는다.
9. 서버 구조 변경도 한 개의 세로 기능 브랜치로 앱·DB·계약·시험·문서를 함께 변경한다.
10. 계산·원장·잠금의 권위는 DB RPC에 유지한다.
11. 외부 I/O와 긴 작업의 실행 위치는 서버 확장 아키텍처 기획안에서 결정한다.
12. 운영 배포는 백업 확인→마이그레이션→ACL→서버 구성→앱→관측 순으로 수행한다.
13. 롤백보다 확장→전환→정리와 전진 복구를 기본으로 한다.
14. 계정 탈퇴와 거래 원장 삭제를 분리한다.
15. 상태를 확인할 수 없으면 추정하지 않고 “미확인”으로 기록한다.
