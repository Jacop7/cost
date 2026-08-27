# @sikjae/db — Supabase 데이터 레이어

스키마·RLS·권위 RPC·Cron·시드·DB 회귀시험의 단일 출처다. 앱과 Worker는 재고·단가·손익을 직접
고치지 않고 이 패키지의 공개 RPC를 통과해야 한다.

## 현재 기준

- 마이그레이션 161개, 최신 `20260826000172_settings_revision_noop_tax.sql`
- 번호가 붙은 DB 회귀 스위트 32개
- public 업무 테이블 28개
- 자동 종료·자동 브레이크·변경 이력 청소 pg_cron 3종
- 로컬 마이그레이션 장부와 파일 161/161 일치(2026-08-28 재구축 확인)

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
  admin-acl.sh            로컬/원격 supabase_admin 기본 ACL fix·check
  admin-acl.test.sh       비밀번호·argv·환경 격리 회귀시험
tests/
  _prelude.sql            공통 픽스처·사후조건
  01_…32_*.sql            트랜잭션 DB 회귀 스위트
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

`--remote fix|check`는 접속 계정이 `supabase_admin`이거나 그 롤로 전환 가능한 슈퍼유저일 때만 동작한다.
호스티드 Supabase 계정에서 이 전환이 가능한지는 아직 실측하지 않았다. 전환 불가 환경을 위한 읽기 전용
`audit` 모드는 아직 구현되지 않았으므로, 첫 원격 연결은
[작업큐 P1-1](../../docs/작업큐.md#p1-1-원격-acl-읽기-전용-감사) 전까지 ACL 단계에서 중단한다.
불가능한 `check`를 성공으로 기록하거나 수동 SQL로 우회하지 않는다.

## 환경별 적용

- 로컬: 파괴적 reset과 합성 데이터 시험 허용.
- 스테이징: 아직 미구축. 운영과 같은 migration/RLS/RPC 계약을 합성 데이터로 검증할 환경이다.
- 운영: 아직 프로젝트 링크와 적용 이력이 확인되지 않았다. `main`의 승인된 migration만 순서대로 적용한다.

현재 Supabase CLI v1 유지 여부와 v2 전환은 P1-2 미결정이다. 원격 프로젝트를 연결하기 전에
`migration list`의 로컬·원격 이력을 대조하고, `db push` 대상·SHA·백업·복구 절차를
[브랜치·DB 배포 운영 기획안](../../docs/브랜치-DB-운영-기획안.md)에 따라 확인한다.
