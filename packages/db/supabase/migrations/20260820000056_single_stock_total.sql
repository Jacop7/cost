-- ════════════════════════════════════════════════════════════════
-- 0056 · 재고를 기준단위 총량 하나로 통일
--
-- 사용자 입력에는 미개봉/개봉분을 별도로 관리하는 흐름이 없다. 저장 모델도
-- 화면과 같은 기준단위(g/ml/개) 총량 하나만 유지한다.
-- 기존 값은 `미개봉 × 개당 용량 + 개봉 잔량`으로 합쳐 보존한다.
-- ════════════════════════════════════════════════════════════════

alter table public.inventory_states
  add column stock_total numeric not null default 0 check (stock_total >= 0);

update public.inventory_states s
   set stock_total = coalesce(s.sealed_count, 0) * coalesce(i.per_volume, 0)
                   + coalesce(s.opened_remain, 0)
  from public.ingredients i
 where i.id = s.ingredient_id;

comment on column public.inventory_states.stock_total is
  '현재 재고 총량. 식재료 기준단위(g/ml/개)로 저장한다.';

-- 읽기 단일 출처. 호출부 호환을 위해 함수 이름은 유지한다.
create or replace function public.stock_total_base(p_ingredient uuid)
returns numeric language sql stable security invoker as $fn$
  select coalesce(s.stock_total, 0)
    from public.ingredients i
    left join public.inventory_states s on s.ingredient_id = i.id
   where i.id = p_ingredient;
$fn$;

comment on function public.stock_total_base(uuid) is
  '식재료 현재 재고 총량(기준단위 g/ml/개). inventory_states.stock_total의 읽기 단일 출처.';

-- 판매·폐기·입고취소가 공유하는 차감 함수.
create or replace function public.consume_stock(p_ingredient uuid, p_amount numeric)
returns numeric language plpgsql security invoker as $fn$
declare
  v_before numeric;
  v_take   numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  select stock_total into v_before
    from public.inventory_states
   where ingredient_id = p_ingredient
   for update;

  if not found then return 0; end if;

  v_take := least(p_amount, coalesce(v_before, 0));
  update public.inventory_states
     set stock_total = stock_total - v_take,
         updated_at = now()
   where ingredient_id = p_ingredient;

  return v_take;
end;
$fn$;

comment on function public.consume_stock(uuid, numeric) is
  '재고 총량을 기준단위로 차감한다. 있는 만큼만 빼고 음수가 되지 않으며 실제 차감량을 반환한다.';

-- 판매·폐기 취소가 공유하는 복구 함수.
create or replace function public.restore_stock(p_ingredient uuid, p_amount numeric)
returns numeric language plpgsql security invoker as $fn$
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  insert into public.inventory_states (ingredient_id, store_id, stock_total)
  select i.id, i.store_id, p_amount
    from public.ingredients i
   where i.id = p_ingredient
  on conflict (ingredient_id) do update
    set stock_total = public.inventory_states.stock_total + excluded.stock_total,
        updated_at = now();

  if not found then return 0; end if;
  return p_amount;
end;
$fn$;

-- E1 입고: 구매 개수는 발주 기록에, 재고는 기준단위 총량에 더한다.
create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null,
  p_idempotency_key text default null,
  p_occurred_at date default null
) returns jsonb language plpgsql as $fn$
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

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'duplicate', false, 'already_received', false,
    'received_qty', v_qty, 'unit_price', v_unit, 'price_spike', v_spike);
end;
$fn$;

-- E5 실사: 화면에서 입력한 변경 후 총량을 그대로 저장한다.
drop function if exists public.e5_stock_adjusted(uuid, numeric, smallint, boolean, numeric, text, date);

