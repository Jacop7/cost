-- ════════════════════════════════════════════════════════════════
-- 0033 · 채널별 손익 (SALES-18)
--
-- 매장·배달·포장은 수수료가 달라 순이익률이 크게 갈린다. 그런데 지금까지는
-- 채널별 **매출**만 알 수 있었다. 재료비·세금까지 채널별로 알아야 "배달이 남는 장사인가"에
-- 답할 수 있다.
--
-- 재료비·세금·수량은 판매 줄에 채널별 수량이 있으므로 **정확히** 나뉜다(배분이 아니다).
-- 수수료도 채널 요율이라 직접비다. 나머지(고정지출·폐기·추가지출)만 매출 비중 배분이며,
-- 화면이 그 구분을 표시한다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.sales_range(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'summary', sales_summary(p_store, p_from, p_to),
    'daily', (
      select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'date', ds.sale_date,
                 'revenue', coalesce(sum(it.unit_price * (it.qty_hall+it.qty_delivery+it.qty_takeout)), 0)
                            + max(coalesce(ds.etc_revenue,0)),
                 'qty', coalesce(sum(it.qty_hall+it.qty_delivery+it.qty_takeout), 0),
                 'material', coalesce(sum(it.unit_material_cost * (it.qty_hall+it.qty_delivery+it.qty_takeout)), 0),
                 'profit', (sales_summary(p_store, ds.sale_date, ds.sale_date)->>'profit')::numeric) as x
          from daily_sales ds left join daily_sales_items it on it.daily_sales_id = ds.id
         where ds.store_id = p_store and ds.sale_date between p_from and p_to
         group by ds.id, ds.sale_date) t),
    'menu', (
      select coalesce(jsonb_agg(x order by (x->>'qty')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'recipe_id', it.recipe_id,
                 'menu_name', it.menu_name,
                 'qty',      sum(it.qty_hall+it.qty_delivery+it.qty_takeout),
                 'qty_hall', sum(it.qty_hall),
                 'qty_delivery', sum(it.qty_delivery),
                 'qty_takeout',  sum(it.qty_takeout),
                 'qty_waste',    sum(coalesce(it.qty_waste,0)),
                 'revenue',  sum(it.unit_price * (it.qty_hall+it.qty_delivery+it.qty_takeout)),
                 'unit_price', max(it.unit_price),
                 'unit_material_cost', max(it.unit_material_cost),
                 'material', sum(it.unit_material_cost * (it.qty_hall+it.qty_delivery+it.qty_takeout))) as x
          from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
         where ds.store_id = p_store and ds.sale_date between p_from and p_to
           and it.qty_hall+it.qty_delivery+it.qty_takeout > 0
         group by it.recipe_id, it.menu_name) t),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', c.code, 'name', c.name, 'fee_rate', c.fee_rate,
               'amount', c.amount, 'qty', c.qty, 'material', c.material,
               'fee', c.amount * c.fee_rate / 100.0, 'tax', c.tax)
             order by c.amount desc), '[]'::jsonb)
      from (
        select ch.code, ch.name, ch.fee_rate,
               coalesce(sum(case ch.code
                 when 'hall'     then it.unit_price * it.qty_hall
                 when 'delivery' then it.unit_price * it.qty_delivery
                 when 'takeout'  then it.unit_price * it.qty_takeout
                 else 0 end), 0) as amount,
               coalesce(sum(case ch.code
                 when 'hall'     then it.qty_hall
                 when 'delivery' then it.qty_delivery
                 when 'takeout'  then it.qty_takeout
                 else 0 end), 0) as qty,
               -- 재료비는 채널별 수량이 있으므로 배분이 아니라 **정확히** 나뉜다.
               coalesce(sum(case ch.code
                 when 'hall'     then it.unit_material_cost * it.qty_hall
                 when 'delivery' then it.unit_material_cost * it.qty_delivery
                 when 'takeout'  then it.unit_material_cost * it.qty_takeout
                 else 0 end), 0) as material,
               coalesce(sum(case when coalesce(it.tax_mode,'included') <> 'included' then 0
                 else (case ch.code
                   when 'hall'     then it.unit_price * it.qty_hall
                   when 'delivery' then it.unit_price * it.qty_delivery
                   when 'takeout'  then it.unit_price * it.qty_takeout
                   else 0 end) * 10 / 110 end), 0) as tax
          from sales_channels ch
          left join daily_sales ds on ds.store_id = p_store and ds.sale_date between p_from and p_to
          left join daily_sales_items it on it.daily_sales_id = ds.id
         where ch.store_id = p_store
         group by ch.code, ch.name, ch.fee_rate) c)
  );
$fn$;

select public.assert_no_rpc_overloads();
