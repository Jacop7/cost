#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 업그레이드 **경로**를 잰다 — 최종 상태가 아니라 순서를.
#
# 왜 필요한가 —
#   `run.mjs` 는 마이그레이션을 다 태운 **최종 스키마**에 시험을 건다. 그래서
#   `앞 마이그레이션이 만들어 놓은 값을 뒤 마이그레이션이 검사해서 통과`하는 구멍을
#   구조적으로 못 잡는다. 실제로 그랬다(0151 → 0152):
#
#     0151 이 `etc_tax ÷ etc_revenue` 로 역산해 스냅샷에 넣는다
#     0152 가 "굳은 세율로 세금이 재현되나" 를 본다
#     방금 넣은 역산값이라 언제나 재현된다 → 통과
#
#   최종 상태만 보면 27/27 이 초록이다. 순서를 태워야 보인다.
#
# 쓰는 법(어느 디렉터리에서 실행해도 된다):
#     bash packages/db/scripts/upgrade-check.sh
#
# ⚠ 로컬 supabase 컨테이너가 떠 있어야 한다(SUPABASE_DB_CONTAINER 로 바꿀 수 있다).
# ⚠ 실행마다 `fresh_upgrade_check_<pid>_<난수>` DB 를 만들고 그 이름만 지운다 — 고정 이름이면
#   두 검증을 동시에 돌릴 때 서로의 DB 를 지웠다(검토 실측).
# ════════════════════════════════════════════════════════════════
set -euo pipefail

CT="${SUPABASE_DB_CONTAINER:-supabase_db_sikjae}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MIG_DIR="$DB_DIR/supabase/migrations"
D="fresh_upgrade_check_$$_${RANDOM}"

# 이 경로가 재는 지점. 여기를 바꾸면 아래 시나리오도 같이 봐야 한다.
BASE=20260826000150            # 이 마이그레이션까지 태운 상태에서 시작한다
STEPS=(20260826000151_basis_backfill_and_guard.sql
       20260826000152_no_rate_guessing.sql)
# 시나리오 ① 이 **어디서 · 왜** 멈춰야 하는지. 이 둘을 안 보면 아무 이유로 깨져도 통과한다.
EXPECT_STOP=20260826000152_no_rate_guessing.sql
EXPECT_MSG='0152: 굳은 세율로'

