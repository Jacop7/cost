-- ═════════════════════════════════════════════════════════════
-- 0066 · 입고 확정이 자동 전파를 남긴다
--
-- 입고 한 번으로 생기는 일:
--   식재료 기준단가가 바뀌고 → 그 재료를 쓰는 모든 메뉴의 재료비·순이익이 바뀐다.
-- 사장님은 직접 고치지 않았는데 숫자가 움직인다 — 왜 그러는지 보여 줘야 한다.
--
-- 식재료 이벤트 1건 + 영향받은 레시피 이벤트 N건을 **같은 correlation_id** 로
-- 묶는다. 그래야 식재료 카드가 "연결 레시피 2개를 재계산했어요" 라고 말하고,
-- 반영 상태가 섞였을 때 '일부 메뉴 미반영' 을 판정할 수 있다.
--
-- ⚠ 본문은 현재 정의를 읽어 기계적으로 주입했다.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.e1_confirm_inbound(p_order uuid, p_actual_qty numeric DEFAULT NULL::numeric, p_idempotency_key text DEFAULT NULL::text, p_occurred_at date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  o          order_records%rowtype;
  v_qty      numeric;
  v_base     numeric;
  v_per      numeric;
  v_remain   numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_today    date := coalesce(p_occurred_at, business_day());
  v_month    text;
  rec        record;
  -- 수정 내역용(0063) — 한 번의 입고를 하나의 묶음으로 남긴다
  v_corr     uuid := gen_random_uuid();
  v_unit0    text;
  v_mat_before jsonb;
  v_mat0     numeric;
  v_tax0     numeric;
  v_rate0    numeric;
  v_price0   numeric;
begin
  if v_today > business_day() then
    raise exception '미래 날짜로는 입고할 수 없습니다 (요청 %, 오늘 %)', v_today, business_day()
      using errcode = '22000';
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
    raise exception '취소된 발주는 입고할 수 없어요' using errcode = '22000';
  end if;

  v_remain := o.qty - o.received_qty;
  if v_remain <= 0 then
    return jsonb_build_object(
      'order_id', p_order, 'already_received', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  v_qty := least(coalesce(p_actual_qty, v_remain), v_remain);
  if v_qty <= 0 then
    raise exception '입고 수량은 0보다 커야 합니다' using errcode = '22000';
  end if;

  select per_volume into v_per from ingredients where id = o.ingredient_id;
  v_base := v_qty * coalesce(v_per, 0);
  v_avg_prev := base_unit_price(o.ingredient_id);

  -- ⚠ 연결 레시피의 재료비는 **입고가 반영되기 전에** 잡아야 한다(0063).
  --   recipe_material_cost 는 지금 단가로 계산하므로, 아래 재고 이벤트가 들어간
  --   뒤에 재면 전후가 같아져 변경이 없는 것으로 보인다.
  select coalesce(jsonb_object_agg(x.recipe_id::text, recipe_material_cost(x.recipe_id)), '{}'::jsonb)
    into v_mat_before
    from (select distinct recipe_id from recipe_lines
           where ingredient_id = o.ingredient_id and store_id = o.store_id) x;

  update order_records
     set received_qty = received_qty + v_qty,
         status = (case when received_qty + v_qty >= qty then 'received' else 'partial' end)::order_status
   where id = p_order;

  insert into inventory_states (ingredient_id, store_id, stock_total, last_inbound_at)
       values (o.ingredient_id, o.store_id, v_base, v_today)
  on conflict (ingredient_id) do update
       set stock_total = inventory_states.stock_total + excluded.stock_total,
           last_inbound_at = greatest(coalesce(inventory_states.last_inbound_at, v_today), v_today);

  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id,
                                idempotency_key, note, occurred_at, unit_normalized)
       values (o.store_id, o.ingredient_id, 'inbound', v_base, p_order, p_idempotency_key,
               v_qty || '개 입고', (v_today::timestamp at time zone business_tz()), true);

  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, v_today, v_unit, p_order);

  if v_avg_prev is not null and v_avg_prev > 0 and v_unit is not null then
    v_spike := v_unit > v_avg_prev * 1.2;
  end if;

  -- ── 단가 변경을 내역에 남긴다(0063) ────────────────────────
  -- ⚠ 실제로 단가가 달라졌을 때만이다. 같은 값으로 또 들어온 입고가
  --   내역을 채우면 사장님이 진짜 변동을 못 찾는다.
  select base_unit::text into v_unit0 from ingredients where id = o.ingredient_id;
  if round(coalesce(v_avg_prev, 0), 4) is distinct from round(coalesce(v_unit, 0), 4) then
    perform record_entity_change(
      o.store_id, 'ingredient', o.ingredient_id, 'inbound', '기준 단가 변경',
      change_line('unit_price', '기준 단가',
                  round(v_avg_prev, 4), round(v_unit, 4), '원/' || v_unit0),
      true, null, v_corr);
  end if;

  v_rate0 := coalesce(fixed_cost_rate(o.store_id, business_month()), 0);

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    v_mat0 := coalesce((v_mat_before->>rec.recipe_id::text)::numeric,
                       recipe_material_cost(rec.recipe_id));
    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;

    perform recompute_recipe(rec.recipe_id, 'material', v_today);

    perform record_entity_change(
      o.store_id, 'recipe', rec.recipe_id, 'ingredient',
      (select name from ingredients where id = o.ingredient_id) || ' 기준 단가 자동 반영',
      change_line('material_cost', '재료비',
                  round(v_mat0, 2), round(recipe_material_cost(rec.recipe_id), 2), '원')
      || change_line('profit', '순이익',
                  round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2),
                  round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2), '원'),
      true, o.ingredient_id, v_corr);
  end loop;

  insert into monthly_pl (store_id, month, material_cost)
       values (o.store_id, v_month, o.amount / nullif(o.qty,0) * v_qty)
  on conflict (store_id, month) do update
       set material_cost = monthly_pl.material_cost + (o.amount / nullif(o.qty,0) * v_qty);

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'duplicate', false, 'already_received', false,
    'received_qty', v_qty, 'unit_price', v_unit, 'price_spike', v_spike);
end;
$function$;

select public.assert_no_rpc_overloads();
