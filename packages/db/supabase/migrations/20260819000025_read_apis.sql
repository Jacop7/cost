-- ════════════════════════════════════════════════════════════════
-- 0025 · 화면 조회 API (도메인별)
--
-- 앱 화면이 필요로 하는 파생값 대부분이 **서버 함수**다(재고 총량·기준단가·손익).
-- 화면이 직접 조합하면 (a) N+1 왕복이 생기고 (b) 계산이 앱에 복제되어 절대원칙 3 을 깬다.
-- 그래서 화면 한 장이 필요한 데이터를 **한 번의 호출**로 내려주는 함수를 도메인별로 둔다.
--
-- 전부 security invoker — RLS 가 그대로 적용된다.
-- ════════════════════════════════════════════════════════════════

-- ── 식재료 상세 (ING-03) ──────────────────────────────────────
create or replace function public.ingredient_detail(p_ingredient uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'category_name', c.name,
    'base_unit', i.base_unit,
    'per_volume', i.per_volume,
    'loss_rate', i.loss_rate,
    'real_loss_rate', real_loss_rate(i.id),
    'safety_stock', i.safety_stock,
    'min_order_qty', i.min_order_qty,
    'memo', i.memo,
    'vendor_name', v.name,
    'stock_total', coalesce(stock_total_base(i.id), 0),
    'sealed_count', coalesce(s.sealed_count, 0),
    'opened_remain', coalesce(s.opened_remain, 0),
    'soon_out', coalesce(s.soon_out, false),
    'last_inbound_at', s.last_inbound_at,
    'base_price', base_unit_price(i.id),
    -- 구매 이력 요약 — 화면의 avg/low/high 는 저장 컬럼이 아니라 **이 집계**다.
    'purchase', (
      select jsonb_build_object(
        'avg',  case when sum(o.received_qty) > 0
                     then sum((o.amount / nullif(o.volume,0)) * o.received_qty) / sum(o.received_qty) end,
        'low',  min(o.amount / nullif(o.volume,0)),
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
               'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name)), '[]'::jsonb)
      from purchase_options po left join vendors pv on pv.id = po.vendor_id
      where po.ingredient_id = i.id)
  )
  from ingredients i
  left join categories c on c.id = i.category_id
  left join vendors    v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.id = p_ingredient;
$$;

-- ── 재고 변동 원장 (ING-07) ───────────────────────────────────
create or replace function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type inventory_event_type,
  count_delta numeric, volume_delta numeric, note text
) language sql stable security invoker as $$
  select ev.id,
         (ev.occurred_at at time zone business_tz())::date as occurred_on,
         ev.type, ev.count_delta, ev.volume_delta, ev.note
    from inventory_events ev
   where ev.ingredient_id = p_ingredient
     and (p_from is null or (ev.occurred_at at time zone business_tz())::date >= p_from)
     and (p_to   is null or (ev.occurred_at at time zone business_tz())::date <= p_to)
   order by ev.occurred_at desc, ev.id desc;
$$;

-- ── 레시피 목록 (RCP-01) ──────────────────────────────────────
create or replace function public.recipe_list(p_store uuid)
returns table (
  id uuid, name text, price numeric, tax_mode tax_mode, base_servings int,
  target_profit_rate numeric, avg_monthly_sales numeric, active boolean,
  material_cost numeric, extra_cost numeric, tax numeric, fixed_cost numeric,
  profit numeric, profit_rate numeric, material_rate numeric
) language sql stable security invoker as $$
  with base as (
    select r.*,
           recipe_material_cost(r.id) as mat,
           coalesce((select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = r.id), 0) as ext,
           case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end as tx,
           coalesce(fixed_cost_rate(r.store_id, business_month()), 0) as rate
      from recipes r
     where r.store_id = p_store and coalesce(r.active, true)
  )
  select b.id, b.name, b.price, b.tax_mode, b.base_servings,
         b.target_profit_rate, b.avg_monthly_sales, coalesce(b.active, true),
         b.mat, b.ext, b.tx, b.rate * b.price,
         b.price - b.tx - b.mat - b.ext - (b.rate * b.price),
         case when b.price > 0 then (b.price - b.tx - b.mat - b.ext - (b.rate * b.price)) / b.price else 0 end,
         case when b.price > 0 then b.mat / b.price else 0 end
    from base b
   order by b.name;
$$;

