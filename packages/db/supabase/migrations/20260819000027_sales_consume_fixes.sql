-- ════════════════════════════════════════════════════════════════
-- 0027 · 판매→소진 전파 결함 3건
--
-- 로컬 DB 로 실제 저장을 돌려보며 찾은 것들이다. 셋 다 "화면은 멀쩡한데 숫자가 틀어지는" 종류다.
--
--  (A) E10 이 항상 INSERT 였다.
--      같은 날 같은 메뉴를 다시 저장하면 행이 **두 개**가 되어 그날 매출이 두 배가 된다.
--      수량을 고치는 것이 판매 등록의 기본 동작인데 고칠 방법 자체가 없었다.
--      → (daily_sales_id, recipe_id) 로 upsert 하고, 이전 소진을 되돌린 뒤 새 수량으로 다시 뺀다.
--
--  (B) E8 이 반제품(sub_recipe) 줄을 건너뛰었다.
--      양념장 같은 반제품으로만 이루어진 메뉴는 팔아도 재고가 **하나도** 줄지 않았다.
--      원가는 recipe_material_cost() 가 재귀로 잘 계산하는데 소진만 1단계였다 — 원가와 재고가 어긋난다.
--      → 재귀 전개 함수 recipe_ingredient_needs() 를 두고 E8 이 그걸 쓴다.
--
--  (C) E9 되돌리기가 미개봉/개봉 구분을 뭉갰다.
--      5,000g 을 되돌리면 opened_remain 에 5,000 이 통째로 들어가 "개봉 5,000g" 이 된다.
--      총량은 맞지만 실사 화면(미개봉 n개 + 개봉 m)이 물리적으로 불가능한 값을 보여준다.
--      → consume_stock 의 거울인 restore_stock 을 만들어 개당 용량 단위로 되채운다.
-- ════════════════════════════════════════════════════════════════

-- ── (B) 레시피 → 식재료 소요량 재귀 전개 ──────────────────────
-- p_servings 인분을 만들 때 실제로 빠져나가는 **기준단위 총량**을 식재료별로 돌려준다.
-- 반제품이 섞여도 잎사귀(실제 식재료)까지 내려가 합산한다.
create or replace function public.recipe_ingredient_needs(
  p_recipe uuid, p_servings numeric, p_depth int default 0
) returns table (ingredient_id uuid, amount numeric)
language plpgsql stable as $fn$
declare
  v_base numeric;
  rec    record;
begin
  if p_depth > 5 or p_servings is null or p_servings <= 0 then
    return;  -- 순환·과도한 중첩은 여기서 끊는다(recipe_material_cost 와 같은 한도).
  end if;

  select base_servings into v_base from recipes where id = p_recipe;
  if v_base is null or v_base <= 0 then return; end if;

  -- 직접 재료
  return query
    select rl.ingredient_id, (rl.input_qty / v_base) * p_servings
      from recipe_lines rl
     where rl.recipe_id = p_recipe and rl.ingredient_id is not null;

  -- 반제품 — 하위 레시피를 (사용량/기준인분 × 요청인분) 인분만큼 만든 셈으로 내려간다.
  for rec in
    select rl.sub_recipe_id, rl.input_qty
      from recipe_lines rl
     where rl.recipe_id = p_recipe and rl.sub_recipe_id is not null
  loop
    return query
      select n.ingredient_id, n.amount
        from recipe_ingredient_needs(
               rec.sub_recipe_id,
               (rec.input_qty / v_base) * p_servings,
               p_depth + 1) n;
  end loop;
end;
$fn$;

comment on function public.recipe_ingredient_needs(uuid, numeric, int) is
  '레시피 n인분의 식재료 소요량을 반제품까지 재귀 전개. E8 소진과 E6 계산이 같은 정의를 쓰게 한다.';

-- ── (C) 되돌리기 — consume_stock 의 거울 ──────────────────────
-- 개봉분을 먼저 채우고, 개당 용량을 넘으면 미개봉으로 되돌린다.
create or replace function public.restore_stock(p_ingredient uuid, p_amount numeric)
returns numeric language plpgsql as $fn$
declare
  v_per    numeric;
  v_sealed numeric;
  v_remain numeric;
  v_total  numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  select i.per_volume, coalesce(s.sealed_count, 0), coalesce(s.opened_remain, 0)
    into v_per, v_sealed, v_remain
    from ingredients i left join inventory_states s on s.ingredient_id = i.id
   where i.id = p_ingredient;

  if v_per is null or v_per <= 0 then return 0; end if;

  -- 총량으로 되돌린 뒤 미개봉/개봉으로 다시 쪼갠다. 이래야 "개봉 5,000g" 같은 상태가 안 생긴다.
  v_total  := v_sealed * v_per + v_remain + p_amount;
  v_sealed := floor(v_total / v_per);
  v_remain := v_total - v_sealed * v_per;

  insert into inventory_states (ingredient_id, store_id, sealed_count, opened_count, opened_remain)
  select p_ingredient, i.store_id, v_sealed,
         (case when v_remain > 0 then 1 else 0 end)::smallint, v_remain
    from ingredients i where i.id = p_ingredient
  on conflict (ingredient_id) do update
    set sealed_count  = excluded.sealed_count,
        opened_count  = excluded.opened_count,
        opened_remain = excluded.opened_remain,
        updated_at    = now();

  return p_amount;
end;
$fn$;

