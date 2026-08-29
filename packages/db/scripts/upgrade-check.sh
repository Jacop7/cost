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
# 임시 DB 삭제 실패를 숨기지 않는다(검토 지적) — 시험이 통과했어도 DB 가 남으면 빨간 결과다.
# (EXIT 트랩 안의 exit 1 이 최종 상태가 된다. 삭제가 됐으면 원래 상태를 그대로 둔다.)
cleanup() {
  if ! bash "$SCRIPT_DIR/fresh-db.sh" --drop "$D" >/dev/null 2>&1; then
    echo "임시 DB 삭제 실패: $D — 직접 지우세요 (drop database $D)" >&2
    exit 1
  fi
}
trap cleanup EXIT

fail=0
say() { printf '%s\n' "$*"; }

# ── 시나리오 1 · 어긋난 장부는 **막혀야** 한다 ──────────────────
say "① 0150 상태 + 어긋난 열린 장부 → 업그레이드가 멈춰야 한다"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE" "$D" >/dev/null

# 현재 seed 는 0162 이전 스키마도 재생한다. 옛 개점 함수가 22:00 을 굳히더라도
# 오늘 픽스처는 판매를 받을 수 있도록 종료 시각이 미래여야 한다.
open_future=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select count(*) from business_days
   where status::text in ('open','break') and planned_close_at > clock_timestamp();")
if [ "$open_future" = "1" ]; then
  say "   ok   중간 버전 시드의 오늘 장부 종료 시각이 미래다"
else
  say "   FAIL 중간 버전 시드의 열린 오늘 장부가 미래 종료를 보장하지 않는다 (${open_future}건)"
  fail=1
fi

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

# ── 시나리오 7 · 매장이 둘인 DB 에서도 0170 이 통과해야 한다 (검토 N P0) ────────
# 첫 판 0170 의 사후조건은 `array_agg … limit 1` 이라 매장이 둘이면 키 40개를 모아 멈췄다.
# 다른 사장님의 두 번째 매장(create_store 트리거 셋이 설정 행을 만든다)을 두고 0170 을 태운다.
say "⑦ 0169 상태 + 매장 2개 → 0170 이 통과하고 매장마다 20키여야 한다"
BASE7=20260826000169
STEP7="$(cd "$MIG_DIR" && ls 20260826000170_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE7" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000c0c0');
insert into stores (owner_id, name) values ('00000000-0000-0000-0000-00000000c0c0', '업그레이드 시험 매장 2');
EOF
n=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select count(*) from settings;")
if [ "$n" != "2" ]; then
  say "   FAIL 전제가 안 섰다 — 설정 행이 2개가 아니다 ($n)"; fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP7" 2>&1 1>/dev/null)"; then
  say "   FAIL 매장이 둘이면 0170 이 멈춘다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  # LEFT JOIN LATERAL — 응답이 NULL 인 매장도 0키로 세어 빨개진다(안쪽 조인이면 그룹이 사라져 통과했다).
  bad=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select count(*) from (select s.store_id, count(k.k) as n from settings s
                            left join lateral jsonb_object_keys(get_settings(s.store_id)) as k(k) on true
                           group by 1) t where t.n <> 20;")
  if [ "$bad" = "0" ]; then say "   ok   매장 2개 모두 20키(응답 NULL 매장 없음)"; else say "   FAIL 20키가 아닌 매장 ${bad}개"; fail=1; fi
fi

# ── 시나리오 8 · 0170 기존 2매장 → 판본 마이그레이션 전체 (검토 O 후속) ─────────
# 특정 마지막 파일을 박지 않는다. 0170 뒤에 있는 마이그레이션을 실행 시점의 최신까지 순서대로
# 태운다 — 0172 처럼 0171 계약을 완결하는 후속이 생겨도 이 경로가 빠뜨리지 않는다.
say "⑧ 0170 상태 + 서로 다른 2매장 설정 → 최신까지 값 보존·일반/세금 판본 계약"
BASE8=20260826000170
STEPS8=()
while IFS= read -r m; do
  prefix="${m%%_*}"
  if [[ "$prefix" > "$BASE8" ]]; then STEPS8+=("$m"); fi
done < <(cd "$MIG_DIR" && printf '%s\n' *.sql | LC_ALL=C sort)
if [ "${#STEPS8[@]}" -lt 2 ] \
   || [[ " ${STEPS8[*]} " != *" 20260826000171_settings_revision.sql "* ]] \
   || [[ " ${STEPS8[*]} " != *" 20260826000172_settings_revision_noop_tax.sql "* ]]; then
  say "   FAIL 0171·0172 를 포함한 후속 마이그레이션 목록을 만들지 못했다"
  fail=1
else
  bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE8" "$D" >/dev/null
  psql_d "$D" <<'EOF' >/dev/null
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000c0c0');
insert into stores (owner_id, name) values ('00000000-0000-0000-0000-00000000c0c0', '판본 업그레이드 매장 2');