-- ── 레시피 상세 (RCP-02) ──────────────────────────────────────
create or replace function public.recipe_detail(p_recipe uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'price', r.price, 'tax_mode', r.tax_mode,
    'base_servings', r.base_servings, 'target_profit_rate', r.target_profit_rate,
    'avg_monthly_sales', r.avg_monthly_sales, 'active', coalesce(r.active, true),
    'material_cost', recipe_material_cost(r.id),
    'extra_cost', coalesce((select sum(amount_per_serving) from recipe_extra_costs where recipe_id = r.id), 0),
    'fixed_rate', coalesce(fixed_cost_rate(r.store_id, business_month()), 0),
    'lines', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', rl.id,
               'ingredient_id', rl.ingredient_id,
               'sub_recipe_id', rl.sub_recipe_id,
               'name', coalesce(i.name, sr.name),
               'base_unit', i.base_unit,
               'input_qty', rl.input_qty,
               'per_serving', rl.input_qty / nullif(r.base_servings, 0),
               -- 반제품은 하위 레시피의 1인분 원가가 단가다.
               'unit_price', coalesce(base_unit_price(rl.ingredient_id), recipe_material_cost(rl.sub_recipe_id))
             ) order by coalesce(i.name, sr.name)), '[]'::jsonb)
      from recipe_lines rl
      left join ingredients i on i.id = rl.ingredient_id
      left join recipes sr on sr.id = rl.sub_recipe_id
      where rl.recipe_id = r.id),
    'extras', (
      select coalesce(jsonb_agg(jsonb_build_object('id', ec.id, 'name', ec.name, 'amount', ec.amount_per_serving)), '[]'::jsonb)
      from recipe_extra_costs ec where ec.recipe_id = r.id),
    'profit_trends', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', pt.trend_date, 'profit_rate', pt.profit_rate,
               'material_rate', pt.material_rate, 'cause', pt.cause) order by pt.trend_date), '[]'::jsonb)
      from profit_trends pt where pt.recipe_id = r.id)
  )
  from recipes r where r.id = p_recipe;
$$;

-- ── 발주 현황 3탭 (ORD-01) ────────────────────────────────────
create or replace function public.order_board(p_store uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ingredient_id', c.ingredient_id, 'name', i.name,
               'reasons', c.reasons, 'recommended_qty', c.recommended_qty, 'status', c.status,
               'stock_total', stock_total_base(i.id),
               'safety_total', i.safety_stock * i.per_volume,
               'base_unit', i.base_unit, 'per_volume', i.per_volume) order by i.name), '[]'::jsonb)
      from order_candidates c join ingredients i on i.id = c.ingredient_id
      where c.store_id = p_store),
    'waiting', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ingredient_id', o.ingredient_id, 'name', i.name,
               'vendor_name', v.name, 'volume', o.volume, 'amount', o.amount,
               'qty', o.qty, 'received_qty', o.received_qty, 'status', o.status,
               'ordered_at', o.ordered_at, 'expected_at', o.expected_at,
               'unit_price', o.amount / nullif(o.volume, 0)) order by o.expected_at nulls last), '[]'::jsonb)
      from order_records o join ingredients i on i.id = o.ingredient_id
      left join vendors v on v.id = o.vendor_id
      where o.store_id = p_store and o.status in ('ordered','partial')),
    'received', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ingredient_id', o.ingredient_id, 'name', i.name,
               'vendor_name', v.name, 'volume', o.volume, 'amount', o.amount,
               'qty', o.qty, 'received_qty', o.received_qty,
               'ordered_at', o.ordered_at,
               'unit_price', o.amount / nullif(o.volume, 0)) order by o.ordered_at desc), '[]'::jsonb)
      from order_records o join ingredients i on i.id = o.ingredient_id
      left join vendors v on v.id = o.vendor_id
      where o.store_id = p_store and o.status = 'received')
  );
$$;

-- ── 매출 일별 장부 (SALES-01/03) ──────────────────────────────
create or replace function public.sales_day(p_store uuid, p_date date)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'sale_date', p_date,
    'daily_sales_id', ds.id,
    'etc_revenue', coalesce(ds.etc_revenue, 0),
    'daily_extra', coalesce(ds.daily_extra, 0),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', it.id, 'recipe_id', it.recipe_id, 'menu_name', it.menu_name,
               'unit_price', it.unit_price, 'unit_material_cost', it.unit_material_cost,
               'unit_extra_cost', it.unit_extra_cost,
               'qty_hall', it.qty_hall, 'qty_delivery', it.qty_delivery, 'qty_takeout', it.qty_takeout,
               'qty', it.qty_hall + it.qty_delivery + it.qty_takeout)
             order by (it.qty_hall + it.qty_delivery + it.qty_takeout) desc), '[]'::jsonb)
      from daily_sales_items it where it.daily_sales_id = ds.id),
    'summary', sales_summary(p_store, p_date, p_date)
  )
  from daily_sales ds
  where ds.store_id = p_store and ds.sale_date = p_date;
$$;

-- ── 설정 목록 (MY) ────────────────────────────────────────────
create or replace function public.settings_lists(p_store uuid)
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'sort_order', c.sort_order,
               'default_loss_rate', c.default_loss_rate,
               'used_count', (select count(*) from ingredients i where i.category_id = c.id))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store),
    'vendors', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name,
               'used_count', (select count(*) from order_records o where o.vendor_id = v.id))
             order by v.name), '[]'::jsonb)
      from vendors v where v.store_id = p_store),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ch.id, 'code', ch.code, 'name', ch.name,
               'fee_rate', ch.fee_rate, 'fee_note', ch.fee_note, 'active', ch.active)
             order by ch.sort_order), '[]'::jsonb)
      from sales_channels ch where ch.store_id = p_store)
  );
$$;

select public.assert_no_rpc_overloads();
