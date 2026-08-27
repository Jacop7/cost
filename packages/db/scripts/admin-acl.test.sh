#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# admin-acl.sh 회귀시험 — 비밀번호(canary)가 **어떤 출력에도** 없어야 한다 (검토 N·O)
#
# 잰다 —
#   ① `bash -x` 로 불러도 canary 가 stdout·stderr 어디에도 안 찍힌다(로컬·원격 모두).
#      (실측: xtrace 를 안 끄면 `LPW=…`·`export PGPASSWORD=…` 가 그대로 나왔다.)
#   ② 원격은 psql 셈(shim)으로 argv 와 환경을 찍어 — argv 에 접속 정보가 없고, 환경엔 명시한 것만 있고,
#      셸의 PGSSLROOTCERT·PGSERVICE·PGPASSWORD 는 상속되지 않는다.
#   ③ 접속 문자열·잘못된 값·모드 생략은 거부되고 그 값은 되풀이되지 않는다.
#
# 실행: bash packages/db/scripts/admin-acl.test.sh   (docker 불필요 — 로컬 케이스는 접속 실패까지만 본다)
# ════════════════════════════════════════════════════════════════
set -uo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ACL="$HERE/admin-acl.sh"
CANARY="CANARY_PW_7f3e9a1c"
fail=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; fail=1; }
check_no_canary() { # $1 label, $2 output
  if printf '%s' "$2" | grep -qF "$CANARY"; then bad "$1 — canary 가 출력에 있다"; else ok "$1 — canary 없음"; fi
}

SHIM="$(mktemp -d)"
trap 'rm -rf "$SHIM"' EXIT
cat > "$SHIM/psql" <<'EOF'
#!/usr/bin/env bash
# ⚠ stderr 로 말한다 — admin-acl.sh 가 psql 의 stdout 을 명령 치환으로 삼킨다.
echo "SHIM ARGV: $*" >&2
echo "SHIM ENV: $(env | grep -E '^(PG|ADMIN_DB)[A-Z_]*=' | sed -E 's/=.*$/=<v>/' | sort | tr '\n' ' ')" >&2
echo "SHIM PW: $(if [ -n "${PGPASSWORD:-}" ]; then echo present; else echo absent; fi)" >&2
exit 7
EOF
chmod +x "$SHIM/psql"

echo "① bash -x 에서도 canary 가 없다"
out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_USER=supabase_admin ADMIN_DB_PASSWORD="$CANARY" \
       bash -x "$ACL" --remote check 2>&1 || true)"
check_no_canary "원격 bash -x" "$out"
printf '%s' "$out" | grep -q "SHIM PW: present" && ok "원격: PGPASSWORD 는 환경으로 전달됐다" || bad "원격: PGPASSWORD 가 환경에 없다"
out="$(SUPABASE_DB_CONTAINER=no_such_container_xyz SUPABASE_ADMIN_PASSWORD="$CANARY" bash -x "$ACL" --local postgres check 2>&1 || true)"
check_no_canary "로컬 bash -x" "$out"

echo "② 원격 psql 은 argv 에 접속 정보가 없고 환경은 명시한 것뿐이다"
out="$(PATH="$SHIM:$PATH" PGSSLROOTCERT=/leak/ca PGSSLKEY=/leak/key PGCHANNELBINDING=require PGSERVICE=leak PGPASSWORD="SHELL-$CANARY" \
       ADMIN_DB_HOST=2001:db8::5 ADMIN_DB_PORT=6543 ADMIN_DB_USER=supabase_admin bash "$ACL" --remote check 2>&1 || true)"
check_no_canary "셸 PGPASSWORD 미상속" "$out"
argv="$(printf '%s' "$out" | grep -m1 'SHIM ARGV:')"
case "$argv" in *"prod"*|*"2001:db8"*|*"supabase_admin"*|*"PG"*) bad "argv 에 접속 정보가 있다: $argv" ;; *) ok "argv 에는 psql 옵션만" ;; esac
envl="$(printf '%s' "$out" | grep -m1 'SHIM ENV:')"
case "$envl" in *PGSSLROOTCERT*|*PGSSLKEY*|*PGCHANNELBINDING*|*PGSERVICE*|*PGPASSWORD*) bad "상속되면 안 되는 변수가 있다: $envl" ;; *) ok "환경엔 명시한 접속 변수만" ;; esac
printf '%s' "$envl" | grep -q "PGHOST=<v>" && printf '%s' "$envl" | grep -q "PGPORT=<v>" && ok "PGHOST/PGPORT 가 환경으로 갔다" || bad "PGHOST/PGPORT 가 없다: $envl"

echo "③ 거부 — 접속 문자열·잘못된 값·모드 생략(값은 되풀이하지 않는다)"
out="$(ADMIN_DB_URL="postgresql://a:$CANARY@h/db" bash "$ACL" --remote check 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "ADMIN_DB_URL 거부(exit 2)" || bad "ADMIN_DB_URL 이 거부되지 않음(exit $rc)"; check_no_canary "ADMIN_DB_URL 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="h password=$CANARY" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "호스트에 섞은 password= 거부" || bad "호스트 검증 실패(exit $rc)"; check_no_canary "호스트 거부 메시지" "$out"
out="$(ADMIN_DB_HOST="$(printf 'good\nevil')" ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "여러 줄 호스트 거부" || bad "여러 줄 호스트 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_PORT=0 ADMIN_DB_USER=u bash "$ACL" --remote check 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "포트 0 거부" || bad "포트 0 통과(exit $rc)"
out="$(ADMIN_DB_HOST=h ADMIN_DB_USER=u bash "$ACL" --remote 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "모드 생략 거부" || bad "모드 생략 통과(exit $rc)"
out="$(bash "$ACL" --local "postgresql://x:$CANARY@h/db" check 2>&1)"; rc=$?
[ $rc -eq 2 ] && ok "--local 접속 문자열 거부" || bad "--local 접속 문자열 통과(exit $rc)"; check_no_canary "--local 거부 메시지" "$out"

echo
if [ "$fail" = "0" ]; then echo "admin-acl 회귀시험 통과"; else echo "admin-acl 회귀시험 실패"; exit 1; fi
