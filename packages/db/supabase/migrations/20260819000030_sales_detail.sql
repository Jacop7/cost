-- ════════════════════════════════════════════════════════════════
-- 0030 · 매출 화면이 실제로 필요로 하는 것들
--
-- SALES-05/06/07 은 프로토타입에 이미 있는데 저장할 자리가 없었다:
--
--  · 조리 폐기(SALES-05) — 만들어 놓고 못 판 음식. 재료는 나갔고 매출은 0 이다.
--    이걸 기록할 데가 없으면 "재고는 줄었는데 아무도 안 샀다"가 원장에서 설명되지 않는다.
--  · 기타 매출(SALES-06) — 레시피에 없는 음료 등. 지금은 합계 숫자 하나뿐이라
--    "무엇을 얼마에 몇 개" 를 되돌아볼 수 없다.
--  · 당일 지출(SALES-07) — 마찬가지로 항목이 없다.
--
-- 합계 컬럼(etc_revenue · daily_extra)은 그대로 두고 **항목 목록에서 계산**한다.
-- sales_summary 를 건드리지 않으면서 화면에는 내역을 줄 수 있다.
-- ════════════════════════════════════════════════════════════════

alter table daily_sales_items
  add column if not exists qty_waste numeric not null default 0;

alter table daily_sales_items
  add constraint daily_sales_items_qty_waste_ck check (qty_waste >= 0) not valid;

alter table daily_sales
  add column if not exists etc_items   jsonb not null default '[]'::jsonb,
  add column if not exists extra_items jsonb not null default '[]'::jsonb;

-- ── 소진 대조에 조리 폐기를 포함 ──────────────────────────────
-- 판매분과 폐기분은 재고 관점에서 같다 — 둘 다 재료가 나갔다.
create or replace function public.reconcile_sales_consumption(
  p_sales_item uuid, p_zero boolean default false
) returns jsonb language plpgsql as $fn$
declare
  it       daily_sales_items%rowtype;
  ds       daily_sales%rowtype;
  v_qty    numeric;
  v_day    date;
  rec      record;
  v_delta  numeric;
  v_before numeric;
  v_taken  numeric;
  v_short  jsonb := '[]'::jsonb;
  v_lines  int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;
  -- 재고에서 빠져야 할 양 = 판매분 + 조리 폐기분
  v_qty := case when p_zero or it.recipe_id is null then 0
                else it.qty_hall + it.qty_delivery + it.qty_takeout + coalesce(it.qty_waste, 0) end;

  for rec in
    with target as (
      select n.ingredient_id, sum(n.amount) as need
        from recipe_ingredient_needs(it.recipe_id, v_qty) n
       group by n.ingredient_id
    ),
    applied as (
      select ev.ingredient_id, -sum(ev.count_delta) as taken
        from inventory_events ev
       where ev.sales_item_id = p_sales_item
       group by ev.ingredient_id
    )
    select coalesce(t.ingredient_id, a.ingredient_id) as ingredient_id,
           coalesce(t.need, 0)  as need,
           coalesce(a.taken, 0) as taken,
           i.name
      from target t
      full join applied a on a.ingredient_id = t.ingredient_id
      join ingredients i on i.id = coalesce(t.ingredient_id, a.ingredient_id)
  loop
    v_delta := rec.need - rec.taken;
    if abs(v_delta) < 1e-9 then
      continue;
    end if;

    if v_delta > 0 then
      v_before := stock_total_base(rec.ingredient_id);
      v_taken  := consume_stock(rec.ingredient_id, v_delta);

      if v_delta > v_before then
        v_short := v_short || jsonb_build_object(
          'ingredient_id', rec.ingredient_id, 'name', rec.name,
          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before);
      end if;

      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id, 'consume', -v_taken, p_sales_item,
         it.menu_name || ' ' || v_qty || '개 소진'
           || case when coalesce(it.qty_waste,0) > 0 then ' (폐기 ' || it.qty_waste || '개 포함)' else '' end,
         (v_day::timestamp at time zone business_tz()));
    else
      perform restore_stock(rec.ingredient_id, -v_delta);
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id, 'adjust', -v_delta, p_sales_item,
         case when v_qty = 0 then '판매 취소 보정'
              else it.menu_name || ' 판매 수량 조정 (' || v_qty || '개)' end,
         (v_day::timestamp at time zone business_tz()));
    end if;

    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'lines', v_lines,
    'sold_qty', v_qty, 'shortages', v_short);
