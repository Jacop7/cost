#!/usr/bin/env bash
# admin-acl.sh 의 Docker 불필요 보안 회귀시험.
# custom PS4 는 첫 명령 전에 평가될 수 있으므로 xtrace 진단에는
# 비밀번호 환경변수 대신 PGPASSFILE 을 써야 한다.
set -uo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ACL="$HERE/admin-acl.sh"
CANARY="CANARY_PW_7f3e9a1c"
fail=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; fail=1; }
has()  { printf '%s' "$1" | grep -qF -- "$2"; }
check_no_canary() {
  if has "$2" "$CANARY"; then bad "$1 — canary 가 출력에 있다"; else ok "$1 — canary 없음"; fi
}

SHIM="$(mktemp -d)"
trap 'rm -rf "$SHIM"' EXIT

# 인자를 합치지 않는다. SQL 하나에 줄바꿈이 있어도 한 ARG 로 보여야 한다.
cat > "$SHIM/psql" <<'EOF'
#!/usr/bin/env bash
printf 'PSQL_ARGC=%s\n' "$#" >&2
i=0
for a in "$@"; do printf 'PSQL_ARG_%s=%q\n' "$i" "$a" >&2; i=$((i + 1)); done
while IFS= read -r n; do printf 'PSQL_ENV=%s\n' "$n" >&2; done < <(builtin compgen -e | LC_ALL=C sort)
printf 'PSQL_PASSWORD=%s\n' "$(if [ -n "${PGPASSWORD:-}" ]; then echo present; else echo absent; fi)" >&2
exit 7
EOF

cat > "$SHIM/docker" <<'EOF'
#!/usr/bin/env bash
printf 'DOCKER_ARGC=%s\n' "$#" >&2
i=0
for a in "$@"; do printf 'DOCKER_ARG_%s=%q\n' "$i" "$a" >&2; i=$((i + 1)); done
while IFS= read -r n; do printf 'DOCKER_ENV=%s\n' "$n" >&2; done < <(builtin compgen -e | LC_ALL=C sort)
printf 'DOCKER_PASSWORD=%s\n' "$(if [ -n "${PGPASSWORD:-}" ]; then echo present; else echo absent; fi)" >&2
exit 7
EOF
chmod +x "$SHIM/psql" "$SHIM/docker"

check_env_allowlist() {
  local label="$1" prefix="$2" output="$3" extra="$4" n unexpected=""
  # Git Bash 는 native executable 을 띄울 때 MSYSTEM/WINDIR 를 다시 넣는다(unset 뒤에도 재현).
  local allowed=" PATH HOME LANG LC_ALL USERPROFILE SYSTEMROOT SystemRoot TEMP TMP APPDATA LOCALAPPDATA PROGRAMDATA HOMEDRIVE HOMEPATH USERNAME COMSPEC PWD SHLVL _ MSYSTEM WINDIR $extra "
  while IFS= read -r n; do
    n="${n#${prefix}=}"
    case "$allowed" in *" $n "*) ;; *) unexpected="${unexpected}${unexpected:+,}$n" ;; esac
  done < <(printf '%s\n' "$output" | grep "^${prefix}=" || true)
  if [ -z "$unexpected" ]; then ok "$label — 환경 이름 허용 목록 일치"; else bad "$label — 예상 밖 환경: $unexpected"; fi
}

echo "① xtrace 계약"
out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin ADMIN_DB_PASSWORD="$CANARY" \
       bash -x "$ACL" --remote check 2>&1 || true)"
check_no_canary "기본 PS4 + 원격 bash -x" "$out"
has "$out" "xtrace(-x)에서는 환경 비밀번호를 받지 않습니다" && ok "xtrace + 환경 비밀번호 명시적 거부" || bad "xtrace + 환경 비밀번호가 거부되지 않음"
if has "$out" "PSQL_ARGC="; then bad "거부 뒤 psql 이 실행됐다"; else ok "거부 뒤 psql 미실행"; fi

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin ADMIN_DB_PASSWORD="$CANARY" \
       bash "$ACL" --remote check 2>&1 || true)"
check_no_canary "일반 실행 + 환경 비밀번호" "$out"
has "$out" "PSQL_PASSWORD=present" && ok "일반 실행은 PGPASSWORD 를 환경으로만 전달" || bad "원격: PGPASSWORD 전달을 확인하지 못함"