psql_d() { docker exec -i "$CT" psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}"; }
cleanup() { bash "$SCRIPT_DIR/fresh-db.sh" --drop "$D" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail=0
say() { printf '%s\n' "$*"; }

# ── 시나리오 1 · 어긋난 장부는 **막혀야** 한다 ──────────────────
say "① 0150 상태 + 어긋난 열린 장부 → 업그레이드가 멈춰야 한다"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE" "$D" >/dev/null

# 배포 전에 이미 기타 매출이 있었고, 그 세금이 지금 굳은 세율로는 재현되지 않는 상태.
# (실제 9.0909% 로 계산해 두고 굳은 값만 다른 경우가 아니라, 그 반대 — 어느 쪽이든
#  "굳은 값이 기록을 설명 못 한다" 는 같은 신호다.)
psql_d "$D" <<'EOF' >/dev/null
update daily_sales ds set etc_revenue = 10000, etc_tax = 900.00
  from business_days bd
 where bd.store_id = ds.store_id and bd.business_date = ds.sale_date
   and bd.status::text <> 'closed';
insert into daily_sales (store_id, sale_date, business_day_id, etc_revenue, etc_tax)
select bd.store_id, bd.business_date, bd.id, 10000, 900.00
  from business_days bd
 where bd.status::text <> 'closed'
   and not exists (select 1 from daily_sales d
                    where d.store_id = bd.store_id and d.sale_date = bd.business_date);
EOF

n=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select count(*) from business_days bd
    join daily_sales ds on ds.store_id = bd.store_id and ds.sale_date = bd.business_date
   where bd.status::text <> 'closed'
     and round(ds.etc_revenue * coalesce((bd.snapshot->>'etc_tax_rate')::numeric, -1), 2)
         is distinct from round(ds.etc_tax, 2);")
if [ "$n" = "0" ]; then
  say "   FAIL 전제가 안 섰다 — 어긋난 장부를 못 만들었다 (0건)"
  fail=1
else
  say "   전제: 어긋난 열린 장부 ${n}건"
  # ⚠ "멈추기만 하면 통과" 로 세면 안 된다. 0151 이 **다른 이유**로 깨져도 초록이 된다.
  #   어디서 멈췄는지와 무슨 문구로 멈췄는지를 둘 다 본다.
  stopped_at=""; err=""
  for m in "${STEPS[@]}"; do
    if err="$(psql_d "$D" < "$MIG_DIR/$m" 2>&1 1>/dev/null)"; then :; else stopped_at="$m"; break; fi
  done
  if [ -z "$stopped_at" ]; then
    say "   FAIL 어긋난 장부가 그대로 통과했다"
    fail=1
  elif [ "$stopped_at" != "$EXPECT_STOP" ]; then
    say "   FAIL 엉뚱한 곳에서 멈췄다: $stopped_at (기대: $EXPECT_STOP)"
    say "        $(printf '%s' "$err" | head -3)"
    fail=1
  elif ! printf '%s' "$err" | grep -qF "$EXPECT_MSG"; then
    say "   FAIL $EXPECT_STOP 에서 멈추긴 했는데 다른 이유다 (기대 문구: $EXPECT_MSG)"
    say "        $(printf '%s' "$err" | head -3)"
    fail=1
  else
    say "   ok   $EXPECT_STOP 이 '$EXPECT_MSG …' 로 멈춘다"
  fi
fi

# ── 시나리오 2 · 멀쩡한 장부는 **통과해야** 한다 ────────────────
# 막기만 하면 그건 고장이다. 반대쪽도 봐야 의미가 있다.
say "② 0150 상태 + 멀쩡한 장부 → 업그레이드가 통과해야 한다"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE" "$D" >/dev/null
ok=1
for m in "${STEPS[@]}"; do
  if ! psql_d "$D" < "$MIG_DIR/$m" >/dev/null 2>&1; then ok=0; say "   FAIL $m 에서 막혔다"; break; fi
done
if [ "$ok" = "1" ]; then say "   ok   업그레이드가 통과한다"; else fail=1; fi

# ── 시나리오 3 · 옛 helper 가 남은 DB 도 정리돼야 한다 ──────────
# 0151 을 이미 태운 환경에는 `etc_tax_rate_of_record` 가 남아 있다. 0152 가 지워야 한다.
say "③ 옛 helper 가 남은 DB → 0152 가 지워야 한다"
psql_d "$D" -c "create or replace function public.etc_tax_rate_of_record(p_store uuid, p_date date)
                returns numeric language sql stable as \$f\$ select 1::numeric \$f\$;" >/dev/null
psql_d "$D" < "$MIG_DIR/${STEPS[1]}" >/dev/null
left=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'etc_tax_rate_of_record';")
if [ "$left" = "0" ]; then say "   ok   옛 helper 가 지워졌다"; else say "   FAIL 옛 helper 가 남았다"; fail=1; fi

# ── 시나리오 4 · 사장님이 저장한 요일별 규칙을 백필이 건드리면 안 된다 (0167, 검토 P0) ──
# 0166 상태에서 문(0159)이 만드는 것과 같은 행(created_by 있음 · revision 1 · 실제 시작일)을
# 요일마다 다르게 저장해 두고, settings 는 그 규칙의 월요일 값만 비추게 한다(0163 이 하는 일).
# 첫 판 0167 은 revision=1 을 "안 만진 초기 규칙"으로 읽고 이 행의 화~일·브레이크를 월요일
# 값으로 덮어썼다(원본 복구 불가). 최종 상태만 보는 스위트는 이 경로를 못 잰다 — 여기서 잰다.
say "④ 0166 상태 + 사장님이 저장한 요일별 예약 규칙 → 0167 이 그 행을 안 건드려야 한다"
BASE4=20260826000166
STEP4="$(cd "$MIG_DIR" && ls 20260826000167_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE4" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
do $f$
declare v_store uuid; v_owner uuid; v_from date;
begin
  select id, owner_id into v_store, v_owner from stores order by created_at, id limit 1;
  v_from := store_local_date(v_store) + 1;
  -- 문이 하는 일과 같다: 열린 규칙을 닫고 내일부터의 새 규칙을 사장님 이름으로 넣는다.
  update operating_rules set effective_to = v_from - 1 where store_id = v_store and effective_to is null;
  insert into operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks, created_by)
  values (v_store, v_from, null,
    (select jsonb_object_agg(d::text, jsonb_build_object(
              'open',  (time '06:00' + make_interval(hours => d))::text,
              'close', (time '14:00' + make_interval(hours => d))::text, 'closed', false))
       from generate_series(0, 6) d),
    (select jsonb_object_agg(d::text, jsonb_build_object(
              'start', (time '10:00' + make_interval(mins => d))::text,
              'end',   (time '10:30' + make_interval(mins => d))::text))
       from generate_series(0, 6) d),
    v_owner);
  -- 표시 폼은 월요일(1) 값만 비춘다 — 검토가 재현한 바로 그 상태.
  update settings set open_time = '07:00', close_time = '15:00', break_start = '10:01', break_end = '10:31'
   where store_id = v_store;