create or replace function public.e5_stock_adjusted(
  p_ingredient uuid,
  p_stock_total numeric,
  p_soon boolean,
  p_note text default null,
  p_occurred_at date default null
) returns jsonb language plpgsql as $fn$
declare
  v_store  uuid;
  v_before numeric;
  v_after  numeric;
  v_day    date := coalesce(p_occurred_at, business_day());
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 실사할 수 없습니다' using errcode = '22000';
  end if;
  if coalesce(p_stock_total, -1) < 0 then
    raise exception '재고 수량은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select store_id into v_store from ingredients where id = p_ingredient;
  if v_store is null then raise exception 'ingredient % not found', p_ingredient; end if;

  v_before := coalesce(stock_total_base(p_ingredient), 0);

  insert into inventory_states (ingredient_id, store_id, stock_total, soon_out)
       values (p_ingredient, v_store, p_stock_total, coalesce(p_soon, false))
  on conflict (ingredient_id) do update
       set stock_total = excluded.stock_total,
           soon_out   = excluded.soon_out,
           updated_at = now();

  v_after := coalesce(stock_total_base(p_ingredient), 0);

  insert into inventory_events (store_id, ingredient_id, type, count_delta, note, occurred_at, unit_normalized)
       values (v_store, p_ingredient, 'stocktake', v_after - v_before,
               coalesce(nullif(btrim(p_note), ''), '재고 실사'),
               (v_day::timestamp at time zone business_tz()), true);

  perform refresh_order_candidate(p_ingredient);

  return jsonb_build_object(
    'ingredient_id', p_ingredient, 'before', v_before, 'after', v_after, 'delta', v_after - v_before);
end;
$fn$;

-- 상세 API에서도 분할 재고 필드를 제거한다.
create or replace function public.ingredient_detail(p_ingredient uuid)
returns jsonb language sql stable as $fn$
  select jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'category_id', i.category_id,
    'category_name', c.name,
    'base_unit', i.base_unit,
    'per_volume', i.per_volume,
    'safety_stock', i.safety_stock,
    'min_order_qty', i.min_order_qty,
    'memo', i.memo,
    'default_vendor_id', i.default_vendor_id,
    'vendor_name', v.name,
    'stock_total', coalesce(s.stock_total, 0),
    'soon_out', coalesce(s.soon_out, false),
    'last_inbound_at', s.last_inbound_at,
    'base_price', base_unit_price(i.id),
    'loss', ingredient_loss(i.id),
    'purchase', (
      select jsonb_build_object(
        'avg', case when sum(o.received_qty) > 0
                    then sum((o.amount / nullif(o.volume,0)) * o.received_qty) / sum(o.received_qty) end,
        'low', min(o.amount / nullif(o.volume,0)),
        'high', max(o.amount / nullif(o.volume,0)),
        'count', count(*))
      from order_records o
      where o.ingredient_id = i.id and o.status in ('received','partial')),
    'price_trends', (
      select coalesce(jsonb_agg(jsonb_build_object('date', t.trend_date, 'price', t.unit_price)
                                order by t.trend_date), '[]'::jsonb)
      from price_trends t where t.ingredient_id = i.id),
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', po.id, 'url', po.url, 'name', po.purchase_name,
               'vendor_id', po.vendor_id,
               'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name)
             order by po.amount / nullif(po.volume,0)), '[]'::jsonb)
      from purchase_options po left join vendors pv on pv.id = po.vendor_id
      where po.ingredient_id = i.id and not po.hidden),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ordered_at', o.ordered_at, 'status', o.status,
               'volume', o.volume, 'amount', o.amount, 'qty', o.qty,
               'received_qty', o.received_qty, 'vendor_name', ov.name,
               'unit_price', o.amount / nullif(o.volume, 0))
             order by o.ordered_at desc), '[]'::jsonb)
      from (select * from order_records where ingredient_id = i.id order by ordered_at desc limit 20) o
      left join vendors ov on ov.id = o.vendor_id)
  )
  from ingredients i
  left join categories c on c.id = i.category_id
  left join vendors v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.id = p_ingredient;
$fn$;

alter table public.inventory_states
  drop column sealed_count,
  drop column opened_count,
  drop column opened_remain;

select public.assert_no_rpc_overloads();
