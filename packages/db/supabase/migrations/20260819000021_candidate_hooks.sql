-- ════════════════════════════════════════════════════════════════
-- 0021 · 재고를 바꾸는 나머지 경로에 후보 재판정 연결
--
-- 0020 이 `refresh_order_candidate()` 단일 출처를 만들고 E2(폐기)·E5(실사)에 연결했다.
-- 여기서 남은 두 경로를 연결한다:
--   · E1 입고 — 지금은 후보를 **무조건 delete** 한다. 부분 입고로 아직 안전재고 미만이어도 사라진다.
--     실증: 양파 3망 중 1망만 입고 → 재고 2 (< 안전 3) 인데 후보 삭제됨.
--   · E8 판매 소진 — 재고가 줄어드는데 후보 판정이 전혀 없다.
--     실증: 제육볶음 5개 판매로 재고 0 이 되어도 후보 0건.
--
-- 무조건 delete 를 재판정으로 바꾸면 "충분히 채워졌을 때만 사라진다".
-- ════════════════════════════════════════════════════════════════

create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null,
  p_idempotency_key text default null,
  p_occurred_at date default null
) returns jsonb language plpgsql security invoker as $$
declare
  o          order_records%rowtype;
  v_qty      numeric;
  v_remain   numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_today    date := coalesce(p_occurred_at, business_day());
  v_month    text;
  rec        record;
begin
  if v_today > business_day() then
    raise exception '미래 날짜로는 입고할 수 없습니다 (요청 %, 오늘 %)', v_today, business_day();
  end if;
  v_month := to_char(v_today, 'YYYY-MM');

  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if p_idempotency_key is not null and exists (
    select 1 from inventory_events
     where store_id = o.store_id and idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'order_id', p_order, 'duplicate', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  if o.status = 'canceled' then
    raise exception 'order % is canceled', p_order;
  end if;

  v_remain := o.qty - o.received_qty;
  if v_remain <= 0 then
    return jsonb_build_object(
      'order_id', p_order, 'already_received', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  v_qty := least(coalesce(p_actual_qty, v_remain), v_remain);
  if v_qty <= 0 then
    raise exception 'actual qty must be positive (order %, requested %)', p_order, p_actual_qty;
  end if;

  v_avg_prev := base_unit_price(o.ingredient_id);

  update order_records
     set received_qty = received_qty + v_qty,
         status = (case when received_qty + v_qty >= qty then 'received' else 'partial' end)::order_status
   where id = p_order;

  insert into inventory_states (ingredient_id, store_id, sealed_count, last_inbound_at)
       values (o.ingredient_id, o.store_id, v_qty, v_today)
  on conflict (ingredient_id) do update
       set sealed_count = inventory_states.sealed_count + v_qty,
           last_inbound_at = greatest(inventory_states.last_inbound_at, v_today);

  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id, idempotency_key, occurred_at)
       values (o.store_id, o.ingredient_id, 'inbound', v_qty, p_order, p_idempotency_key,
               (v_today::timestamp at time zone business_tz()));

  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, v_today, v_unit, p_order);

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_today);
  end loop;

  insert into monthly_pl (store_id, month, material_cost)
       values (o.store_id, v_month, o.amount / nullif(o.qty,0) * v_qty)
  on conflict (store_id, month) do update
       set material_cost = monthly_pl.material_cost + (o.amount / nullif(o.qty,0) * v_qty);

  -- 무조건 delete 하지 않는다. **충분히 채워졌을 때만** 후보가 사라진다.
  -- (부분 입고 후에도 안전재고 미만이면 후보로 남아야 한다.)
  perform refresh_order_candidate(o.ingredient_id);

  if v_avg_prev is not null and v_avg_prev > 0 then
    v_spike := abs(v_unit - v_avg_prev) / v_avg_prev >= 0.15;
  end if;

  return jsonb_build_object(
    'order_id', p_order, 'received_qty', v_qty,
    'unit_price', v_unit, 'price_spike', v_spike,
    'duplicate', false, 'already_received', false, 'occurred_at', v_today);
end;
$$;

-- E8 판매 소진 — 재고가 줄었으니 후보를 재판정한다.
create or replace function public.e8_sales_consumed(
  p_sales_item uuid
) returns jsonb language plpgsql security invoker as $$
declare
  it        daily_sales_items%rowtype;
  ds        daily_sales%rowtype;
  v_qty     numeric;
  v_day     date;
  rec       record;
  v_need    numeric;
  v_before  numeric;
  v_taken   numeric;
  v_short   jsonb := '[]'::jsonb;
  v_lines   int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;
  v_qty := it.qty_hall + it.qty_delivery + it.qty_takeout;

  if exists (select 1 from inventory_events where sales_item_id = p_sales_item) then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', true, 'lines', 0);
  end if;

  if v_qty <= 0 or it.recipe_id is null then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', false, 'lines', 0);
  end if;

  for rec in
    select rl.ingredient_id,
           (rl.input_qty / nullif(r.base_servings, 0)) as per_serving,
           i.name
      from recipe_lines rl
      join recipes r on r.id = rl.recipe_id
      join ingredients i on i.id = rl.ingredient_id
     where rl.recipe_id = it.recipe_id and rl.ingredient_id is not null
  loop
    if rec.per_serving is null then continue; end if;
    v_need := rec.per_serving * v_qty;

    v_before := stock_total_base(rec.ingredient_id);
    v_taken  := consume_stock(rec.ingredient_id, v_need);

    if v_need > v_before then
      v_short := v_short || jsonb_build_object(
        'ingredient_id', rec.ingredient_id, 'name', rec.name,
        'needed', v_need, 'available', v_before, 'shortage', v_need - v_before);
    end if;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
    values
      (it.store_id, rec.ingredient_id, 'consume', -v_taken, p_sales_item,
       it.menu_name || ' ' || v_qty || '개 판매',
       (v_day::timestamp at time zone business_tz()));

    -- 판매로 재고가 줄면 발주 후보가 생겨야 한다 — 이것이 사이클의 마지막 고리다.
    perform refresh_order_candidate(rec.ingredient_id);

    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'duplicate', false,
    'lines', v_lines, 'sold_qty', v_qty, 'shortages', v_short);
end;
$$;
