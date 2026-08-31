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
# 쓰는 법 — 대상도 동작도 **명시적으로**만.
#   로컬 컨테이너의 일회용 DB:
#       bash packages/db/scripts/admin-acl.sh --local <db> <fix|check>
#       <db> 는 식별자(영소문자·숫자·_)만 — 접속 문자열은 거부한다.
#   원격(운영·개발) — 접속 정보는 **항목별 환경변수**로만 받는다. 접속 문자열(URL/keyword)은 받지 않는다:
#       ADMIN_DB_HOST=db.example.com ADMIN_DB_USER=supabase_admin [ADMIN_DB_PORT=5432] [ADMIN_DB_NAME=postgres]
#       [ADMIN_DB_SSLMODE=require] [ADMIN_DB_SSLROOTCERT=/path/ca.crt] [ADMIN_DB_PASSWORD=…]
#         bash packages/db/scripts/admin-acl.sh --remote <audit|fix|check>
#       · 값마다 문자 집합·범위를 검사한다(여러 줄·공백·=·따옴표는 거부, 포트는 1~65535, IPv6 는 그대로).
#       · psql 은 **비운 환경**에서 뜬다 — 격리된 서브셸에서 export 변수를 전부 unset 하고 필요한 것만 export 한 뒤
#         exec 한다. 비밀번호는 psql 은 물론 env 같은 **중간 명령의 argv 에도** 실리지 않는다(검토 P1: `env -i A=… cmd`
#         는 env 프로세스의 명령행에 값이 보였다). 셸의 PGSSLROOTCERT·PGSSLKEY·PGCHANNELBINDING·PGSERVICE·PGPASSWORD
#         같은 것은 하나도 상속되지 않는다.
#       · 비밀번호는 ADMIN_DB_PASSWORD 가 있으면 그것만 PGPASSWORD 로, 없으면 PGPASSFILE(있으면 그 경로,
#         없으면 libpq 기본 ~/.pgpass — Windows 는 %APPDATA%\postgresql\pgpass.conf)에 맡긴다.
#       · `bash -x` 의 PS4 는 스크립트 첫 명령보다 먼저 평가될 수 있다. 따라서 xtrace 진단에는
#         ADMIN_DB_PASSWORD/SUPABASE_ADMIN_PASSWORD 를 환경으로 주지 말고 PGPASSFILE 을 쓴다.
#         스크립트 안에서 이를 사후 차단하면 이미 출력된 비밀을 되돌릴 수 없으므로, 이 조합을
#         안전하다고 약속하지 않는다(admin-acl.test.sh 가 custom PS4 + PGPASSFILE 경로를 잰다).
#   audit = 영구 변경 없이 앱 롤 공격면을 잰다(호스티드 우선 게이트, supabase_admin 전환 없음)
#   fix   = 회수하고 잰다        check = 재기만 한다(배포 후 확인·게이트)     ← 생략 불가
#   프로브가 열려 있으면 exit 1 — 조용히 넘어가지 않는다.
#
# ⚠ 운영 배포 절차의 한 단계다(`--remote fix` 한 번, 이후 `--remote check` 로 게이트).
#   접속 계정은 supabase_admin 이거나 그 롤로 전환할 수 있는 슈퍼유저여야 한다 — 먼저 확인하고
#   아니면 아무것도 바꾸지 않고 멈춘다. 마이그레이션(0167)은 이 상태를 NOTICE 로만 남긴다.
# ⚠ 로그는 host/db 까지. 받은 값이 틀려도 되풀이하지 않는다.
# ════════════════════════════════════════════════════════════════
# 본체는 privileged mode(`bash -p`)에서만 돈다. 이 모드는 환경에서 가져온 BASH_FUNC_* 함수와
# SHELLOPTS/BASHOPTS 를 적용하지 않는다. `/bin/bash` 는 경로로 직접 실행하므로 밖에서 export 한
# set/unset/export/exec/compgen 함수가 이 부트스트랩을 가로챌 수 없다. 부모 분기는 자격증명을
# 읽지도, 다른 명령을 실행하지도 않고 자식의 종료 상태를 그대로 돌려준다.
# xtrace + 환경 비밀번호는 명시적으로 거부한다. 기본 PS4 에서는 아래 문구를 내고 exit 2지만,
# custom PS4 가 비밀번호를 참조했다면 **이 첫 조건을 실행하기 전** 이미 샐 수 있다. 그래서 진단
# 계약은 환경 비밀번호 자체를 주지 않고 PGPASSFILE 을 쓰는 것이다.
if [[ $- == *x* && ( -v ADMIN_DB_PASSWORD || -v SUPABASE_ADMIN_PASSWORD ) ]]; then
  /usr/bin/printf '%s\n' 'admin-acl: xtrace(-x)에서는 환경 비밀번호를 받지 않습니다 — PGPASSFILE을 사용하세요' >&2
  /bin/bash -p -c 'exit 2'
