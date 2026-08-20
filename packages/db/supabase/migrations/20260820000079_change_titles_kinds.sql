-- ═════════════════════════════════════════════════════════════
-- 0079 · 기록 지점을 용어표와 갈래에 맞춘다
--
-- 제목(기획 §2)
--   메뉴 수정                  → 레시피 수정
--   기준 단가 변경             → 입고 단가 반영
--   입고 취소로 기준 단가 변경 → 입고 취소 반영
--   OO 기준 단가 자동 반영     → 식재료 단가 반영
--   고정 지출 자동 반영        → 고정지출 반영
--
-- 갈래(change_kind)
--   direct   사장님이 친 값   판매가 · 부자재 · 안전재고 …
--   derived  그 결과로 계산된 값  재료비 · 세금 · 순이익 · 기준단가 …
--
-- ⚠ 부자재는 direct 다. 사장님이 직접 담고 빼는 값이다.
--   재료비는 derived 다 — 구성을 고친 결과로 따라 움직인다.
--
-- ⚠ 본문은 현재 정의를 읽어 기계적으로 주입했다.
-- ═════════════════════════════════════════════════════════════

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
      -- ⚠ 기준단가는 사장님이 친 값이 아니라 **계산 결과**다(0078).
      --   개당 용량을 바꾸면 따라 움직인다 — 상세에서 '자동 갱신'으로 묶인다.
      || change_line('unit_price', '기준 단가',   round(v_price0, 4), round(v_price1, 4),
                                                  '원/' || v_before.base_unit::text, 'derived')
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
                         target_profit_rate, avg_monthly_sales, category_id, memo, active)
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
            nullif(p_payload->>'memo',''),
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
      -- ⚠ 키가 있을 때만 바꾼다. 헤더만 고치는 호출이 메모를 지우면 안 된다.
      --   (0063 이 컬럼만 만들고 여기를 빠뜨려, 메모가 아예 저장되지 않았다.)
      memo               = case when p_payload ? 'memo'
                                then nullif(p_payload->>'memo','') else memo end,
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
    perform record_entity_change(p_store, 'recipe', v_id, 'direct', '레시피 등록',
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
      -- ⚠ 부자재는 사장님이 직접 담고 빼는 값이라 direct 다.
      || change_line('extra_cost','부자재',    round(v_ext0, 2), round(v_ext1, 2), '원')
      -- 계산 결과 — 재료 구성·세금 항목을 바꾸면 여기에 드러난다. '자동 갱신'으로 묶인다.
      || change_line('material_cost','재료비', round(v_mat0, 2), round(v_mat1, 2), '원', 'derived')
      || change_line('tax','세금',             round(v_tax0, 2), round(v_tax1, 2), '원', 'derived')
      || change_line('profit','순이익',
                     round(v_before.price - v_mat0 - v_ext0 - v_tax0 - v_rate * v_before.price, 2),
                     round((p_payload->>'price')::numeric - v_mat1 - v_ext1 - v_tax1
                           - v_rate * (p_payload->>'price')::numeric, 2), '원', 'derived')
      into v_ch;

    perform record_entity_change(p_store, 'recipe', v_id, 'direct', '레시피 수정', v_ch, v_money);
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.e1_confirm_inbound(p_order uuid, p_actual_qty numeric DEFAULT NULL::numeric, p_idempotency_key text DEFAULT NULL::text, p_occurred_at date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  o          order_records%rowtype;
  v_qty      numeric;
  v_base     numeric;
  v_per      numeric;
  v_remain   numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_today    date := coalesce(p_occurred_at, business_day());
  v_month    text;
  rec        record;
  -- 수정 내역용(0063) — 한 번의 입고를 하나의 묶음으로 남긴다
  v_corr     uuid := gen_random_uuid();
  v_unit0    text;
  v_mat_before jsonb;
  v_mat0     numeric;
  v_tax0     numeric;
  v_rate0    numeric;
  v_price0   numeric;
begin
  if v_today > business_day() then
    raise exception '미래 날짜로는 입고할 수 없습니다 (요청 %, 오늘 %)', v_today, business_day()
      using errcode = '22000';
  end if;
  v_month := to_char(v_today, 'YYYY-MM');

  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if p_idempotency_key is not null and exists (
    select 1 from inventory_events
     where store_id = o.store_id and idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'order_id', p_order, 'duplicate', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  if o.status = 'canceled' then
    raise exception '취소된 발주는 입고할 수 없어요' using errcode = '22000';
  end if;

  v_remain := o.qty - o.received_qty;
  if v_remain <= 0 then
    return jsonb_build_object(
      'order_id', p_order, 'already_received', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  v_qty := least(coalesce(p_actual_qty, v_remain), v_remain);
  if v_qty <= 0 then
    raise exception '입고 수량은 0보다 커야 합니다' using errcode = '22000';
  end if;

  -- ⚠ 재고는 **그 발주의 팩 용량**으로 환산한다(0072).
  --   전에는 식재료 마스터의 per_volume 을 썼다. 그러면 마스터가 3kg 인데 5kg 짜리를
  --   사 오면 재고는 3,000g 만 늘고 단가는 5,000g 기준으로 매겨져 2,000g 이 증발했다(실측).
  --   단가와 재고가 같은 분모를 써야 `단가 × 재고 = 쓴 돈` 이 성립한다.
  --   마스터 per_volume 은 이제 **기본값**이다 — 발주에 용량이 없을 때만 쓴다.
  select per_volume into v_per from ingredients where id = o.ingredient_id;
  v_base := v_qty * coalesce(nullif(o.volume, 0), v_per, 0);
  v_avg_prev := base_unit_price(o.ingredient_id);

  -- ⚠ 연결 레시피의 재료비는 **입고가 반영되기 전에** 잡아야 한다(0063).
  --   recipe_material_cost 는 지금 단가로 계산하므로, 아래 재고 이벤트가 들어간
  --   뒤에 재면 전후가 같아져 변경이 없는 것으로 보인다.
  select coalesce(jsonb_object_agg(x.recipe_id::text, recipe_material_cost(x.recipe_id)), '{}'::jsonb)
    into v_mat_before
    from (select distinct recipe_id from recipe_lines
           where ingredient_id = o.ingredient_id and store_id = o.store_id) x;

  update order_records
     set received_qty = received_qty + v_qty,
         status = (case when received_qty + v_qty >= qty then 'received' else 'partial' end)::order_status
   where id = p_order;

  insert into inventory_states (ingredient_id, store_id, stock_total, last_inbound_at)
       values (o.ingredient_id, o.store_id, v_base, v_today)
  on conflict (ingredient_id) do update
       set stock_total = inventory_states.stock_total + excluded.stock_total,
           last_inbound_at = greatest(coalesce(inventory_states.last_inbound_at, v_today), v_today);

  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id,
                                idempotency_key, note, occurred_at, unit_normalized)
       values (o.store_id, o.ingredient_id, 'inbound', v_base, p_order, p_idempotency_key,
               v_qty || '개 입고', (v_today::timestamp at time zone business_tz()), true);

  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, v_today, v_unit, p_order);

  if v_avg_prev is not null and v_avg_prev > 0 and v_unit is not null then
    v_spike := v_unit > v_avg_prev * 1.2;
  end if;

  -- ── 단가 변경을 내역에 남긴다(0063) ────────────────────────
  -- ⚠ 실제로 단가가 달라졌을 때만이다. 같은 값으로 또 들어온 입고가
  --   내역을 채우면 사장님이 진짜 변동을 못 찾는다.
  select base_unit::text into v_unit0 from ingredients where id = o.ingredient_id;
  if round(coalesce(v_avg_prev, 0), 4) is distinct from round(coalesce(v_unit, 0), 4) then
    perform record_entity_change(
      o.store_id, 'ingredient', o.ingredient_id, 'inbound', '입고 단가 반영',
      change_line('unit_price', '기준 단가',
                  round(v_avg_prev, 4), round(v_unit, 4), '원/' || v_unit0, 'derived'),
      true, null, v_corr, '입고 확정으로 기준 단가 변경');
  end if;

  v_rate0 := coalesce(fixed_cost_rate(o.store_id, business_month()), 0);

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    v_mat0 := coalesce((v_mat_before->>rec.recipe_id::text)::numeric,
                       recipe_material_cost(rec.recipe_id));
    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;

    perform recompute_recipe(rec.recipe_id, 'material', v_today);

    perform record_entity_change(
      o.store_id, 'recipe', rec.recipe_id, 'ingredient', '식재료 단가 반영',
      change_line('material_cost', '재료비',
                  round(v_mat0, 2), round(recipe_material_cost(rec.recipe_id), 2), '원', 'derived')
      || change_line('profit', '순이익',
                  round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2),
                  round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2), '원', 'derived'),
      true, o.ingredient_id, v_corr,
      (select name from ingredients where id = o.ingredient_id) || ' 기준 단가 변경');
  end loop;

  insert into monthly_pl (store_id, month, material_cost)
       values (o.store_id, v_month, o.amount / nullif(o.qty,0) * v_qty)
  on conflict (store_id, month) do update
       set material_cost = monthly_pl.material_cost + (o.amount / nullif(o.qty,0) * v_qty);

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'duplicate', false, 'already_received', false,
    'received_qty', v_qty, 'unit_price', v_unit, 'price_spike', v_spike);