-- ── E8 재작성 — 반제품 포함 ───────────────────────────────────
create or replace function public.e8_sales_consumed(p_sales_item uuid)
returns jsonb language plpgsql as $fn$
declare
  it       daily_sales_items%rowtype;
  ds       daily_sales%rowtype;
  v_qty    numeric;
  v_day    date;
  rec      record;
  v_before numeric;
  v_taken  numeric;
  v_short  jsonb := '[]'::jsonb;
  v_lines  int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;
  v_qty := it.qty_hall + it.qty_delivery + it.qty_takeout;

  if exists (select 1 from inventory_events where sales_item_id = p_sales_item and type = 'consume') then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', true, 'lines', 0);
  end if;

  if v_qty <= 0 or it.recipe_id is null then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', false, 'lines', 0);
  end if;

  -- 같은 식재료가 여러 줄(직접 + 반제품 안)에 나올 수 있으므로 합산 후 한 번에 뺀다.
  -- 나눠 빼면 이벤트가 쪼개져 원장이 읽기 어려워지고, 부족 판정도 줄마다 달라진다.
  for rec in
    select n.ingredient_id, sum(n.amount) as need, i.name
      from recipe_ingredient_needs(it.recipe_id, v_qty) n
      join ingredients i on i.id = n.ingredient_id
     group by n.ingredient_id, i.name
  loop
    v_before := stock_total_base(rec.ingredient_id);
    v_taken  := consume_stock(rec.ingredient_id, rec.need);

    -- 부족해도 판매는 취소하지 않는다 — 실제로 팔린 것이다. 대신 **부족분을 돌려준다**.
    -- 화면이 이걸 받아 "재고 기록이 실제와 다를 수 있어요"를 알려야 한다.
    if rec.need > v_before then
      v_short := v_short || jsonb_build_object(
        'ingredient_id', rec.ingredient_id, 'name', rec.name,
        'needed', rec.need, 'available', v_before, 'shortage', rec.need - v_before);
    end if;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
    values
      (it.store_id, rec.ingredient_id, 'consume', -v_taken, p_sales_item,
       it.menu_name || ' ' || v_qty || '개 판매',
       (v_day::timestamp at time zone business_tz()));

    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'duplicate', false,
    'lines', v_lines, 'sold_qty', v_qty, 'shortages', v_short);
end;
$fn$;

-- ── E9 재작성 — 총량 보존 + 후보 재평가 ───────────────────────
create or replace function public.e9_sales_reverted(p_sales_item uuid)
returns jsonb language plpgsql as $fn$
declare
  rec     record;
  v_lines int := 0;
begin
  for rec in
    select ev.ingredient_id, ev.store_id, sum(ev.count_delta) as delta
      from inventory_events ev
     where ev.sales_item_id = p_sales_item and ev.type = 'consume'
     group by ev.ingredient_id, ev.store_id
    having sum(ev.count_delta) < 0
       -- 이미 되돌린 건 두 번 되돌리지 않는다.
       and not exists (
         select 1 from inventory_events r
          where r.sales_item_id = p_sales_item and r.type = 'adjust'
            and r.ingredient_id = ev.ingredient_id)
  loop
    perform restore_stock(rec.ingredient_id, -rec.delta);

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
    values
      (rec.store_id, rec.ingredient_id, 'adjust', -rec.delta, p_sales_item,
       '판매 취소 보정', now());

    -- 재고가 다시 찼으면 발주 후보에서 빠져야 한다. 빠뜨리면 취소한 뒤에도 발주 알림이 남는다.
    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object('sales_item_id', p_sales_item, 'reverted_lines', v_lines);
end;
$fn$;

-- ── E10 재작성 — 하루·메뉴당 한 줄 ────────────────────────────
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
    insert into daily_sales_items
      (store_id, daily_sales_id, recipe_id, menu_name, unit_price,
       qty_hall, qty_delivery, qty_takeout, unit_material_cost, unit_extra_cost, tax_mode)
    values
      (p_store, v_ds, p_recipe, r.name, r.price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, v_mat, v_extra, r.tax_mode)
    returning id into v_item;
  else
    -- 수정 저장 — 먼저 이전 소진을 통째로 되돌리고, 새 수량으로 다시 뺀다.
    -- 차액만 빼면 레시피가 그사이 바뀌었을 때 되돌릴 수 없는 잔차가 남는다.
    perform e9_sales_reverted(v_item);
    delete from inventory_events where sales_item_id = v_item;

    update daily_sales_items set
      qty_hall = p_qty_hall, qty_delivery = p_qty_delivery, qty_takeout = p_qty_takeout,
      unit_price = r.price, unit_material_cost = v_mat, unit_extra_cost = v_extra,
      menu_name = r.name, tax_mode = r.tax_mode
    where id = v_item;
  end if;

  v_consume := e8_sales_consumed(v_item);

  -- 수량 0 은 "그날 안 팔았다"는 뜻이다. 빈 줄을 남기면 목록에 0개짜리 메뉴가 쌓인다.
  if coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0) + coalesce(p_qty_takeout,0) = 0 then
    delete from inventory_events where sales_item_id = v_item;
    delete from daily_sales_items where id = v_item;
    return jsonb_build_object('daily_sales_id', v_ds, 'sales_item_id', null, 'removed', true);
  end if;

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$fn$;

-- 하루·메뉴당 한 줄이라는 계약을 DB 가 직접 지킨다. 함수만 믿으면 직접 insert 로 뚫린다.
delete from daily_sales_items a
 using daily_sales_items b
 where a.daily_sales_id = b.daily_sales_id and a.recipe_id = b.recipe_id
   and a.recipe_id is not null and a.ctid > b.ctid;

create unique index if not exists daily_sales_items_day_recipe_uk
  on daily_sales_items (daily_sales_id, recipe_id) where recipe_id is not null;

select public.assert_no_rpc_overloads();
