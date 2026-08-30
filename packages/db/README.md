# @margincook/db — Supabase 데이터 레이어

스키마·RLS·권위 RPC·Cron·시드·DB 회귀시험의 단일 출처다. 앱과 Worker는 재고·단가·손익을 직접
고치지 않고 이 패키지의 공개 RPC를 통과해야 한다.

## 현재 기준

- 마이그레이션 163개, 최신 `20260829000174_rpc_least_privilege.sql`
- 번호가 붙은 DB 회귀 스위트 34개
- public 업무 테이블 30개
- 자동 종료·자동 브레이크·변경 이력 청소 pg_cron 3종
- 로컬 마이그레이션 장부와 파일 163/163 일치(2026-08-29 0174 통합 뒤 확인)

개수는 현재 스냅샷이다. 실제 판단은 파일과 시험 실행 결과를 우선한다.

## 구조

```text
supabase/
  config.toml             로컬 Supabase 설정
  migrations/             순서가 있는 전진 마이그레이션
  seed.sql                검산용 합성 매장·입고·레시피·판매
  functions/              현재 함수 없음(Edge Function 미도입)
scripts/
  fresh-db.sh             격리 DB 생성·중간 버전 재생
  upgrade-check.sh        실제 마이그레이션 순서의 업그레이드 검사
  admin-acl.sh            로컬 fix·check, 원격 audit(읽기 전용)·fix·check
  admin-acl-audit.sql     원격 audit의 rollback 전용 앱 롤 공격면 감사 SQL
  admin-acl.test.sh       비밀번호·argv·환경 격리 회귀시험
  admin-acl-audit.test.mjs 실제 DB metric·rollback·모바일 RPC 허용 목록 대조
tests/
  _prelude.sql            공통 픽스처·사후조건
  01_…34_*.sql            트랜잭션 DB 회귀 스위트
  concurrency.mjs         판매 저장과 마감·브레이크의 2세션 경합
src/database.types.ts     `pnpm db:types` 생성 타입
```

## 권위 데이터

- `inventory_events`: append-only 재고 원장. `inventory_states.stock_total`은 원장 합과 같아야 한다.
- `business_days`: 영업 시작 시 그날 계산 기준을 스냅샷으로 고정한다.
- `daily_sales`·`daily_sales_items`: 일 판매 장부와 판매 시점 메뉴명·판매가 스냅샷.
- `business_day_revisions`: 종료된 날의 판매 정정 전후 감사.
- `business_state_transitions`: 시작·브레이크·재개·종료·자동 전이 감사.
- `entity_change_events`: 식재료·레시피 직접 변경과 파생 전파 감사.
- `store_lifecycle_events`: 계정 삭제·폐점·물리 삭제 절차를 매장 삭제 뒤에도 보존하는 감사 원장.
- `store_purge_schedules`: 보존 종료 시각·승인 주체·승인 근거가 있는 service role 전용 삭제 예약.
- `price_trends`·`profit_trends`: 단가·손익 시점 스냅샷.

전파 이벤트 E1~E12(E6 없음)와 고정 검산값은 루트 [ARCHITECTURE.md](../../ARCHITECTURE.md)가 설명한다.

## 기본 명령

```bash
corepack pnpm db:start
corepack pnpm db:test
corepack pnpm db:types
```

`db:reset`은 로컬 Postgres를 지우고 마이그레이션과 시드를 다시 적용한다. 보존할 로컬 데이터가 있으면
먼저 dump를 만들고 복구 가능 여부를 확인한다.

```bash
corepack pnpm db:reset
```

스키마를 바꿀 때는 기존 파일을 고치지 않고 새 migration을 추가한 뒤 타입을 재생성한다. 단,
운영·스테이징에 한 번도 적용되지 않은 로컬 전용 파일은 검토 지시에 따라 재생성할 수 있다. 적용 이력이
있는 파일은 불변이며 새 migration으로 전진 복구한다.

## 격리된 새 DB와 업그레이드 경로

Windows에서는 Git Bash로 실행한다. DB 이름은 `fresh_` 접두사를 강제하며 정리도 같은 검사를 거친다.

```bash
bash packages/db/scripts/fresh-db.sh fresh_manual
PGDATABASE=fresh_manual node packages/db/tests/run.mjs
node packages/db/tests/concurrency.mjs fresh_manual
bash packages/db/scripts/fresh-db.sh --drop fresh_manual

# 지정 migration까지의 중간 상태
bash packages/db/scripts/fresh-db.sh --until 20260826000150 fresh_upgrade_probe
bash packages/db/scripts/fresh-db.sh --drop fresh_upgrade_probe

# 저장소가 보유한 실제 업그레이드 시나리오 전체
bash packages/db/scripts/upgrade-check.sh
```

루트 `corepack pnpm verify`의 ④가 새 DB·경합·로케일 실측 대조를, ⑤가 업그레이드 경로를 자동 실행하고
성공·실패와 무관하게 임시 DB 정리를 시도한다.

## ACL 검사

