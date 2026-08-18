-- ════════════════════════════════════════════════════════════════
-- 0026 · 등록·수정·삭제 API
--
-- 화면의 "저장" 한 번은 대개 **여러 테이블 + 전파**다.
--   레시피 저장 = recipes upsert + recipe_lines 전량 교체 + extra_costs 교체 + E3 재계산
-- 이걸 앱에서 4번의 왕복으로 하면 중간에 끊겼을 때 반쯤 저장된 레시피가 남는다.
-- 그래서 저장 단위를 **하나의 함수 = 하나의 트랜잭션**으로 묶는다.
--
-- 삭제는 원장 보존 원칙(0018)에 따라 **비활성화**가 기본이다. 이미 팔린 메뉴,
-- 이미 입고된 식재료를 물리 삭제하면 과거 손익이 재현되지 않는다.
-- ════════════════════════════════════════════════════════════════

-- ── 매장 소유 확인 ────────────────────────────────────────────
-- RLS 가 이미 막지만, 에러 메시지가 "0 rows"로 나오면 원인을 알 수 없다.
create or replace function public.assert_my_store(p_store uuid)
returns void language plpgsql stable as $fn$
begin
  if not exists (select 1 from stores where id = p_store and owner_id = auth.uid()) then
    raise exception '이 매장에 대한 권한이 없습니다' using errcode = '42501';
  end if;
end;
$fn$;

-- ════════════════ 식재료 (ING-02 / ING-04) ════════════════════
create or replace function public.save_ingredient(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare
  v_id        uuid := nullif(p_payload->>'id', '')::uuid;
  v_old_loss  numeric;
  v_new_loss  numeric := coalesce((p_payload->>'loss_rate')::numeric, 0);
  v_name      text    := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);

  if v_name is null or v_name = '' then
    raise exception '식재료 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'per_volume')::numeric, 0) <= 0 then
    raise exception '개당 용량은 0보다 커야 합니다' using errcode = '22000';
  end if;
  if v_new_loss < 0 or v_new_loss >= 100 then
    raise exception '로스율은 0 이상 100 미만이어야 합니다' using errcode = '22000';
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
      loss_rate, safety_stock, min_order_qty, default_vendor_id, memo, active
    ) values (
      p_store, v_name,
      nullif(p_payload->>'category_id','')::uuid,
      (p_payload->>'base_unit')::base_unit,
      (p_payload->>'per_volume')::numeric,
      v_new_loss,
      coalesce((p_payload->>'safety_stock')::numeric, 0),
      coalesce((p_payload->>'min_order_qty')::numeric, 1),
      nullif(p_payload->>'default_vendor_id','')::uuid,
      nullif(p_payload->>'memo',''),
      true
    ) returning id into v_id;
  else
    select loss_rate into v_old_loss from ingredients where id = v_id and store_id = p_store;
    if not found then
      raise exception '식재료를 찾을 수 없습니다' using errcode = 'P0002';
    end if;

    update ingredients set
      name              = v_name,
      category_id       = nullif(p_payload->>'category_id','')::uuid,
      base_unit         = (p_payload->>'base_unit')::base_unit,
      per_volume        = (p_payload->>'per_volume')::numeric,
      loss_rate         = v_new_loss,
      safety_stock      = coalesce((p_payload->>'safety_stock')::numeric, safety_stock),
      min_order_qty     = coalesce((p_payload->>'min_order_qty')::numeric, min_order_qty),
      default_vendor_id = nullif(p_payload->>'default_vendor_id','')::uuid,
      memo              = nullif(p_payload->>'memo',''),
      updated_at        = now()
    where id = v_id;
  end if;

  -- 안전재고·개당용량이 바뀌면 발주 후보 판정도 바뀐다.
  perform refresh_order_candidate(v_id);

  -- 로스율은 기준단가 공식의 분모다. 바뀌면 이 재료를 쓰는 **모든 레시피의 원가**가 움직인다.
  -- 저장한 화면만 새 값이고 레시피 화면은 옛 값이면 두 개의 진실이 생긴다.
  if v_old_loss is distinct from v_new_loss then
    perform recompute_recipe(r.id, 'material', null)
       from recipes r
      where r.store_id = p_store and r.active
        and exists (select 1 from recipe_lines l where l.recipe_id = r.id and l.ingredient_id = v_id);
  end if;

  return v_id;
