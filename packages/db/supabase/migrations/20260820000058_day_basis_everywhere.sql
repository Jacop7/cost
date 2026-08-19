-- ════════════════════════════════════════════════════════════════
-- 0058 · 매출 화면 전체를 그날 기준으로
--
-- 사장님: "레시피에서 수정값이 매출페이지에 전부 반영되는 거지?"
-- 재 보니 **여섯 군데가 따라 움직이고 있었다.** 메뉴 손익 상세만 고정돼 있고
-- 합계·분석·되짚기는 현재 값으로 다시 계산해서, 같은 화면 안의 두 숫자가
-- 서로 다른 말을 했다.
--
--   sales_summary        고정지출률이 **현재 월** 설정 · 폐기 손실이 **현재 단가**
--   sales_material_usage 수량은 그날 원장인데 **단가는 현재 값**
--   sales_extra_usage    그날 판매량 × **현재 부자재 구성** (지우면 그날 내역도 사라짐)
--   sales_fixed_breakdown 현재 월 항목·금액
--
-- 전부 그날 스냅샷(0048)을 쓴다. 스냅샷이 없는 과거는 지금처럼 현재 값으로
-- 떨어진다 — 그때는 그 값이 최선이고, 화면도 그렇게 그려 왔다.
--
-- ⚠ 기간 조회는 **날짜별로 그날 기준을 적용해 더한다.** 기간 전체에 한 벌을
--   적용하면 어느 날짜의 기준인지 말할 수 없다.
-- ════════════════════════════════════════════════════════════════

