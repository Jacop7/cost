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
# `--until <14자리>` 로 **그 마이그레이션까지만** 태울 수 있다. 업그레이드 경로를 재는 데 쓴다 —
# 최종 상태만 보면 `앞 마이그레이션이 만들어 놓은 값을 뒤 마이그레이션이 검사해서 통과`
# 하는 구멍을 못 잡는다(실제로 0151→0152 가 그랬다).
#     bash packages/db/scripts/fresh-db.sh --until 20260826000150 fresh_up
#
# ⚠ 로컬 supabase 컨테이너가 떠 있어야 한다(SUPABASE_DB_CONTAINER 로 바꿀 수 있다).
# ════════════════════════════════════════════════════════════════
set -euo pipefail

CT="${SUPABASE_DB_CONTAINER:-supabase_db_margincook}"

# ── 경로 ────────────────────────────────────────────────────────
# ⚠ 상대경로를 쓰지 않는다. `pnpm --filter @margincook/db fresh-db` 는 **패키지 디렉터리**
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
UNTIL=""
while true; do
  case "${1:-}" in
    --drop)  DROP_ONLY=1; shift ;;
    --until) # ⚠ 값이 있는지 **먼저** 본다. `shift 2` 를 앞세우면 인자가 하나뿐일 때
             #   shift 가 실패하고 `set -e` 가 **아무 말 없이** 끝낸다(실측 exit 1, 출력 0줄).
             [ "$#" -ge 2 ] || {
               echo "--until 뒤에 14자리 마이그레이션 접두사가 필요합니다" >&2; exit 2; }
             UNTIL="$2"; shift 2
             printf '%s' "$UNTIL" | grep -Eq '^[0-9]{14}$' || {
               echo "--until 은 14자리 마이그레이션 접두사여야 합니다 (받은 값: '$UNTIL')" >&2; exit 2; }
             # ⚠ 형식만 보면 **없는 번호**도 통과한다. 그러면 전체를 다 태우고도
             #   "그 번호까지 준비됐다" 고 말한다 — 업그레이드 검사가 거짓으로 초록이 된다.
             # ⚠ `ls` 로 세면 안 된다. 매칭이 없을 때 `ls` 가 2 로 끝나고, `pipefail` 때문에
             #   대입이 실패해 스크립트가 **아무 말 없이** 죽는다(실제로 그랬다 — exit 2, 출력 없음).
             shopt -s nullglob
             _hit=( "$MIG_DIR/${UNTIL}"_*.sql )
             shopt -u nullglob
             [ "${#_hit[@]}" = "1" ] || {
               echo "--until $UNTIL 에 맞는 마이그레이션이 ${#_hit[@]}개입니다 (정확히 1개여야 합니다)" >&2
               exit 2; } ;;
    *) break ;;
  esac
done

D="${1:-}"
if [ -z "$D" ]; then
  echo "쓰는 법: fresh-db.sh [--drop] [--until <14자리>] fresh_<이름>" >&2
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

# supabase_admin 이 만들 테이블의 기본 권한 — postgres 는 이 롤의 멤버가 아니라 못 바꾼다(0166 경고).
# 슈퍼유저 접속으로 걷어내고 **그 롤로 표를 실제로 만들어** 닫혔는지 잰다. 운영·개발 DB 도 같은
# 스크립트를 배포 절차에서 부른다(ADMIN_DB_URL). 시험 스위트는 postgres 세션이라 이 롤이 못 된다.
# ⚠ --local 이라 ADMIN_DB_URL 을 보지 않지만, 혹시 남아 있어도 상속되지 않게 지운다(검토 P0).
env -u ADMIN_DB_URL bash "$(dirname -- "${BASH_SOURCE[0]}")/admin-acl.sh" --local "$D" fix >/dev/null || exit 1

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
  b="$(basename "$f")"
  # `--until` 이 있으면 그 접두사보다 뒤엣것은 안 태운다(이름이 시각 순이라 사전순 비교로 충분).
  if [ -n "$UNTIL" ] && [ "${b:0:14}" \> "$UNTIL" ]; then break; fi
  psql_d "$D" < "$f" > /dev/null || { echo "MIGFAIL $b" >&2; exit 1; }
done
shopt -u nullglob

# ── 시드 ────────────────────────────────────────────────────────
psql_d "$D" < "$SEED" > /dev/null || { echo "SEEDFAIL" >&2; exit 1; }

echo "$D 준비 완료${UNTIL:+ (${UNTIL} 까지)}"
