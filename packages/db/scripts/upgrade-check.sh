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

CT="${SUPABASE_DB_CONTAINER:-supabase_db_margincook}"
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
apply_after() {
  local database="$1" base="$2" migration name version
  for migration in "$MIG_DIR"/*.sql; do
    name="$(basename "$migration")"
    version="${name%%_*}"
    if [[ "$version" > "$base" ]]; then
      if ! psql_d "$database" < "$migration"; then
        printf 'migration failed: %s\n' "$name" >&2
        return 1
      fi
    fi
  done
}

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
say "⑧ 0170 상태 + 서로 다른 2매장 설정 → 최신까지 값 보존·일반 판본/옛 세금 문 계약"
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

      # 앱이 밟는 일반 설정 문의 무변경→변경→낡은 판본 거부를 잰다.
      # 이 픽스처의 두 매장은 의도적으로 자동 국제 프로필 대상이 아니므로 새 프로필 판본은
      # DB 시험 44·47이 맡고, 여기서는 cutover 뒤 옛 세금 저장 문이 45017로 닫히는지만 잰다.
      # 전부 롤백해 보존 검산과 분리한다.
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
begin
  select s.* into v from settings s join stores st on st.id=s.store_id order by st.created_at, st.id limit 1;
  v_time := v.updated_at;

  v_r := save_settings(v.store_id, jsonb_build_object('cup_volume', v.cup_volume), v.revision);
  if (v_r->>'changed')::boolean or (v_r->>'revision')::int <> v.revision then
    raise exception '⑧ save_settings 무변경 응답이 틀렸습니다: %', v_r;
  end if;
  begin
    perform save_store_tax(v.store_id, v.tax_mode, v.tax_items, v.revision);
    raise exception '⑧ 옛 세금 저장 문이 통과했습니다';
  exception when sqlstate '45017' then null;
  end;
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

end $test$;
rollback;
EOF
      )"; then
        say "   FAIL 일반/세금 판본 행동 계약이 깨졌다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
      else
        say "   ok   일반 설정 무변경은 자국 0, 변경은 +1, 낡은 판본은 45009, 옛 세금 문은 45017"
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
  "select concat_ws('|',
     has_table_privilege('authenticated','public.settings','select'),
     has_table_privilege('authenticated','public.settings','insert'),
     has_table_privilege('authenticated','public.settings','update'),
     has_table_privilege('authenticated','public.settings','delete'),
     has_table_privilege('authenticated','public.settings','truncate'));")
if [ "$before" != "f|t|t|t|t" ]; then
  say "   FAIL 전제가 안 섰다 — 호스티드 사전 상태(f|t|t|t|t)가 아니다: $before"
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

# ── 시나리오 11 · 0174 실행 역할·Cron·내부 키 → MarginCook 네임스페이스 ────
say "⑪ 0174 상태 → 0175가 실행 역할·Cron·삭제 가드 키를 MarginCook으로 전환"
BASE11=20260829000174
STEP11="$(cd "$MIG_DIR" && ls 20260830000175_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE11" "$D" >/dev/null
old_role=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select count(*) from pg_roles where rolname='sikjae_rpc_executor';")
old_cron=$(docker exec -i "$CT" psql -U postgres -d "$D" -q -t -A -c \
  "create temp table brand_cron_count(value integer);
   do \$\$
   declare
     v_count integer := 0;
   begin
     if to_regclass('cron.job') is null then
       insert into brand_cron_count values (0);
     else
       execute 'select count(*) from cron.job where jobname in
         (''sikjae-close-due'',''sikjae-apply-breaks'',''sikjae-purge-changes'')'
         into strict v_count;
       insert into brand_cron_count values (v_count);
     end if;
   end
   \$\$;
   select value from brand_cron_count;")
if [ "$old_role" != "1" ]; then
  say "   FAIL 전제가 안 섰다 — 이전 실행 역할이 정확히 1개가 아니다 ($old_role)"
  fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP11" 2>&1 1>/dev/null)"; then
  say "   FAIL 0175 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  state=$(docker exec -i "$CT" psql -U postgres -d "$D" -q -t -A -c "
    create temp table brand_cron_state(old_count integer, new_count integer);
    do \$\$
    declare
      v_old integer := 0;
      v_new integer := 0;
    begin
      if to_regclass('cron.job') is not null then
        execute 'select count(*) from cron.job where jobname like ''sikjae-%'''
          into v_old;
        execute 'select count(*) from cron.job where jobname in
          (''margincook-close-due'',''margincook-apply-breaks'',''margincook-purge-changes'')'
          into v_new;
      end if;
      insert into brand_cron_state values (v_old, v_new);
    end
    \$\$;
    select concat_ws('|',
      (select count(*) from pg_roles where rolname='sikjae_rpc_executor'),
      (select count(*) from pg_roles where rolname='margincook_rpc_executor'),
      position('margincook.store_purge_id' in pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure)) > 0,
      position('sikjae.store_purge_id' in pg_get_functiondef('public.reject_store_direct_delete()'::regprocedure)) = 0,
      old_count,
      new_count)
      from brand_cron_state;" )
  IFS='|' read -r old_after new_after new_key old_key_gone old_cron_after new_cron <<< "$state"
  if [ "$old_after" = "0" ] && [ "$new_after" = "1" ] \
     && [ "$new_key" = "t" ] && [ "$old_key_gone" = "t" ] \
     && [ "$old_cron_after" = "0" ] && [ "$new_cron" = "$old_cron" ]; then
    say "   ok   역할 OID 전진 · 이전 키/작업명 0 · 기존 Cron ${old_cron}건 이름 보존 전환"
  else
    say "   FAIL 전환 상태가 맞지 않다: $state (기존 Cron=$old_cron)"
    fail=1
  fi
fi

# ── 시나리오 12 · 0175 업무 원장 → 운영 관측 추가 ───────────────────────────
say "⑫ 0175 상태 + 기존 판매·재고 원장 → 0176이 원장 불변으로 관측 경계만 추가"
BASE12=20260830000175
STEP12="$(cd "$MIG_DIR" && ls 20260830000176_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE12" "$D" >/dev/null
before12=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select concat_ws('|',(select count(*) from inventory_events),(select count(*) from daily_sales));")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP12" 2>&1 1>/dev/null)"; then
  say "   FAIL 0176 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after12=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
    "select concat_ws('|',(select count(*) from inventory_events),(select count(*) from daily_sales));")
  state12=$(docker exec -i "$CT" psql -U postgres -d "$D" -q -t -A -c "
    select set_config('request.jwt.claims',
      jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, false)
      from stores order by created_at, id limit 1;
    set role authenticated;
    select report_client_rpc_error('45009','REVISION_CONFLICT','web')->>'reason';
    select report_client_rpc_error('XX001','INTERNAL_FAILURE','web')->>'reported';
    select report_client_rpc_error(null,null,'web')->>'reported';
    reset role;
    select concat_ws('|',
      to_regclass('ops.rpc_error_buckets') is not null,
      to_regclass('ops.monitoring_config') is not null,
      has_function_privilege('authenticated','public.report_client_rpc_error(text,text,text)','execute'),
      not has_function_privilege('authenticated','public.ops_health_status()','execute'),
      not has_schema_privilege('authenticated','ops','usage'),
      (ops_health_status()#>>'{rpc,unexpected_count}')::integer = 2);" | tail -1)
  if [ "$before12" = "$after12" ] && [ "$state12" = "t|t|t|t|t|t" ]; then
    say "   ok   판매·재고 행 수 불변 · ops 원본 폐쇄 · 보고/상태 권한 분리 · 코드 없는 오류 포함 2건"
  else
    say "   FAIL 원장 전=$before12 후=$after12 관측 상태=$state12"
    fail=1
  fi
fi

# ── 시나리오 13 · 0176 관측 신호 → Cron 장애와 앱 RPC 경고 분리 ─────────────
say "⑬ 0176 상태 + 실패만 있는 Cron·앱 RPC 보고 → 0177이 장애와 경고를 분리"
BASE13=20260830000176
STEP13="$(cd "$MIG_DIR" && ls 20260831000177_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE13" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
create schema if not exists cron;
create table if not exists cron.job (
  jobid bigint primary key,
  schedule text not null,
  command text not null,
  database text not null,
  username text not null,
  active boolean not null,
  jobname text not null
);
create table if not exists cron.job_run_details (
  jobid bigint not null,
  runid bigint primary key,
  database text not null,
  username text not null,
  command text not null,
  status text not null,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);
insert into cron.job (jobid, schedule, command, database, username, active, jobname) values
  (910001, '* * * * *', 'select public.close_due_business_days()', current_database(), current_user, true, 'margincook-close-due'),
  (910002, '* * * * *', 'select public.apply_due_breaks()', current_database(), current_user, true, 'margincook-apply-breaks'),
  (910003, '17 4 * * *', 'select public.purge_entity_changes()', current_database(), current_user, true, 'margincook-purge-changes');
EOF
before13=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select concat_ws('|',(select count(*) from inventory_events),(select count(*) from daily_sales));")
psql_d "$D" <<'EOF' >/dev/null
select set_config('request.jwt.claims',
  jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, false)
  from stores order by created_at, id limit 1;
set role authenticated;
select report_client_rpc_error('XX001','INTERNAL_FAILURE','web');
reset role;
delete from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'margincook-purge-changes');
insert into cron.job_run_details
  (jobid, runid, database, username, command, status, start_time, end_time)
select jobid, coalesce((select max(runid) from cron.job_run_details), 0) + 3000000,
       database, username, command, 'failed', clock_timestamp(), clock_timestamp()
  from cron.job where jobname = 'margincook-purge-changes';
EOF
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP13" 2>&1 1>/dev/null)"; then
  say "   FAIL 0177 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  failed13=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    with v as (select ops_health_status() x)
    select concat_ws('|', x#>>'{cron,healthy}', x->>'status', x#>>'{rpc,warning}',
      exists (select 1 from jsonb_array_elements(x#>'{cron,jobs}') j
               where j->>'name'='margincook-purge-changes'
                 and jsonb_typeof(j->'healthy')='boolean'
                 and (j->>'healthy')::boolean is false)) from v;")
  docker exec -i "$CT" psql -U postgres -d "$D" -q -c \
    "delete from cron.job_run_details where jobid=(select jobid from cron.job where jobname='margincook-purge-changes');" >/dev/null
  warning13=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    with v as (select ops_health_status() x)
    select concat_ws('|', x#>>'{cron,healthy}', x->>'status', x#>>'{rpc,warning}') from v;")
  after13=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
    "select concat_ws('|',(select count(*) from inventory_events),(select count(*) from daily_sales));")
  if [ "$failed13" = "false|degraded|true|t" ] \
     && [ "$warning13" = "true|ok|true" ] \
     && [ "$before13" = "$after13" ]; then
    say "   ok   실패만 있는 Cron은 degraded · 앱 보고만 있으면 ok+warning · 업무 원장 불변"
  else
    say "   FAIL 실패 상태=$failed13 경고 상태=$warning13 원장 전=$before13 후=$after13"
    fail=1
  fi
fi

# ── 시나리오 14 · 0177 현행 세금 → 국제 계약 capability 비활성 기준선 ──────
say "⑭ 0177 상태 + 현행 세금 계산 → 0178 capability 추가 뒤 계산 불변·새 쓰기 비활성"
BASE14=20260831000177
STEP14="$(cd "$MIG_DIR" && ls 20260831000178_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE14" "$D" >/dev/null
before14=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select tax_of(12000, 'included', '[{\"name\":\"부가세\",\"rate\":9.0909090909}]'::jsonb);")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP14" 2>&1 1>/dev/null)"; then
  say "   FAIL 0178 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  state14=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    with v as (select app_capabilities() x)
    select concat_ws('|',
      x->>'contract_version',
      x->>'minimum_supported_app_version',
      x#>>'{international_tax,contract_version}',
      x#>>'{international_tax,read_enabled}',
      x#>>'{international_tax,write_enabled}',
      jsonb_typeof(x#>'{international_tax,minimum_write_app_version}'),
      has_function_privilege('authenticated','public.app_capabilities()','execute'),
      not has_function_privilege('anon','public.app_capabilities()','execute')) from v;")
  after14=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
    "select tax_of(12000, 'included', '[{\"name\":\"부가세\",\"rate\":9.0909090909}]'::jsonb);")
  if [ "$before14" = "$after14" ] \
     && [ "$state14" = "1|0.1.0|international_tax_v1|false|false|null|t|t" ]; then
    say "   ok   현행 세금 계산 불변 · capability 계약/권한 고정 · 국제 세금 읽기·쓰기 비활성"
  else
    say "   FAIL 세금 전=$before14 후=$after14 capability=$state14"
    fail=1
  fi
fi

# ── 시나리오 15 · 0178 비활성 capability → 국제 세금 확장 스키마 ───────────
say "⑮ 0178 상태 + 현행 세금/원장 → 0179 빈 확장 스키마 추가 뒤 값·capability 불변"
BASE15=20260831000178
STEP15="$(cd "$MIG_DIR" && ls 20260831000179_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE15" "$D" >/dev/null
before15=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
  "select concat_ws('|',
     tax_of(12000, 'included', '[{\"name\":\"부가세\",\"rate\":9.0909090909}]'::jsonb),
     (select count(*) from inventory_events),
     (select count(*) from daily_sales_items));")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP15" 2>&1 1>/dev/null)"; then
  say "   FAIL 0179 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after15=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c \
    "select concat_ws('|',
       tax_of(12000, 'included', '[{\"name\":\"부가세\",\"rate\":9.0909090909}]'::jsonb),
       (select count(*) from inventory_events),
       (select count(*) from daily_sales_items));")
  state15=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    with tables(name) as (values
      ('tax_region_catalog'),('store_market_profiles'),('store_tax_profiles'),
      ('store_tax_components'),('tax_category_catalog'),('menu_tax_overrides'),
      ('channel_tax_remittance'),('daily_sales_item_tax_snapshots'),
      ('daily_sales_item_tax_component_snapshots'),('sales_tax_events')
    ), privileges as (
      select count(*) n from tables t,
        unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) p(privilege_name)
       where has_table_privilege('authenticated','public.'||t.name,p.privilege_name)
          or has_table_privilege('anon','public.'||t.name,p.privilege_name)
    )
    select concat_ws('|',
      (select count(*) from tables where to_regclass('public.'||name) is not null),
      (select n from privileges),
      (select count(*) from store_market_profiles),
      (select count(*) from sales_tax_events),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  if [ "$before15" = "$after15" ] && [ "$state15" = "10|0|0|0|false|false" ]; then
    say "   ok   기존 세금·판매·재고 불변 · 빈 확장 표 10개 · 앱 직접 권한 0 · capability 비활성"
  else
    say "   FAIL 원장 전=$before15 후=$after15 확장 상태=$state15"
    fail=1
  fi
fi

# ── 시나리오 16 · 0179 빈 확장 스키마 → 감사·명확한 미래 프로필만 이관 ─────
say "⑯ 0179 상태 + 명확/모호 매장·과거 세금 → 0180이 합계 불변으로 판정을 가른다"
BASE16=20260831000179
STEP16="$(cd "$MIG_DIR" && ls 20260831000180_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE16" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c9');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000c9','수동 확인 매장');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c8');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-0000000000c8','오늘 미개장 명확 매장');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c7');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000d7','00000000-0000-0000-0000-0000000000c7','보관된 수동 확인 매장');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c6');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000c6','허용 오차 안 매장');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000c5');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000c5','허용 오차 밖 매장');
update settings
   set locale='en-US', currency='USD', money_digits=2, tax_mode='separate',
       tax_items='[{"name":"City fee","rate":7}]'::jsonb
 where store_id='00000000-0000-0000-0000-0000000000d9';
update settings
   set locale='ko', currency='KRW', money_digits=0, tax_mode='included',
       tax_items='[{"name":"부가세","rate":9.0909090909}]'::jsonb
 where store_id='00000000-0000-0000-0000-0000000000d8';
update settings
   set locale='ko', currency='KRW', money_digits=0, tax_mode='included',
       tax_items='[{"name":"부가세","rate":9.0909090909}]'::jsonb
 where store_id='00000000-0000-0000-0000-0000000000d7';
update stores
   set owner_id=null,
       archived_at=clock_timestamp(),
       archive_reason='store_archived',
       archive_note='upgrade archived fixture'
 where id='00000000-0000-0000-0000-0000000000d7';
update settings set locale='ko',currency='KRW',money_digits=0,tax_mode='included',
  tax_items='[{"name":"부가세","rate":9.0909095}]'::jsonb
 where store_id='00000000-0000-0000-0000-0000000000d6';
update settings set locale='ko',currency='KRW',money_digits=0,tax_mode='included',
  tax_items='[{"name":"부가세","rate":9.090911}]'::jsonb
 where store_id='00000000-0000-0000-0000-0000000000d5';
EOF
before16=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select concat_ws('|',
    (select count(*) from settings),
    (select md5(jsonb_agg(to_jsonb(s) order by store_id)::text) from settings s),
    (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
    (select coalesce(sum(etc_revenue),0) from daily_sales),
    (select coalesce(sum(etc_tax),0) from daily_sales));")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP16" 2>&1 1>/dev/null)"; then
  say "   FAIL 0180 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after16=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select count(*) from settings),
      (select md5(jsonb_agg(to_jsonb(s) order by store_id)::text) from settings s),
      (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
      (select coalesce(sum(etc_revenue),0) from daily_sales),
      (select coalesce(sum(etc_tax),0) from daily_sales));")
  state16=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select count(*) from international_tax_migration_audits),
      (select count(*) from international_tax_migration_audits where decision='auto_profile_created'),
      (select count(*) from international_tax_migration_audits where decision='manual_review_required'),
      (select future_effective_from = store_local_date(store_id) + 1
         from international_tax_migration_audits
        where store_id='00000000-0000-0000-0000-0000000000d8'),
      (select reason_codes @> array['locale_not_ko','currency_contract_not_krw','price_basis_not_inclusive','standard_vat_not_exact']
         from international_tax_migration_audits where store_id='00000000-0000-0000-0000-0000000000d9'),
      (select decision='manual_review_required' and reason_codes @> array['store_archived']
         from international_tax_migration_audits where store_id='00000000-0000-0000-0000-0000000000d7'),
      (select decision='auto_profile_created' and cardinality(reason_codes)=0
         from international_tax_migration_audits where store_id='00000000-0000-0000-0000-0000000000d6'),
      (select decision='manual_review_required' and reason_codes @> array['standard_vat_not_exact']
         from international_tax_migration_audits where store_id='00000000-0000-0000-0000-0000000000d5'),
      (select count(*) from store_market_profiles),
      (select count(*) from tax_region_catalog where country_code in ('US','CA')),
      not exists (
        select 1 from international_tax_migration_audits a
         where a.decision='auto_profile_created' and (
           (select count(*) from store_tax_components c
             where c.tax_profile_id=a.tax_profile_id and c.kind='primary' and c.name='부가세'
               and c.rate_pct=10 and c.jurisdiction_level='national'
               and c.calculation_basis='primary_tax_exclusive'
               and c.applies_to_treatments=array['taxable'::tax_treatment]) <> 1
           or (select count(*) from tax_category_catalog c
                where c.tax_profile_id=a.tax_profile_id
                  and (c.code,c.treatment) in (
                    ('standard','taxable'::tax_treatment),
                    ('zero_rated','zero_rated'::tax_treatment),
                    ('exempt','exempt'::tax_treatment))) <> 3
           or (select count(*) from channel_tax_remittance r
                join store_tax_components c on c.id=r.tax_component_id
               where c.tax_profile_id=a.tax_profile_id
                 and r.remittance_owner='merchant'
                 and r.sales_channel_code in ('hall','delivery','takeout')) <> 3)),
      not has_table_privilege('authenticated','store_tax_profile_contract','SELECT')
        and not has_table_privilege('anon','store_tax_profile_contract','SELECT')
        and not has_table_privilege('service_role','store_tax_profile_contract','SELECT'),
      (select count(*) from daily_sales_item_tax_snapshots),
      (select count(*) from daily_sales_item_tax_component_snapshots),
      (select count(*) from sales_tax_events),
      not exists (select 1 from daily_sales_items where unit_tax_calculation_version<>'legacy_effective_rate_v1'),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  if [ "$before16" = "$after16" ] \
     && [ "$state16" = "6|3|3|t|t|t|t|t|3|64|t|t|0|0|0|t|false|false" ]; then
    say "   ok   현행 설정·세액 불변 · 명확 3/수동 3(보관·허용 오차 경계 포함) · 내일부터 적용 · 자동 하위 계약 · 관할 64 · 상세 역산 0 · capability 비활성"
  else
    say "   FAIL 원본 전=$before16 후=$after16 이관 상태=$state16"
    fail=1
  fi
fi

# ── 시나리오 17 · 0180 자동 프로필 뒤의 기존 미래 영업일을 삼키지 않는다 ─────
say "⑰ 0179 상태 + 내일은 비었지만 그 뒤 미래 영업일 존재 → 0181이 마지막 장부 다음으로 경계를 전진"
BASE17=20260831000179
STEP17A="$(cd "$MIG_DIR" && ls 20260831000180_*.sql)"
STEP17B="$(cd "$MIG_DIR" && ls 20260901000181_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE17" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
do $fixture$
declare v_store uuid; v_future date;
begin
  select id into v_store from stores order by created_at,id limit 1;
  update settings set locale='ko',currency='KRW',money_digits=0,tax_mode='included',
    tax_items='[{"name":"부가세","rate":9.0909090909}]'::jsonb where store_id=v_store;
  v_future := store_local_date(v_store)+3;
  insert into business_days(
    store_id,business_date,status,opened_at,planned_close_at,closed_at,close_method,
    last_activity_at,snapshot,basis_quality,revision_no)
  values(v_store,v_future,'closed',clock_timestamp()-interval '1 hour',
    clock_timestamp(),clock_timestamp(),'manual',clock_timestamp(),'{}','exact',0);
end
$fixture$;
EOF
before17=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select concat_ws('|',
    (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
    (select coalesce(sum(etc_tax),0) from daily_sales),
    (select count(*) from business_days));")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP17A" 2>&1 1>/dev/null)"; then
  say "   FAIL 0180 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
elif ! err="$(psql_d "$D" < "$MIG_DIR/$STEP17B" 2>&1 1>/dev/null)"; then
  say "   FAIL 0181 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after17=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
      (select coalesce(sum(etc_tax),0) from daily_sales),
      (select count(*) from business_days));")
  state17=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select p.effective_from=(select max(business_date)+1 from business_days where store_id=p.store_id)
         from store_market_profiles p limit 1),
      (select t.effective_from=m.effective_from from store_tax_profiles t
         join store_market_profiles m on m.id=t.market_profile_id limit 1),
      (select a.future_effective_from=m.effective_from from international_tax_migration_audits a
         join store_market_profiles m on m.id=a.market_profile_id limit 1),
      (select a.original_future_effective_from=store_local_date(a.store_id)+1
         from international_tax_migration_audits a where a.decision='auto_profile_created' limit 1),
      to_regprocedure('public.calculate_international_tax(tax_price_basis,smallint,tax_treatment,numeric,jsonb)') is not null,
      not exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='sales_tax_events' and column_name='reverses_event_id'),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  if [ "$before17" = "$after17" ] && [ "$state17" = "t|t|t|t|t|t|false|false" ]; then
    say "   ok   0180 최초 경계 보존 · 미래 장부 뒤로 실제 경계 동기화 · 기존 합계 불변 · capability 비활성"
  else
    say "   FAIL 원본 전=$before17 후=$after17 계산 경계=$state17"
    fail=1
  fi
fi

# ── 시나리오 18 · 0181 계산 몸통 → 비활성 앱 계약·사용자 언어 분리 ───────
say "⑱ 0181 상태 + 한국어/영어/기타 로케일 → 0182 사용자 언어 분리·읽기 facade·capability 비활성"
BASE18=20260901000181
STEP18="$(cd "$MIG_DIR" && ls 20260901000182_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE18" "$D" >/dev/null
psql_d "$D" <<'EOF' >/dev/null
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000e8');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000f8','00000000-0000-0000-0000-0000000000e8','영어 앱 매장');
update settings set locale='en-US',currency='USD',money_digits=2
 where store_id='00000000-0000-0000-0000-0000000000f8';
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000e9');
insert into stores(id,owner_id,name)
values ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000e9','확인 필요 매장');
update settings set locale='ja',currency='JPY',money_digits=0
 where store_id='00000000-0000-0000-0000-0000000000f9';
EOF
before18=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select concat_ws('|',
    (select count(*) from auth.users),
    (select md5(jsonb_agg(to_jsonb(s) order by store_id)::text) from settings s),
    (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
    app_capabilities()#>>'{international_tax,read_enabled}',
    app_capabilities()#>>'{international_tax,write_enabled}');")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP18" 2>&1 1>/dev/null)"; then
  say "   FAIL 0182 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after18=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select count(*) from auth.users),
      (select md5(jsonb_agg(to_jsonb(s) order by store_id)::text) from settings s),
      (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  state18=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select count(*) from user_preferences)=(select count(*) from auth.users),
      (select app_language='en' and source_locale='en-US' from user_preferences where user_id='00000000-0000-0000-0000-0000000000e8'),
      (select app_language is null and source_locale='ja' from user_preferences where user_id='00000000-0000-0000-0000-0000000000e9'),
      to_regprocedure('public.get_user_preferences()') is not null,
      to_regprocedure('public.international_tax_app_state(uuid)') is not null,
      to_regprocedure('public.recipe_tax_app_state(uuid,uuid)') is not null,
      to_regprocedure('public.sales_tax_app_detail(uuid,date,date)') is not null,
      not has_table_privilege('authenticated','public.user_preferences','select'),
      not has_function_privilege('anon','public.international_tax_app_state(uuid)','execute'),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  if [ "$before18" = "$after18" ] && [ "$state18" = "t|t|t|t|t|t|t|t|t|false|false" ]; then
    say "   ok   사용자별 ko/en 분리·기타 언어 확인 필요 · 기존 설정/세액 불변 · facade 권한 폐쇄 · capability 비활성"
  else
    say "   FAIL 원본 전=$before18 후=$after18 앱 계약=$state18"
    fail=1
  fi
fi

# ── 시나리오 19 · 0182 앱 facade → 0183 검토 보완·기존 권한 보존 ─────
say "⑲ 0182 상태 + 비활성 앱 facade → 0183 응답 의미 보완·실행 권한/capability 보존"
BASE19=20260901000182
STEP19="$(cd "$MIG_DIR" && ls 20260901000183_*.sql)"
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE19" "$D" >/dev/null
before19=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select concat_ws('|',
    (select count(*) from stores),
    (select count(*) from daily_sales),
    (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
    app_capabilities()#>>'{international_tax,read_enabled}',
    app_capabilities()#>>'{international_tax,write_enabled}');")
if ! err="$(psql_d "$D" < "$MIG_DIR/$STEP19" 2>&1 1>/dev/null)"; then
  say "   FAIL 0183 적용이 막혔다"; say "        $(printf '%s' "$err" | head -3)"; fail=1
else
  after19=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      (select count(*) from stores),
      (select count(*) from daily_sales),
      (select coalesce(sum(unit_tax*(qty_hall+qty_delivery+qty_takeout)),0) from daily_sales_items),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  state19=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      has_function_privilege('authenticated','public.international_tax_app_state(uuid)','execute'),
      has_function_privilege('authenticated','public.recipe_tax_app_state(uuid,uuid)','execute'),
      has_function_privilege('authenticated','public.sales_tax_app_detail(uuid,date,date)','execute'),
      not has_function_privilege('anon','public.sales_tax_app_detail(uuid,date,date)','execute'),
      app_capabilities()#>>'{international_tax,read_enabled}',
      app_capabilities()#>>'{international_tax,write_enabled}');")
  if [ "$before19" = "$after19" ] && [ "$state19" = "t|t|t|t|false|false" ]; then
    say "   ok   업무 합계 불변 · facade 실행 권한 보존 · anon 폐쇄 · capability 비활성"
  else
    say "   FAIL 원본 전=$before19 후=$after19 권한/capability=$state19"
    fail=1
  fi
fi

# ── 시나리오 20 · 0180 자동 프로필의 구성행 → 0186 config_key 백필 ─────
say "⑳ 0179 상태 + 한국 자동 이관 프로필 구성행 → 0186 이후 최신까지 중단 없이 백필"
BASE20=20260831000179
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE20" "$D" >/dev/null
if ! err="$(apply_after "$D" "$BASE20" 2>&1 1>/dev/null)"; then
  say "   FAIL 자동 이관 프로필이 있는 업그레이드가 막혔다"
  say "        $(printf '%s' "$err" | head -3)"
  fail=1
else
  state20=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      exists(select 1 from international_tax_migration_audits where decision='auto_profile_created'),
      exists(select 1 from store_tax_components),
      not exists(select 1 from store_tax_components where config_key is null),
      (select count(*) from store_tax_components)=
        (select count(distinct (tax_profile_id,config_key)) from store_tax_components));")
  if [ "$state20" = "t|t|t|t" ]; then
    say "   ok   기존 자동 프로필 구성행을 config_key로 안전하게 백필했다"
  else
    say "   FAIL 자동 프로필·config_key 사후조건이 틀렸다: $state20"
    fail=1
  fi
fi

# ── 시나리오 21 · main의 0183 스키마 → 메뉴 과세 적용일 전진 이관 ─────
say "㉑ 0183 main 상태 → 0186이 effective_from·PK·판매일 선택을 전진 추가"
BASE21=20260901000183
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE21" "$D" >/dev/null
before21=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
  select exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='menu_tax_overrides'
      and column_name='effective_from');")
if [ "$before21" != "f" ]; then
  say "   FAIL 0183 기준선에 아직 없어야 할 effective_from이 있다"
  fail=1
elif ! err="$(apply_after "$D" "$BASE21" 2>&1 1>/dev/null)"; then
  say "   FAIL 0183 main 상태에서 최신까지 적용이 막혔다"
  say "        $(printf '%s' "$err" | head -3)"
  fail=1
else
  state21=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A -c "
    select concat_ws('|',
      exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='menu_tax_overrides'
          and column_name='effective_from' and is_nullable='NO'),
      (select count(*) from pg_attribute a
         join pg_index i on i.indrelid='public.menu_tax_overrides'::regclass
          and i.indisprimary and a.attrelid=i.indrelid and a.attnum=any(i.indkey)),
      position('o.effective_from <= v_sales.sale_date' in
        pg_get_functiondef('public.apply_international_tax_for_sales_item_body(uuid,boolean)'::regprocedure))>0,
      position('o.effective_from<=p_date' in
        pg_get_functiondef('public.international_tax_shadow_compare(uuid,date)'::regprocedure))>0,
      position('effective_from <= d.sale_date' in
        pg_get_functiondef('public.guard_sales_tax_snapshot_source()'::regprocedure))>0);")
  if [ "$state21" != "t|3|t|t|t" ]; then
    say "   FAIL 메뉴 과세 적용일 스키마·PK·계산·shadow·스냅샷 가드가 어긋났다: $state21"
    fail=1
  elif ! test21="$(cd "$DB_DIR" && PGDATABASE="$D" node tests/run.mjs 50 2>&1)"; then
    say "   FAIL 0183→최신 DB에서 메뉴 적용일 행동 시험이 실패했다"
    say "        $(printf '%s' "$test21" | tail -8)"
    fail=1
  else
    say "   ok   main 기준 DB에 적용일 스키마와 판매일 선택을 추가하고 행동 회귀가 통과한다"
  fi
fi

# ── 시나리오 22 · 0185 중간 상태의 shadow 실행 가능 계약 ─────────
say "㉒ 0185 중간 상태 → effective_from 없이 shadow 비교 함수가 실제로 실행됨"
BASE22=20260901000185
bash "$SCRIPT_DIR/fresh-db.sh" --until "$BASE22" "$D" >/dev/null
state22=$(docker exec -i "$CT" psql -U postgres -d "$D" -t -A <<'EOF'
with target as (
  select id,owner_id from public.stores order by created_at,id limit 1
), claims as (
  select set_config('request.jwt.claims',
    jsonb_build_object('sub',owner_id::text,'role','authenticated')::text,false)
  from target
)
select concat_ws('|',
  position('o.effective_from' in pg_get_functiondef(
    'public.international_tax_shadow_compare(uuid,date)'::regprocedure))=0,
  coalesce((public.international_tax_shadow_compare(
    target.id,(public.resolve_sales_business_context(target.id,clock_timestamp())).sales_date)
      ->>'status') in ('complete','not_comparable','no_sales','partial'),false))
from target,claims;
EOF
)
if [ "$state22" = "t|t" ]; then
  say "   ok   0185 단독 상태에서 적용일 열 없이 shadow 비교가 실행된다"
else
  say "   FAIL 0185 중간 상태의 shadow 실행 계약이 깨졌다: $state22"
  fail=1
fi

say ""
if [ "$fail" = "0" ]; then say "업그레이드 경로 22/22 통과"; else say "업그레이드 경로 실패"; exit 1; fi
