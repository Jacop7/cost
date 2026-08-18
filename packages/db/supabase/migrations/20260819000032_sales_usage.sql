-- ════════════════════════════════════════════════════════════════
-- 0032 · 매출 상세 화면의 집계 (SALES-13/14/15/16)
--
-- "재료 원가 890,000원" 밑에 무엇이 얼마나 들어갔는지가 없으면 사장님은 확인할 방법이 없다.
-- 그 내역은 **이미 원장에 있다** — 판매(E10)가 소진 이벤트를 남겼기 때문이다.
-- 여기서는 그 원장을 식재료별·메뉴별로 되읽는다. 새 계산이 아니라 **되짚기**다.
-- ════════════════════════════════════════════════════════════════

-- ── 재료 원가 자세히 (SALES-13) ───────────────────────────────
-- 기간 내 판매로 빠져나간 식재료를 집계한다. 폐기(E2)는 별도 항목이라 제외 —
-- 여기에 섞으면 "판매 원가"와 "폐기 손실"이 이중 계상된다.
create or replace function public.sales_material_usage(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable security invoker as $fn$
  with used as (
    select ev.ingredient_id,
           it.menu_name,
           -- consume 은 음수, 조정(adjust)은 양수다. 합치면 **순 사용량**이 된다.
           sum(-ev.count_delta) as qty
      from inventory_events ev
      join daily_sales_items it on it.id = ev.sales_item_id
      join daily_sales ds on ds.id = it.daily_sales_id
     where ev.store_id = p_store
       and ds.sale_date between p_from and p_to
     group by ev.ingredient_id, it.menu_name
    having sum(-ev.count_delta) > 0
  ),
  per_ing as (
    select u.ingredient_id, sum(u.qty) as qty
      from used u group by u.ingredient_id
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(p.qty * coalesce(base_unit_price(p.ingredient_id), 0)), 0) from per_ing p),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ingredient_id', p.ingredient_id,
               'name', i.name,
               'base_unit', i.base_unit,
               'qty', p.qty,
               'unit_price', base_unit_price(p.ingredient_id),
               'amount', p.qty * coalesce(base_unit_price(p.ingredient_id), 0),
               'menus', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'menu_name', u.menu_name,
                          'qty', u.qty,
                          'amount', u.qty * coalesce(base_unit_price(p.ingredient_id), 0))
                        order by u.qty desc), '[]'::jsonb)
                 from used u where u.ingredient_id = p.ingredient_id))
             order by p.qty * coalesce(base_unit_price(p.ingredient_id), 0) desc), '[]'::jsonb)
      from per_ing p join ingredients i on i.id = p.ingredient_id)
  );
$fn$;

-- ── 부자재 자세히 (SALES-15) ──────────────────────────────────
-- 부자재는 재고를 갖지 않는다(포장용기 등). 판매 시점 스냅샷 unit_extra_cost 로 되짚는다.
create or replace function public.sales_extra_usage(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable security invoker as $fn$
  with sold as (
    select it.recipe_id, it.menu_name,
           sum(it.qty_hall + it.qty_delivery + it.qty_takeout) as qty
      from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
     group by it.recipe_id, it.menu_name
    having sum(it.qty_hall + it.qty_delivery + it.qty_takeout) > 0
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(ec.amount_per_serving * s.qty), 0)
                from sold s join recipe_extra_costs ec on ec.recipe_id = s.recipe_id),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', x.name, 'qty', x.qty, 'amount', x.amount, 'menus', x.menus)
             order by x.amount desc), '[]'::jsonb)
      from (
        select ec.name,
               sum(s.qty) as qty,
               sum(ec.amount_per_serving * s.qty) as amount,
               jsonb_agg(jsonb_build_object(
                 'menu_name', s.menu_name, 'qty', s.qty,
                 'unit', ec.amount_per_serving,
                 'amount', ec.amount_per_serving * s.qty) order by s.qty desc) as menus
          from sold s join recipe_extra_costs ec on ec.recipe_id = s.recipe_id
         group by ec.name) x)
  );
$fn$;

-- ── 고정지출 일배분 (SALES-17) ────────────────────────────────
-- 월 고정지출을 매출 비중으로 나눈다. 화면이 items 를 다시 파싱하지 않게 여기서 풀어준다.
create or replace function public.sales_fixed_breakdown(p_store uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_month   text := to_char(p_from, 'YYYY-MM');
  v_rate    numeric;
  v_revenue numeric;
  v_fix_sum numeric;
begin
  v_rate := fixed_cost_rate(p_store, v_month);
  if v_rate is null then
    select month, fixed_cost_rate(p_store, month) into v_month, v_rate
      from fixed_costs_monthly
     where store_id = p_store and month <= to_char(p_from, 'YYYY-MM')
       and fixed_cost_rate(p_store, month) is not null
     order by month desc limit 1;
  end if;

  v_revenue := (sales_summary(p_store, p_from, p_to)->>'revenue')::numeric;

  select coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i), 0)
    into v_fix_sum from fixed_costs_monthly where store_id = p_store and month = v_month;

  return jsonb_build_object(
    'month', v_month,
    'rate', v_rate,
    'provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'revenue', v_revenue,
    'total', coalesce(v_rate, 0) * v_revenue,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', i->>'key',
               'month_total', (i->>'total')::numeric,
               -- 항목별 배분액 = 기간 고정지출 × (그 항목이 월 고정지출에서 차지하는 비중)
               'amount', case when v_fix_sum > 0
                              then coalesce(v_rate,0) * v_revenue * ((i->>'total')::numeric / v_fix_sum)
                              else 0 end,
               'lines', coalesce(i->'lines', '[]'::jsonb))
             order by (i->>'total')::numeric desc)
      from fixed_costs_monthly f, jsonb_array_elements(f.items) i
     where f.store_id = p_store and f.month = v_month), '[]'::jsonb));
end;
$fn$;

select public.assert_no_rpc_overloads();