-- ── 스냅샷에 재료 단가 맵 ─────────────────────────────────────
-- 지금까지 단가는 레시피 lines 안에만 있었다. 그러면 그날 안 팔린 메뉴의 재료와
-- 식재료 폐기(E2, 매출과 무관)의 단가를 알 수 없다. 매장 전 재료를 담는다.
create or replace function public.build_day_snapshot(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'taken_at', now(),
    'fixed_rate', coalesce(fixed_cost_rate(p_store, business_month()), 0),
    'fixed_items', coalesce(
      (select f.items from fixed_costs_monthly f
        where f.store_id = p_store and f.month = business_month()), '[]'::jsonb),
    -- 재료 단가 — 폐기 손실과 재료 되짚기가 그날 값을 쓰려면 여기 있어야 한다(0058).
    'ingredients', coalesce((
      select jsonb_object_agg(i.id::text, jsonb_build_object(
               'name', i.name, 'base_unit', i.base_unit,
               'unit_price', base_unit_price(i.id)))
        from ingredients i where i.store_id = p_store), '{}'::jsonb),
    'recipes', coalesce((
      select jsonb_object_agg(r.id::text, jsonb_build_object(
        'name', r.name,
        'price', r.price,
        'tax_mode', r.tax_mode,
        'tax_items', coalesce(r.tax_items, '[]'::jsonb),
        'tax', tax_of(r.price, r.tax_mode, r.tax_items),
        'base_servings', r.base_servings,
        'material_cost', recipe_material_cost(r.id),
        'extra_cost', coalesce((select sum(ec.amount_per_serving)
                                  from recipe_extra_costs ec where ec.recipe_id = r.id), 0),
        'extras', coalesce((select jsonb_agg(jsonb_build_object(
                              'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving))
                              from recipe_extra_costs ec where ec.recipe_id = r.id), '[]'::jsonb),
        'lines', coalesce((select jsonb_agg(jsonb_build_object(
                              'ingredient_id', l.ingredient_id,
                              'name', i.name,
                              'base_unit', i.base_unit,
                              'per_serving', l.input_qty / nullif(r.base_servings, 0),
                              'unit_price', base_unit_price(l.ingredient_id)))
                              from recipe_lines l
                              join ingredients i on i.id = l.ingredient_id
                             where l.recipe_id = r.id and l.ingredient_id is not null), '[]'::jsonb)))
        from recipes r where r.store_id = p_store and r.active), '{}'::jsonb));
$fn$;

-- ── 그날 기준을 꺼내는 창구 ───────────────────────────────────
-- 네 함수가 각자 스냅샷을 파고들면 또 흩어진다. 여기 한 곳으로 모은다.

create or replace function public.day_snapshot(p_store uuid, p_date date)
returns jsonb language sql stable security invoker as $fn$
  select b.snapshot from business_days b
   where b.store_id = p_store and b.business_date = p_date;
$fn$;

comment on function public.day_snapshot(uuid, date) is
  '그날 기준값 한 벌. 영업 기록이 없는 과거는 null 이고, 호출부가 현재 값으로 떨어진다(0058).';

/** 그날 재료 단가. 스냅샷에 없으면(옛 기록·신규 재료) 현재 단가로 떨어진다. */
create or replace function public.day_unit_price(p_store uuid, p_date date, p_ingredient uuid)
returns numeric language sql stable security invoker as $fn$
  select coalesce(
    (day_snapshot(p_store, p_date) #>> array['ingredients', p_ingredient::text, 'unit_price'])::numeric,
    base_unit_price(p_ingredient));
$fn$;

/** 그날 고정지출률. 스냅샷 → 그 달 설정 → 가장 최근 입력 월(④ 2) 순으로 찾는다. */
create or replace function public.day_fixed_rate(p_store uuid, p_date date)
returns numeric language plpgsql stable security invoker as $fn$
declare v_rate numeric;
begin
  v_rate := (day_snapshot(p_store, p_date)->>'fixed_rate')::numeric;
  if v_rate is not null then return v_rate; end if;

  v_rate := fixed_cost_rate(p_store, to_char(p_date, 'YYYY-MM'));
  if v_rate is not null then return v_rate; end if;

  select fixed_cost_rate(p_store, month) into v_rate
    from fixed_costs_monthly
   where store_id = p_store and month <= to_char(p_date, 'YYYY-MM')
     and fixed_cost_rate(p_store, month) is not null
   order by month desc limit 1;
  return v_rate;
end;
$fn$;

/** 그날 고정지출 항목 구성. 스냅샷이 없으면 그 달 설정. */
create or replace function public.day_fixed_items(p_store uuid, p_date date)
returns jsonb language sql stable security invoker as $fn$
  select coalesce(
    day_snapshot(p_store, p_date)->'fixed_items',
    (select f.items from fixed_costs_monthly f
      where f.store_id = p_store and f.month = to_char(p_date, 'YYYY-MM')),
    (select f.items from fixed_costs_monthly f
      where f.store_id = p_store and f.month <= to_char(p_date, 'YYYY-MM')
      order by f.month desc limit 1),
    '[]'::jsonb);
$fn$;

/** 그날 매출(메뉴 + 기타). 고정비를 날짜별로 배분할 때 분모가 된다. */
create or replace function public.day_revenue(p_store uuid, p_date date)
returns numeric language sql stable security invoker as $fn$
  select coalesce((
      select sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout))
        from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
       where ds.store_id = p_store and ds.sale_date = p_date), 0)
       + coalesce((select ds.etc_revenue from daily_sales ds
                    where ds.store_id = p_store and ds.sale_date = p_date), 0);
$fn$;

-- 그날 고정지출 항목 합계 — 항목별 배분의 분모다.
create or replace function public.day_fixed_total(p_store uuid, p_date date)
returns numeric language sql stable security invoker as $fn$
  select coalesce((select sum((i->>'total')::numeric)
                     from jsonb_array_elements(day_fixed_items(p_store, p_date)) i), 0);
$fn$;

-- ════════════════════════════════════════════════════════════════
-- ① 손익 합계 — 고정비와 폐기 손실을 날짜별 기준으로
-- ════════════════════════════════════════════════════════════════
create or replace function public.sales_summary(p_store uuid, p_from date, p_to date)
returns jsonb language plpgsql stable as $fn$
declare
  v_revenue    numeric := 0;
  v_etc        numeric := 0;
  v_material   numeric := 0;
  v_extra_mat  numeric := 0;
  v_tax        numeric := 0;
  v_waste_ing  numeric := 0;   -- 식재료 폐기(E2)
  v_waste_menu numeric := 0;   -- 조리 폐기(만들어 놓고 못 판 음식)
  v_extra      numeric := 0;
  v_fixed      numeric := 0;
  v_qty        numeric := 0;
  v_days       int     := 0;
  v_rate       numeric;
begin
  select
    coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0),
    coalesce(sum(it.unit_material_cost * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(coalesce(it.unit_extra_cost,0) * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    -- 조리 폐기는 매출도 부가세도 없다. 재료비만 손실로 잡힌다.
    coalesce(sum(it.unit_material_cost * coalesce(it.qty_waste, 0)), 0),
    -- 판매 시점에 굳은 unit_tax 를 쓴다. 세금 항목을 나중에 고쳐도 지난 장부가 안 움직인다(0052).
    coalesce(sum(
      coalesce(it.unit_tax,
               case when coalesce(it.tax_mode, 'included') = 'included'
                    then it.unit_price * 10 / 110 else 0 end)
      * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0)
  into v_revenue, v_qty, v_material, v_extra_mat, v_waste_menu, v_tax
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)
    into v_etc, v_extra, v_days
  from daily_sales where store_id = p_store and sale_date between p_from and p_to;

  v_revenue := v_revenue + v_etc;

  -- 식재료 폐기 손실 — 재고 원장에서 집계.
  -- sales_item_id 가 있는 폐기는 조리 폐기다(0041). 그쪽은 qty_waste 로 이미 잡혀 이중 집계가 된다.
  -- 단가는 버린 날 기준이다(0058) — 현재 단가를 곱하면 재료값이 오를 때마다 지난달 폐기 손실이 따라 오른다.
  select coalesce(sum(coalesce(ev.volume_delta, 0)
                      * coalesce(day_unit_price(p_store,
                          (ev.occurred_at at time zone business_tz())::date, ev.ingredient_id), 0)), 0)
    into v_waste_ing
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard' and ev.sales_item_id is null
    -- 되돌린 폐기는 빼야 한다. 0038 이 real_loss_rate 에서만 고치고 여기는 놓쳤었다(실측 7,760원).
    and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)
    and (ev.occurred_at at time zone business_tz())::date between p_from and p_to;

  -- 고정 지출 — 날짜별 그날 률로 배분해 더한다(0058).
  -- 기간 전체에 한 벌을 적용하면, 이번 달 인건비를 올렸을 때 지난 날짜의 고정비까지 따라 오른다.
  select coalesce(sum(day_revenue(p_store, d.sale_date)
                      * coalesce(day_fixed_rate(p_store, d.sale_date), 0)), 0)
    into v_fixed
  from (select distinct sale_date from daily_sales
         where store_id = p_store and sale_date between p_from and p_to) d;

  -- 표시용 률 — 기간이면 실제 배분 결과의 가중평균. 하루면 그날 률 그대로.
  v_rate := case when v_revenue > 0 then v_fixed / v_revenue
                 else day_fixed_rate(p_store, p_from) end;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'revenue', v_revenue, 'etc_revenue', v_etc, 'qty', v_qty,
    'material_cost', v_material,
    'extra_material_cost', v_extra_mat,
    'tax', v_tax,
    'waste_loss', v_waste_ing + v_waste_menu,
    'waste_ingredient', v_waste_ing,
    'waste_menu', v_waste_menu,
    'daily_extra', v_extra, 'fixed_cost', v_fixed,
    'fixed_rate', v_rate,
    'fixed_rate_provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'profit', v_revenue - v_material - v_extra_mat - v_tax
              - v_waste_ing - v_waste_menu - v_extra - v_fixed);
end;
$fn$;

-- ════════════════════════════════════════════════════════════════
-- ② 재료 되짚기 — 수량은 원장, 단가는 그날
-- ════════════════════════════════════════════════════════════════
create or replace function public.sales_material_usage(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with used as (
    select ev.ingredient_id,
           it.menu_name,
           ds.sale_date,
           -- consume 은 음수, 조정(adjust)은 양수다. 합치면 순 사용량이 된다.
           sum(-ev.count_delta) as qty
      from inventory_events ev
      join daily_sales_items it on it.id = ev.sales_item_id
      join daily_sales ds on ds.id = it.daily_sales_id
     where ev.store_id = p_store
       and ds.sale_date between p_from and p_to
     group by ev.ingredient_id, it.menu_name, ds.sale_date
    having sum(-ev.count_delta) > 0
  ),
  -- 금액은 그날 단가로 낸다(0058). 현재 단가를 곱하면 재료값이 오를 때마다
  -- 지난 날짜의 재료비 내역이 통째로 올라간다.
  priced as (
    select u.ingredient_id, u.menu_name, u.sale_date, u.qty,
           u.qty * coalesce(day_unit_price(p_store, u.sale_date, u.ingredient_id), 0) as amount
      from used u
  ),
  per_ing as (
    select p.ingredient_id, sum(p.qty) as qty, sum(p.amount) as amount
      from priced p group by p.ingredient_id
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(p.amount), 0) from per_ing p),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ingredient_id', p.ingredient_id,
               'name', i.name,
               'base_unit', i.base_unit,
               'qty', p.qty,
               -- 기간 중 단가가 바뀌었으면 한 값으로 말할 수 없다 — 실제 지출 나누기 수량이 답이다.
               'unit_price', case when p.qty > 0 then p.amount / p.qty else null end,
               'amount', p.amount,
               'menus', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'menu_name', m.menu_name,
                          'qty', m.qty,
                          'amount', m.amount)
                        order by m.qty desc), '[]'::jsonb)
                 from (select x.menu_name, sum(x.qty) as qty, sum(x.amount) as amount
                         from priced x where x.ingredient_id = p.ingredient_id
                        group by x.menu_name) m))
             order by p.amount desc), '[]'::jsonb)
      from per_ing p join ingredients i on i.id = p.ingredient_id)
  );
