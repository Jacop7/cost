-- ════════════════════════════════════════════════════════════════
-- 0062 · 오늘 기준은 **더할 수 있다**
--
-- 사장님: "내일부터 뱃지가 맞냐는거지?"
--
-- 맞지 않았다. 스냅샷을 굳히는 이유는 **이미 기록된 숫자**가 뒤늦게 움직이지
-- 않게 하려는 것이다. 그런데 오늘 새로 만든 메뉴는 오늘 기록이 하나도 없다 —
-- 오늘 기준에 더해도 움직일 숫자가 없다. 순수한 추가다. 막을 이유가 없었다.
-- 스냅샷 모델의 부수효과를 규칙인 것처럼 만들어 놓은 것이다.
--
-- 더 흔하고 더 나쁜 경우가 있었다:
--   재료가 떨어져 메뉴를 잠깐 꺼 둔 채 영업을 시작 → 스냅샷에 안 담김
--   → 입고돼서 다시 켜도 **오늘 하루 종일 못 판다**
--
-- 그래서 오늘 기준에 없는 메뉴는 팔 때 **그 시점 값으로 오늘 기준에 더한다.**
-- 기존 항목은 손대지 않으므로 이미 기록된 매출·원가·손익은 그대로다.
-- 한 번 더해지면 그 뒤의 수정은 여전히 다음 영업일부터다.
--
-- ⚠ 종료된 영업일에는 더하지 않는다. 그날 장부는 잠긴 것이다 —
--   고치려면 영업 기록을 다시 열어야 한다.
-- ════════════════════════════════════════════════════════════════

-- ── 레시피 한 벌을 스냅샷 모양으로 ────────────────────────────
-- build_day_snapshot 과 추가 경로가 각자 만들면 언젠가 어긋난다. 한 곳에 둔다.
create or replace function public.recipe_snapshot_entry(p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
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
                         where l.recipe_id = r.id and l.ingredient_id is not null), '[]'::jsonb))
    from recipes r where r.id = p_recipe;
$fn$;

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
      select jsonb_object_agg(r.id::text, recipe_snapshot_entry(r.id))
        from recipes r where r.store_id = p_store and r.active), '{}'::jsonb));
$fn$;

-- ── 오늘 기준에 더한다 ────────────────────────────────────────
create or replace function public.add_to_day_basis(p_store uuid, p_date date, p_recipe uuid)
returns jsonb language plpgsql security invoker as $fn$
declare
  v_day   business_days;
  v_entry jsonb;
begin
  select * into v_day from business_days
   where store_id = p_store and business_date = p_date
   for update;

  if v_day.id is null then
    raise exception '아직 영업을 시작하지 않았어요' using errcode = 'P0003';
  end if;
  if v_day.status = 'closed' then
    raise exception '% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요', p_date
      using errcode = 'P0004';
  end if;

  -- 이미 있으면 그대로 둔다. 다시 넣으면 오늘 기준이 지금 값으로 바뀐다 —
  -- 그게 바로 막으려던 일이다(불변식: 한 번 정해진 기준은 그날 안 움직인다).
  v_entry := v_day.snapshot #> array['recipes', p_recipe::text];
  if v_entry is not null then
    return v_entry;
  end if;

  v_entry := recipe_snapshot_entry(p_recipe);
  if v_entry is null then
    raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  update business_days
     set snapshot = jsonb_set(
           -- 이 메뉴가 쓰는 재료 중 오늘 기준에 없는 것(영업 중에 만든 재료)도 함께 담는다.
           jsonb_set(snapshot, '{ingredients}',
             coalesce(snapshot->'ingredients', '{}'::jsonb) || coalesce((
               select jsonb_object_agg(i.id::text, jsonb_build_object(
                        'name', i.name, 'base_unit', i.base_unit,
                        'unit_price', base_unit_price(i.id)))
                 from recipe_lines l join ingredients i on i.id = l.ingredient_id
                where l.recipe_id = p_recipe and l.ingredient_id is not null
                  and not (coalesce(snapshot->'ingredients', '{}'::jsonb) ? i.id::text)),
               '{}'::jsonb)),
           array['recipes', p_recipe::text], v_entry, true)
   where id = v_day.id;

  return v_entry;
end;
$fn$;

comment on function public.add_to_day_basis(uuid, date, uuid) is
  '오늘 기준에 없는 메뉴를 그 시점 값으로 더한다 — 순수 추가라 이미 기록된 숫자는 안 움직인다(0062).';

