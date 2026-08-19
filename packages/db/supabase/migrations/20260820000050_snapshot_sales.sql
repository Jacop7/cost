-- ════════════════════════════════════════════════════════════════
-- 0050 · 매출·소진이 **영업 시작 스냅샷**을 쓴다
--
-- 사장님 명세:
--   영업 시작   이 시점의 판매가·레시피 구성·식재료 단가·부자재·고정지출을
--               오늘 기준으로 확정
--   영업 중     마스터는 자유롭게 수정. 레시피 화면에는 수정값이 보인다.
--               **오늘 매출·원가·손익은 영업 시작 기준을 계속 사용**
--   브레이크    같은 영업일·같은 기준값 유지
--   영업 종료   오늘 판매량·매출·원가·세부항목을 마감하고 잠금
--   다음 영업일 그동안 수정된 최종값으로 새 기준 생성
--
-- 0048/0049 가 스냅샷을 **만들기만** 했다. 여기서 실제로 **쓰게** 한다.
-- 이게 붙어야 "영업 중 수정이 오늘 매출에 반영 안 됨"이 동작한다.
--
-- ⚠ 영업일이 없으면 판매를 받지 않는다. 화면이 "오늘 영업을 시작할까요?"
--   컨펌을 띄우고 open_business_day 를 부른 뒤 다시 저장한다.
-- ════════════════════════════════════════════════════════════════

-- ── 그 날짜의 영업일 (없으면 null) ────────────────────────────
create or replace function public.business_day_of(p_store uuid, p_date date)
returns business_days language sql stable security invoker as $fn$
  select * from business_days where store_id = p_store and business_date = p_date;
$fn$;

-- ── 스냅샷에서 그 메뉴의 기준값 ───────────────────────────────
create or replace function public.day_recipe_snapshot(p_store uuid, p_date date, p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
  select b.snapshot #> array['recipes', p_recipe::text]
    from business_days b
   where b.store_id = p_store and b.business_date = p_date;
$fn$;

comment on function public.day_recipe_snapshot(uuid, date, uuid) is
  '그날 기준의 메뉴 값(판매가·재료 구성·부자재·세금). 영업 시작 시점에 굳은 값이다(0050).';

-- ── 스냅샷 기준 1인분 재료 소요량 ─────────────────────────────
-- recipe_ingredient_needs 는 **현재** 레시피를 본다. 그날 소진은 그날 기준이어야 한다.
create or replace function public.day_ingredient_needs(
  p_store uuid, p_date date, p_recipe uuid, p_servings numeric
) returns table (ingredient_id uuid, amount numeric)
language sql stable security invoker as $fn$
  select (l->>'ingredient_id')::uuid,
         (l->>'per_serving')::numeric * p_servings
    from jsonb_array_elements(
           coalesce(day_recipe_snapshot(p_store, p_date, p_recipe) -> 'lines', '[]'::jsonb)) l
   where coalesce((l->>'per_serving')::numeric, 0) > 0;
$fn$;

-- ── 소진 대조를 스냅샷 기준으로 ───────────────────────────────
create or replace function public.reconcile_sales_consumption(
  p_sales_item uuid, p_zero boolean default false
) returns jsonb language plpgsql as $fn$
declare
  it       daily_sales_items%rowtype;
  ds       daily_sales%rowtype;
  v_sold   numeric;
  v_waste  numeric;
  v_day    date;
  v_bday   uuid;
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
  v_day  := ds.sale_date;
  v_bday := ds.business_day_id;

  if p_zero or it.recipe_id is null then
    v_sold := 0; v_waste := 0;
  else
    v_sold  := it.qty_hall + it.qty_delivery + it.qty_takeout;
    v_waste := coalesce(it.qty_waste, 0);
  end if;

  for rec in
    -- ⚠ 필요량은 **그날 스냅샷**에서 온다. 영업 중에 레시피를 고쳐도
    --   이미 판 몫의 소진이 새 구성으로 덮이지 않는다(실측: 대파 250g → 500g 로 덮였다).
    with target as (
      select n.ingredient_id, false as waste, sum(n.amount) as need
        from day_ingredient_needs(ds.store_id, v_day, it.recipe_id, v_sold) n group by 1
      union all
      select n.ingredient_id, true, sum(n.amount)
        from day_ingredient_needs(ds.store_id, v_day, it.recipe_id, v_waste) n group by 1
    ),
    applied as (
      select ev.ingredient_id, ev.waste, -sum(ev.count_delta) as taken
        from inventory_events ev
       where ev.sales_item_id = p_sales_item
       group by 1, 2
    )
    select coalesce(t.ingredient_id, a.ingredient_id) as ingredient_id,
           coalesce(t.waste, a.waste)                 as waste,
           coalesce(t.need, 0)                        as need,
           coalesce(a.taken, 0)                       as taken,
           i.name
      from target t
      full join applied a
        on a.ingredient_id = t.ingredient_id and a.waste = t.waste
      join ingredients i on i.id = coalesce(t.ingredient_id, a.ingredient_id)
  loop
    v_delta := rec.need - rec.taken;
    if abs(v_delta) < 1e-9 then continue; end if;

    if v_delta > 0 then
      v_before := stock_total_base(rec.ingredient_id);
      v_taken  := consume_stock(rec.ingredient_id, v_delta);

      if v_delta > v_before then
        v_short := v_short || jsonb_build_object(
          'ingredient_id', rec.ingredient_id, 'name', rec.name,
          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before);
      end if;

      if v_taken > 0 then
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, volume_delta,
         sales_item_id, waste, note, occurred_at, business_day_id)
      values
        (it.store_id, rec.ingredient_id,
         (case when rec.waste then 'discard' else 'consume' end)::inventory_event_type,
         -v_taken,
         case when rec.waste then v_taken end,
         p_sales_item, rec.waste,
         it.menu_name || ' ' ||
         case when rec.waste then v_waste || '개 조리 후 폐기' else v_sold || '개 판매 소진' end,
         (v_day::timestamp at time zone business_tz()), v_bday);
      end if;
    else
      perform restore_stock(rec.ingredient_id, -v_delta);
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, waste, note, occurred_at, business_day_id)
      values
        (it.store_id, rec.ingredient_id, 'adjust', -v_delta, p_sales_item, rec.waste,
         case when rec.waste then
                case when v_waste = 0 then it.menu_name || ' 조리 후 폐기 취소'
                     else it.menu_name || ' 조리 후 폐기 수량 조정 (' || v_waste || '개)' end
              else
                case when v_sold = 0 then it.menu_name || ' 판매 취소 보정'
                     else it.menu_name || ' 판매 수량 조정 (' || v_sold || '개)' end
         end,
         (v_day::timestamp at time zone business_tz()), v_bday);
    end if;

    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'lines', v_lines,
    'sold_qty', v_sold, 'waste_qty', v_waste, 'shortages', v_short);
