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
# 쓰는 법 — 대상도 동작도 **명시적으로**만(검토: 환경변수 하나로 운영이 잡히거나 기본값이 fix 면 안 된다).
#   로컬 컨테이너의 일회용 DB:  bash packages/db/scripts/admin-acl.sh --local <db> <fix|check>
#       <db> 는 식별자(영소문자·숫자·_)만 — 접속 문자열은 거부한다.
#   원격(운영·개발):            ADMIN_DB_URL='…' [ADMIN_DB_PASSWORD='…'] bash packages/db/scripts/admin-acl.sh --remote <fix|check>
#       ADMIN_DB_URL 은 URI(postgresql://user@host/db) 또는 keyword(host=… dbname=… user=…) — **비밀번호는 금지**.
#       비밀번호는 ADMIN_DB_PASSWORD(환경으로만 psql 에 전달) 또는 PGPASSFILE/~/.pgpass 로 준다.
#       접속 문자열을 파싱해 비밀번호를 떼어 내는 짓은 하지 않는다 — ?password=, 탭 구분, 이스케이프 인용,
#       중복 password= 같은 형식에서 새어 나갔다(검토 실측). 비밀번호가 보이면 **거부**하고 값은 되풀이하지 않는다.
#   fix   = 회수하고 잰다        check = 재기만 한다(배포 후 확인·게이트)     ← 생략 불가
#   프로브가 열려 있으면 exit 1 — 조용히 넘어가지 않는다.
#
# ⚠ 운영 배포 절차의 한 단계다(`--remote fix` 한 번, 이후 `--remote check` 로 게이트).
#   접속 계정은 supabase_admin 이거나 그 롤로 전환할 수 있는 슈퍼유저여야 한다 — 먼저 확인하고
#   아니면 아무것도 바꾸지 않고 멈춘다. 마이그레이션(0167)은 이 상태를 NOTICE 로만 남긴다.
# ⚠ 자식 프로세스(psql·docker)에는 ADMIN_DB_URL·ADMIN_DB_PASSWORD 를 넘기지 않는다. 로그는 host/db 까지.
# ════════════════════════════════════════════════════════════════
set -euo pipefail

usage() {
  echo "사용법: admin-acl.sh --local <db> <fix|check> | --remote <fix|check>" >&2
  echo "        원격은 ADMIN_DB_URL(비밀번호 없이) 필수, 비밀번호는 ADMIN_DB_PASSWORD 또는 PGPASSFILE" >&2
  exit 2
}

