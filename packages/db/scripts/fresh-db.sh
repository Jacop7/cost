#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 빈 DB 에 마이그레이션 전체 + 시드를 태워 **새 DB** 를 만든다.
#
# 왜 필요한가 —
#   개발 DB 는 마이그레이션을 하나씩 손으로 태운 결과라, 순서가 틀렸거나 나중 매장에만
#   생기는 문제를 못 잡는다. 실제로 여기서만 잡힌 것들이 있다 —
#     · 시드가 만드는 매장에 영업시간 규칙이 없어 영업 시작이 막혔다(0129)
#     · 트리거 기본값과 settings 컬럼 기본값이 갈렸다(0129)
#     · save_settings 가 규칙을 안 건드려 화면과 예정 종료가 달랐다(0130)
#
# 쓰는 법:
#     bash packages/db/scripts/fresh-db.sh mydb
#     PGDATABASE=mydb node packages/db/tests/run.mjs
#     docker exec -i supabase_db_sikjae psql -U postgres -d postgres -c 'drop database mydb;'
#
# ⚠ 로컬 supabase 컨테이너(`supabase_db_sikjae`)가 떠 있어야 한다.
#   프로젝트 루트에서 실행한다(마이그레이션 경로가 상대경로다).
# ════════════════════════════════════════════════════════════════
set -e
D=$1
docker exec -i supabase_db_sikjae psql -U postgres -d postgres -q -c "drop database if exists $D;" -c "create database $D;"
docker exec -i supabase_db_sikjae psql -U postgres -d $D -v ON_ERROR_STOP=1 -q <<EOF
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
alter database $D set search_path to "\$user", public, extensions;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as \$f\$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid \$f\$;
EOF
for t in users identities; do
  docker exec -i supabase_db_sikjae psql -U postgres -d postgres -t -A -c "
    select 'create table auth.$t (' || string_agg(quote_ident(column_name)||' '||
      case when data_type='USER-DEFINED' then 'text' else data_type end, ', ' order by ordinal_position) ||
      case when '$t'='users' then ', primary key (id)' else '' end || ');'
    from information_schema.columns where table_schema='auth' and table_name='$t';" \
  | docker exec -i supabase_db_sikjae psql -U postgres -d $D -v ON_ERROR_STOP=1 -q
done
for f in $(ls packages/db/supabase/migrations/*.sql | sort); do
  docker exec -i supabase_db_sikjae psql -U postgres -d $D -v ON_ERROR_STOP=1 -q < "$f" > /dev/null 2>&1 || { echo "MIGFAIL $f"; exit 1; }
done
docker exec -i supabase_db_sikjae psql -U postgres -d $D -q >/dev/null 2>&1 <<EOF
grant usage on schema public, extensions to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on all tables in schema auth to authenticated, service_role;
EOF
# ⚠ 위 `grant all on all tables` 가 마이그레이션이 걷어낸 권한을 되살린다.
#   실제로 그것 때문에 새 DB 만 `operating_rules` 가 `arwdDxt` 로 열려 있었고,
#   개발 DB 만 보고 있어서 아무도 못 봤다. 권한이 풀렸는지는 아무도 안 본다.
#
#   그래서 **`revoke` 가 들어 있는 마이그레이션을 다시 태운다.** 파일 이름을 나열하지
#   않는 이유는 다음에 하나 더 생겨도 저절로 걸리게 하기 위해서다.
for f in $(grep -ril '^[[:space:]]*revoke' packages/db/supabase/migrations/*.sql | sort); do
  docker exec -i supabase_db_sikjae psql -U postgres -d $D -v ON_ERROR_STOP=1 -q < "$f" > /dev/null 2>&1 || { echo "REGRANTFAIL $f"; exit 1; }
done
docker exec -i supabase_db_sikjae psql -U postgres -d $D -v ON_ERROR_STOP=1 -q < packages/db/supabase/seed.sql > /dev/null 2>&1 || { echo "SEEDFAIL"; exit 1; }
echo "$D 준비 완료"