$fn$;

-- ════════════════════════════════════════════════════════════════
-- ③ 부자재 되짚기 — 그날 구성으로
-- ════════════════════════════════════════════════════════════════
create or replace function public.sales_extra_usage(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with sold as (
    select ds.sale_date, it.recipe_id, it.menu_name,
           sum(it.qty_hall + it.qty_delivery + it.qty_takeout) as qty
      from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
       and it.recipe_id is not null
     group by ds.sale_date, it.recipe_id, it.menu_name
    having sum(it.qty_hall + it.qty_delivery + it.qty_takeout) > 0
  ),
  -- 부자재 구성은 그날 스냅샷이다(0058). 현재 레시피를 읽으면 항목을 지우는 순간
  -- 그날 내역에서도 사라진다 — 그날 실제로 들어간 원가인데.
  lines as (
    select s.sale_date, s.menu_name, s.qty,
           e->>'name' as name,
           coalesce((e->>'amount')::numeric, 0) as unit
      from sold s
      cross join lateral jsonb_array_elements(
        coalesce(day_snapshot(p_store, s.sale_date) #> array['recipes', s.recipe_id::text, 'extras'],
                 (select coalesce(jsonb_agg(jsonb_build_object(
                           'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving)), '[]'::jsonb)
                    from recipe_extra_costs ec where ec.recipe_id = s.recipe_id))) e
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(l.unit * l.qty), 0) from lines l),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', x.name, 'qty', x.qty, 'amount', x.amount, 'menus', x.menus)
             order by x.amount desc), '[]'::jsonb)
      from (
        select l.name,
               sum(l.qty) as qty,
               sum(l.unit * l.qty) as amount,
               jsonb_agg(jsonb_build_object(
                 'menu_name', l.menu_name, 'qty', l.qty,
                 'unit', l.unit,
                 'amount', l.unit * l.qty) order by l.qty desc) as menus
          from lines l
         group by l.name) x)
  );
