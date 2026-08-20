-- ═════════════════════════════════════════════════════════════
-- 0072 · 기준단가는 **양**으로 가중한다
--
-- 사장님: "양이 기본 아니야. 개수랑 이거는 구매 옵션 기록으로 남겨두고"
--
-- 맞다. 개당 단가를 **팩 개수**로 평균 내면 1kg 짜리 한 개가 20kg 짜리와
-- 같은 무게를 갖는다. 들어온 양의 95%가 싼 값인데 소포장 하나가 평균을 끌어올린다.
--
-- 결정적인 이유: **단가 × 재고 = 그 재고에 쓴 돈** 이 성립해야 한다.
--   실측 — 1kg 5,300원 + 20kg 80,000원 (쓴 돈 85,300원 / 들어온 양 21,000g)
--     개수 가중 4.6500원/g → 21,000g 을 97,650원으로 매긴다 (없는 돈 12,350원)
--     양   가중 4.0619원/g → 85,300원 — 실제 쓴 돈과 같다
--
-- 개수는 사라지지 않는다. order_records 에 팩 용량·팩 금액·받은 개수가
-- 그대로 남고 구매 이력 화면이 그걸 보여 준다.
-- **개수는 기록, 가중치는 양**이다.
--
-- ⚠ 지금 데이터에서는 **전 재료의 차이가 0** 이다 — 지금까지 한 가지 팩 용량으로만
--   들어왔기 때문이다. 빠른 입고로 여러 용량을 섮을 수 있게 되는 순간부터 갈라진다.
--   그래서 검산값도 안 움직인다(대파 4.00 그대로).
--
-- ⚠ 이동가중평균(입고마다 남은 재고 기준 갱신)은 1차에 넣지 않는다.
--   지금은 order_records 에서 매번 재계산하는 무상태 구조라 입고 취소(E11)가 자유롭다.
--   상태를 저장하면 그게 흔들린다. 입고 기간이 21일뿐이라 옛 가격이 쌓인 문제도 없다.
-- ═════════════════════════════════════════════════════════════

create or replace function public.base_unit_price(p_ingredient uuid)
returns numeric language plpgsql stable as $fn$
declare v_avg numeric;
begin
  -- 가중치는 **실제로 들어온 양**이다(0072). 오지 안은 물량은 섞지 않는다 —
  -- received_qty 가 0 이면 분모에도 분자에도 기여하지 않는다.
  --   amount 는 **팩 1개 금액**, volume 은 **팩 1개 용량**이다.
  select case when sum(volume * received_qty) > 0
              then sum(amount * received_qty) / sum(volume * received_qty)
         end
    into v_avg
    from order_records
   where ingredient_id = p_ingredient and status in ('received','partial');

  -- 로스로 나누지 않는다(0041). 산 값 그대로가 기준단가다.
  return v_avg;
end;
$fn$;

comment on function public.base_unit_price(uuid) is
  '기준단가 = 쓴 돈 ÷ 들어온 양(양 가중평균, 0072). 개수는 기록이고 가중치가 아니다.';

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

  -- ⚠ 재고는 **그 발주의 팩 용량**으로 환산한다(0072).
  --   전에는 식재료 마스터의 per_volume 을 썼다. 그러면 마스터가 3kg 인데 5kg 짜리를
  --   사 오면 재고는 3,000g 만 늘고 단가는 5,000g 기준으로 매겨져 2,000g 이 증발했다(실측).
  --   단가와 재고가 같은 분모를 써야 `단가 × 재고 = 쓴 돈` 이 성립한다.
  --   마스터 per_volume 은 이제 **기본값**이다 — 발주에 용량이 없을 때만 쓴다.
  select per_volume into v_per from ingredients where id = o.ingredient_id;
  v_base := v_qty * coalesce(nullif(o.volume, 0), v_per, 0);
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
