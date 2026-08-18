-- ════════════════════════════════════════════════════════════════
-- 0031 · 상세 조회에 식별자 추가
--
-- 수정 화면은 "카테고리 이름"이 아니라 **카테고리 id** 가 있어야 셀렉트를 채운다.
-- 이름만 내려주면 앱이 이름으로 역조회하게 되고, 같은 이름이 둘이면 엉뚱한 것이 선택된다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.ingredient_detail(p_ingredient uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'category_id', i.category_id,
    'category_name', c.name,
    'base_unit', i.base_unit,
    'per_volume', i.per_volume,
    'loss_rate', i.loss_rate,
    'real_loss_rate', real_loss_rate(i.id),
    'safety_stock', i.safety_stock,
    'min_order_qty', i.min_order_qty,
    'memo', i.memo,
    'default_vendor_id', i.default_vendor_id,
    'vendor_name', v.name,
    'stock_total', coalesce(stock_total_base(i.id), 0),
    'sealed_count', coalesce(s.sealed_count, 0),
    'opened_remain', coalesce(s.opened_remain, 0),
    'soon_out', coalesce(s.soon_out, false),
    'last_inbound_at', s.last_inbound_at,
    'base_price', base_unit_price(i.id),
    -- 화면의 avg/low/high 는 저장 컬럼이 아니라 **이 집계**다.
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
               'vendor_id', po.vendor_id,
               'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name)
             order by po.amount / nullif(po.volume,0)), '[]'::jsonb)
      from purchase_options po left join vendors pv on pv.id = po.vendor_id
      where po.ingredient_id = i.id and not po.hidden),
    -- 최근 발주 이력 — ING-03 의 "구매 이력" 목록.
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
  left join vendors    v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.id = p_ingredient;
$fn$;

-- 레시피 상세에도 판매 실적을 붙인다 — "이 메뉴 얼마나 팔렸나"를 보려고 매출 탭으로
-- 건너갔다 돌아오게 하지 않는다.
create or replace function public.recipe_detail(p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
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
               'stock_total', stock_total_base(rl.ingredient_id),
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
      from profit_trends pt where pt.recipe_id = r.id),
    -- 최근 30일 판매 실적
    'sales_30d', (
      select jsonb_build_object(
               'qty', coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0),
               'revenue', coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
               'waste', coalesce(sum(coalesce(it.qty_waste, 0)), 0))
        from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
       where ds.store_id = r.store_id and it.recipe_id = r.id
         and ds.sale_date > business_day() - 30)
  )
  from recipes r where r.id = p_recipe;
$fn$;

-- 반제품 후보 — 레시피 재료로 넣을 수 있는 다른 메뉴 목록(자기 자신 제외).
create or replace function public.recipe_pick_list(p_store uuid, p_exclude uuid default null)
returns table (id uuid, name text, base_servings int, unit_cost numeric, active boolean)
language sql stable security invoker as $fn$
  select r.id, r.name, r.base_servings, recipe_material_cost(r.id), coalesce(r.active, true)
    from recipes r
   where r.store_id = p_store and (p_exclude is null or r.id <> p_exclude)
   order by coalesce(r.active, true) desc, r.name;
$fn$;

select public.assert_no_rpc_overloads();
