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
out="$(PATH="$SHIM:$PATH" LEAK_TWO=bad SUPABASE_DB_CONTAINER=supabase_db_sikjae \
       SUPABASE_ADMIN_PASSWORD="$CANARY" bash "$ACL" --local postgres check 2>&1 || true)"
check_no_canary "local docker" "$out"
has "$out" 'DOCKER_ARG_0=exec' && has "$out" 'DOCKER_ARG_2=-e' && has "$out" 'DOCKER_ARG_3=PGPASSWORD' \
  && ok "docker 는 -e PGPASSWORD 이름만 받음" || bad "docker PGPASSWORD 전달 형태가 다름"
if printf '%s\n' "$out" | grep '^DOCKER_ARG_' | grep -qF 'PGPASSWORD='; then bad "docker argv 에 비밀번호 할당이 있다"; else ok "docker argv 에 비밀번호 값 없음"; fi
check_env_allowlist "local docker" DOCKER_ENV "$out" "PGPASSWORD"
has "$out" 'DOCKER_PASSWORD=present' && ok "docker 프로세스 환경에 PGPASSWORD 존재" || bad "docker 환경에 PGPASSWORD 없음"

echo "⑤ 거부 — 접속 문자열·잘못된 값·모드 생략"
out="$(ADMIN_DB_URL="postgresql://a:$CANARY@h/db" bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "ADMIN_DB_URL 거부(exit 2)" || bad "ADMIN_DB_URL 이 거부되지 않음(exit $rc)"; check_no_canary "ADMIN_DB_URL 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="h password=$CANARY" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "호스트에 섞은 password= 거부" || bad "호스트 검증 실패(exit $rc)"; check_no_canary "호스트 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="$(printf 'good\nevil')" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "여러 줄 호스트 거부" || bad "여러 줄 호스트 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_PORT=0 ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "포트 0 거부" || bad "포트 0 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_USER=u bash "$ACL" --remote 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "모드 생략 거부" || bad "모드 생략 통과(exit $rc)"
out="$(bash "$ACL" --local "postgresql://x:$CANARY@h/db" check 2>&1)"; rc=$?
[ "$rc" -eq 2 ] && ok "--local 접속 문자열 거부" || bad "--local 접속 문자열 통과(exit $rc)"; check_no_canary "--local 거부 메시지" "$out"

echo
if [ "$fail" = "0" ]; then echo "admin-acl 회귀시험 통과"; else echo "admin-acl 회귀시험 실패"; exit 1; fi