end;
$fn$;

-- ── 매출 등록이 스냅샷 값을 쓴다 ──────────────────────────────
create or replace function public.e10_sale_recorded(
  p_store uuid, p_date date, p_recipe uuid,
  p_qty_hall numeric default 0, p_qty_delivery numeric default 0,
  p_qty_takeout numeric default 0, p_qty_waste numeric default 0
) returns jsonb language plpgsql as $fn$
declare
  v_ds      uuid;
  v_item    uuid;
  v_bday    business_days;
  v_snap    jsonb;
  v_name    text;
  v_price   numeric;
  v_mat     numeric;
  v_extra   numeric;
  v_tax     tax_mode;
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

  -- ── 영업일이 있어야 판매를 받는다 ────────────────────────────
  v_bday := business_day_of(p_store, p_date);
  if v_bday.id is null then
    raise exception '아직 영업을 시작하지 않았어요' using errcode = 'P0003';
  end if;
  if v_bday.status = 'closed' then
    raise exception '% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요', p_date
      using errcode = 'P0004';
  end if;

  v_snap := v_bday.snapshot #> array['recipes', p_recipe::text];
  if v_snap is null then
    -- 영업 시작 뒤에 만든 메뉴는 오늘 기준값이 없다. 내일부터 팔 수 있다.
    raise exception '오늘 기준에 없는 메뉴예요. 다음 영업일부터 판매할 수 있어요'
      using errcode = '22000';
  end if;

  v_name  := v_snap->>'name';
  v_price := (v_snap->>'price')::numeric;
  v_mat   := coalesce((v_snap->>'material_cost')::numeric, 0);
  v_extra := coalesce((v_snap->>'extra_cost')::numeric, 0);
  v_tax   := coalesce((v_snap->>'tax_mode')::tax_mode, 'included');

  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);

  -- ── 팔 수 없는 메뉴는 막는다(0046) ─────────────────────────
  -- ⚠ 수량이 0 이면 막지 않는다. 이미 적어 둔 판매를 지우는 것도 저장이라,
  --   막았다가는 재고가 바닥난 메뉴의 오입력을 영영 못 지운다.
  if v_total > 0 then
    if not coalesce((select active from recipes where id = p_recipe), true) then
      raise exception '%은(는) 판매 중지된 메뉴예요. 레시피에서 판매를 다시 켜 주세요', v_name
        using errcode = '22000';
    end if;
    declare v_blocked text := recipe_blocked_by(p_recipe);
    begin
      if v_blocked is not null then
        raise exception '%이(가) 없어서 %을(를) 만들 수 없어요. 식재료에서 재고를 먼저 맞춰 주세요',
          v_blocked, v_name using errcode = '22000';
      end if;
    end;
  end if;

  insert into daily_sales (store_id, sale_date, business_day_id) values (p_store, p_date, v_bday.id)
  on conflict (store_id, sale_date)
    do update set updated_at = now(), business_day_id = excluded.business_day_id
  returning id into v_ds;

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
      (p_store, v_ds, p_recipe, v_name, v_price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, p_qty_waste,
       v_mat, v_extra, v_tax)
    returning id into v_item;
  else
    -- ⚠ 수량만 고친다. 원가·판매가는 그날 기준이라 재저장으로 바뀌지 않는다.
    --   예전에는 여기서 현재 레시피 값으로 덮어써서, 입고 한 번에 아침에 판 것의
    --   원가까지 소급됐다(실측: 2,806.40 → 2,971.92).
    update daily_sales_items set
      qty_hall = p_qty_hall, qty_delivery = p_qty_delivery,
      qty_takeout = p_qty_takeout, qty_waste = p_qty_waste
    where id = v_item;
  end if;

  perform touch_business_day(p_store);
  v_consume := reconcile_sales_consumption(v_item, false);

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'business_day_id', v_bday.id,
    'unit_price', v_price, 'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$fn$;

select public.assert_no_rpc_overloads();