$fn$;

-- ════════════════════════════════════════════════════════════════
-- ④ 고정 지출 되짚기 — 날짜별 그날 항목·률로 배분해 더한다
-- ════════════════════════════════════════════════════════════════
create or replace function public.sales_fixed_breakdown(p_store uuid, p_from date, p_to date)
returns jsonb language plpgsql stable as $fn$
declare
  v_sum     jsonb;
  v_total   numeric;
  v_revenue numeric;
begin
  v_sum     := sales_summary(p_store, p_from, p_to);
  v_revenue := (v_sum->>'revenue')::numeric;
  v_total   := (v_sum->>'fixed_cost')::numeric;

  return jsonb_build_object(
    'month', to_char(p_from, 'YYYY-MM'),
    -- 기간이면 날마다 다를 수 있다. 표시용 률은 실제 배분 결과의 가중평균이다.
    'rate', case when v_revenue > 0 then v_total / v_revenue
                 else day_fixed_rate(p_store, p_from) end,
    'provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'revenue', v_revenue,
    'total', v_total,
    -- 항목도 그날 구성이다(0058). 인건비 한 줄만 고쳐도 지난 장부의 항목별
    -- 숫자가 전부 바뀌던 자리다.
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', x.key,
               'month_total', x.month_total,
               'amount', x.amount,
               'lines', x.lines)
             order by x.amount desc)
      from (
        select i->>'key' as key,
               max((i->>'total')::numeric) as month_total,
               sum(day_revenue(p_store, d.sale_date)
                   * coalesce(day_fixed_rate(p_store, d.sale_date), 0)
                   * case when day_fixed_total(p_store, d.sale_date) > 0
                          then (i->>'total')::numeric / day_fixed_total(p_store, d.sale_date)
                          else 0 end) as amount,
               -- 세부 줄은 기간 안에서 가장 최근 날의 구성으로 보인다.
               (array_agg(coalesce(i->'lines', '[]'::jsonb) order by d.sale_date desc))[1] as lines
          from (select distinct sale_date from daily_sales
                 where store_id = p_store and sale_date between p_from and p_to) d
          cross join lateral jsonb_array_elements(day_fixed_items(p_store, d.sale_date)) i
         group by i->>'key') x), '[]'::jsonb));