elif [[ ! -o privileged ]]; then
  /bin/bash -p "$0" "$@"
else
set -euo pipefail
# 일반 xtrace 는 본체 첫 줄에서 끈다. 단, custom PS4 가 비밀번호 환경변수를 참조하면 이 줄보다
# 먼저 샐 수 있으므로 위 계약대로 그 진단에는 PGPASSFILE 만 사용한다.
{ set +x; } 2>/dev/null
# 자격증명 환경을 가진 채 dirname/pwd 같은 자식 프로세스를 띄우지 않는다. 슬래시 없는
# `bash admin-acl.sh` 호출도 현재 디렉터리의 짝 SQL을 찾게 한다.
case "${BASH_SOURCE[0]}" in
  */*) AUDIT_SQL_FILE="${BASH_SOURCE[0]%/*}/admin-acl-audit.sql" ;;
  *)   AUDIT_SQL_FILE="./admin-acl-audit.sql" ;;
esac

usage() {
  echo "사용법: admin-acl.sh --local <db> <fix|check> | --remote <audit|fix|check>" >&2
  echo "        원격: ADMIN_DB_HOST ADMIN_DB_USER [ADMIN_DB_PORT] [ADMIN_DB_NAME] [ADMIN_DB_SSLMODE] [ADMIN_DB_SSLROOTCERT] [ADMIN_DB_PASSWORD | PGPASSFILE]" >&2
  exit 2
}

# 자식이 받을 최소 환경 — 나머지 export 변수는 서브셸 안에서 전부 unset 한다(부모 셸은 그대로).
# ⚠ `env -i A=1 B=2 cmd` 는 A·B 가 env 프로세스의 argv 에 실린다 — 비밀번호가 새는 길이었다(검토 P1).
KEEP_ENV=' PATH HOME LANG LC_ALL USERPROFILE SYSTEMROOT SystemRoot TEMP TMP APPDATA LOCALAPPDATA PROGRAMDATA HOMEDRIVE HOMEPATH USERNAME COMSPEC '
scrub_env() {
  { set +x; } 2>/dev/null      # 서브셸에서도 xtrace 는 꺼진 채(SHELLOPTS 로 켜져 들어와도)
  local v
  # `builtin` — 밖에서 export 된 같은 이름의 함수로 목록을 속이지 못하게(검토 지적).
  for v in $(builtin compgen -e); do
    case "$KEEP_ENV" in *" $v "*) ;; *) builtin unset "$v" 2>/dev/null || true ;; esac
  done
  builtin export LANG="${LANG:-C.UTF-8}"
}

TARGET="${1:-}"; shift || true
case "$TARGET" in
  --local)
    D="${1:-}"; [ -n "$D" ] || usage; shift
    MODE="${1:-}"
    # 식별자만 — `postgresql://…` 같은 접속 문자열을 psql -d 가 URI 로 읽는다(검토 재현). 값은 되풀이하지 않는다.
    [[ "$D" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] \
      || { echo "admin-acl: --local 의 DB 이름은 식별자(영소문자·숫자·_)만 됩니다 (받은 값 ${#D}자, 되풀이하지 않음)" >&2; exit 2; }
    CT="${SUPABASE_DB_CONTAINER:-supabase_db_margincook}"
    [[ "$CT" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || { echo "admin-acl: SUPABASE_DB_CONTAINER 형식이 아닙니다" >&2; exit 2; }
    LPW="${SUPABASE_ADMIN_PASSWORD:-postgres}"
    # 격리된 서브셸: 환경을 비우고 PGPASSWORD 만 export 한 뒤 exec. docker 에는 -e PGPASSWORD(이름만)로 넘긴다 —
    # 어떤 argv 에도 비밀번호가 없다.
    run() { ( scrub_env; builtin export PGPASSWORD="$LPW"; builtin exec docker exec -i -e PGPASSWORD "$CT" \
              psql -U supabase_admin -d "$D" -v ON_ERROR_STOP=1 -q -t -A "$@" ); }
    WHERE="local $CT/$D"
    ;;
  --remote)
    MODE="${1:-}"
    if [ -n "${ADMIN_DB_URL:-}" ]; then
      echo "admin-acl: ADMIN_DB_URL 은 더는 받지 않습니다 — ADMIN_DB_HOST/PORT/NAME/USER(+ADMIN_DB_PASSWORD 또는 PGPASSFILE)로 주세요" >&2; exit 2
    fi
    H="${ADMIN_DB_HOST:-}"; P="${ADMIN_DB_PORT:-5432}"; N="${ADMIN_DB_NAME:-postgres}"; U="${ADMIN_DB_USER:-}"
    SSL="${ADMIN_DB_SSLMODE:-require}"; CA="${ADMIN_DB_SSLROOTCERT:-}"
    [ -n "$H" ] && [ -n "$U" ] || { echo "admin-acl: --remote 는 ADMIN_DB_HOST 와 ADMIN_DB_USER 가 필요합니다" >&2; exit 2; }
    # bash 의 =~ 는 문자열 전체에 앵커된다 — 여러 줄 값은 문자 집합에 줄바꿈이 없어 통과하지 못한다(grep 은 줄마다 봐서 뚫렸다).
    [[ "$H" =~ ^[A-Za-z0-9._:-]{1,253}$ ]] || { echo "admin-acl: ADMIN_DB_HOST 형식이 아닙니다(호스트명 또는 IPv4/IPv6 리터럴만)" >&2; exit 2; }
    [[ "$P" =~ ^[0-9]{1,5}$ ]] && [ "$P" -ge 1 ] && [ "$P" -le 65535 ] || { echo "admin-acl: ADMIN_DB_PORT 는 1~65535 여야 합니다" >&2; exit 2; }
    [[ "$N" =~ ^[A-Za-z0-9_.-]{1,63}$ ]]  || { echo "admin-acl: ADMIN_DB_NAME 형식이 아닙니다" >&2; exit 2; }
    [[ "$U" =~ ^[A-Za-z0-9_.-]{1,63}$ ]]  || { echo "admin-acl: ADMIN_DB_USER 형식이 아닙니다" >&2; exit 2; }
    case "$SSL" in disable|allow|prefer|require|verify-ca|verify-full) ;; *) echo "admin-acl: ADMIN_DB_SSLMODE 값이 아닙니다" >&2; exit 2 ;; esac
    if [ -n "$CA" ]; then
      # 경로는 OS 마다 모양이 달라 문자 집합 대신 "한 줄이고 읽을 수 있는 파일"만 본다.
      [[ "$CA" != *$'\n'* ]] && [ -r "$CA" ] || { echo "admin-acl: ADMIN_DB_SSLROOTCERT 는 읽을 수 있는 파일 경로(한 줄)여야 합니다" >&2; exit 2; }
    fi
    RPW="${ADMIN_DB_PASSWORD:-}"; RPF="${PGPASSFILE:-}"
    # 접속 정보는 전부 libpq 환경변수로 — 격리된 서브셸에서 환경을 비우고 export 한 뒤 exec 한다.
    # argv 에는 psql 옵션만 남고, 비밀번호는 env 같은 중간 명령의 argv 에도 실리지 않는다(검토 P1).
    run() { (
      scrub_env
      builtin export PGHOST="$H" PGPORT="$P" PGDATABASE="$N" PGUSER="$U" PGSSLMODE="$SSL" PGCONNECT_TIMEOUT=15
      [ -n "$CA" ] && builtin export PGSSLROOTCERT="$CA"
      if [ -n "$RPW" ]; then builtin export PGPASSWORD="$RPW"
      elif [ -n "$RPF" ]; then builtin export PGPASSFILE="$RPF"   # 비밀번호를 안 줬으면 파일에만 맡긴다 — 셸의 PGPASSWORD 는 scrub 으로 사라진다.
      fi
      builtin exec psql -v ON_ERROR_STOP=1 -q -t -A "$@"
    ); }
    WHERE="remote $H:$P/$N"
    ;;
  *) usage ;;
esac
case "$MODE" in
  fix|check) ;;
  audit) [ "$TARGET" = "--remote" ] || usage ;;
  *) usage ;;
esac

# 호스티드 대체 게이트. 영구 변경은 하지 않고, 프로브도 같은 트랜잭션에서 rollback한다.
# `supabase_admin` 전환 가능 여부는 사실로만 출력한다. 전환 불가가 감사 실패 사유는 아니다.
if [ "$MODE" = "audit" ]; then
  WHO=$(run -c "select current_user || '|' || coalesce((select rolsuper from pg_roles where rolname = current_user), false)::text
                       || '|' || coalesce(pg_has_role(current_user, 'supabase_admin', 'member'), false)::text;") \
    || { echo "admin-acl: 접속 실패 [$WHERE]" >&2; exit 1; }
  IFS='|' read -r AUDIT_USER AUDIT_SUPER AUDIT_MEMBER <<< "$WHO"
  echo "admin-acl: audit identity current_user=$AUDIT_USER rolsuper=$AUDIT_SUPER supabase_admin_member=$AUDIT_MEMBER [$WHERE]"

  [ -r "$AUDIT_SQL_FILE" ] || { echo "admin-acl: audit SQL 파일을 읽을 수 없습니다(기대 경로: $AUDIT_SQL_FILE)" >&2; exit 1; }
  AUDIT=$(run -f "$AUDIT_SQL_FILE") \
    || { echo "admin-acl: audit SQL 실행 실패 — 아무것도 바꾸지 않았습니다 [$WHERE]" >&2; exit 1; }

  failed=""; seen=" "
  platform_open="알 수 없음"
  while IFS='|' read -r metric value expected; do
    [ -n "$metric" ] || continue
    case "$seen" in *" $metric "*) failed="${failed}${failed:+, }duplicate_metric=$metric" ;; esac
    seen="$seen$metric "
    case "$metric" in
      platform_default_open) platform_open="$value" ;;
      migrations) [ "$value" = "2" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      probe_owner) [ "$value" = "postgres" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      protected_objects) [ "$value" = "6" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      blocked_internal_rpc_objects) [ "$value" = "11" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      rpc_executor_role) [ "$value" = "1" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      facade_rpc_objects) [ "$value" = "65" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      probe_dangerous|public_dangerous|protected_writes|source_schema_grants|supabase_admin_objects|anon_rpc|blocked_internal_rpc|facade_rpc_missing|unapproved_authenticated_rpc|rls_disabled_app_tables|ledger_write_paths|international_contract_view_acl_invalid)
        [ "$value" = "0" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      rpc_executor_facades_invalid|rpc_executor_privileged_maintenance|rls_policy_helper_calls)
        [ "$value" = "0" ] || failed="${failed}${failed:+, }$metric=$value" ;;
      *) failed="${failed}${failed:+, }unknown_metric=$metric" ;;
    esac
    echo "admin-acl: audit $metric=$value ($expected)"
  done <<< "$AUDIT"

  # 필수 metric이 하나라도 없으면 실패한다. 빈 출력·부분 출력·중복 행은 성공으로 위장할 수 없다.
  for required in migrations probe_owner probe_dangerous public_dangerous protected_objects protected_writes \
                  source_schema_grants supabase_admin_objects anon_rpc blocked_internal_rpc blocked_internal_rpc_objects \
                  rpc_executor_role rpc_executor_facades_invalid rpc_executor_privileged_maintenance \
                  rls_policy_helper_calls facade_rpc_objects facade_rpc_missing unapproved_authenticated_rpc \
                  rls_disabled_app_tables ledger_write_paths international_contract_view_acl_invalid platform_default_open; do
    case "$seen" in *" $required "*) ;; *) failed="${failed}${failed:+, }missing_metric=$required" ;; esac
  done

  if [ -n "$failed" ]; then
    echo "admin-acl: audit 실패 — $failed [$WHERE]" >&2
    exit 1
  fi
  if [ "$platform_open" != "0" ]; then
    echo "admin-acl: audit platform-exception — supabase_admin 기본 권한 열린 행=$platform_open; 전환 가능하면 fix→check, 불가능하면 플랫폼 관리 영역으로 기록하세요 [$WHERE]"
  fi
  echo "admin-acl: audit ok — 측정한 애플리케이션 ACL 항목이 닫혀 있습니다(플랫폼 기본 권한과 별도) [$WHERE]"
  exit 0
fi

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
fi