로컬 fresh DB는 생성 과정에서 `supabase_admin` 소유 객체의 기본 TRUNCATE·TRIGGER·REFERENCES 권한을
닫고 실제 프로브 테이블로 확인한다.

```bash
bash packages/db/scripts/admin-acl.sh --local postgres check
bash packages/db/scripts/admin-acl.test.sh
```

`--remote audit`은 `supabase_admin`으로 전환하지 않고 WHO 원값, ACL 마이그레이션, postgres 소유
rollback 프로브, 앱 롤의 위험 테이블 권한, RLS 비활성 public 표, 원장 직접 쓰기 경로,
integration·ops·Queue 원본 노출, 내부 RPC 권한과 앱이 직접 쓰는 facade RPC의 정확한 시그니처
허용 목록을 검사한다. 플랫폼 내부
롤의 기본 권한은 앱 감사와 분리해 예외로 보고한다. 2026-08-28 개발 DB 실측은 RLS 비활성 앱 표
`0개`이고, 0174 적용 전에는 원장 직접 쓰기 조합 `32개`, 허용 목록 밖 authenticated 함수
`87개`였다. 0174 이후 계약은 두 값 모두 `0개`다. 앱 롤은 감사 SQL의 정확한 64개 facade만
실행하며, 내부 함수와 원장 표 쓰기는 로그인할 수 없고 RLS를 우회하지 않는
`margincook_rpc_executor`만 사용한다. 기존 01~33 백색상자 시험은 이 실행 역할과 실제 JWT를 쓰고,
34번은 실제 `authenticated` 역할의 facade·RLS·직접 공격면을 검증한다.
0174 적용 뒤 executor에는 앱에 열리지 않은 postgres SECURITY DEFINER가 `0개`이며,
새 함수도 executor에 자동 공개하지 않는다. 새 facade가 내부 도우미를 필요로 하면
호출 그래프를 검토한 같은 migration에서 정확한 시그니처만 명시적으로 grant한다.

호스티드 접속은 가능하면 `ADMIN_DB_SSLMODE=verify-full`과 공급자가 제공한 CA 파일의
`ADMIN_DB_SSLROOTCERT`를 사용한다. `require`는 암호화만 하고 서버 인증서는 검증하지 않는다.
`--remote fix|check`는 접속 계정이 `supabase_admin`이거나 그 롤로 전환할 수 있을 때만 사용한다.
실제 운영 접속에서 `audit`을 실행하기 전에는 원격 ACL 적용까지 완료됐다고 기록하지 않는다.
[작업큐 P1-1](../../docs/작업큐.md#p1-1-원격-acl-읽기-전용-감사)을 따른다.

## 환경별 적용

- 로컬: 파괴적 reset과 합성 데이터 시험 허용.
- 스테이징: 유료 프로젝트를 만들고 로컬 링크·계획 확인까지 마쳤다. P0-5 승인 전에는 원격 적용하지 않는다.
- 운영: 별도 프로젝트를 만들었지만 이 작업 루트는 스테이징에만 링크한다. `main`의 승인된 migration만
  대상별 배포 가드로 순서대로 적용한다.

Supabase CLI는 P1-2 검증을 통과한 `2.116.0`으로 정확히 고정한다. 원격 프로젝트를 연결하기 전에
`migration list`의 로컬·원격 이력을 대조하고, `db push` 대상·SHA·백업·복구 절차를
[브랜치·DB 배포 운영 기획안](../../docs/브랜치-DB-운영-기획안.md)에 따라 확인한다.

### 원격 배포 가드

일반 `db push` 편의 명령은 두지 않는다. 스테이징과 운영은 각각 계획 명령으로 적용 예정 파일을 먼저
확인하고, 같은 가드를 적용 모드로 다시 실행한다.

```bash
# 공통: 정확한 main SHA와 대상 project ref를 승인값으로 고정
export MARGINCOOK_APPROVED_DEPLOY_SHA=<40자리-main-SHA>
export MARGINCOOK_STAGING_PROJECT_REF=<20자리-project-ref>
corepack pnpm db:deploy:staging:plan

# 계획 출력과 확인 문구를 대조한 뒤에만 적용
export MARGINCOOK_DEPLOY_CONFIRM=APPLY:staging:<project-ref>:<40자리-main-SHA>
corepack pnpm db:deploy:staging:apply
```

운영은 `MARGINCOOK_PRODUCTION_PROJECT_REF`와 `db:deploy:production:plan` / `db:deploy:production:apply`를
사용한다. 가드는 실제 링크 ref, 깨끗한 `main`, `origin/main`, 승인 SHA와 동일 SHA의
`protected-gate` 성공을 모두 확인한다. 계획 모드도 DB를 바꾸지 않는 `--dry-run`만 수행하고 출력만
남긴다. 링크를 대조한 뒤 CLI에도 같은 `--project-ref`를 명시하므로 검증 뒤 재링크가 대상을 바꾸지
못한다. 실제 적용이 성공하면 `docs/deployments/`에 `status: APPLIED` 기록이 생성된다.

프로젝트 링크·접속 자격·스테이징 검증·백업/복구 확인 없이 적용 명령을 실행하지 않는다.