# custom PS4 에 비밀번호 변수를 넣으면 첫 명령 전부터 샐 수 있다. 내용은 파일 안에만 둔다.
PGFILE="$SHIM/pgpass"
printf 'prod.invalid:5432:postgres:supabase_admin:%s\n' "$CANARY" > "$PGFILE"
chmod 600 "$PGFILE"
out="$(PATH="$SHIM:$PATH" PS4='TRACE:${ADMIN_DB_PASSWORD-}: ' PGPASSFILE="$PGFILE" \
       ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin bash -x "$ACL" --remote check 2>&1 || true)"
check_no_canary "custom PS4 + PGPASSFILE" "$out"
has "$out" "PSQL_ENV=PGPASSFILE" && ok "custom PS4 진단은 PGPASSFILE 사용" || bad "PGPASSFILE 이 자식에 없다"

echo "② export 함수/SHELLOPTS 가 본체를 가로채지 못한다"
out="$(PATH="$SHIM:$PATH" ACL="$ACL" CANARY="$CANARY" bash -c '
  set()     { printf "SHADOW-set-%s\n" "$CANARY"; }
  unset()   { printf "SHADOW-unset-%s\n" "$CANARY"; }
  export()  { printf "SHADOW-export-%s\n" "$CANARY"; }
  exec()    { printf "SHADOW-exec-%s\n" "$CANARY"; }
  compgen() { printf "SHADOW-compgen-%s\n" "$CANARY"; }
  builtin export -f set unset export exec compgen
  ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin ADMIN_DB_PASSWORD="$CANARY" bash "$ACL" --remote check
' 2>&1 || true)"
check_no_canary "export 함수 사보타주" "$out"
if has "$out" "SHADOW-"; then bad "export 함수가 실행됐다"; else ok "export 함수가 실행되지 않았다"; fi
has "$out" "PSQL_PASSWORD=present" && ok "privileged 본체가 정상 경로까지 도달" || bad "privileged 본체가 psql 까지 못 감"

out="$(PATH="$SHIM:$PATH" ACL="$ACL" CANARY="$CANARY" PGFILE="$PGFILE" bash -c '
  set()     { printf "SHADOW-set-%s\n" "$CANARY"; }
  unset()   { printf "SHADOW-unset-%s\n" "$CANARY"; }
  export()  { printf "SHADOW-export-%s\n" "$CANARY"; }
  exec()    { printf "SHADOW-exec-%s\n" "$CANARY"; }
  compgen() { printf "SHADOW-compgen-%s\n" "$CANARY"; }
  builtin export -f set unset export exec compgen
  builtin set -x
  builtin export SHELLOPTS
  ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin PGPASSFILE="$PGFILE" bash "$ACL" --remote check
' 2>&1 || true)"
check_no_canary "export 함수 + inherited SHELLOPTS" "$out"
if has "$out" "SHADOW-"; then bad "SHELLOPTS 경로에서 export 함수가 실행됐다"; else ok "SHELLOPTS 도 privileged 본체에 적용되지 않았다"; fi
has "$out" "PSQL_ENV=PGPASSFILE" && ok "SHELLOPTS 진단은 PGPASSFILE 사용" || bad "SHELLOPTS 경로에 PGPASSFILE 이 없다"

echo "③ remote psql — 인자 경계·정확한 환경 허용 목록"
out="$(PATH="$SHIM:$PATH" LEAK_ONE=bad PGSSLROOTCERT=/leak/ca PGSSLKEY=/leak/key PGCHANNELBINDING=require \
       PGSERVICE=leak PGPASSWORD="SHELL-$CANARY" ADMIN_DB_HOST=2001:db8::5 ADMIN_DB_PORT=6543 \
       ADMIN_DB_USER=supabase_admin bash "$ACL" --remote check 2>&1 || true)"
check_no_canary "셸 PGPASSWORD 미상속" "$out"
has "$out" 'PSQL_ARGC=7' && ok "psql 인자 수 7개" || bad "psql 인자 경계가 다르다"
has "$out" '\n' && ok "여러 줄 SQL 이 한 인자로 계측됨" || bad "여러 줄 SQL 계측이 없다"
for forbidden in 2001:db8 prod.invalid LEAK_ONE ADMIN_DB PGSSLKEY PGCHANNELBINDING PGSERVICE PGPASSWORD=; do
  if printf '%s\n' "$out" | grep '^PSQL_ARG_' | grep -qF "$forbidden"; then bad "psql argv 에 $forbidden 이 있다"; fi