end;
$function$;

CREATE OR REPLACE FUNCTION public.e11_inbound_reverted(p_order uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  o        order_records%rowtype;
  v_recv   numeric;   -- 되돌릴 **구매단위 개수**
  v_base   numeric := 0;  -- 되돌릴 **기준단위 총량**
  v_taken  numeric;
  v_short  numeric := 0;  -- 재고가 모자라 되돌리지 못한 몫
  v_unit   numeric;
  v_month  text;
  v_day    date := business_day();
  rec      record;
  ev       record;
  -- 수정 내역용(0063)
  v_corr     uuid := gen_random_uuid();
  v_prev     numeric;
  v_unit0    text;
  v_mat_before jsonb;
  v_mat0     numeric;
  v_rate0    numeric;
  v_price0   numeric;
  v_tax0     numeric;
begin
  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if o.received_qty <= 0 then
    return jsonb_build_object('order_id', p_order, 'nothing_to_revert', true, 'reverted_qty', 0);
  end if;

  v_recv := o.received_qty;

  -- 1) 이 발주로 늘어난 재고를 되돌린다.
  --    ⚠ inventory_events.count_delta 는 0034 이후 **기준단위(g)** 다. sealed_count 는 **개수**다.
  --      예전 구현은 개수에서 그램을 빼고 greatest(...,0) 로 잘라 재고를 통째로 날렸다
  --      (2개=2,000g 입고를 취소하면 개수 2 에서 2000 을 빼 0).
  --      consume_stock 은 기준단위를 받아 미개봉/개봉을 알아서 쪼개므로 그대로 쓴다.
  for ev in
    select ingredient_id, sum(count_delta) as delta
      from inventory_events
     where order_record_id = p_order and type = 'inbound'
       and not exists (select 1 from inventory_events r where r.reverses_event_id = inventory_events.id)
     group by ingredient_id
  loop
    v_base  := v_base + ev.delta;
    v_taken := consume_stock(ev.ingredient_id, ev.delta);

    -- 이미 팔려나가 뺄 수 없는 몫. 조용히 0 으로 자르면 사장님은 재고가 왜 안 줄었는지 모른다.
    if v_taken < ev.delta then
      v_short := v_short + (ev.delta - v_taken);
    end if;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, order_record_id, note, occurred_at, unit_normalized)
    values
      (o.store_id, ev.ingredient_id, 'adjust', -v_taken, p_order,
       coalesce(p_reason, '입고 취소 보정')
         || case when v_taken < ev.delta
                 then ' (재고 부족 ' || round(ev.delta - v_taken, 1) || ' 미반영)' else '' end,
       now(), true);
  end loop;

  -- ⚠ 되돌리기 **전** 값을 먼저 잡는다(0063). 아래에서 발주 상태가 바뀌는 순간
  --   base_unit_price 가 이 건을 빼고 다시 계산되므로, 뒤에 재면 전후가 같아진다.
  v_prev := base_unit_price(o.ingredient_id);
  select base_unit::text into v_unit0 from ingredients where id = o.ingredient_id;
  select coalesce(jsonb_object_agg(x.recipe_id::text, recipe_material_cost(x.recipe_id)), '{}'::jsonb)
    into v_mat_before
    from (select distinct recipe_id from recipe_lines
           where ingredient_id = o.ingredient_id and store_id = o.store_id) x;

  -- 2) 발주 상태를 되돌린다. 이 시점부터 base_unit_price 가 이 건을 제외하고 재계산된다.
  update order_records
     set received_qty = 0,
         status = 'ordered'::order_status
   where id = p_order;

  -- 3) 단가가 되돌아간 사실을 추이에 남긴다(과거 점은 그대로 둔다).
  v_unit := base_unit_price(o.ingredient_id);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
         values (o.store_id, o.ingredient_id, v_day, v_unit, p_order);
  end if;

  -- 4) 월 재료비 차감.
  --    ⚠ 여기도 단위다. 개당 금액 × **개수** 여야 한다. 예전엔 기준단위 총량을 곱해
  --      per_volume 배만큼 과다 차감했다(2개 취소인데 2,000개 값을 뺐다).
  v_month := to_char(coalesce(o.ordered_at, v_day), 'YYYY-MM');
  update monthly_pl
     set material_cost = greatest(coalesce(material_cost,0) - (o.amount * v_recv), 0)
   where store_id = o.store_id and month = v_month;

  -- ── 수정 내역(0063) — 취소도 값이 움직인 사건이다 ─────────
  if round(coalesce(v_prev, 0), 4) is distinct from round(coalesce(v_unit, 0), 4) then
    perform record_entity_change(
      o.store_id, 'ingredient', o.ingredient_id, 'inbound', '입고 취소 반영',
      change_line('unit_price', '기준 단가',
                  round(v_prev, 4), round(v_unit, 4), '원/' || v_unit0, 'derived'),
      true, null, v_corr, '취소된 입고를 제외해 기준 단가 변경');
  end if;

  v_rate0 := coalesce(fixed_cost_rate(o.store_id, business_month()), 0);

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    v_mat0 := coalesce((v_mat_before->>rec.recipe_id::text)::numeric,
                       recipe_material_cost(rec.recipe_id));
    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;

    perform recompute_recipe(rec.recipe_id, 'material', v_day);

    perform record_entity_change(
      o.store_id, 'recipe', rec.recipe_id, 'ingredient', '식재료 단가 반영',
      change_line('material_cost', '재료비',
                  round(v_mat0, 2), round(recipe_material_cost(rec.recipe_id), 2), '원', 'derived')
      || change_line('profit', '순이익',
                  round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2),
                  round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2), '원', 'derived'),
      true, o.ingredient_id, v_corr,
      (select name from ingredients where id = o.ingredient_id) || ' 기준 단가 변경');
  end loop;

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'nothing_to_revert', false,
    'reverted_qty', v_recv, 'reverted_base', v_base,
    'shortfall', v_short,
    'unit_price', v_unit, 'status', 'ordered');
