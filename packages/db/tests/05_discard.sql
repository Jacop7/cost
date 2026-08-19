-- ════════════════════════════════════════════════════════════════
-- 05 · 폐기 — 실제로 버린 것만 센다 (0041)
--
-- 출발점: "폐기를 했는데 왜 기준단가가 내려가지? 올라가야 하는 거 아니야?"
-- 답: 추정 로스율이 실측에 밀려 내려앉는 구조였다. 그래서 로스율을 없앴다.
-- 이제 단가는 산 값 그대로이고, 손실은 **버릴 때만** 기록된다.
--
-- 폐기 경로는 둘이다.
--   ① 식재료 폐기(E2)      — 쉬어서 버림.        sales_item_id 없음
--   ② 조리 폐기(qty_waste) — 만들어 놓고 못 팖.  sales_item_id 있음, waste = true
-- 손익에서 ①은 원장에서, ②는 daily_sales_items 에서 집계한다 — 겹치면 이중 계산이다.
--
-- 1차 범위 밖(사장님 결정): **손질 손실**은 잡지 않는다. 대파 1kg 을 다듬어 850g 을
-- 쓰더라도 150g 은 어디에도 기록되지 않고, 장부 재고가 물리 재고보다 많아진다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_daepa uuid := pg_temp.ing('대파');
  v_ing   uuid := pg_temp.ing('청양고추');
  v_rcp   uuid := pg_temp.rcp('제육볶음');
  v_day   date := business_day();
  v_ev    uuid;
  v_res   jsonb;
  b_events bigint;
  b_stock  numeric;
  b_price  numeric;
  v_item   uuid;
  v_need   numeric;