TARGET="${1:-}"; shift || true
PGPW=""          # 비밀번호는 여기에만 — run() 이 환경변수로만 넘긴다
case "$TARGET" in
  --local)
    D="${1:-}"; [ -n "$D" ] || usage; shift
    MODE="${1:-}"
    # 식별자만 — `postgresql://…` 같은 접속 문자열을 psql -d 가 URI 로 읽는다(검토 재현). 값은 되풀이하지 않는다.
    if ! printf '%s' "$D" | grep -Eq '^[a-z_][a-z0-9_]{0,62}$'; then
      echo "admin-acl: --local 의 DB 이름은 식별자(영소문자·숫자·_)만 됩니다 (받은 값 ${#D}자, 되풀이하지 않음)" >&2; exit 2
    fi
    CT="${SUPABASE_DB_CONTAINER:-supabase_db_sikjae}"
    PGPW="${SUPABASE_ADMIN_PASSWORD:-postgres}"
    # -e PGPASSWORD (값 없이) — docker 가 환경에서 가져간다. argv 에는 이름만 남는다.
    run() { env -u ADMIN_DB_URL -u ADMIN_DB_PASSWORD PGPASSWORD="$PGPW" docker exec -i -e PGPASSWORD "$CT" \
              psql -U supabase_admin -d "$D" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
    WHERE="local $CT/$D"
    ;;
  --remote)
    MODE="${1:-}"
    CONN="${ADMIN_DB_URL:-}"
    [ -n "$CONN" ] || { echo "admin-acl: --remote 는 ADMIN_DB_URL(접속 문자열, 비밀번호 없이)이 필요합니다" >&2; exit 2; }
    # 비밀번호가 실려 있으면 거부 — 어떤 형식이든(URI userinfo · ?password= · keyword password= · 탭/줄바꿈 구분).
    if printf '%s' "$CONN" | grep -Eiq '(^|[[:space:]?&;])password=' \
       || printf '%s' "$CONN" | grep -Eq '^[a-zA-Z]+://[^@/]*:[^@/]*@'; then
      echo "admin-acl: ADMIN_DB_URL 에 비밀번호를 넣지 마세요 — ADMIN_DB_PASSWORD 또는 PGPASSFILE 로 주세요 (값은 되풀이하지 않음)" >&2; exit 2
    fi
    PGPW="${ADMIN_DB_PASSWORD:-}"
    # 자식에는 ADMIN_* 를 넘기지 않는다. 비밀번호는 PGPASSWORD 환경으로만(없으면 libpq 가 PGPASSFILE/~/.pgpass 를 본다).
    if [ -n "$PGPW" ]; then
      run() { env -u ADMIN_DB_URL -u ADMIN_DB_PASSWORD PGPASSWORD="$PGPW" psql "$CONN" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
    else
      run() { env -u ADMIN_DB_URL -u ADMIN_DB_PASSWORD psql "$CONN" -v ON_ERROR_STOP=1 -q -t -A "$@"; }
    fi
    case "$CONN" in
      *://*) WHERE="remote $(printf '%s' "$CONN" | sed -E 's#^[a-zA-Z]+://([^@/]*@)?##; s#\?.*$##')" ;;
      *)     WHERE="remote $(printf '%s' "$CONN" | tr '\t\n' '  ' | sed -nE 's/.*(^| )host=([^ ]*).*/\2/p')/$(printf '%s' "$CONN" | tr '\t\n' '  ' | sed -nE 's/.*(^| )dbname=([^ ]*).*/\2/p')" ;;
    esac
    ;;
  *) usage ;;
esac
case "$MODE" in fix|check) ;; *) usage ;; esac

# 접속 계정 확인 — supabase_admin 이거나 그 롤이 될 수 있는 슈퍼유저여야 한다. 아니면 아무것도 안 바꾼다.
WHO=$(run -c "select current_user || '|' || (select rolsuper from pg_roles where rolname = current_user)::text
                     || '|' || pg_has_role(current_user, 'supabase_admin', 'member')::text;") \
  || { echo "admin-acl: 접속 실패 [$WHERE]" >&2; exit 1; }
case "$WHO" in
  supabase_admin\|*|*\|true\|*|*\|*\|true) ;;
  *) echo "admin-acl: 이 계정(${WHO%%|*})은 supabase_admin 도, 그 롤로 전환할 수 있는 슈퍼유저도 아닙니다 — 아무것도 바꾸지 않았습니다 [$WHERE]" >&2; exit 1 ;;
esac

# 접속 롤이 supabase_admin 이 아니면 그 롤이 되어 실행한다 — 재는 건 **supabase_admin 소유** 표다.
BECOME="do \$b\$ begin if current_user <> 'supabase_admin' then execute 'set local role supabase_admin'; end if; end \$b\$;"

if [ "$MODE" = "fix" ]; then
  run -c "begin; $BECOME
          alter default privileges for role supabase_admin in schema public
            revoke truncate, trigger, references on tables from anon, authenticated;
          commit;" \
    || { echo "admin-acl: 기본 권한 회수 실패 [$WHERE]" >&2; exit 1; }
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
  echo "           'admin-acl.sh $TARGET ${D:-} fix' 를 실행하세요." >&2
  exit 1
fi
echo "admin-acl: ok — supabase_admin 이 만든 표가 앱 롤에 닫혀 있습니다 [$WHERE]"
