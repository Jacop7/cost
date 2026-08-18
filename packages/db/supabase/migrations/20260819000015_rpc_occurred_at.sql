-- ════════════════════════════════════════════════════════════════
-- 0015 · 전파 RPC 에 "발생 시점" 인자 추가 (과거 데이터 구성)
--
-- 문제:
--   E1/E3 이 `business_day()`·`business_month()` 로 **항상 오늘**을 찍는다. 그래서
--     · price_trends.trend_date        → 오늘만
--     · profit_trends.trend_date       → 오늘만
--     · inventory_states.last_inbound_at → 오늘만
--     · monthly_pl.month               → 이번 달만
--   즉 **과거 입고·과거 손익 추이를 만들 수 없다.** 단가 추이·손익 추이 그래프와 월 손익 비교가
--   전부 "오늘 하루"밖에 없는 상태가 된다.
--
--   직접 INSERT 로 과거 행을 만드는 건 금지다 — 불변식 2(재고·단가·이력은 E1/E2/E5 에서만 변경)를
--   깨고 전파(영향 레시피 재계산·월 재료비 합산)가 일어나지 않아 데이터가 조용히 어긋난다.
--
-- 해결:
--   RPC 에 `p_occurred_at date default null` 을 더한다. null 이면 지금까지처럼 오늘(영업일)을 쓴다.
--   **기본 동작은 바뀌지 않는다** — 기존 호출부는 그대로 오늘로 기록된다.
--
-- 안전장치:
--   미래 날짜는 거부한다. 아직 오지 않은 날의 재고·손익을 기록하면 추이가 앞질러 그려지고
--   "오늘까지의 누적"이라는 집계 전제가 깨진다.
-- ════════════════════════════════════════════════════════════════

-- ── recompute_recipe: 추이 점을 찍을 날짜를 받는다 ────────────
create or replace function public.recompute_recipe(
  p_recipe uuid,
  p_cause trend_cause,
  p_occurred_at date default null      -- null = 오늘(영업일)
) returns void language plpgsql security invoker as $$
declare
  r          recipes%rowtype;
  v_day      date := coalesce(p_occurred_at, business_day());
  v_month    text;
  v_tax      numeric;
  v_material numeric := 0;
  v_extra    numeric := 0;
  v_fixed    numeric;
  v_rate     numeric;
  v_profit   numeric;
  v_pr       numeric;
  v_mr       numeric;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 기록할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day();
  end if;
  v_month := to_char(v_day, 'YYYY-MM');

  select * into r from recipes where id = p_recipe;
  if not found then return; end if;

  select coalesce(sum((rl.input_qty / r.base_servings) * coalesce(base_unit_price(rl.ingredient_id),0)),0)
    into v_material
  from recipe_lines rl where rl.recipe_id = p_recipe and rl.ingredient_id is not null;

  select coalesce(sum(amount_per_serving),0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_tax  := case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end;
  v_rate := coalesce(fixed_cost_rate(r.store_id, v_month), 0);
  v_fixed := v_rate * r.price;

  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;
  v_pr := case when r.price > 0 then round(v_profit / r.price * 100, 2) else 0 end;
  v_mr := case when r.price > 0 then round(v_material / r.price * 100, 2) else 0 end;

  insert into profit_trends (store_id, recipe_id, trend_date, profit_rate, material_rate, cause)
  values (r.store_id, p_recipe, v_day, v_pr, v_mr, p_cause);
end;
$$;

-- ── E3: 저장 시점을 넘길 수 있게 ──────────────────────────────
create or replace function public.e3_recipe_saved(
  p_recipe uuid,
  p_occurred_at date default null
) returns void language plpgsql security invoker as $$
begin
  perform recompute_recipe(p_recipe, 'recipe', p_occurred_at);  -- 파랑 점
end;
$$;

-- ── E1: 입고 시점을 넘길 수 있게 ──────────────────────────────
create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null,
  p_idempotency_key text default null,
  p_occurred_at date default null        -- null = 오늘(영업일)
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
           -- 과거 입고를 나중에 넣어도 "가장 최근 입고일"이 과거로 되돌아가면 안 된다.
           last_inbound_at = greatest(inventory_states.last_inbound_at, v_today);

  -- 재고 이벤트의 발생 시각도 그날로 찍는다(기간 집계가 폐기·입고를 날짜로 묶는다).
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

  delete from order_candidates
   where ingredient_id = o.ingredient_id and store_id = o.store_id;

  if v_avg_prev is not null and v_avg_prev > 0 then
    v_spike := abs(v_unit - v_avg_prev) / v_avg_prev >= 0.15;
  end if;

  return jsonb_build_object(
    'order_id', p_order, 'received_qty', v_qty,
    'unit_price', v_unit, 'price_spike', v_spike,
    'duplicate', false, 'already_received', false, 'occurred_at', v_today);
end;
$$;

-- 인자를 추가하면 **구버전이 남는다**(0012 에서 겪은 문제). 이전 시그니처를 지운다.
drop function if exists public.e1_confirm_inbound(uuid, numeric, text);
drop function if exists public.e3_recipe_saved(uuid);
drop function if exists public.recompute_recipe(uuid, trend_cause);

-- 각 함수의 오버로드가 정확히 하나인지 확인한다.
do $$
declare r record;
begin
  for r in
    select p.proname, count(*) c
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('e1_confirm_inbound','e3_recipe_saved','recompute_recipe')
     group by p.proname
  loop
    if r.c <> 1 then
      raise exception '% 오버로드가 %개다. 인자 개수로 선택이 갈려 방어가 새어나간다.', r.proname, r.c;
    end if;
  end loop;
end $$;