end;
$fn$;

-- ── E10 에 조리 폐기 인자 추가 ────────────────────────────────
-- ⚠ 인자를 늘리면 **오버로드**가 생긴다(0012·0022 에서 두 번 당했다). 먼저 옛 시그니처를 지운다.
drop function if exists public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric);

create or replace function public.e10_sale_recorded(
  p_store uuid, p_date date, p_recipe uuid,
  p_qty_hall numeric default 0, p_qty_delivery numeric default 0, p_qty_takeout numeric default 0,
  p_qty_waste numeric default 0
) returns jsonb language plpgsql as $fn$
declare
  v_ds      uuid;
  v_item    uuid;
  r         recipes%rowtype;
  v_mat     numeric;
  v_extra   numeric;
  v_consume jsonb;
  v_total   numeric;
begin
  if p_date > business_day() then
    raise exception '미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)', p_date, business_day()
      using errcode = '22000';
  end if;
  if coalesce(p_qty_hall,0) < 0 or coalesce(p_qty_delivery,0) < 0
     or coalesce(p_qty_takeout,0) < 0 or coalesce(p_qty_waste,0) < 0 then
    raise exception '판매 수량은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select * into r from recipes where id = p_recipe;
  if not found then raise exception 'recipe % not found', p_recipe; end if;

  insert into daily_sales (store_id, sale_date) values (p_store, p_date)
  on conflict (store_id, sale_date) do update set updated_at = now()
  returning id into v_ds;

  v_mat := coalesce(recipe_material_cost(p_recipe), 0);
  select coalesce(sum(amount_per_serving), 0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);

  select id into v_item
    from daily_sales_items
   where daily_sales_id = v_ds and recipe_id = p_recipe
   for update;

  if v_item is null then
    if v_total = 0 then
      return jsonb_build_object('daily_sales_id', v_ds, 'sales_item_id', null, 'skipped', true);
    end if;
    insert into daily_sales_items
      (store_id, daily_sales_id, recipe_id, menu_name, unit_price,
       qty_hall, qty_delivery, qty_takeout, qty_waste,
       unit_material_cost, unit_extra_cost, tax_mode)
    values
      (p_store, v_ds, p_recipe, r.name, r.price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, p_qty_waste,
       v_mat, v_extra, r.tax_mode)
    returning id into v_item;
  else
    update daily_sales_items set
      qty_hall = p_qty_hall, qty_delivery = p_qty_delivery,
      qty_takeout = p_qty_takeout, qty_waste = p_qty_waste,
      unit_price = r.price, unit_material_cost = v_mat, unit_extra_cost = v_extra,
      menu_name = r.name, tax_mode = r.tax_mode
    where id = v_item;
  end if;

  v_consume := reconcile_sales_consumption(v_item, false);

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$fn$;

-- ── save_sale 재작성 — 폐기·기타매출·지출 항목까지 ────────────
drop function if exists public.save_sale(uuid, date, jsonb, numeric, numeric);

create or replace function public.save_sale(
  p_store uuid, p_date date, p_items jsonb,
  p_etc_items jsonb default null, p_extra_items jsonb default null
) returns jsonb language plpgsql security invoker as $fn$
declare
  v_item    jsonb;
  v_sales   uuid;
  v_recipes uuid[] := '{}';
  v_dead    uuid;
  v_result  jsonb := '[]'::jsonb;
  v_etc     numeric;
  v_extra   numeric;
