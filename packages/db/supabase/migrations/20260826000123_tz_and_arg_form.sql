-- ════════════════════════════════════════════════════════════════
-- 0123 · 1단계에 뚫려 있던 구멍 둘
--
-- 조사에서 나왔다. 둘 다 **내 검증이 못 잡은 것**이라 검증도 같이 고친다.
--
-- ── ① 인자 있는 형태를 놓쳤다 ────────────────────────────────
-- 0121 은 이렇게 바꿨다:
--     replace(def, 'business_day()', 'store_local_date(...)')
-- 그런데 `e2_discard_reverted` 는 **인자를 넣어** 부른다 —
--     if business_day(ev.occurred_at) < v_day - (discard_delete_days() - 1) then
-- 문자열이 `business_day()` 가 아니라 `business_day(ev.occurred_at)` 이라 안 걸렸다.
--
-- 더 나쁜 건 **검증도 같은 문자열을 봤다**는 것이다 —
--     if position('business_day()' in v_def) > 0 then ... 안 옮겨졌다 ...
-- 그래서 "13개 전부 옮겼다" 고 통과했다. 테스트 23 도 같은 눈으로 봤다.
--
-- 결과: 폐기 취소의 7일 제한이 **판매 영업일 기준**으로 재어진다. 영업시간이
-- 자정을 넘는 순간 그 창이 하루 밀린다 — 어제 폐기를 오늘 못 되돌리거나 그 반대다.
--
-- ── ② 날짜만 옮기고 시간대는 안 옮겼다 ──────────────────────
-- `business_tz()` 는 아직 `'Asia/Seoul'` 하드코딩이고 11개 함수가 그대로 쓴다.
-- 그중 4개는 **0121 이 옮긴 함수들**이다. 날짜는 매장별로 재면서 타임스탬프는
-- 서울로 못 박는다 —
--     insert into inventory_events (... occurred_at ...)
--       values (..., (v_day::timestamp at time zone business_tz()), ...)
--
-- 뉴욕 매장이면 13시간 어긋난 순간이 저장되고, `stock_history` 가 그걸 되읽을 때
-- 날짜 경계가 하루 밀린다. **원장 날짜와 화면 날짜가 갈린다.**
--
-- ⚠ `business_day()` 와 `business_month()` 는 여기서 안 건드린다.
--   business_day 는 판매 무리(3단계) 몫이고, business_month 는 고정지출 귀속 월 키라
--   잘못 옮기면 월 손익이 통째로 이동한다. 따로 다룬다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 인자 있는 형태 ──────────────────────────────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e2_discard_reverted';

  if v_def is null then
    raise exception '0123: e2_discard_reverted 가 없습니다' using errcode = '45003';
  end if;
  if position('business_day(ev.occurred_at)' in v_def) = 0 then return; end if;

  v_new := replace(v_def, 'business_day(ev.occurred_at)',
    'store_local_date((select store_id from inventory_events where id = p_event), ev.occurred_at)');
  if v_new = v_def then
    raise exception '0123: 폐기 취소의 인자 형태를 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;
end
$mig$;


-- ── ②-0 잘못 넣은 별칭을 되돌린다 ────────────────────────────
/*
 * ⚠ 처음엔 하위질의 별칭을 `it` 로 썼는데, `reconcile_sales_consumption` 은
 *   **변수 이름이 이미 `it`** 다(`it daily_sales_items%rowtype`).
 *   그래서 `it.daily_sales_id` 가 모호해져 그 함수가 통째로 죽었다(테스트 10개 빨강).
 *   plpgsql 안에서 하위질의를 쓸 때는 변수 이름과 안 겹치는 별칭을 골라야 한다.
 *   새 DB 에서는 처음부터 `dsi` 로 들어가므로 이 블록은 아무 일도 안 한다.
 */
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reconcile_sales_consumption';
  if v_def is null then return; end if;

  -- 내가 넣었던 두 가지 나쁜 형태를 전부 `it.store_id` 로 눕힌다.
  v_new := v_def;
  v_new := replace(v_new,
    '(select ds.store_id from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id where it.id = p_sales_item)',
    'it.store_id');
  v_new := replace(v_new,
    '(select ds.store_id from daily_sales ds join daily_sales_items dsi on dsi.daily_sales_id = ds.id where dsi.id = p_sales_item)',
    'it.store_id');
  if v_new <> v_def then
    execute v_new;
    raise notice '0123: reconcile_sales_consumption 의 별칭 충돌을 되돌렸습니다';
  end if;