with ranked as (
  select s.store_id, row_number() over (order by st.created_at, st.id) as n
    from settings s join stores st on st.id = s.store_id
)
update settings s set
  locale = case r.n when 1 then 'en-US' else 'ja' end,
  currency = case r.n when 1 then 'USD' else 'JPY' end,
  money_digits = case r.n when 1 then 2 else 0 end,
  cup_volume = case r.n when 1 then 333 else 444 end,
  quantity_digits = case r.n when 1 then 3 else 4 end,
  default_target_profit_rate = case r.n when 1 then 37 else 42 end,
  alert_morning_summary = (r.n = 1),
  alert_inbound_delay = (r.n = 2),
  tax_mode = case r.n when 1 then 'included'::tax_mode else 'exempt'::tax_mode end,
  tax_items = case r.n when 1 then '[{"name":"지방세","rate":3.5}]'::jsonb else '[]'::jsonb end
from ranked r where r.store_id = s.store_id;

create table public._expect_0171 as
select s.store_id, to_jsonb(s) - 'updated_at' as value_before
  from settings s;
EOF
  n=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select count(*) from public._expect_0171;")
  if [ "$n" != "2" ]; then
    say "   FAIL 전제가 안 섰다 — 보존할 설정 행이 2개가 아니다 ($n)"
    fail=1
  else
    ok=1
    for m in "${STEPS8[@]}"; do
      if ! err="$(psql_d "$D" < "$MIG_DIR/$m" 2>&1 1>/dev/null)"; then
        ok=0; say "   FAIL $m 에서 막혔다"; say "        $(printf '%s' "$err" | head -3)"; break
      fi
    done
    if [ "$ok" = "1" ]; then
      # 기대 행을 기준으로만 inner join 하면 후속 마이그레이션이 설정 행을 지운 경우 그 행이
      # 비교에서 사라져 changed=0 으로 거짓 통과한다. FULL JOIN 으로 값 변경뿐 아니라 누락·추가도 센다.
      changed=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
        select count(*)
          from public._expect_0171 e
          full join settings s using (store_id)
         where e.store_id is null
            or s.store_id is null
            or (to_jsonb(s) - 'updated_at' - 'revision') is distinct from e.value_before;")
      rev_bad=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "select count(*) from settings where revision <> 1;")
      old_fn=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
        select count(*) from pg_proc p where p.pronamespace='public'::regnamespace
          and ((p.proname='save_settings' and p.pronargs <> 3)
            or (p.proname='save_store_tax' and p.pronargs <> 4));")
      if [ "$changed" = "0" ] && [ "$rev_bad" = "0" ] && [ "$old_fn" = "0" ]; then
        say "   ok   두 매장의 기존 일반·세금 값 보존 · revision=1 · 옛 시그니처 0개"
      else
        say "   FAIL 값 변경=$changed 판본 불일치=$rev_bad 옛 시그니처=$old_fn"
        fail=1
      fi

      # 앱이 밟는 문으로 무변경→변경→낡은 판본 거부를 잰다. 전부 롤백해 보존 검산과 분리한다.
      if ! err="$(psql_d "$D" <<'EOF' 2>&1 1>/dev/null
begin;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true)
  from stores order by created_at, id limit 1;
set local role authenticated;
do $test$
declare
  v settings%rowtype;
  v_r jsonb;
  v_time timestamptz;
  v_mode tax_mode;
begin
  select s.* into v from settings s join stores st on st.id=s.store_id order by st.created_at, st.id limit 1;
  v_time := v.updated_at;

  v_r := save_settings(v.store_id, jsonb_build_object('cup_volume', v.cup_volume), v.revision);
  if (v_r->>'changed')::boolean or (v_r->>'revision')::int <> v.revision then
    raise exception '⑧ save_settings 무변경 응답이 틀렸습니다: %', v_r;
  end if;
  v_r := save_store_tax(v.store_id, v.tax_mode, v.tax_items, v.revision);
  if (v_r->>'changed')::boolean or (v_r->>'revision')::int <> v.revision then
    raise exception '⑧ save_store_tax 무변경 응답이 틀렸습니다: %', v_r;
  end if;
  if (select updated_at from settings where store_id=v.store_id) is distinct from v_time then
    raise exception '⑧ 무변경 저장이 updated_at 을 바꿨습니다';
  end if;

  v_r := save_settings(v.store_id, jsonb_build_object('cup_volume', v.cup_volume + 1), v.revision);
  if not (v_r->>'changed')::boolean or (v_r->>'revision')::int <> v.revision + 1 then
    raise exception '⑧ save_settings 변경 판본이 틀렸습니다: %', v_r;
  end if;
  begin
    perform save_settings(v.store_id, jsonb_build_object('quantity_digits', 2), v.revision);
    raise exception '⑧ save_settings 낡은 판본이 통과했습니다';
  exception when sqlstate '45009' then null;
  end;

  v_mode := case when v.tax_mode = 'exempt' then 'included'::tax_mode else 'exempt'::tax_mode end;
  v_r := save_store_tax(v.store_id, v_mode, '[]'::jsonb, v.revision + 1);
  if not (v_r->>'changed')::boolean or (v_r->>'revision')::int <> v.revision + 2 then
    raise exception '⑧ save_store_tax 변경 판본이 틀렸습니다: %', v_r;
  end if;
  begin
    perform save_store_tax(v.store_id, v_mode, '[]'::jsonb, v.revision + 1);
    raise exception '⑧ save_store_tax 낡은 판본이 통과했습니다';
  exception when sqlstate '45009' then null;
  end;
