-- ════════════════════════════════════════════════════════════════
-- 23 · 날짜 분리 (0121) — 영업시간 재설계 1단계
--
-- 지금까지 날짜가 하나뿐이었다. `business_day()` 가 발주·입고·재고·추이·판매를
-- 전부 담당했고, 그 정의에 **지금 설정**이 섞여 있었다 —
--
--     business_cutoff() = 영업 종료 < 시작 이면 (종료 시각), 아니면 0
--     business_day(at)  = ((at at time zone 서울) - cutoff)::date
--
-- 그래서 영업시간을 자정 너머로 바꾸는 순간 **과거 시각의 해석이 바뀐다.**
-- 원장에 이미 박힌 날짜와 갈린다(기획서 §2.2).
--
-- 일반 기록(발주·입고·재고·가격추이·손익추이·수정내역)의 날짜는 그러면 안 된다.
-- 달력 날짜는 영업시간과 무관하다 — "서울 매장 01:00 입고는 현지 달력의 오늘 입고다"(§4.1).
--
-- ⚠ 판매·영업일 무리는 **아직 옮기지 않았다.** 거기는 cutoff 가 의미가 있다
--   (새벽 영업이면 전날 장부). 3단계에서 통째로 간다. 이 시험이 그 경계를 지킨다 —
--   실수로 판매까지 옮기면 새벽 판매가 다음 날 장부로 새 버린다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 영업시간을 바꿔도 현지 날짜는 안 움직인다 ───────────────
do $t$
declare
  v_at   timestamptz;
  v_bd0  date; v_ld0 date;
  v_bd1  date; v_ld1 date;
begin
  -- 서울 새벽 1시. 자정 너머 영업이면 '어제 장부'지만 달력으로는 오늘이다.
  v_at := (business_day()::text || ' 01:00')::timestamp at time zone 'Asia/Seoul';

  v_bd0 := business_day(v_at);
  v_ld0 := store_local_date(pg_temp.store(), v_at);
  perform pg_temp.eq_t('바꾸기 전에는 둘이 같다', v_bd0::text, v_ld0::text);

  -- 사장님이 영업시간을 18:00–02:00 으로 바꾼다.
  update settings set open_time = '18:00', close_time = '02:00';

  v_bd1 := business_day(v_at);
  v_ld1 := store_local_date(pg_temp.store(), v_at);

  /*
   * ⚠ 여기가 이 파일의 이유다. **같은 과거 시각**을 두 번 재는데 답이 달라진다.
   *   business_day 는 지금 설정을 읽으므로 어제로 밀린다.
   */
  perform pg_temp.ok('영업일은 과거 해석이 바뀐다 (그래서 일반 기록에 쓰면 안 된다)',
    v_bd1 is distinct from v_bd0);
  perform pg_temp.eq_t('현지 날짜는 그대로다', v_ld1::text, v_ld0::text);
end $t$;


-- ── ② 시간대는 매장이 정한다 ──────────────────────────────────
do $t$
declare
  v_at timestamptz := '2026-08-25 22:30:00+00'::timestamptz;   -- UTC 22:30
begin
  -- 서울(UTC+9)이면 다음 날 07:30 이다.
  perform pg_temp.eq_t('서울에서는 다음 날',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-26');

  -- ⚠ 행이 있다고 가정하지 않는다. 없으면 update 가 0행을 치고 시험이 조용히 통과한다.
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  -- 뉴욕(UTC-4, 서머타임)이면 아직 같은 날 18:30 이다.
  perform pg_temp.eq_t('뉴욕에서는 같은 날',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-25');

  -- 등록이 없어도 멈추지 않는다. 날짜 계산이 설정 때문에 죽으면 안 된다.
  delete from store_time_settings where store_id = pg_temp.store();
  perform pg_temp.eq_t('시간대가 없으면 서울로 떨어진다',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-26');
end $t$;


-- ── ③ 옮긴 것과 안 옮긴 것의 경계 ─────────────────────────────
-- 이 경계가 무너지면 조용히 틀린다. 목록으로 못 박는다.
do $t$
declare
  r     record;
  v_def text;
begin
  -- 일반 기록 13개 — 전부 옮겼어야 한다.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e2_discard_reverted','e5_stock_adjusted',
                        'e7_place_order','e11_inbound_reverted','quick_inbound','e4_fixed_cost_saved',
                        'recipe_detail','recompute_recipe','retire_channel','save_store_tax',
                        'fixed_cost_revenue_check']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 현지 날짜를 쓴다', r.fn),
      position('store_local_date' in v_def) > 0 and position('business_day()' in v_def) = 0);
  end loop;

  /*
   * 판매·영업일 5개 — **아직 옮기면 안 된다.**
   * 여기는 cutoff 가 일부러 들어 있다. 새벽 2시까지 영업하는 집에서 01:00 판매는
   * 어제 장부에 들어가야 한다. 3단계에서 sync_business_context 로 옮긴다.
   */
  for r in
    select unnest(array['business_day_state','day_menu_basis','e10_sale_recorded',
                        'open_business_day','save_sale']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 아직 영업일을 쓴다 (3단계 몫)', r.fn),
      position('business_day()' in v_def) > 0);
  end loop;
end $t$;


-- ── ④ 오늘은 값이 안 바뀐다 ───────────────────────────────────
-- 이 단계는 구조만 가른다. 지금 영업시간(11:00–22:00)에서는 cutoff 가 0 이라
-- 두 날짜가 같아야 한다. 다르면 이 단계가 데이터를 움직인 것이다.
do $t$
declare v_i uuid := pg_temp.ing('대파'); v_o uuid;
begin
  perform pg_temp.eq_t('오늘 두 날짜가 같다',
    store_local_date(pg_temp.store())::text, business_day()::text);

  -- 실제 기록 경로도 같은 날짜를 남긴다.
  perform quick_inbound(pg_temp.store(), v_i, 1000, 4000, 1, null, null, 'T23');
  select id into v_o from order_records where ingredient_id = v_i order by created_at desc limit 1;
  perform pg_temp.eq_t('빠른 입고가 현지 날짜로 적힌다',
    (select ordered_at::text from order_records where id = v_o),
    store_local_date(pg_temp.store())::text);
end $t$;