-- ── 판매가 막히는 대신 더한다 ─────────────────────────────────
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
  v_added   boolean := false;
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
    -- ⚠ 막지 않고 **더한다**(0062). 오늘 기록이 없는 메뉴라 움직일 숫자가 없다.
    --   영업 중에 만든 새 메뉴, 껐다 다시 켠 메뉴가 여기로 온다.
    v_snap  := add_to_day_basis(p_store, p_date, p_recipe);
    v_added := true;
  end if;

  v_name  := v_snap->>'name';
  v_price := (v_snap->>'price')::numeric;
  v_mat   := coalesce((v_snap->>'material_cost')::numeric, 0);
  v_extra := coalesce((v_snap->>'extra_cost')::numeric, 0);
  v_mode  := coalesce((v_snap->>'tax_mode')::tax_mode, 'included');
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
    -- 오늘 기준에 새로 더해졌는가. 화면이 알릴 거리는 아니지만 검증에는 쓸모가 있다.
    'added_to_basis', v_added,
    'consume', v_consume);
end;
$fn$;

select public.assert_no_rpc_overloads();

-- ════════════════════════════════════════════════════════════════
-- ⚠ 영업일 오류 코드를 바꾼다 — P0003 · P0004 는 **예약 코드**다
--
-- 테스트를 쓰다 걸렸다. `exception when others` 가 P0004 를 못 잡는다.
--   P0003 = too_many_rows
--   P0004 = assert_failure  ← Postgres 문서: others 는 QUERY_CANCELED 와
--                             ASSERT_FAILURE 를 **잡지 않는다**
-- 남의 뜻을 가진 코드를 빌려 쓴 것이고, 그중 하나는 아예 잡히지 않아서
-- 서버 쪽에서 되돌리기·대체 처리를 넣을 수 없었다.
--
-- 표준에서 쓰지 않는 45 클래스로 옮긴다.
--   45001 아직 영업을 시작하지 않았어요
--   45002 그날 영업은 종료됐어요
--
-- 앱은 코드가 아니라 문구로 가려내므로(isNotOpenError·isClosedError) 화면은 그대로다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.add_to_day_basis(p_store uuid, p_date date, p_recipe uuid)
returns jsonb language plpgsql security invoker as $fn$
declare
  v_day   business_days;
  v_entry jsonb;
begin
  select * into v_day from business_days
   where store_id = p_store and business_date = p_date
   for update;

  if v_day.id is null then
    raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001';
  end if;
  if v_day.status = 'closed' then
    raise exception '% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요', p_date
      using errcode = '45002';
  end if;

  -- 이미 있으면 그대로 둔다. 다시 넣으면 오늘 기준이 지금 값으로 바뀐다 —
  -- 그게 바로 막으려던 일이다(불변식: 한 번 정해진 기준은 그날 안 움직인다).
  v_entry := v_day.snapshot #> array['recipes', p_recipe::text];
  if v_entry is not null then
    return v_entry;
  end if;

  v_entry := recipe_snapshot_entry(p_recipe);
  if v_entry is null then
    raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  update business_days
     set snapshot = jsonb_set(
           -- 이 메뉴가 쓰는 재료 중 오늘 기준에 없는 것(영업 중에 만든 재료)도 함께 담는다.
           jsonb_set(snapshot, '{ingredients}',
             coalesce(snapshot->'ingredients', '{}'::jsonb) || coalesce((
               select jsonb_object_agg(i.id::text, jsonb_build_object(
                        'name', i.name, 'base_unit', i.base_unit,
                        'unit_price', base_unit_price(i.id)))
                 from recipe_lines l join ingredients i on i.id = l.ingredient_id
                where l.recipe_id = p_recipe and l.ingredient_id is not null
                  and not (coalesce(snapshot->'ingredients', '{}'::jsonb) ? i.id::text)),
               '{}'::jsonb)),
           array['recipes', p_recipe::text], v_entry, true)
   where id = v_day.id;

  return v_entry;
end;
$fn$;

do $mig$
declare v_src text;
begin
  -- e10 은 위에서 이미 새로 만들었다. 코드만 바꿔 다시 심는다 —
  -- 본문을 한 번 더 적으면 두 벌이 되어 언젠가 어긋난다.
  select pg_get_functiondef('public.e10_sale_recorded(uuid,date,uuid,numeric,numeric,numeric,numeric)'::regprocedure)
    into v_src;
  v_src := replace(v_src, 'errcode = ''P0003''', 'errcode = ''45001''');
  v_src := replace(v_src, 'errcode = ''P0004''', 'errcode = ''45002''');
  execute v_src;
end $mig$;

comment on function public.add_to_day_basis(uuid, date, uuid) is
  '오늘 기준에 없는 메뉴를 그 시점 값으로 더한다 — 순수 추가라 이미 기록된 숫자는 안 움직인다(0062). '
  '45001=영업 미시작 · 45002=종료됨.';

select public.assert_no_rpc_overloads();