end $test$;
rollback;
EOF
      )"; then
        say "   FAIL 일반/세금 판본 행동 계약이 깨졌다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
      else
        say "   ok   일반·세금 무변경은 자국 0, 변경은 +1, 낡은 판본은 45009"
      fi
    else
      fail=1
    fi
  fi
fi

# ── 시나리오 9 · 0172 기존 원장 → 계정 삭제 수명주기 분리 (P0-1) ──────────────
# 0173 이전의 실제 FK는 auth.users 삭제를 stores와 전 업무 원장으로 cascade 했다.
# 0172 상태의 시드 원장 수를 먼저 굳힌 뒤 0173을 태우고, 인증 계정을 지워도 같은 수인지 잰다.
say "⑨ 0172 상태 + 기존 판매·재고 원장 → 0173 뒤 계정 삭제에도 원장 보존"
BASE9=20260826000172
STEP9="$(cd "$MIG_DIR" && ls 20260829000173_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE9" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
create table public._expect_0173 as
select s.id as store_id, s.owner_id,
       (select count(*) from inventory_events e where e.store_id=s.id) as inventory_count,
       (select count(*) from daily_sales d where d.store_id=s.id) as sales_count
  from stores s order by s.created_at, s.id limit 1;
EOF
n=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select count(*) from public._expect_0173 where inventory_count > 0 and sales_count > 0;")
if [ "$n" != "1" ]; then
  say "   FAIL 전제가 안 섰다 — 보존할 판매·재고 원장이 없다"
  fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP9" 2>&1 1>/dev/null)"; then
  say "   FAIL 0173 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
elif ! err="$(psql_d "$D" <<'EOF' 2>&1 1>/dev/null
do $test$
declare
  v public._expect_0173%rowtype;
begin
  select * into v from public._expect_0173;
  delete from auth.users where id = v.owner_id;
  if not exists (select 1 from stores where id=v.store_id and owner_id is null
                   and archived_at is not null and archive_reason='account_deleted') then
    raise exception '⑨ 계정 삭제 뒤 매장이 archive 상태로 남지 않았습니다';
  end if;
  if (select count(*) from inventory_events where store_id=v.store_id) <> v.inventory_count
     or (select count(*) from daily_sales where store_id=v.store_id) <> v.sales_count then
    raise exception '⑨ 계정 삭제로 판매·재고 원장 수가 바뀌었습니다';
  end if;
  if not exists (select 1 from store_lifecycle_events where store_id=v.store_id
                   and event_type='account_deleted' and former_owner_id=v.owner_id) then
    raise exception '⑨ 계정 삭제 감사 이벤트가 없습니다';
  end if;
end $test$;
EOF
)"; then
  say "   FAIL 계정 삭제 보존 계약이 깨졌다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  say "   ok   매장은 archive · 판매·재고 행 수 불변 · 계정 삭제 감사 원장 보존"
fi

# ── 시나리오 10 · 호스티드처럼 settings 선행 SELECT가 없는 0163 상태 ────────
# 로컬 fresh DB는 기본 ACL 때문에 authenticated SELECT가 열려 있어 0164의 암묵적 전제를 가렸다.
# 권한을 명시적으로 걷은 0163 DB에서 0164 하나만 태워 읽기 전용 계약을 migration 자체가 만드는지 잰다.
say "⑩ 0163 상태 + settings 읽기 권한 없음 → 0164가 읽기만 명시적으로 연다"
BASE10=20260826000163
STEP10="$(cd "$MIG_DIR" && ls 20260826000164_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE10" "$D" >/dev/null
psql_d "$D" -c "revoke select on public.settings from anon, authenticated;" >/dev/null
before=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select has_table_privilege('authenticated','public.settings','select');")
if [ "$before" != "f" ]; then
  say "   FAIL 전제가 안 섰다 — authenticated SELECT가 닫히지 않았다"
  fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP10" 2>&1 1>/dev/null)"; then
  say "   FAIL 선행 SELECT가 없으면 0164가 멈춘다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      has_table_privilege('authenticated','public.settings','select'),
      has_table_privilege('authenticated','public.settings','insert'),
      has_table_privilege('authenticated','public.settings','update'),
      has_table_privilege('authenticated','public.settings','delete'),
      has_table_privilege('authenticated','public.settings','truncate'));" )
  if [ "$after" = "t|f|f|f|f" ]; then
    say "   ok   settings 권한 = SELECT만 열림 ($after)"
  else
    say "   FAIL 0164 뒤 settings 권한이 읽기 전용이 아니다: $after"
    fail=1
  fi
fi

say ""
if [ "$fail" = "0" ]; then say "업그레이드 경로 10/10 통과"; else say "업그레이드 경로 실패"; exit 1; fi
