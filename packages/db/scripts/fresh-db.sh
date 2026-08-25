#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 빈 DB 에 마이그레이션 전체 + 시드를 태워 **새 DB** 를 만든다.
#
# 왜 필요한가 —
#   개발 DB 는 마이그레이션을 하나씩 손으로 태운 결과라, 순서가 틀렸거나 나중에
#   만들어지는 매장에만 생기는 문제를 못 잡는다. 실제로 여기서만 잡힌 것들 —
#     · 시드가 만드는 매장에 영업시간 규칙이 없어 영업 시작이 막혔다(0129)
#     · 트리거 기본값과 settings 컬럼 기본값이 갈렸다(0129)
#     · save_settings 가 규칙을 안 건드려 화면과 예정 종료가 달랐다(0130)
#
# 쓰는 법(어느 디렉터리에서 실행해도 된다):
#     bash packages/db/scripts/fresh-db.sh fresh_a
#     PGDATABASE=fresh_a node packages/db/tests/run.mjs
#     bash packages/db/scripts/fresh-db.sh --drop fresh_a
#
# ⚠ 로컬 supabase 컨테이너가 떠 있어야 한다(SUPABASE_DB_CONTAINER 로 바꿀 수 있다).
# ════════════════════════════════════════════════════════════════
set -euo pipefail

CT="${SUPABASE_DB_CONTAINER:-supabase_db_sikjae}"

# ── 경로 ────────────────────────────────────────────────────────
# ⚠ 상대경로를 쓰지 않는다. `pnpm --filter @sikjae/db fresh-db` 는 **패키지 디렉터리**
#   에서 돌기 때문에, `packages/db/supabase/...` 로 적으면
#   `packages/db/packages/db/supabase/...` 를 찾는다. 실제로 그랬다.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MIG_DIR="$DB_DIR/supabase/migrations"
SEED="$DB_DIR/supabase/seed.sql"

psql_d() { docker exec -i "$CT" psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }

# ── 이름 검사 ───────────────────────────────────────────────────
# ⚠ 인자가 그대로 `drop database` 에 들어간다. 여기서 안 막으면 —
#     · 오타 한 번(`fresh-db postgres`)에 개발 DB 가 날아간다
#     · 공백·세미콜론이 든 이름이면 SQL 이 그대로 실행된다
#     · 인자를 빠뜨리면 빈 이름으로 문법 오류가 나며 무슨 일이 났는지 모른다
#   그래서 **`fresh_` 로 시작하는 안전한 식별자만** 받는다. 실수로 지울 수 있는 DB 는
#   이 접두사를 쓰지 않는다.
DROP_ONLY=0
if [ "${1:-}" = "--drop" ]; then DROP_ONLY=1; shift; fi

D="${1:-}"
if [ -z "$D" ]; then
  echo "쓰는 법: fresh-db.sh [--drop] fresh_<이름>" >&2
  exit 2
fi
if ! printf '%s' "$D" | grep -Eq '^fresh_[a-z0-9_]{1,50}$'; then
  echo "DB 이름은 fresh_ 로 시작하는 소문자·숫자·밑줄이어야 합니다 (받은 값: '$D')" >&2
  echo "  일회용이 아닌 DB 를 실수로 지우지 않으려는 장치입니다." >&2
  exit 2
fi
case "$D" in
  postgres|template0|template1) echo "'$D' 는 지울 수 없습니다" >&2; exit 2 ;;
esac

if [ "$DROP_ONLY" = "1" ]; then
  psql_d postgres -c "drop database if exists $D;"
  echo "$D 삭제 완료"
  exit 0
fi

# ── 빈 DB ───────────────────────────────────────────────────────
psql_d postgres -c "drop database if exists $D;" -c "create database $D;"

psql_d "$D" <<EOF
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
alter database $D set search_path to "\$user", public, extensions;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as \$f\$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid \$f\$;
EOF

# 로컬 supabase 의 auth.users / auth.identities 모양을 그대로 흉내 낸다.
for t in users identities; do
  docker exec -i "$CT" psql -U postgres -d postgres -t -A -c "
    select 'create table auth.$t (' || string_agg(quote_ident(column_name)||' '||
      case when data_type='USER-DEFINED' then 'text' else data_type end, ', ' order by ordinal_position) ||
      case when '$t'='users' then ', primary key (id)' else '' end || ');'
    from information_schema.columns where table_schema='auth' and table_name='$t';" \
  | psql_d "$D"
done

# ── 권한: **마이그레이션보다 먼저** 정한다 ──────────────────────
# ⚠ 예전엔 마이그레이션을 다 태운 **뒤에** `grant all on all tables` 를 뿌렸다.
#   그러면 마이그레이션이 걷어낸 권한이 되살아난다 — 실제로 `operating_rules` 가
#   새 DB 에서만 `arwdDxt` 로 열려 있었고 아무도 못 봤다.
#
#   그걸 `revoke` 든 마이그레이션을 다시 태워 때웠는데, 그건 **그 마이그레이션 전체**
#   를 다시 실행하는 짓이다. 지금은 우연히 안전하지만, 나중에 데이터 변경이나 옛 함수
#   정의가 든 파일이 걸리면 마지막에 과거 코드로 덮어쓴다.
#
#   그래서 방향을 뒤집는다 — **기본 권한(default privileges)** 을 먼저 깔아 두면
#   마이그레이션이 만드는 테이블은 생길 때 권한을 받고, 그 뒤의 `revoke` 가 마지막
#   말이 된다. 다시 태울 것이 없다.
psql_d "$D" <<'EOF'
grant usage on schema public, extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on all tables in schema auth to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
-- ⚠ 함수는 **anon 과 PUBLIC 을 뺀다**(0135·0136). 로그인 안 한 사람이
--   `purge_entity_changes(1)` 로 모든 매장의 수정 내역을 지울 수 있었다(실측 128건).
--   테이블은 RLS 가 막아 주지만 `security definer` 함수는 RLS 를 지나간다 —
--   함수 권한이 유일한 문이다.
--
-- ⚠ **두 문장의 층이 다르다**(0136). 한쪽만 쓰면 절반만 걷힌다:
--     PUBLIC 은 PostgreSQL 의 **전역** 기본값 → `in schema` 를 **빼야** 걷힌다
--     anon   은 Supabase 가 넣은 **스키마별** 기본값 → `in schema` 를 **줘야** 걷힌다
--   실측: `in schema` 만 쓰면 새 함수가 PUBLIC=true anon=true 로 그대로 생긴다.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema extensions
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;
EOF

# ── 마이그레이션 ────────────────────────────────────────────────
shopt -s nullglob
for f in "$MIG_DIR"/*.sql; do
  psql_d "$D" < "$f" > /dev/null || { echo "MIGFAIL $(basename "$f")" >&2; exit 1; }
done
shopt -u nullglob

# ── 시드 ────────────────────────────────────────────────────────
psql_d "$D" < "$SEED" > /dev/null || { echo "SEEDFAIL" >&2; exit 1; }

echo "$D 준비 완료"