end;
$fn$;

-- ── 옛 스냅샷에도 통하게 ──────────────────────────────────────
-- 0058 이전에 만들어진 스냅샷에는 ingredients 맵이 없다. 그런데 레시피 줄
-- (recipes[*].lines[])에는 그날 단가가 이미 들어 있다 — 거기서 찾는다.
-- 그래도 없으면(어느 레시피에도 안 쓰는 재료) 현재 단가로 떨어진다.
create or replace function public.day_unit_price(p_store uuid, p_date date, p_ingredient uuid)
returns numeric language sql stable security invoker as $fn$
  select coalesce(
    -- ① 0058 이후 스냅샷 — 매장 전 재료의 단가를 담는다
    (day_snapshot(p_store, p_date) #>> array['ingredients', p_ingredient::text, 'unit_price'])::numeric,
    -- ② 옛 스냅샷 — 레시피 줄에 박힌 그날 단가
    (select (l->>'unit_price')::numeric
       from jsonb_each(coalesce(day_snapshot(p_store, p_date)->'recipes', '{}'::jsonb)) r
       cross join lateral jsonb_array_elements(coalesce(r.value->'lines', '[]'::jsonb)) l
      where l->>'ingredient_id' = p_ingredient::text
        and (l->>'unit_price') is not null
      limit 1),
    -- ③ 영업 기록이 없는 과거 — 지금 값이 최선이다
    base_unit_price(p_ingredient));
$fn$;

comment on function public.day_unit_price(uuid, date, uuid) is
  '그날 재료 단가 — 스냅샷 → 옛 스냅샷의 레시피 줄 → 현재 단가 순으로 찾는다(0058).';

select public.assert_no_rpc_overloads();