done
check_env_allowlist "remote psql" PSQL_ENV "$out" \
  "PGHOST PGPORT PGDATABASE PGUSER PGSSLMODE PGCONNECT_TIMEOUT"
for required in PGHOST PGPORT PGDATABASE PGUSER PGSSLMODE PGCONNECT_TIMEOUT; do
  has "$out" "PSQL_ENV=$required" || bad "remote 환경에 $required 가 없다"
done
has "$out" 'PSQL_PASSWORD=absent' && ok "셸 PGPASSWORD 는 제거됨" || bad "셸 PGPASSWORD 가 남음"

echo "④ local docker — 비밀번호는 환경 이름으로만 전달"
out="$(PATH="$SHIM:$PATH" LEAK_TWO=bad SUPABASE_DB_CONTAINER=supabase_db_margincook \
       SUPABASE_ADMIN_PASSWORD="$CANARY" bash "$ACL" --local postgres check 2>&1 || true)"
check_no_canary "local docker" "$out"
has "$out" 'DOCKER_ARG_0=exec' && has "$out" 'DOCKER_ARG_2=-e' && has "$out" 'DOCKER_ARG_3=PGPASSWORD' \
  && ok "docker 는 -e PGPASSWORD 이름만 받음" || bad "docker PGPASSWORD 전달 형태가 다름"
if printf '%s\n' "$out" | grep '^DOCKER_ARG_' | grep -qF 'PGPASSWORD='; then bad "docker argv 에 비밀번호 할당이 있다"; else ok "docker argv 에 비밀번호 값 없음"; fi
check_env_allowlist "local docker" DOCKER_ENV "$out" "PGPASSWORD"
has "$out" 'DOCKER_PASSWORD=present' && ok "docker 프로세스 환경에 PGPASSWORD 존재" || bad "docker 환경에 PGPASSWORD 없음"

echo "⑤ remote audit — 전환 없이 앱 ACL을 재고 실패를 숨기지 않는다"
cat > "$SHIM/psql" <<'EOF'
#!/usr/bin/env bash
sql="$*"
if [ ! -t 0 ]; then sql="$sql$(cat)"; fi
prev=""
for arg in "$@"; do
  if [ "$prev" = "-f" ]; then sql="$sql$(cat "$arg")"; fi
  prev="$arg"
done

if [[ "$sql" == *"current_user || '|'"* ]]; then
  printf '%s|false|false\n' "${PGUSER:-postgres}"
  exit 0
fi

[[ "$sql" != *"set local role supabase_admin"* ]] || { echo "AUDIT_SET_ROLE" >&2; exit 9; }
[[ "$sql" == *"create table public._acl_probe_postgres"* ]] || { echo "AUDIT_NO_PROBE" >&2; exit 9; }
[[ "$sql" == *"rollback;"* ]] || { echo "AUDIT_NO_ROLLBACK" >&2; exit 9; }
echo "AUDIT_SQL_OK" >&2

migrations=2; dangerous=0; owner="${PGUSER:-postgres}"; rls_off=0; ledger_direct=0
case "${PGDATABASE:-}" in
  audit_missing) migrations=1 ;;
  audit_open) dangerous=1 ;;
  audit_rpc_open) rpc_open=1 ;;
  audit_rls_off) rls_off=1 ;;
  audit_ledger_direct) ledger_direct=1 ;;
  audit_partial) printf 'migrations|2|expected=2\nprobe_owner|%s|expected=postgres\n' "$owner"; exit 0 ;;
  audit_empty) exit 0 ;;
  audit_duplicate) duplicate=1 ;;
esac
: "${rpc_open:=0}" "${duplicate:=0}"
cat <<ROWS
migrations|$migrations|expected=2
probe_owner|$owner|expected=postgres
probe_dangerous|0|expected=0
public_dangerous|$dangerous|expected=0
rls_disabled_app_tables|$rls_off|expected=0
protected_objects|6|expected=6
protected_writes|0|expected=0
ledger_write_paths|$ledger_direct|expected=0
source_schema_grants|0|expected=0
supabase_admin_objects|0|expected=0
anon_rpc|0|expected=0
blocked_internal_rpc|0|expected=0
blocked_internal_rpc_objects|11|expected=11
facade_rpc_missing|0|expected=0
unapproved_authenticated_rpc|$rpc_open|expected=0
platform_default_open|1|informational
ROWS
[ "$duplicate" = "0" ] || printf 'unapproved_authenticated_rpc|0|expected=0\n'
EOF
chmod +x "$SHIM/psql"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=postgres \
       ADMIN_DB_PASSWORD="$CANARY" bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "전환 불가 postgres audit 통과" || bad "정상 audit 실패(exit $rc)"