begin
  perform assert_my_store(p_store);
  if p_date > business_day() then
    raise exception '미래 날짜의 매출은 등록할 수 없어요' using errcode = '22000';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_recipes := v_recipes || (v_item->>'recipe_id')::uuid;
    v_result := v_result || jsonb_build_array(
      e10_sale_recorded(
        p_store, p_date, (v_item->>'recipe_id')::uuid,
        coalesce((v_item->>'qty_hall')::numeric, 0),
        coalesce((v_item->>'qty_delivery')::numeric, 0),
        coalesce((v_item->>'qty_takeout')::numeric, 0),
        coalesce((v_item->>'qty_waste')::numeric, 0)));
  end loop;

  -- 화면에서 지운 메뉴 — 목록에 없으면 0 으로 저장해 재고를 되돌린다.
  for v_dead in
    select it.recipe_id
      from daily_sales_items it join daily_sales ds on ds.id = it.daily_sales_id
     where ds.store_id = p_store and ds.sale_date = p_date
       and it.recipe_id is not null and not (it.recipe_id = any(v_recipes))
       and it.qty_hall + it.qty_delivery + it.qty_takeout + coalesce(it.qty_waste,0) > 0
  loop
    perform e10_sale_recorded(p_store, p_date, v_dead, 0, 0, 0, 0);
  end loop;

  if p_etc_items is not null or p_extra_items is not null then
    select id into v_sales from daily_sales where store_id = p_store and sale_date = p_date;
    if v_sales is null then
      insert into daily_sales (store_id, sale_date) values (p_store, p_date) returning id into v_sales;
    end if;

    -- 합계는 항목에서 **계산**한다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
    if p_etc_items is not null then
      select coalesce(sum(coalesce((x->>'price')::numeric,0) * coalesce((x->>'qty')::numeric,1)), 0)
        into v_etc from jsonb_array_elements(p_etc_items) x;
      update daily_sales set etc_items = p_etc_items, etc_revenue = v_etc, updated_at = now()
       where id = v_sales;
    end if;
    if p_extra_items is not null then
      select coalesce(sum(coalesce((x->>'amount')::numeric,0)), 0)
        into v_extra from jsonb_array_elements(p_extra_items) x;
      update daily_sales set extra_items = p_extra_items, daily_extra = v_extra, updated_at = now()
       where id = v_sales;
    end if;
  end if;

  return jsonb_build_object('sale_date', p_date, 'items', v_result);
end;
$fn$;