end $f$;
create table public._expect_0167 as
  select id, weekly_hours, weekly_breaks from operating_rules where created_by is not null;
EOF
n=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select count(*) from public._expect_0167;")
if [ "$n" = "0" ]; then
  say "   FAIL 전제가 안 섰다 — 사장님 저장 규칙을 못 만들었다"
  fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP4" 2>&1 1>/dev/null)"; then
  say "   FAIL 0167 이 멀쩡한 DB 에서 막혔다"
  say "        $(printf '%s' "$err" | head -3)"
  fail=1
else
  changed=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select count(*) from operating_rules r join public._expect_0167 e on e.id = r.id
     where r.weekly_hours::text <> e.weekly_hours::text or r.weekly_breaks::text <> e.weekly_breaks::text;")
  if [ "$changed" = "0" ]; then
    say "   ok   사장님이 저장한 규칙(요일별 시간·브레이크)이 그대로다"
  else
    say "   FAIL 0167 백필이 사장님 저장 규칙 ${changed}건을 덮어썼다"
    fail=1
  fi
fi
psql_d "$D" -c "drop table if exists public._expect_0167;" >/dev/null

# ── 시나리오 5·6 · 언어 키 이관 (0168·0169, 검토 I·J) ───────────────
# 새 DB 는 설정 행이 'ko' 로 태어나 레거시 이관(ko-KR → ko)을 못 잰다. 0167 상태에서 레거시 값을
# 만들어 두고 0168·0169 를 태운다 — ⑤ 옮겨지고 조합이 맞춰져야 하고, ⑥ 모르는 키는 0168 이 멈춰야 한다.
BASE5=20260826000167
STEPS5=($(cd "$MIG_DIR" && ls 20260826000168_*.sql 20260826000169_*.sql))
say "⑤ 0167 상태 + 레거시 'ko-KR' · 어긋난 통화 → 0168·0169 가 'ko/KRW/0' 으로 옮겨야 한다"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE5" "$D" >/dev/null
psql_d "$D" -c "update settings set locale = 'ko-KR', currency = 'USD', money_digits = 2;" >/dev/null
ok=1
for m in "${STEPS5[@]}"; do
  if ! err="$(psql_d "$D" < "$MIG_DIR/$m" 2>&1 1>/dev/null)"; then ok=0; say "   FAIL $m 에서 막혔다"; say "        $(printf '%s' "$err" | head -3)"; break; fi
done
if [ "$ok" = "1" ]; then
  got=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select string_agg(locale||'/'||currency||'/'||money_digits, ',') from settings;")
  if [ "$got" = "ko/KRW/0" ]; then say "   ok   ko-KR/USD/2 → $got"; else say "   FAIL 이관 결과가 다르다: $got"; fail=1; fi
  combo=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select count(*) from pg_constraint where conname = 'settings_locale_combo_ck' and convalidated;")
  if [ "$combo" = "1" ]; then say "   ok   조합 CHECK 가 걸렸다"; else say "   FAIL 조합 CHECK 가 없다"; fail=1; fi
else
  fail=1
fi

say "⑥ 0167 상태 + 모르는 언어 키 'xx-XX' → 0168 이 멈춰야 한다"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE5" "$D" >/dev/null
psql_d "$D" -c "update settings set locale = 'xx-XX';" >/dev/null
if err="$(psql_d "$D" < "$MIG_DIR/${STEPS5[0]}" 2>&1 1>/dev/null)"; then
  say "   FAIL 모르는 언어 키가 그대로 통과했다"; fail=1
elif printf '%s' "$err" | grep -qF '0168: 알 수 없는 언어 키'; then
  say "   ok   0168 이 '알 수 없는 언어 키 …' 로 멈춘다"
else
  say "   FAIL 0168 이 멈추긴 했는데 다른 이유다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
fi

say ""
if [ "$fail" = "0" ]; then say "업그레이드 경로 6/6 통과"; else say "업그레이드 경로 실패"; exit 1; fi
