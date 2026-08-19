-- ════════════════════════════════════════════════════════════════
-- 0054 · 세금도 그날 값으로 굳는다
--
-- 0052 가 세금 항목을, 0053 이 계산 한 곳을 만들었다. 여기서 스냅샷에 담고
-- 매출 줄에 굳힌다. 재료·부자재·고정지출과 같은 규칙이 된다.
-- ════════════════════════════════════════════════════════════════

-- ── 스냅샷에 세금 항목과 그날 세금액 ──────────────────────────
create or replace function public.build_day_snapshot(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'taken_at', now(),
    'fixed_rate', coalesce(fixed_cost_rate(p_store, business_month()), 0),
    'fixed_items', coalesce(
      (select f.items from fixed_costs_monthly f
        where f.store_id = p_store and f.month = business_month()), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_object_agg(r.id::text, jsonb_build_object(
        'name', r.name,
        'price', r.price,
        'tax_mode', r.tax_mode,
        -- 세금 항목까지 담는다. 나중에 카드 수수료를 고쳐도 그날 세금은 그대로다(0054).
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

-- ── 매출 등록이 그날 세금을 박는다 ────────────────────────────
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
  v_tax     numeric;
  v_mode    tax_mode;
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
    raise exception '오늘 기준에 없는 메뉴예요. 다음 영업일부터 판매할 수 있어요'
      using errcode = '22000';
  end if;

  v_name  := v_snap->>'name';
  v_price := (v_snap->>'price')::numeric;
  v_mat   := coalesce((v_snap->>'material_cost')::numeric, 0);
  v_extra := coalesce((v_snap->>'extra_cost')::numeric, 0);
  v_mode  := coalesce((v_snap->>'tax_mode')::tax_mode, 'included');
  -- 세금도 그날 값이다. 스냅샷에 담긴 게 있으면 그대로, 없으면(옛 스냅샷) 그때 규칙으로.
  v_tax   := coalesce((v_snap->>'tax')::numeric,
                      tax_of(v_price, v_mode, coalesce(v_snap->'tax_items', '[]'::jsonb)));

  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);

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
       unit_material_cost, unit_extra_cost, unit_tax, tax_mode)
    values
      (p_store, v_ds, p_recipe, v_name, v_price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, p_qty_waste,
       v_mat, v_extra, v_tax, v_mode)
    returning id into v_item;
  else
    -- 수량만 고친다. 판매가·원가·세금은 그날 기준이라 재저장으로 바뀌지 않는다.
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
    'unit_price', v_price, 'unit_material_cost', v_mat,
    'unit_extra_cost', v_extra, 'unit_tax', v_tax,
    'consume', v_consume);
end;
$fn$;

-- ── 레시피 상세가 세금 내역을 준다 ────────────────────────────
create or replace function public.recipe_tax_items(p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
  select tax_breakdown(r.price, r.tax_mode, r.tax_items) from recipes r where r.id = p_recipe;
$fn$;

-- ── 빈 세금 항목이 객체로 들어가던 자리 ───────────────────────
-- save_recipe 가 새 메뉴에 '{}' 를 넣었다. text[] 시절의 빈 배열 리터럴인데
-- jsonb 에서는 빈 **객체**여서, 세금 계산이 항목을 훑는 순간 터진다.
update recipes set tax_items = '[]'::jsonb where jsonb_typeof(tax_items) <> 'array';

alter table recipes drop constraint if exists recipes_tax_items_is_array;
alter table recipes add constraint recipes_tax_items_is_array
  check (jsonb_typeof(tax_items) = 'array');

CREATE OR REPLACE FUNCTION public.save_recipe(p_store uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id       uuid := nullif(p_payload->>'id','')::uuid;
  v_name     text := btrim(p_payload->>'name');
  v_servings int  := coalesce((p_payload->>'base_servings')::int, 1);
  v_line     jsonb;
begin
  perform assert_my_store(p_store);

  if v_name is null or v_name = '' then
    raise exception '메뉴 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if v_servings <= 0 then
    raise exception '기준 인분은 1 이상이어야 합니다' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'price')::numeric, -1) < 0 then
    raise exception '판매가는 0 이상이어야 합니다' using errcode = '22000';
  end if;
  if exists (
    select 1 from recipes
     where store_id = p_store and active and lower(btrim(name)) = lower(v_name)
       and (v_id is null or id <> v_id)
  ) then
    raise exception '이미 같은 이름의 메뉴가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into recipes (store_id, name, price, tax_mode, tax_items, base_servings,
                         target_profit_rate, avg_monthly_sales, category_id, active)
    values (p_store, v_name,
            (p_payload->>'price')::numeric,
            coalesce((p_payload->>'tax_mode')::tax_mode, 'included'),
            -- ⚠ '{}' 는 text[] 시절의 빈 배열. jsonb 에서는 빈 **객체**라
            --   jsonb_array_elements 가 터진다(0054).
            '[]'::jsonb, v_servings,
            coalesce((p_payload->>'target_profit_rate')::numeric, 30),
            nullif(p_payload->>'avg_monthly_sales','')::numeric,
            nullif(p_payload->>'category_id','')::uuid,
            true)
    returning id into v_id;
  else
    update recipes set
      name               = v_name,
      price              = (p_payload->>'price')::numeric,
      tax_mode           = coalesce((p_payload->>'tax_mode')::tax_mode, tax_mode),
      base_servings      = v_servings,
      target_profit_rate = coalesce((p_payload->>'target_profit_rate')::numeric, target_profit_rate),
      avg_monthly_sales  = coalesce(nullif(p_payload->>'avg_monthly_sales','')::numeric, avg_monthly_sales),
      category_id        = case when p_payload ? 'category_id'
                                then nullif(p_payload->>'category_id','')::uuid else category_id end,
      active             = coalesce((p_payload->>'active')::boolean, active),
      updated_at         = now()
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;

  if p_payload ? 'lines' then
    delete from recipe_lines where recipe_id = v_id;
    for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
      if coalesce((v_line->>'input_qty')::numeric, 0) > 0 then
        if nullif(v_line->>'sub_recipe_id','')::uuid = v_id then
          raise exception '메뉴가 자기 자신을 재료로 쓸 수 없어요' using errcode = '22000';
        end if;
        insert into recipe_lines (store_id, recipe_id, ingredient_id, sub_recipe_id, input_qty)
        values (p_store, v_id,
                nullif(v_line->>'ingredient_id','')::uuid,
                nullif(v_line->>'sub_recipe_id','')::uuid,
                (v_line->>'input_qty')::numeric);
      end if;
    end loop;
  end if;

  if p_payload ? 'extras' then
    delete from recipe_extra_costs where recipe_id = v_id;
    -- 부자재 마스터를 가리키면 금액은 **마스터 단가 × 수량**이다.
    -- 화면이 보낸 금액을 그대로 믿으면 마스터를 고쳐도 레시피가 옛 값을 붙들고 있게 된다.
    insert into recipe_extra_costs (store_id, recipe_id, material_id, name, qty, amount_per_serving)
    select p_store, v_id,
           nullif(x->>'material_id','')::uuid,
           coalesce(m.name, nullif(btrim(x->>'name'),''), '기타'),
           coalesce((x->>'qty')::numeric, 1),
           case when m.id is not null
                then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                else coalesce((x->>'amount')::numeric, 0) end
      from jsonb_array_elements(p_payload->'extras') x
      left join materials m on m.id = nullif(x->>'material_id','')::uuid
     where coalesce(
             case when m.id is not null then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                  else (x->>'amount')::numeric end, 0) <> 0;
  end if;

  perform e3_recipe_saved(v_id, nullif(p_payload->>'occurred_at','')::date);
  return v_id;