-- ── sales_summary — 조리 폐기 손실 반영 ───────────────────────
create or replace function public.sales_summary(p_store uuid, p_from date, p_to date)
returns jsonb language plpgsql stable as $fn$
declare
  v_revenue    numeric := 0;
  v_etc        numeric := 0;
  v_material   numeric := 0;
  v_extra_mat  numeric := 0;
  v_fee        numeric := 0;
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
    coalesce(sum(
      it.unit_price * (
        it.qty_hall     * coalesce((select fee_rate from sales_channels where store_id=p_store and code='hall'), 0) +
        it.qty_delivery * coalesce((select fee_rate from sales_channels where store_id=p_store and code='delivery'), 0) +
        it.qty_takeout  * coalesce((select fee_rate from sales_channels where store_id=p_store and code='takeout'), 0)
      ) / 100.0), 0),
    coalesce(sum(
      case when coalesce(it.tax_mode, 'included') = 'included'
           then it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout) * 10 / 110
           else 0 end), 0)
  into v_revenue, v_qty, v_material, v_extra_mat, v_waste_menu, v_fee, v_tax
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)
    into v_etc, v_extra, v_days
  from daily_sales where store_id = p_store and sale_date between p_from and p_to;

  v_revenue := v_revenue + v_etc;

  -- 식재료 폐기 손실 — 재고 원장에서 집계
  select coalesce(sum(coalesce(ev.volume_delta, 0) * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
    into v_waste_ing
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard'
    and (ev.occurred_at at time zone business_tz())::date between p_from and p_to;

  -- 고정 지출 — 해당 월 률. 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  v_rate := fixed_cost_rate(p_store, to_char(p_from, 'YYYY-MM'));
  if v_rate is null then
    select fixed_cost_rate(p_store, month) into v_rate
      from fixed_costs_monthly
     where store_id = p_store and month <= to_char(p_from, 'YYYY-MM')
       and fixed_cost_rate(p_store, month) is not null
     order by month desc limit 1;
  end if;
  v_fixed := coalesce(v_rate, 0) * v_revenue;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'revenue', v_revenue, 'etc_revenue', v_etc, 'qty', v_qty,
    'material_cost', v_material,
    'extra_material_cost', v_extra_mat,
    'channel_fee', v_fee, 'tax', v_tax,
    'waste_loss', v_waste_ing + v_waste_menu,
    'waste_ingredient', v_waste_ing,
    'waste_menu', v_waste_menu,
    'daily_extra', v_extra, 'fixed_cost', v_fixed,
    'fixed_rate', v_rate,
    'fixed_rate_provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'profit', v_revenue - v_material - v_extra_mat - v_fee - v_tax
              - v_waste_ing - v_waste_menu - v_extra - v_fixed);
end;
$fn$;

-- ── 조회 API 갱신 ─────────────────────────────────────────────
create or replace function public.sales_day(p_store uuid, p_date date)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'sale_date', p_date,
    'daily_sales_id', ds.id,
    'etc_revenue', coalesce(ds.etc_revenue, 0),
    'daily_extra', coalesce(ds.daily_extra, 0),
    'etc_items',   coalesce(ds.etc_items, '[]'::jsonb),
    'extra_items', coalesce(ds.extra_items, '[]'::jsonb),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', it.id, 'recipe_id', it.recipe_id, 'menu_name', it.menu_name,
               'unit_price', it.unit_price, 'unit_material_cost', it.unit_material_cost,
               'unit_extra_cost', it.unit_extra_cost,
               'qty_hall', it.qty_hall, 'qty_delivery', it.qty_delivery,
               'qty_takeout', it.qty_takeout, 'qty_waste', coalesce(it.qty_waste, 0),
               'qty', it.qty_hall + it.qty_delivery + it.qty_takeout)
             order by (it.qty_hall + it.qty_delivery + it.qty_takeout) desc), '[]'::jsonb)
      from daily_sales_items it
     where it.daily_sales_id = ds.id
       and it.qty_hall + it.qty_delivery + it.qty_takeout + coalesce(it.qty_waste,0) > 0),
    'summary', sales_summary(p_store, p_date, p_date)
  )
  from daily_sales ds
  where ds.store_id = p_store and ds.sale_date = p_date;
$fn$;

-- ── 기간 분석 (SALES-02) ──────────────────────────────────────
-- 일별 매출·순이익 + 메뉴별 집계 + 채널 구성비를 한 번에.
-- 화면이 날짜마다 sales_day 를 부르면 30일 조회에 30 왕복이 된다.
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
                 'material', coalesce(sum(it.unit_material_cost * (it.qty_hall+it.qty_delivery+it.qty_takeout)), 0)) as x
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
               'code', c.code, 'name', c.name, 'fee_rate', c.fee_rate, 'amount', c.amount)
             order by c.amount desc), '[]'::jsonb)
      from (
        select ch.code, ch.name, ch.fee_rate,
               coalesce(sum(case ch.code
                 when 'hall'     then it.unit_price * it.qty_hall
                 when 'delivery' then it.unit_price * it.qty_delivery
                 when 'takeout'  then it.unit_price * it.qty_takeout
                 else 0 end), 0) as amount
          from sales_channels ch
          left join daily_sales ds on ds.store_id = p_store and ds.sale_date between p_from and p_to
          left join daily_sales_items it on it.daily_sales_id = ds.id
         where ch.store_id = p_store
         group by ch.code, ch.name, ch.fee_rate) c)
  );
$fn$;

select public.assert_no_rpc_overloads();