end;
$fn$;

-- 원장 보존: 물리 삭제 대신 비활성화. 과거 입고·판매 기록이 그대로 남는다.
create or replace function public.deactivate_ingredient(p_ingredient uuid)
returns void language plpgsql security invoker as $fn$
declare v_used int;
begin
  select count(*) into v_used
    from recipe_lines l join recipes r on r.id = l.recipe_id
   where l.ingredient_id = p_ingredient and r.active;

  if v_used > 0 then
    raise exception '이 식재료를 쓰는 메뉴가 %개 있어요. 메뉴에서 먼저 빼주세요', v_used
      using errcode = '23503';
  end if;

  update ingredients set active = false, updated_at = now() where id = p_ingredient;
  delete from order_candidates where ingredient_id = p_ingredient;
end;
$fn$;

-- ════════════════ 구매 옵션 (ING-05) ══════════════════════════
create or replace function public.save_purchase_option(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare v_id uuid := nullif(p_payload->>'id','')::uuid;
begin
  perform assert_my_store(p_store);

  if coalesce((p_payload->>'volume')::numeric, 0) <= 0 then
    raise exception '용량은 0보다 커야 합니다' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'amount')::numeric, -1) < 0 then
    raise exception '금액은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  if v_id is null then
    insert into purchase_options (store_id, ingredient_id, purchase_name, vendor_id, brand_id, volume, amount, url, hidden)
    values (
      p_store,
      (p_payload->>'ingredient_id')::uuid,
      coalesce(nullif(btrim(p_payload->>'purchase_name'),''), '구매 옵션'),
      nullif(p_payload->>'vendor_id','')::uuid,
      nullif(p_payload->>'brand_id','')::uuid,
      (p_payload->>'volume')::numeric,
      (p_payload->>'amount')::numeric,
      nullif(p_payload->>'url',''),
      false
    ) returning id into v_id;
  else
    update purchase_options set
      purchase_name = coalesce(nullif(btrim(p_payload->>'purchase_name'),''), purchase_name),
      vendor_id     = nullif(p_payload->>'vendor_id','')::uuid,
      brand_id      = nullif(p_payload->>'brand_id','')::uuid,
      volume        = (p_payload->>'volume')::numeric,
      amount        = (p_payload->>'amount')::numeric,
      url           = nullif(p_payload->>'url','')
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '구매 옵션을 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$fn$;

create or replace function public.delete_purchase_option(p_id uuid)
returns void language sql security invoker as $fn$
  delete from purchase_options where id = p_id;
$fn$;

