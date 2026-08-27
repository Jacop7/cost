#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# supabase_admin 기본 권한 회수 + **역할별 실제 생성 시험** (0166·0167 검토)
#
# 왜 따로인가 —
#   `alter default privileges for role supabase_admin …` 은 그 롤의 멤버(슈퍼유저)만 실행할 수
#   있다. 마이그레이션은 postgres 로 돌아 못 바꾸고, 그래서 그 롤이 public 에 만드는 표는
#   TRUNCATE/TRIGGER/REFERENCES 가 앱 롤에 열린 채 태어난다(검토 재현). 이 스크립트가
#   ① 기본 권한을 걷어내고 ② **그 롤로 표를 실제로 만들어** 닫혔는지 잰다(만들고 지운다).
#
# 쓰는 법 —
#   로컬 컨테이너:  bash packages/db/scripts/admin-acl.sh <db> [fix|check]
#   원격(운영·개발): ADMIN_DB_URL='postgresql://<슈퍼유저>@host:5432/postgres' \
#                   bash packages/db/scripts/admin-acl.sh postgres fix
#   fix   = 회수하고 잰다(기본)       check = 재기만 한다(배포 후 확인·CI 게이트)
#   프로브가 열려 있으면 exit 1 — 조용히 넘어가지 않는다.
#
# ⚠ 운영 배포 절차의 한 단계다. 마이그레이션(0167)은 이 상태를 NOTICE 로만 남긴다 —
#   배포가 여기서 멈추면 안 되지만, 이 스크립트의 `check` 가 빨간 채로 배포를 끝내면 안 된다.
# ════════════════════════════════════════════════════════════════
set -euo pipefail

D="${1:?사용법: admin-acl.sh <db> [fix|check]}"
MODE="${2:-fix}"
CT="${SUPABASE_DB_CONTAINER:-supabase_db_sikjae}"

if [ -n "${ADMIN_DB_URL:-}" ]; then
  run() { psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
  WHERE="$ADMIN_DB_URL"
else
  run() { docker exec -i -e PGPASSWORD="${SUPABASE_ADMIN_PASSWORD:-postgres}" "$CT" \
            psql -U supabase_admin -d "$D" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
  WHERE="$CT/$D (supabase_admin)"
fi

if [ "$MODE" = "fix" ]; then
  run -c "alter default privileges for role supabase_admin in schema public
          revoke truncate, trigger, references on tables from anon, authenticated;" \
    || { echo "admin-acl: 기본 권한 회수 실패 — 슈퍼유저(또는 supabase_admin 멤버) 접속이 필요합니다 [$WHERE]" >&2; exit 1; }
fi

# 실제 생성 시험 — 이 접속의 롤로 표를 만들어 본다. supabase_admin 접속이면 그 롤 소유가 된다.
PROBE=$(run <<'EOF'
create table public._acl_probe_admin (id int);
select has_table_privilege('authenticated', 'public._acl_probe_admin', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public._acl_probe_admin', 'TRIGGER')
    or has_table_privilege('authenticated', 'public._acl_probe_admin', 'REFERENCES')
    or has_table_privilege('anon', 'public._acl_probe_admin', 'TRUNCATE')
    or has_table_privilege('anon', 'public._acl_probe_admin', 'TRIGGER')
    or has_table_privilege('anon', 'public._acl_probe_admin', 'REFERENCES');
drop table public._acl_probe_admin;
EOF
) || { echo "admin-acl: 생성 시험 자체가 실패했습니다 [$WHERE]" >&2; exit 1; }

# 기본 권한 행에도 열린 글자(D/t/x)가 없어야 한다 — 프로브와 별개로 상태를 본다.
OPEN=$(run -c "select coalesce(string_agg(ro.rolname, ','), '')
                 from pg_default_acl a join pg_roles ro on ro.oid = a.defaclrole
                where a.defaclnamespace = 'public'::regnamespace and a.defaclobjtype = 'r'
                  and ro.rolname in ('postgres', 'supabase_admin')
                  and exists (select 1 from unnest(a.defaclacl) x
                               where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]');")

if [ "$PROBE" != "f" ] || [ -n "$OPEN" ]; then
  echo "admin-acl: 열려 있습니다 — 프로브=$PROBE 기본권한 열린 롤=[${OPEN:-없음}] [$WHERE]" >&2
  echo "           슈퍼유저 접속으로 'admin-acl.sh <db> fix' 를 실행하세요." >&2
  exit 1
fi
echo "admin-acl: ok — supabase_admin 이 만든 표가 앱 롤에 닫혀 있습니다 [$WHERE]"
