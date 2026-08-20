-- ═════════════════════════════════════════════════════════════
-- 0064 · 저장이 수정 내역을 함께 남긴다
--
-- 원본 수정과 기록은 **같은 트랜잭션**이어야 한다. 따로 두면 한쪽만 성공하는
-- 순간이 생기고, 그때부터 내역이 장부와 다른 말을 한다.
--
-- ⚠ 본문은 손으로 옮겨 적지 않았다. 현재 정의를 읽어 기계적으로 주입했다 —
--   두 벌이 되면 언젠가 어긋난다(세금이 다섯 곳에 흩어져 겪었다).
-- ═════════════════════════════════════════════════════════════

-- 이름을 그대로 보여 주기 위한 작은 조회 둘. id 를 내여놓으면 사장님이 읽을 수 없다.
create or replace function public.category_name(p_id uuid)
returns text language sql stable security invoker as $fn$
  select name from categories where id = p_id;
$fn$;

create or replace function public.vendor_name(p_id uuid)
returns text language sql stable security invoker as $fn$
  select name from vendors where id = p_id;
$fn$;

CREATE OR REPLACE FUNCTION public.save_ingredient(p_store uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id        uuid := nullif(p_payload->>'id', '')::uuid;
  v_name      text    := btrim(p_payload->>'name');
  -- 수정 내역용 — 고치기 전 모습과 그때 기준단가(0063)
  v_before    ingredients;
  v_price0    numeric;
  v_price1    numeric;
  v_ch        jsonb := '[]'::jsonb;
  v_new       boolean;
begin
  perform assert_my_store(p_store);

  v_new := v_id is null;
  if not v_new then
    select * into v_before from ingredients where id = v_id and store_id = p_store;
    v_price0 := base_unit_price(v_id);
  end if;

  if v_name is null or v_name = '' then
    raise exception '식재료 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'per_volume')::numeric, 0) <= 0 then
    raise exception '개당 용량은 0보다 커야 합니다' using errcode = '22000';
  end if;

  -- 같은 매장에 같은 이름이 둘이면 어느 쪽 재고인지 사장님이 구분할 수 없다.
  if exists (
    select 1 from ingredients
     where store_id = p_store and active and lower(btrim(name)) = lower(v_name)
       and (v_id is null or id <> v_id)
  ) then
    raise exception '이미 같은 이름의 식재료가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into ingredients (
      store_id, name, category_id, base_unit, per_volume,
      safety_stock, min_order_qty, default_vendor_id, memo, active
    ) values (
      p_store, v_name,
      nullif(p_payload->>'category_id','')::uuid,
      (p_payload->>'base_unit')::base_unit,
      (p_payload->>'per_volume')::numeric,
      coalesce((p_payload->>'safety_stock')::numeric, 0),
      coalesce((p_payload->>'min_order_qty')::numeric, 1),
      nullif(p_payload->>'default_vendor_id','')::uuid,
      nullif(p_payload->>'memo',''),
      true
    ) returning id into v_id;
  else
    perform 1 from ingredients where id = v_id and store_id = p_store;
    if not found then
      raise exception '식재료를 찾을 수 없습니다' using errcode = 'P0002';
    end if;

    update ingredients set
      name              = v_name,
      category_id       = nullif(p_payload->>'category_id','')::uuid,
      base_unit         = (p_payload->>'base_unit')::base_unit,
      per_volume        = (p_payload->>'per_volume')::numeric,
      safety_stock      = coalesce((p_payload->>'safety_stock')::numeric, safety_stock),
      min_order_qty     = coalesce((p_payload->>'min_order_qty')::numeric, min_order_qty),
      default_vendor_id = nullif(p_payload->>'default_vendor_id','')::uuid,
      memo              = nullif(p_payload->>'memo',''),
      updated_at        = now()
    where id = v_id;
  end if;

  -- 안전재고·개당용량이 바뀌면 발주 후보 판정도 바뀐다.
  perform refresh_order_candidate(v_id);

  -- ── 수정 내역(0063) ────────────────────────────────────────
  -- ⚠ 실제로 달라진 필드만 남긴다. 같은 값 저장이 내역을 더럽히면
  --   사장님이 진짜 변경을 못 찾는다.
  if v_new then
    perform record_entity_change(p_store, 'ingredient', v_id, 'direct', '식재료 등록',
      jsonb_build_array(jsonb_build_object(
        'key', 'created', 'label', '등록', 'before', null, 'after', v_name, 'unit', null)),
      false);
  else
    v_price1 := base_unit_price(v_id);
    select
      change_line('name',          '이름',        v_before.name,          v_name)
      || change_line('category_id','카테고리',    category_name(v_before.category_id),
                                                  category_name(nullif(p_payload->>'category_id','')::uuid))
      || change_line('base_unit',  '기준단위',    v_before.base_unit::text,
                                                  (p_payload->>'base_unit'))
      || change_line('per_volume', '개당 용량',   v_before.per_volume,
                                                  (p_payload->>'per_volume')::numeric,
                                                  v_before.base_unit::text)
      || change_line('safety_stock','안전재고',   v_before.safety_stock,
                                                  coalesce((p_payload->>'safety_stock')::numeric, v_before.safety_stock))
      || change_line('min_order_qty','최소 발주량', v_before.min_order_qty,
                                                  coalesce((p_payload->>'min_order_qty')::numeric, v_before.min_order_qty))
      || change_line('default_vendor_id','기본 구매처', vendor_name(v_before.default_vendor_id),
                                                  vendor_name(nullif(p_payload->>'default_vendor_id','')::uuid))
      || change_line('memo',       '메모',        v_before.memo, nullif(p_payload->>'memo',''))
      -- 기준단가는 직접 고치는 값이 아니지만, 개당 용량을 바꾸면 따라 움직인다.
      || change_line('unit_price', '기준 단가',   round(v_price0, 4), round(v_price1, 4),
                                                  '원/' || v_before.base_unit::text)
      into v_ch;

    perform record_entity_change(p_store, 'ingredient', v_id, 'direct', '식재료 수정',
      v_ch, v_price0 is distinct from v_price1);
  end if;


  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_recipe(p_store uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id       uuid := nullif(p_payload->>'id','')::uuid;
  v_name     text := btrim(p_payload->>'name');
  v_servings int  := coalesce((p_payload->>'base_servings')::int, 1);
  v_line     jsonb;
  -- 수정 내역용(0063)
  v_before   recipes;
  v_mat0     numeric;
  v_ext0     numeric;
  v_tax0     numeric;
  v_mat1     numeric;
  v_ext1     numeric;
  v_tax1     numeric;
  v_rate     numeric;
  v_ch       jsonb := '[]'::jsonb;
  v_money    boolean;
  v_new      boolean;
begin
  perform assert_my_store(p_store);

  v_new := v_id is null;
  if not v_new then
    select * into v_before from recipes where id = v_id and store_id = p_store;
    v_mat0 := recipe_material_cost(v_id);
    v_ext0 := coalesce((select sum(ec.amount_per_serving)
                          from recipe_extra_costs ec where ec.recipe_id = v_id), 0);
    v_tax0 := tax_of(v_before.price, v_before.tax_mode, v_before.tax_items);
  end if;

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
  -- ── 수정 내역(0063) ────────────────────────────────────────
  if v_new then
    perform record_entity_change(p_store, 'recipe', v_id, 'direct', '메뉴 등록',
      jsonb_build_array(jsonb_build_object(
        'key', 'created', 'label', '등록', 'before', null, 'after', v_name, 'unit', null)),
      false);
  else
    v_mat1 := recipe_material_cost(v_id);
    v_ext1 := coalesce((select sum(ec.amount_per_serving)
                          from recipe_extra_costs ec where ec.recipe_id = v_id), 0);
    select tax_of(price, tax_mode, tax_items) into v_tax1 from recipes where id = v_id;
    v_rate := coalesce(fixed_cost_rate(p_store, business_month()), 0);

    v_money := (v_before.price is distinct from (p_payload->>'price')::numeric)
            or (round(v_mat0, 4) is distinct from round(v_mat1, 4))
            or (round(v_ext0, 4) is distinct from round(v_ext1, 4))
            or (round(v_tax0, 4) is distinct from round(v_tax1, 4));

    select
      change_line('name',   '이름',   v_before.name, v_name)
      || change_line('memo', '메모',  v_before.memo, nullif(p_payload->>'memo',''))
      || change_line('price','판매가', v_before.price, (p_payload->>'price')::numeric, '원')
      || change_line('base_servings','기준 인분', v_before.base_servings, v_servings, '인분')
      || change_line('target_profit_rate','목표 순이익률', v_before.target_profit_rate,
                     coalesce((p_payload->>'target_profit_rate')::numeric, v_before.target_profit_rate), '%')
      || change_line('avg_monthly_sales','월 평균 판매량', v_before.avg_monthly_sales,
                     coalesce(nullif(p_payload->>'avg_monthly_sales','')::numeric, v_before.avg_monthly_sales), '개')
      || change_line('active','판매 상태',
                     case when v_before.active then '판매중' else '판매중지' end,
                     case when coalesce((p_payload->>'active')::boolean, v_before.active)
                          then '판매중' else '판매중지' end)
      -- 계산값 — 재료 구성·부자재·세금 항목을 바꾸면 여기에 결과로 드러난다.
      || change_line('material_cost','재료비', round(v_mat0, 2), round(v_mat1, 2), '원')
      || change_line('extra_cost','부자재',    round(v_ext0, 2), round(v_ext1, 2), '원')
      || change_line('tax','세금',             round(v_tax0, 2), round(v_tax1, 2), '원')
      || change_line('profit','순이익',
                     round(v_before.price - v_mat0 - v_ext0 - v_tax0 - v_rate * v_before.price, 2),
                     round((p_payload->>'price')::numeric - v_mat1 - v_ext1 - v_tax1
                           - v_rate * (p_payload->>'price')::numeric, 2), '원')
      into v_ch;

    perform record_entity_change(p_store, 'recipe', v_id, 'direct', '메뉴 수정', v_ch, v_money);
  end if;

  return v_id;
end;
$function$;

select public.assert_no_rpc_overloads();