begin
  -- ── 기준단가는 실입고량 가중평균, 그 이상 아무것도 아니다 ────
  -- 단순평균이면 3개 들어온 옵션과 100개 들어온 옵션이 같은 무게를 갖는다.
  perform pg_temp.eq('기준단가 = 실입고량 가중평균',
    base_unit_price(v_daepa),
    (select sum((o.amount / nullif(o.volume,0)) * o.received_qty) / nullif(sum(o.received_qty),0)
       from order_records o
      where o.ingredient_id = v_daepa and o.status in ('received','partial')
        and coalesce(o.received_qty,0) > 0), 0.0001);

  -- ── ① 폐기해도 기준단가는 움직이지 않는다 ───────────────────
  -- 0041 이전에는 폐기가 실측 로스율을 만들어 단가를 끌어내렸다(4.7059 → 4.0161).
  -- 인과가 거꾸로였다. 이제 폐기는 재고와 손실에만 영향을 준다.
  b_price := base_unit_price(v_daepa);
  b_stock := stock_total_base(v_daepa);
  -- ⚠ 두 번째 인자는 **남은 양**이다(버린 양이 아니다). 100g 만 남기고 버린다.
  perform e2_discard(v_daepa, 100);
  perform pg_temp.eq('폐기 후에도 기준단가 불변', base_unit_price(v_daepa), b_price, 0.0001);
  perform pg_temp.eq('남긴 만큼만 재고가 남았다', stock_total_base(v_daepa), 100, 0.0001);

  -- ── 버릴 게 없으면 이벤트를 만들지 않는다 ───────────────────
  -- 0짜리 폐기가 쌓이면 원장이 의미 없는 줄로 늘어난다.
  select count(*) into b_events from inventory_events where ingredient_id = v_ing;
  v_res := e2_discard(v_ing, stock_total_base(v_ing));
  perform pg_temp.ok('폐기량 0 이면 skipped', (v_res->>'skipped')::boolean is true);
  perform pg_temp.eq('폐기량 0 이면 이벤트 안 생김',
    (select count(*) from inventory_events where ingredient_id = v_ing), b_events, 0);

  -- ── 폐기 되돌리기는 멱등하다 ────────────────────────────────
  -- ⚠ 행 잠금으로는 중복을 못 막는다 — inventory_events 에는 원장 보존을 위해 UPDATE
  --   정책이 없고, RLS 아래 FOR UPDATE 는 UPDATE 정책 검사에 걸려 0행을 돌려준다.
  select id into v_ev from inventory_events
   where ingredient_id = v_daepa and type = 'discard' order by seq desc limit 1;
  perform e2_discard_reverted(v_ev, '테스트');
  perform pg_temp.eq('되돌리면 재고가 돌아온다', stock_total_base(v_daepa), b_stock, 0.0001);

  declare
    s_stock  numeric := stock_total_base(v_daepa);
    s_events bigint  := (select count(*) from inventory_events where ingredient_id = v_daepa);
    v_again  jsonb;
  begin
    v_again := e2_discard_reverted(v_ev, '두번째');
    perform pg_temp.ok('두 번째 되돌림은 already_reverted',
      (v_again->>'already_reverted')::boolean is true);
    perform pg_temp.eq('두 번째 되돌림에 재고 불변', stock_total_base(v_daepa), s_stock, 0);
    perform pg_temp.eq('두 번째 되돌림에 이벤트 불변',
      (select count(*) from inventory_events where ingredient_id = v_daepa), s_events, 0);
  end;

  -- 동시 요청은 함수의 exists 검사를 둘 다 통과할 수 있다. 그때는 유니크 인덱스가 막는다.
  perform pg_temp.ok('되돌림 유니크 인덱스가 있다',
    exists (select 1 from pg_indexes
             where tablename = 'inventory_events' and indexname = 'inventory_events_reverses_uk'));
  perform pg_temp.ok('stock_history 가 되돌림을 표시한다',
    (select reverted from stock_history(v_daepa) where id = v_ev) is true);

  -- ── ② 조리 폐기는 판매분과 갈라져 기록된다 (0041) ───────────
  -- 이전에는 "제육볶음 18개 소진 (폐기 2개 포함)" 한 줄로 뭉쳐 있어서
  -- 재고 내역에서 왜 나갔는지 구분할 수 없었다.
  select sum(amount) into v_need
    from recipe_ingredient_needs(v_rcp, 1) where ingredient_id = v_daepa;

  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0);
  select it.id into v_item from daily_sales_items it
    join daily_sales d on d.id = it.daily_sales_id
   where d.store_id = pg_temp.store() and d.sale_date = v_day and it.recipe_id = v_rcp;
  perform e9_sales_reverted(v_item);
  b_stock := stock_total_base(v_daepa);

  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 20, 0, 0, 3);

  perform pg_temp.eq('판매분은 consume 으로 20인분',
    (select -sum(count_delta) from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and not waste), v_need * 20, 0.0001);
  perform pg_temp.eq('조리 폐기는 discard 로 3인분',
    (select -sum(count_delta) from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and waste), v_need * 3, 0.0001);
  perform pg_temp.ok('조리 폐기 이벤트 종류가 discard',
    (select bool_and(type = 'discard') from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and waste and count_delta < 0));
  perform pg_temp.eq('둘을 합치면 23인분', b_stock - stock_total_base(v_daepa), v_need * 23, 0.0001);

  -- ── 손익에서 ①과 ②가 겹치지 않는다 ─────────────────────────
  -- 조리 폐기는 daily_sales_items 에서 금액으로 잡히므로, 원장에서 또 더하면 두 번 센다.
  declare j jsonb := sales_summary(pg_temp.store(), v_day, v_day);
  begin
    perform pg_temp.eq('식재료 폐기에 조리 폐기가 섞이지 않음',
      (j->>'waste_ingredient')::numeric, 0, 0.01);
    perform pg_temp.ok('조리 폐기는 waste_menu 로 잡힌다', (j->>'waste_menu')::numeric > 0);
    perform pg_temp.eq('폐기 손실 합계 = 식재료 + 조리',
      (j->>'waste_loss')::numeric,
      (j->>'waste_ingredient')::numeric + (j->>'waste_menu')::numeric, 0.01);
  end;

  -- ── 로스율은 완전히 사라졌다 ────────────────────────────────
  perform pg_temp.eq('real_loss_rate 함수 없음',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'real_loss_rate'), 0, 0);
  perform pg_temp.eq('loss_rate 컬럼 없음',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and column_name like '%loss%'), 0, 0);
end $t$;
