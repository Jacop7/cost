-- ════════════════════════════════════════════════════════════════
-- 0028 · 판매 소진을 "되돌리고 다시 빼기" → "목표치 대조"로
--
-- 0027 의 수정 저장은 이렇게 동작했다:
--   E9 로 전량 복구 → inventory_events 삭제 → 수량 갱신 → E8 로 다시 차감
--
-- 그런데 `inventory_events` 에는 **DELETE 정책이 없다**(0018 원장 보존). RLS 아래에서
-- delete 는 오류 없이 0건 처리되고, 남아 있는 consume 이벤트 때문에 E8 이 "이미 처리됨"으로
-- 빠져나갔다. 결과: 복구만 되고 재차감은 안 되어 **판매했는데 재고가 도로 가득 찼다.**
-- (실증: 제육볶음 8 → 12 재저장 후 대파 1,800 → 2,000)
--
-- 삭제에 기대는 설계 자체가 원장 보존과 충돌한다. 그래서 모델을 바꾼다:
--
--   "이 판매 줄이 지금까지 뺀 양"과 "지금 빠져야 할 양"을 비교해 **차이만** 움직인다.
--
-- 이러면 삭제가 필요 없고, 몇 번을 눌러도 결과가 같으며(멱등), 모든 조정이 원장에 남는다.
-- 수량 증가·감소·취소가 전부 같은 한 경로로 처리된다.
-- ════════════════════════════════════════════════════════════════

-- ── 목표치 대조 ───────────────────────────────────────────────
-- p_zero = true 면 목표를 0 으로 두어 전량 복구한다(판매 취소).
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
  v_qty := case when p_zero or it.recipe_id is null then 0
                else it.qty_hall + it.qty_delivery + it.qty_takeout end;

  -- 목표(target) 와 기적용(applied) 을 식재료 단위로 맞대어 본다.
  --   target  : 지금 수량이면 빠져 있어야 할 총량 (반제품까지 재귀 전개)
  --   applied : 이 판매 줄이 지금까지 실제로 뺀 총량 (consume 음수 + adjust 양수의 합)
  -- 한쪽에만 있는 식재료도 봐야 한다 — 레시피에서 빠진 재료는 target 이 없고 applied 만 있다.
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
      continue;  -- 이미 맞다. 0 짜리 이벤트를 남기면 원장이 소음으로 가득 찬다.
    end if;

    if v_delta > 0 then
      v_before := stock_total_base(rec.ingredient_id);
      v_taken  := consume_stock(rec.ingredient_id, v_delta);

      -- 부족해도 판매를 막지 않는다 — 이미 팔린 것이다. 대신 부족분을 돌려줘 화면이 알리게 한다.
      if v_delta > v_before then
        v_short := v_short || jsonb_build_object(
          'ingredient_id', rec.ingredient_id, 'name', rec.name,
          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before);
      end if;

      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id, 'consume', -v_taken, p_sales_item,
         it.menu_name || ' ' || v_qty || '개 판매',
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

    -- 재고가 오르내리면 발주 후보 판정도 함께 바뀐다. 이게 사이클의 마지막 고리다.
    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'lines', v_lines,
    'sold_qty', v_qty, 'shortages', v_short);
end;
$fn$;

comment on function public.reconcile_sales_consumption(uuid, boolean) is
  '판매 줄 하나의 재고 소진을 목표치에 맞춘다. 증가·감소·취소가 모두 이 한 경로. 멱등이며 원장을 지운 적이 없다.';

-- E8/E9 는 이제 대조 함수의 얇은 이름표다. 화면·문서가 쓰는 이벤트 이름을 그대로 유지한다.
create or replace function public.e8_sales_consumed(p_sales_item uuid)
returns jsonb language sql as $fn$
  select reconcile_sales_consumption(p_sales_item, false);
$fn$;

create or replace function public.e9_sales_reverted(p_sales_item uuid)
returns jsonb language sql as $fn$
  select reconcile_sales_consumption(p_sales_item, true);