-- ════════════════ 레시피 (RCP-03 / RCP-04) ════════════════════
--
-- 한 번의 저장으로 헤더 + 재료 줄 + 부가 원가를 통째로 교체하고 E3 를 돌린다.
-- 줄은 "부분 수정"이 아니라 **전량 교체**다 — 화면이 보낸 목록이 곧 최종 상태다.
create or replace function public.save_recipe(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
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
                         target_profit_rate, avg_monthly_sales, active)
    values (p_store, v_name,
            (p_payload->>'price')::numeric,
            coalesce((p_payload->>'tax_mode')::tax_mode, 'included'),
            '{}',
            v_servings,
            coalesce((p_payload->>'target_profit_rate')::numeric, 30),
            nullif(p_payload->>'avg_monthly_sales','')::numeric,
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
      updated_at         = now()
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;

  -- 재료 줄 전량 교체 (payload 에 'lines' 키가 있을 때만 — 헤더만 고치는 저장을 위해)
  if p_payload ? 'lines' then
    delete from recipe_lines where recipe_id = v_id;
    for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
      -- 0 인 줄은 저장하지 않는다. 원가에 기여하지 않는 유령 줄이 남으면 혼란스럽다.
      if coalesce((v_line->>'input_qty')::numeric, 0) > 0 then
        -- 자기 자신을 반제품으로 넣으면 원가 계산이 무한 재귀에 빠진다.
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
    insert into recipe_extra_costs (store_id, recipe_id, name, amount_per_serving)
    select p_store, v_id,
           coalesce(nullif(btrim(x->>'name'),''), '기타'),
           coalesce((x->>'amount')::numeric, 0)
      from jsonb_array_elements(p_payload->'extras') x
     where coalesce((x->>'amount')::numeric, 0) <> 0;
  end if;

  -- E3 — 손익 재계산 + profit_trends 파랑 점. 저장 시점부터 추이가 기록된다(절대원칙 4).
  perform e3_recipe_saved(v_id, nullif(p_payload->>'occurred_at','')::date);
  return v_id;
end;
$fn$;

create or replace function public.deactivate_recipe(p_recipe uuid)
returns void language sql security invoker as $fn$
  update recipes set active = false, updated_at = now() where id = p_recipe;
$fn$;

-- ════════════════ 설정 목록 (MY) ══════════════════════════════
create or replace function public.save_category(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare v_id uuid := nullif(p_payload->>'id','')::uuid; v_name text := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '카테고리 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if exists (select 1 from categories where store_id = p_store and lower(btrim(name)) = lower(v_name)
               and (v_id is null or id <> v_id)) then
    raise exception '이미 같은 이름의 카테고리가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into categories (store_id, name, sort_order, default_loss_rate)
    values (p_store, v_name,
            coalesce((p_payload->>'sort_order')::int,
                     (select coalesce(max(sort_order), 0) + 1 from categories where store_id = p_store)),
            coalesce((p_payload->>'default_loss_rate')::numeric, 0))
    returning id into v_id;
  else
    update categories set
      name = v_name,
      sort_order = coalesce((p_payload->>'sort_order')::int, sort_order),
      default_loss_rate = coalesce((p_payload->>'default_loss_rate')::numeric, default_loss_rate)
    where id = v_id and store_id = p_store;
  end if;
  return v_id;
end;
$fn$;

create or replace function public.delete_category(p_id uuid)
returns void language plpgsql security invoker as $fn$
declare v_used int;
begin
  select count(*) into v_used from ingredients where category_id = p_id and active;
  if v_used > 0 then
    raise exception '이 카테고리를 쓰는 식재료가 %개 있어요', v_used using errcode = '23503';
  end if;
  delete from categories where id = p_id;
end;
$fn$;

-- 카테고리 순서 일괄 저장 — 드래그 정렬은 여러 행이 동시에 바뀌므로 한 번에 받는다.
create or replace function public.reorder_categories(p_store uuid, p_ids uuid[])
returns void language plpgsql security invoker as $fn$
begin
  perform assert_my_store(p_store);
  update categories c set sort_order = x.ord
    from (select id, ordinality::int as ord from unnest(p_ids) with ordinality as t(id, ordinality)) x
   where c.id = x.id and c.store_id = p_store;
end;
$fn$;

create or replace function public.save_vendor(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare v_id uuid := nullif(p_payload->>'id','')::uuid; v_name text := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '거래처 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if exists (select 1 from vendors where store_id = p_store and not hidden
               and lower(btrim(name)) = lower(v_name) and (v_id is null or id <> v_id)) then
    raise exception '이미 같은 이름의 거래처가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into vendors (store_id, name, hidden) values (p_store, v_name, false) returning id into v_id;
  else
    update vendors set name = v_name where id = v_id and store_id = p_store;
  end if;
  return v_id;
end;
$fn$;

-- 발주 이력이 있으면 숨김 처리. 지우면 과거 발주의 거래처가 사라진다.
create or replace function public.delete_vendor(p_id uuid)
returns void language plpgsql security invoker as $fn$
begin
  if exists (select 1 from order_records where vendor_id = p_id)
     or exists (select 1 from purchase_options where vendor_id = p_id) then
    update vendors set hidden = true where id = p_id;
  else
    delete from vendors where id = p_id;
  end if;
end;
$fn$;

create or replace function public.save_channel(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare v_id uuid := nullif(p_payload->>'id','')::uuid; v_rate numeric := coalesce((p_payload->>'fee_rate')::numeric, 0);
begin
  perform assert_my_store(p_store);
  if v_rate < 0 or v_rate > 100 then
    raise exception '수수료율은 0에서 100 사이여야 합니다' using errcode = '22000';
  end if;

  if v_id is null then
    insert into sales_channels (store_id, code, name, fee_rate, fee_note, sort_order, active)
    values (p_store,
            coalesce(nullif(p_payload->>'code',''), 'ch_' || substr(md5(random()::text), 1, 8)),
            btrim(p_payload->>'name'), v_rate, nullif(p_payload->>'fee_note',''),
            (select coalesce(max(sort_order), 0) + 1 from sales_channels where store_id = p_store),
            true)
    returning id into v_id;
  else
    update sales_channels set
      name = coalesce(nullif(btrim(p_payload->>'name'),''), name),
      fee_rate = v_rate,
      fee_note = nullif(p_payload->>'fee_note',''),
      active = coalesce((p_payload->>'active')::boolean, active)
    where id = v_id and store_id = p_store;
  end if;
  return v_id;
end;
$fn$;

-- 채널은 지우지 않는다 — 과거 매출의 수수료 근거가 사라지면 손익이 재현되지 않는다.
create or replace function public.retire_channel(p_id uuid)
returns void language sql security invoker as $fn$
  update sales_channels set active = false, retired_at = business_day() where id = p_id;
$fn$;

-- ════════════════ 고정지출 (MY-05) ════════════════════════════
create or replace function public.save_fixed_costs(
  p_store uuid, p_month text, p_total_revenue numeric, p_items jsonb
) returns jsonb language plpgsql security invoker as $fn$
begin
  perform assert_my_store(p_store);
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode = '22000';
  end if;
  if coalesce(p_total_revenue, -1) < 0 then
    raise exception '월 매출은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  insert into fixed_costs_monthly (store_id, month, total_revenue, items, updated_at)
  values (p_store, p_month, p_total_revenue, coalesce(p_items, '[]'::jsonb), now())
  on conflict (store_id, month) do update
    set total_revenue = excluded.total_revenue,
        items         = excluded.items,
        updated_at    = now();

  -- E4 — 고정지출률이 바뀌면 **전 메뉴 손익**이 함께 움직인다.
  return e4_fixed_cost_saved(p_store, p_month);
end;
$fn$;

-- ════════════════ 매출 (SALES-01) ═════════════════════════════
--
-- 화면의 저장 한 번 = 그날 팔린 메뉴 전부. 메뉴마다 E10 을 돌려 재고까지 차감한다.
-- 수량 0 으로 저장하면 그 메뉴는 그날 장부에서 빠지고, 이미 차감된 재고는 E9 로 되돌아간다.
create or replace function public.save_sale(
  p_store uuid, p_date date, p_items jsonb,
  p_etc_revenue numeric default null, p_daily_extra numeric default null
) returns jsonb language plpgsql security invoker as $fn$
declare
  v_item    jsonb;
  v_sales   uuid;
  v_recipes uuid[] := '{}';
  v_dead    uuid;
  v_result  jsonb := '[]'::jsonb;
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
        coalesce((v_item->>'qty_takeout')::numeric, 0)));
  end loop;

  -- 화면에서 지운 메뉴 — 목록에 없으면 0 으로 저장해 재고를 되돌린다.
  -- (이 단계를 빼면 "메뉴를 지웠는데 재고는 그대로"가 된다.)
  for v_dead in
    select it.recipe_id
      from daily_sales_items it join daily_sales ds on ds.id = it.daily_sales_id
     where ds.store_id = p_store and ds.sale_date = p_date
       and it.recipe_id is not null and not (it.recipe_id = any(v_recipes))
  loop
    perform e10_sale_recorded(p_store, p_date, v_dead, 0, 0, 0);
  end loop;

  if p_etc_revenue is not null or p_daily_extra is not null then
    select id into v_sales from daily_sales where store_id = p_store and sale_date = p_date;
    if v_sales is null then
      insert into daily_sales (store_id, sale_date, etc_revenue, daily_extra)
      values (p_store, p_date, coalesce(p_etc_revenue, 0), coalesce(p_daily_extra, 0))
      returning id into v_sales;
    else
      update daily_sales set
        etc_revenue = coalesce(p_etc_revenue, etc_revenue),
        daily_extra = coalesce(p_daily_extra, daily_extra),
        updated_at  = now()
      where id = v_sales;
    end if;
  end if;

  return jsonb_build_object('sale_date', p_date, 'items', v_result);
end;
$fn$;

select public.assert_no_rpc_overloads();