check_no_canary "audit 비밀번호 비노출" "$out"
has "$out" 'current_user=postgres rolsuper=false supabase_admin_member=false' \
  && ok "WHO 원값 출력" || bad "WHO 원값이 없다"
has "$out" 'AUDIT_SQL_OK' && ok "프로브·rollback 실행, SET ROLE 없음" || bad "audit SQL 계약을 못 지킴"
has "$out" 'platform-exception' && ok "플랫폼 기본 권한을 별도 예외로 보고" || bad "플랫폼 기본 권한을 성공으로 숨김"
has "$out" 'audit ok — 측정한 애플리케이션 ACL 항목이 닫혀 있습니다' && ok "측정 범위로 한정한 성공 명칭" || bad "audit 성공 명칭이 넓거나 없다"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_open ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'public_dangerous=1' \
  && ok "앱 롤 위험 권한 한 건이면 실패" || bad "위험 권한을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_missing ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'migrations=1' \
  && ok "ACL 마이그레이션 누락이면 실패" || bad "마이그레이션 누락을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_rpc_open ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'unapproved_authenticated_rpc=1' \
  && ok "허용 목록 밖 RPC 한 건이면 실패" || bad "미승인 RPC를 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_partial ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'missing_metric=unapproved_authenticated_rpc' \
  && ok "metric 일부 누락이면 실패" || bad "metric 누락을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_empty ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'missing_metric=' \
  && ok "빈 audit 출력이면 실패" || bad "빈 출력을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_duplicate ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'duplicate_metric=unapproved_authenticated_rpc' \
  && ok "metric 중복이면 실패" || bad "metric 중복을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_rls_off ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'rls_disabled_app_tables=1' \
  && ok "RLS 비활성 표 한 건이면 실패" || bad "RLS 비활성을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_ledger_direct ADMIN_DB_USER=postgres \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'ledger_write_paths=1' \
  && ok "원장 직접 쓰기 한 건이면 실패" || bad "원장 직접 쓰기를 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=limited \
       bash "$ACL" --remote audit 2>&1)"; rc=$?
[ "$rc" -eq 1 ] && has "$out" 'probe_owner=limited' \
  && ok "postgres 소유가 아닌 프로브는 실패" || bad "프로브 소유자 어긋남을 통과시킴(exit $rc)"

out="$(PATH="$SHIM:$PATH" bash "$ACL" --local postgres audit 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "audit 은 원격 전용" || bad "로컬 audit 이 허용됨(exit $rc)"

echo "⑥ 거부 — 접속 문자열·잘못된 값·모드 생략"
URL_PREFIX='postgresql:'
BAD_REMOTE_URL="${URL_PREFIX}//a:${CANARY}@h/db"
BAD_LOCAL_URL="${URL_PREFIX}//x:${CANARY}@h/db"
out="$(ADMIN_DB_URL="$BAD_REMOTE_URL" bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "ADMIN_DB_URL 거부(exit 2)" || bad "ADMIN_DB_URL 이 거부되지 않음(exit $rc)"; check_no_canary "ADMIN_DB_URL 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="h password=$CANARY" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "호스트에 섞은 password= 거부" || bad "호스트 검증 실패(exit $rc)"; check_no_canary "호스트 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="$(printf 'good\nevil')" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "여러 줄 호스트 거부" || bad "여러 줄 호스트 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_PORT=0 ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "포트 0 거부" || bad "포트 0 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_USER=u bash "$ACL" --remote 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "모드 생략 거부" || bad "모드 생략 통과(exit $rc)"
out="$(bash "$ACL" --local "$BAD_LOCAL_URL" check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "--local 접속 문자열 거부" || bad "--local 접속 문자열 통과(exit $rc)"; check_no_canary "--local 거부 메시지" "$out"

echo
if [ "$fail" = "0" ]; then echo "admin-acl 회귀시험 통과"; else echo "admin-acl 회귀시험 실패"; exit 1; fi