$fn$;

-- ── E10 재작성 — 삭제 없는 수정 ───────────────────────────────
create or replace function public.e10_sale_recorded(
  p_store uuid, p_date date, p_recipe uuid,
  p_qty_hall numeric default 0, p_qty_delivery numeric default 0, p_qty_takeout numeric default 0
) returns jsonb language plpgsql as $fn$
declare
  v_ds      uuid;
  v_item    uuid;
  r         recipes%rowtype;
  v_mat     numeric;
  v_extra   numeric;
  v_consume jsonb;
begin
  if p_date > business_day() then
    raise exception '미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)', p_date, business_day()
      using errcode = '22000';
  end if;
  if coalesce(p_qty_hall,0) < 0 or coalesce(p_qty_delivery,0) < 0 or coalesce(p_qty_takeout,0) < 0 then
    raise exception '판매 수량은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select * into r from recipes where id = p_recipe;
  if not found then raise exception 'recipe % not found', p_recipe; end if;

  insert into daily_sales (store_id, sale_date) values (p_store, p_date)
  on conflict (store_id, sale_date) do update set updated_at = now()
  returning id into v_ds;

  -- 판매 시점 스냅샷. **반제품 포함** 원가여야 재고 소진과 앞뒤가 맞는다.
  v_mat := coalesce(recipe_material_cost(p_recipe), 0);
  select coalesce(sum(amount_per_serving), 0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  select id into v_item
    from daily_sales_items
   where daily_sales_id = v_ds and recipe_id = p_recipe
   for update;

  if v_item is null then
    -- 팔지도 않은 메뉴를 0 으로 저장하는 건 아무 일도 아니다. 빈 줄을 만들지 않는다.
    if coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0) + coalesce(p_qty_takeout,0) = 0 then
      return jsonb_build_object('daily_sales_id', v_ds, 'sales_item_id', null, 'skipped', true);
    end if;
    insert into daily_sales_items
      (store_id, daily_sales_id, recipe_id, menu_name, unit_price,
       qty_hall, qty_delivery, qty_takeout, unit_material_cost, unit_extra_cost, tax_mode)
    values
      (p_store, v_ds, p_recipe, r.name, r.price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, v_mat, v_extra, r.tax_mode)
    returning id into v_item;
  else
    -- 수정 저장 — 스냅샷 원가도 저장 시점 값으로 다시 찍는다.
    -- (그 사이 재료 단가가 바뀌었다면 그 날의 원가로 다시 기록하는 것이 맞다.)
    update daily_sales_items set
      qty_hall = p_qty_hall, qty_delivery = p_qty_delivery, qty_takeout = p_qty_takeout,
      unit_price = r.price, unit_material_cost = v_mat, unit_extra_cost = v_extra,
      menu_name = r.name, tax_mode = r.tax_mode
    where id = v_item;
  end if;

  -- 수량이 0 이어도 줄은 남긴다. 원장(inventory_events)이 이 줄을 참조하고 있어
  -- 지우면 소진 이력이 통째로 사라진다. 조회 API 가 0 짜리를 목록에서 뺀다.
  v_consume := reconcile_sales_consumption(v_item, false);

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$fn$;

-- ── 조회에서 0 짜리 줄 감추기 ─────────────────────────────────
-- 취소된 메뉴가 "0개"로 목록에 남으면 사장님은 그걸 지우려고 다시 헤맨다.
create or replace function public.sales_day(p_store uuid, p_date date)
returns jsonb language sql stable security invoker as $fn$
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
      from daily_sales_items it
     where it.daily_sales_id = ds.id
       and it.qty_hall + it.qty_delivery + it.qty_takeout > 0),
    'summary', sales_summary(p_store, p_date, p_date)
  )
  from daily_sales ds
  where ds.store_id = p_store and ds.sale_date = p_date;
$fn$;

select public.assert_no_rpc_overloads();