end;
$function$;

CREATE OR REPLACE FUNCTION public.e4_fixed_cost_saved(p_store uuid, p_month text, p_prev_rate numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_rate numeric;
  v_rev  numeric;
  v_fix  numeric;
  v_mat  numeric;
  v_day  date;
  rec    record;
  -- 수정 내역용(0063) — 한 번의 고정지출 저장을 하나의 묶음으로
  v_corr  uuid := gen_random_uuid();
  v_rate0 numeric;
  v_ext   numeric;
begin
  -- ⚠ 직전 률은 **저장 직전**에만 알 수 있다. save_fixed_costs 가 잡아 넘겨준다.
  --   스냅샷에서 읽으면 "그날 기준"과 비교하게 돼서, 같은 값을 두 번 저장해도
  --   매번 기록이 쌓인다(실제로 그러했다).
  v_rate0 := p_prev_rate;

  v_rate := fixed_cost_rate(p_store, p_month);

  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;

  -- **그 달의 마지막 날**(오늘을 넘지 않게)에 점을 찍는다.
  -- 과거 월을 수정했는데 오늘 날짜로 점을 찍으면 그 달의 추이가 아니라 오늘 추이가 된다.
  v_day := least((to_date(p_month, 'YYYY-MM') + interval '1 month - 1 day')::date, business_day());

  for rec in select id from recipes where store_id = p_store and coalesce(active, true) loop
    perform recompute_recipe(rec.id, 'fixed', v_day);

    -- ── 수정 내역(0063) ──────────────────────────────────────
    -- 고정지출은 식재료도 레시피도 아니라 원장에 담을 엔터티가 없다.
    -- 영향을 받은 **메뉴 쪽에** 남기고 correlation_id 로 한 묶음으로 묶는다.
    -- ⚠ 률이 실제로 달라졌을 때만이다. 항목 이름만 고친 저장은 기록하지 않는다.
    if v_rate0 is not null and round(v_rate0, 6) is distinct from round(coalesce(v_rate, 0), 6) then
      v_ext := coalesce((select sum(ec.amount_per_serving)
                           from recipe_extra_costs ec where ec.recipe_id = rec.id), 0);
      perform record_entity_change(
        p_store, 'recipe', rec.id, 'fixed_cost', '고정지출 반영',
        (select
           change_line('fixed_rate', '고정지출률',
                       round(v_rate0 * 100, 2), round(coalesce(v_rate, 0) * 100, 2), '%', 'derived')
           || change_line('fixed_cost', '개당 고정비',
                       round(v_rate0 * r.price, 2), round(coalesce(v_rate, 0) * r.price, 2), '원', 'derived')
           || change_line('profit', '순이익',
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items) - v_rate0 * r.price, 2),
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items)
                             - coalesce(v_rate, 0) * r.price, 2), '원', 'derived')
           from recipes r where r.id = rec.id),
        true, null, v_corr, '고정지출률 변경');
    end if;
  end loop;

  select coalesce(sum(material_cost),0) into v_mat
    from monthly_pl where store_id = p_store and month = p_month;

  insert into monthly_pl (store_id, month, revenue, fixed_cost, material_cost)
       values (p_store, p_month, coalesce(v_rev,0), coalesce(v_fix,0), coalesce(v_mat,0))
  on conflict (store_id, month) do update
       set revenue = excluded.revenue,
           fixed_cost = excluded.fixed_cost;

  return jsonb_build_object('month', p_month, 'rate', v_rate, 'revenue', v_rev, 'fixed', v_fix);
end;
$function$;

select public.assert_no_rpc_overloads();
