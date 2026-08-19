-- ════════════════════════════════════════════════════════════════
-- 0055 · 세금 항목을 레시피 저장·조회에 태운다
--
-- 0052 가 별도 RPC(save_recipe_tax_items)로 열어 뒀는데, 화면에서는 판매가·모드와
-- 같은 화면에서 고친다. 저장 두 번은 한쪽만 성공하는 순간이 생긴다 —
-- save_recipe 가 payload 로 함께 받는다.
--
-- 검사는 한 곳(assert_tax_items)에 두고 두 진입점이 같이 쓴다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.assert_tax_items(p_items jsonb)
returns jsonb language plpgsql immutable as $fn$
-- ⚠ 변수명은 v_ 로 둔다. 안쪽 select 의 별칭과 같으면 plpgsql 이 "ambiguous" 로 막는다.
declare v_i jsonb;
begin
  if p_items is null then return '[]'::jsonb; end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception '세금 항목은 목록이어야 합니다' using errcode = '22000';
  end if;
  for v_i in select * from jsonb_array_elements(p_items) loop
    if btrim(coalesce(v_i->>'name','')) = '' then
      raise exception '세금 항목 이름을 입력해 주세요' using errcode = '22000';
    end if;
    if coalesce((v_i->>'rate')::numeric, -1) < 0 or (v_i->>'rate')::numeric >= 100 then
      raise exception '세금 요율은 0 이상 100 미만이어야 해요' using errcode = '22000';
    end if;
  end loop;
  -- 이름은 다듬어 저장한다 — 화면에서 온 공백이 그대로 굳지 않게.
  return coalesce((select jsonb_agg(jsonb_build_object(
                     'name', btrim(t->>'name'), 'rate', (t->>'rate')::numeric))
                     from jsonb_array_elements(p_items) t), '[]'::jsonb);
end;
$fn$;

create or replace function public.save_recipe_tax_items(p_store uuid, p_recipe uuid, p_items jsonb)
returns void language plpgsql security invoker as $fn$
begin
  perform assert_my_store(p_store);
  update recipes set tax_items = assert_tax_items(p_items), updated_at = now()
   where id = p_recipe and store_id = p_store;
  if not found then
    raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  -- 세금이 바뀌면 순이익이 바뀐다 — 추이에 점을 남긴다(절대원칙 4).
  perform recompute_recipe(p_recipe, 'recipe');
end;
$fn$;

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
            case when p_payload ? 'tax_items'
                 then assert_tax_items(p_payload->'tax_items') else '[]'::jsonb end,
            v_servings,
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
      -- 키가 있을 때만 바꾼다. 헤더만 고치는 호출이 항목을 지우면 안 된다.
      tax_items          = case when p_payload ? 'tax_items'
                                then assert_tax_items(p_payload->'tax_items') else tax_items end,
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

CREATE OR REPLACE FUNCTION public.recipe_detail(p_recipe uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'price', r.price, 'tax_mode', r.tax_mode,
    -- 세금 항목과 그 내역(0052). 화면이 '(−) 세금'을 펼칠 때 쓴다.
    'tax_items', coalesce(r.tax_items, '[]'::jsonb),
    'tax', tax_of(r.price, r.tax_mode, r.tax_items),
    'tax_breakdown', tax_breakdown(r.price, r.tax_mode, r.tax_items),
    'base_servings', r.base_servings, 'target_profit_rate', r.target_profit_rate,
    'avg_monthly_sales', r.avg_monthly_sales, 'active', coalesce(r.active, true),
    'material_cost', recipe_material_cost(r.id),
    'extra_cost', coalesce((select sum(amount_per_serving) from recipe_extra_costs where recipe_id = r.id), 0),
    'fixed_rate', coalesce(fixed_cost_rate(r.store_id, business_month()), 0),
    'lines', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', rl.id,
               'ingredient_id', rl.ingredient_id,
               'sub_recipe_id', rl.sub_recipe_id,
               'name', coalesce(i.name, sr.name),
               'base_unit', i.base_unit,
               'input_qty', rl.input_qty,
               'per_serving', rl.input_qty / nullif(r.base_servings, 0),
               'stock_total', stock_total_base(rl.ingredient_id),
               -- 반제품은 하위 레시피의 1인분 원가가 단가다.
               'unit_price', coalesce(base_unit_price(rl.ingredient_id), recipe_material_cost(rl.sub_recipe_id))
             ) order by coalesce(i.name, sr.name)), '[]'::jsonb)
      from recipe_lines rl
      left join ingredients i on i.id = rl.ingredient_id
      left join recipes sr on sr.id = rl.sub_recipe_id
      where rl.recipe_id = r.id),
    'extras', (
      select coalesce(jsonb_agg(jsonb_build_object('id', ec.id, 'name', ec.name, 'amount', ec.amount_per_serving)), '[]'::jsonb)
      from recipe_extra_costs ec where ec.recipe_id = r.id),
    'profit_trends', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', pt.trend_date, 'profit_rate', pt.profit_rate,
               'material_rate', pt.material_rate, 'cause', pt.cause) order by pt.trend_date), '[]'::jsonb)
      from profit_trends pt where pt.recipe_id = r.id),
    -- 최근 30일 판매 실적
    'sales_30d', (
      select jsonb_build_object(
               'qty', coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0),
               'revenue', coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
               'waste', coalesce(sum(coalesce(it.qty_waste, 0)), 0))
        from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
       where ds.store_id = r.store_id and it.recipe_id = r.id
         and ds.sale_date > business_day() - 30)
  )
  from recipes r where r.id = p_recipe;
$function$;

select public.assert_no_rpc_overloads();
