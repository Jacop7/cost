#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# supabase_admin 기본 권한 회수 + **그 롤로 실제 표를 만들어 보는 시험** (0166·0167 검토)
#
# 왜 따로인가 —
#   `alter default privileges for role supabase_admin …` 은 그 롤(또는 슈퍼유저)만 실행할 수
#   있다. 마이그레이션은 postgres 로 돌아 못 바꾸고, 그래서 그 롤이 public 에 만드는 표는
#   TRUNCATE/TRIGGER/REFERENCES 가 앱 롤에 열린 채 태어난다(검토 재현). 이 스크립트가
#   ① 기본 권한을 걷어내고 ② **supabase_admin 으로 표를 만들어** 닫혔는지 잰다(트랜잭션 안에서
#   만들고 롤백한다 — 중간에 실패해도 프로브 표가 남지 않는다).
#
# 쓰는 법 — 대상은 **명시적 모드**로만 고른다(환경변수 하나로 운영이 잡히면 안 된다 — 검토 P0).
#   로컬 컨테이너의 일회용 DB:  bash packages/db/scripts/admin-acl.sh --local <db> [fix|check]
#   원격(운영·개발):            ADMIN_DB_URL='postgresql://…' bash packages/db/scripts/admin-acl.sh --remote [fix|check]
#   fix   = 회수하고 잰다        check = 재기만 한다(배포 후 확인·게이트)
#   프로브가 열려 있으면 exit 1 — 조용히 넘어가지 않는다.
#
# ⚠ 운영 배포 절차의 한 단계다(`--remote fix` 한 번, 이후 `--remote check` 로 게이트).
#   마이그레이션(0167)은 이 상태를 NOTICE 로만 남긴다.
# ⚠ 접속 문자열은 로그에 찍지 않는다 — 비밀번호가 실린다. 대상 표시는 host/db 까지다.
# ════════════════════════════════════════════════════════════════
set -euo pipefail

usage() { echo "사용법: admin-acl.sh --local <db> [fix|check] | --remote [fix|check]  (원격은 ADMIN_DB_URL 필수)" >&2; exit 2; }

TARGET="${1:-}"; shift || true
case "$TARGET" in
  --local)
    D="${1:-}"; [ -n "$D" ] || usage; shift
    MODE="${1:-fix}"
    CT="${SUPABASE_DB_CONTAINER:-supabase_db_sikjae}"
    # 로컬은 ADMIN_DB_URL 을 **보지 않는다** — 값이 남아 있어도 컨테이너의 그 DB 만 건드린다.
    run() { docker exec -i -e PGPASSWORD="${SUPABASE_ADMIN_PASSWORD:-postgres}" "$CT" \
              psql -U supabase_admin -d "$D" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
    WHERE="local $CT/$D"
    ;;
  --remote)
    MODE="${1:-fix}"
    [ -n "${ADMIN_DB_URL:-}" ] || { echo "admin-acl: --remote 는 ADMIN_DB_URL(슈퍼유저 접속 문자열)이 필요합니다" >&2; exit 2; }
    run() { psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
    # 자격증명을 뗀 host/db 만 남긴다.
    WHERE="remote $(printf '%s' "$ADMIN_DB_URL" | sed -E 's#^[a-zA-Z]+://([^@/]*@)?##; s#\?.*$##')"
    ;;
  *) usage ;;
esac
case "$MODE" in fix|check) ;; *) usage ;; esac

# 원격 접속이 supabase_admin 이 아닌 슈퍼유저라면 그 롤이 되어 표를 만든다 — 재는 건 **supabase_admin 소유** 표다.
BECOME="do \$b\$ begin if current_user <> 'supabase_admin' then execute 'set local role supabase_admin'; end if; end \$b\$;"

if [ "$MODE" = "fix" ]; then
  run -c "begin; $BECOME
          alter default privileges for role supabase_admin in schema public
            revoke truncate, trigger, references on tables from anon, authenticated;
          commit;" \
    || { echo "admin-acl: 기본 권한 회수 실패 — supabase_admin(또는 슈퍼유저) 접속이 필요합니다 [$WHERE]" >&2; exit 1; }
fi

# 실제 생성 시험 — 트랜잭션 안에서 supabase_admin 으로 만들고 롤백한다(무엇도 남지 않는다).
PROBE=$(run <<EOF
begin;
$BECOME
create table public._acl_probe_admin (id int);
select (select rolname from pg_roles where oid = c.relowner) = 'supabase_admin'
       and not (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
             or has_table_privilege('authenticated', c.oid, 'TRIGGER')
             or has_table_privilege('authenticated', c.oid, 'REFERENCES')
             or has_table_privilege('anon', c.oid, 'TRUNCATE')
             or has_table_privilege('anon', c.oid, 'TRIGGER')
             or has_table_privilege('anon', c.oid, 'REFERENCES'))
  from pg_class c where c.oid = 'public._acl_probe_admin'::regclass;
rollback;
EOF
) || { echo "admin-acl: 생성 시험 자체가 실패했습니다 [$WHERE]" >&2; exit 1; }

# 기본 권한 행에도 열린 글자(D/t/x)가 없어야 한다 — 프로브와 별개로 상태를 본다.
OPEN=$(run -c "select coalesce(string_agg(ro.rolname, ','), '')
                 from pg_default_acl a join pg_roles ro on ro.oid = a.defaclrole
                where a.defaclnamespace = 'public'::regnamespace and a.defaclobjtype = 'r'
                  and ro.rolname in ('postgres', 'supabase_admin')
                  and exists (select 1 from unnest(a.defaclacl) x
                               where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]');")

if [ "$PROBE" != "t" ] || [ -n "$OPEN" ]; then
  echo "admin-acl: 열려 있습니다 — 프로브(supabase_admin 소유·닫힘)=$PROBE 기본권한 열린 롤=[${OPEN:-없음}] [$WHERE]" >&2
  echo "           supabase_admin(또는 슈퍼유저) 접속으로 'admin-acl.sh $TARGET ${D:-} fix' 를 실행하세요." >&2
  exit 1
fi
echo "admin-acl: ok — supabase_admin 이 만든 표가 앱 롤에 닫혀 있습니다 [$WHERE]"