end;
$function$;

-- 계산 쪽도 방어한다 — 배열이 아니면 항목이 없는 것으로 본다.
create or replace function public.tax_of(p_price numeric, p_mode tax_mode, p_items jsonb)
returns numeric language sql immutable as $fn$
  select coalesce(
    case when p_mode = 'included' then p_price * 10 / 110 else 0 end
    + coalesce((select sum(p_price * (i->>'rate')::numeric / 100)
                  from jsonb_array_elements(
                         case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
                 where coalesce((i->>'rate')::numeric, 0) > 0), 0), 0);
$fn$;

create or replace function public.tax_breakdown(p_price numeric, p_mode tax_mode, p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(
    case when p_mode = 'included'
         then jsonb_build_array(jsonb_build_object(
                'name', '부가세', 'rate', 100.0 * 10 / 110, 'amount', p_price * 10 / 110,
                'builtin', true))
         else '[]'::jsonb end
    || coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i->>'name',
                  'rate', (i->>'rate')::numeric,
                  'amount', p_price * (i->>'rate')::numeric / 100,
                  'builtin', false))
                  from jsonb_array_elements(
                         case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
                 where coalesce((i->>'rate')::numeric, 0) > 0), '[]'::jsonb),
    '[]'::jsonb);
$fn$;

select public.assert_no_rpc_overloads();
