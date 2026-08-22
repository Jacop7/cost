-- ════════════════════════════════════════════════════════════════
-- 0092 · 폐기 손실·세금도 되짚을 수 있게
--
-- 사장님: "폐기손실과 세금은 왜 상세가 없냐?"
--
-- 손익 카드의 일곱 줄 중 이 둘만 화살표가 없었다. 데이터는 다 있는데
-- 되짚어 주는 함수가 없어서였다.
--
-- ⚠ 지어내지 않는다. 재료·부자재가 그랬듯(0058) 여기도 **그날 기준**으로 되짚는다 —
--   폐기 단가는 버린 날 단가, 세금 요율은 판 날 요율이다. 지금 값을 곱하면
--   재료값이 오를 때마다 지난달 폐기 손실이 따라 오른다.
-- ════════════════════════════════════════════════════════════════

-- ── 폐기 손실 ─────────────────────────────────────────────────
-- 두 갈래를 섞지 않는다(0041). 사장님이 할 일이 다르다 —
--   조리 폐기   만들어 놓고 못 팔았다   → 덜 만들어야 한다
--   식재료 폐기 쓰기도 전에 버렸다      → 발주·보관을 손봐야 한다
create or replace function public.sales_waste_breakdown(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with menu as (
    -- 조리 폐기 — 판매 시점에 굳은 1인분 재료비 × 버린 인분(0052).
    select it.menu_name as name,
           sum(coalesce(it.qty_waste, 0)) as qty,
           sum(coalesce(it.unit_material_cost, 0) * coalesce(it.qty_waste, 0)) as amount
      from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
       and coalesce(it.qty_waste, 0) > 0
     group by it.menu_name
  ),
  ing as (
    -- 식재료 폐기 — 재고 원장에서. sales_item_id 가 있으면 조리 폐기라 위에서 이미 셌다.
    select i.name,
           sum(coalesce(ev.volume_delta, 0)) as qty,
           sum(coalesce(ev.volume_delta, 0)
               * coalesce(day_unit_price(p_store,
                   (ev.occurred_at at time zone business_tz())::date, ev.ingredient_id), 0)) as amount,
           min(i.base_unit::text) as base_unit
      from inventory_events ev join ingredients i on i.id = ev.ingredient_id
     where ev.store_id = p_store and ev.type = 'discard' and ev.sales_item_id is null
       and (ev.occurred_at at time zone business_tz())::date between p_from and p_to
       and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)
     group by i.name
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'menu_total', (select coalesce(sum(amount), 0) from menu),
    'ingredient_total', (select coalesce(sum(amount), 0) from ing),
    'total', (select coalesce(sum(amount), 0) from menu) + (select coalesce(sum(amount), 0) from ing),
    'menu', (select coalesce(jsonb_agg(jsonb_build_object(
               'name', name, 'qty', qty, 'amount', amount) order by amount desc), '[]'::jsonb) from menu),
    'ingredient', (select coalesce(jsonb_agg(jsonb_build_object(
               'name', name, 'qty', qty, 'base_unit', base_unit, 'amount', amount)
             order by amount desc), '[]'::jsonb) from ing)
  );
$fn$;

comment on function public.sales_waste_breakdown(uuid, date, date) is
  '폐기 손실 되짚기(0092). 조리 폐기(메뉴별)와 식재료 폐기(재료별)를 갈라서 준다 — '
  '사장님이 할 일이 다르다(0041). 단가는 버린 날 기준이다(0058).';


-- ── 세금 ──────────────────────────────────────────────────────
-- 세금은 판 날 요율로 얼어 있다(메뉴 unit_tax · 기타 etc_tax). 항목별로 쪼갤 때도
-- **그날 요율 비중**으로 나눈다 — 지금 요율로 나누면 지난달 내역이 오늘 설정을 따라 움직인다.
create or replace function public.sales_tax_breakdown(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with days as (
    select ds.sale_date,
           coalesce(sum(coalesce(it.unit_tax, 0)
                        * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0) as menu_tax,
           max(coalesce(ds.etc_tax, 0)) as etc_tax
      from daily_sales ds left join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
     group by ds.sale_date
  ),
  -- 그날 얼어 있던 세금 항목. 스냅샷에 없으면(옛 날짜) 지금 설정으로 대신한다.
  rates as (
    select d.sale_date, d.menu_tax, d.etc_tax,
           coalesce(
             (select r.value -> 'tax_items'
                from jsonb_each(coalesce(day_snapshot(p_store, d.sale_date) -> 'recipes', '{}'::jsonb)) r
               limit 1),
             (select s.tax_items from settings s where s.store_id = p_store),
             '[]'::jsonb) as items
      from days d
  ),
  split as (
    select x.name, x.rate,
           sum((r.menu_tax + r.etc_tax) * x.rate / nullif(x.total_rate, 0)) as amount,
           sum(r.menu_tax * x.rate / nullif(x.total_rate, 0)) as menu_amount,
           sum(r.etc_tax  * x.rate / nullif(x.total_rate, 0)) as etc_amount
      from rates r
      cross join lateral (
        select i->>'name' as name,
               (i->>'rate')::numeric as rate,
               (select sum((j->>'rate')::numeric) from jsonb_array_elements(r.items) j
                 where coalesce((j->>'rate')::numeric, 0) > 0) as total_rate
          from jsonb_array_elements(r.items) i
         where coalesce((i->>'rate')::numeric, 0) > 0) x
     group by x.name, x.rate
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(menu_tax + etc_tax), 0) from days),
    'menu_total', (select coalesce(sum(menu_tax), 0) from days),
    'etc_total', (select coalesce(sum(etc_tax), 0) from days),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', name, 'rate', rate, 'amount', amount,
                'menu_amount', menu_amount, 'etc_amount', etc_amount)
              order by amount desc), '[]'::jsonb) from split)
  );
$fn$;

comment on function public.sales_tax_breakdown(uuid, date, date) is
  '세금 되짚기(0092). 항목별로 쪼개고 메뉴분·기타 매출분을 갈라서 준다. '
  '⚠ 그날 얼어 있던 요율 비중으로 나눈다 — 지금 요율로 나누면 지난 장부가 움직인다.';

select public.assert_no_rpc_overloads();