end
$mig$;


-- ── ② 시간대를 매장 것으로 ────────────────────────────────────
-- ⚠ 매장을 알 수 있는 함수만 옮긴다. 모르는 곳에 억지로 넣지 않는다.
do $mig$
declare r record; v_def text; v_new text; v_n int := 0;
begin
  for r in
    select * from (values
      ('e1_confirm_inbound',          '(select store_id from order_records where id = p_order)'),
      ('e2_discard',                  '(select store_id from ingredients where id = p_ingredient)'),
      ('e5_stock_adjusted',           '(select store_id from ingredients where id = p_ingredient)'),
      ('recompute_recipe',            '(select store_id from recipes where id = p_recipe)'),
      ('stock_history',               '(select store_id from ingredients where id = p_ingredient)'),
      ('sales_summary',               'p_store'),
      ('sales_waste_breakdown',       'p_store'),
      ('planned_close',               'p_store'),
      -- ⚠ 여기는 **하위질의를 쓰지 않는다.** 이 함수는 `it` 와 `ds` 를 둘 다 변수로
      --   선언해 놔서(`it daily_sales_items%rowtype` · `ds daily_sales%rowtype`)
      --   어떤 별칭을 골라도 plpgsql 이 변수와 헷갈린다. 실제로 두 번 연달아 터졌다.
      --   그럴 필요도 없다 — 이미 `it.store_id` 가 로드돼 있다.
      ('reconcile_sales_consumption', 'it.store_id')
    ) as t(fn, store_expr)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;

    if v_def is null then
      raise exception '0123: % 가 없습니다', r.fn using errcode = '45003';
    end if;
    if position('business_tz()' in v_def) = 0 then continue; end if;

    v_new := replace(v_def, 'business_tz()', 'store_timezone(' || r.store_expr || ')');
    execute v_new;
    v_n := v_n + 1;
  end loop;

  raise notice '0123: %개 함수의 시간대를 매장 것으로 옮겼습니다', v_n;
end
$mig$;


-- ── 되읽어서 확인한다 (이번엔 인자 형태까지 본다) ─────────────
do $chk$
declare r record; v_def text; v_bad text := '';
begin
  /*
   * ⚠ `business_day()` 가 아니라 **`business_day(`** 로 본다.
   *   괄호까지만 보면 인자 있는 호출을 놓친다 — 0121 이 정확히 그래서 뚫렸다.
   */
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e2_discard_reverted','e5_stock_adjusted',
                        'e7_place_order','e11_inbound_reverted','quick_inbound','e4_fixed_cost_saved',
                        'recipe_detail','recompute_recipe','retire_channel','save_store_tax',
                        'fixed_cost_revenue_check']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if position('business_day(' in v_def) > 0 then v_bad := v_bad || ' day:' || r.fn; end if;
  end loop;

  -- 시간대를 옮긴 9개에 하드코딩이 남아 있으면 안 된다.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e5_stock_adjusted','recompute_recipe',
                        'stock_history','sales_summary','sales_waste_breakdown','planned_close',
                        'reconcile_sales_consumption']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if position('business_tz()' in v_def) > 0 then v_bad := v_bad || ' tz:' || r.fn; end if;
    if position('store_timezone(' in v_def) = 0 then v_bad := v_bad || ' !tz:' || r.fn; end if;
  end loop;

  if v_bad <> '' then
    raise exception '0123: 안 옮겨진 자리가 있습니다 —%', v_bad using errcode = '45003';
  end if;

  -- 판매 무리는 아직 그대로여야 한다(3단계 몫).
  for r in
    select unnest(array['business_day_state','day_menu_basis','e10_sale_recorded',
                        'open_business_day','save_sale']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if position('business_day(' in v_def) = 0 then
      raise exception '0123: 판매 무리의 % 를 건드렸습니다 — 3단계 몫입니다', r.fn
        using errcode = '45003';
    end if;
  end loop;
end
$chk$;

select public.assert_no_rpc_overloads();
