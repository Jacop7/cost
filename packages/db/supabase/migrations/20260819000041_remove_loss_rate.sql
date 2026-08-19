-- ════════════════════════════════════════════════════════════════
-- 0041 · 로스율 제거 — 추정을 버리고 실제 폐기만 센다
--
-- 사장님 결정:
--   "로스율 없애고, 사용자가 식재료 수정에서 폐기할 때 또는 매출에서 판매 처리할 때
--    해당 메뉴 폐기 시 연결된 식재료 폐기하면 되지?"
--   "대파 1kg 사서 뿌리·겉잎 다듬으면 850g — 이것까지는 1차 버전에서 고려하지 않는다."
--
-- ── 무엇이 바뀌나 ────────────────────────────────────────────
-- 기준단가에서 `÷ (1 − 로스율)` 을 걷어낸다. 산 값 그대로가 단가다.
--   대파 4,000원/1,000g → 4.7059원/g 이던 것이 **4.0000원/g** 이 된다.
-- 손실은 추정하지 않고 **실제로 버릴 때만** 기록한다. 경로는 둘이다.
--   ① 식재료 폐기(E2)      — 쉬어서 버림. 사장님이 직접 입력.
--   ② 조리 폐기(qty_waste) — 만들어 놓고 못 판 음식. 매출 등록에서 입력.
-- 둘 다 재고에서 빠지고 월 손익의 폐기 손실로 잡힌다.
--
-- ── 1차 범위 밖으로 명시하는 것 (사장님 결정) ────────────────
-- **손질 손실**은 잡지 않는다. 대파 1kg 을 다듬어 850g 을 쓰더라도 150g 은
-- 어디에도 기록되지 않는다. 그 결과 아래 둘을 감수한다.
--   · 월 53,240원(실측, 2026-08 기준)이 원가에 잡히지 않는다.
--     기록된 폐기 전부(월 29,930원)보다 큰 금액이다.
--   · 장부 재고가 물리 재고보다 많아진다(대파 장부 2,040g).
--     소진할 때마다 다듬어 버린 만큼 벌어진다.
-- 2차에서 입고 실측량 입력이나 손질 폐기 입력으로 닫을 수 있다.
--
-- ── 손익 영향 (실측) ────────────────────────────────────────
--   제육볶음 33.49% → 33.72%,  계란말이 39.34% → 40.11%
--   전 메뉴 +0.15 ~ +0.77%p. 로스를 지던 재료의 원가 비중이 작아 영향은 작다.
-- ════════════════════════════════════════════════════════════════

-- ── base_unit_price ─────────────────────────────
create or replace function public.base_unit_price(p_ingredient uuid)
returns numeric language plpgsql stable as $fn$
declare v_avg numeric;
begin
  -- 가중치는 **실제로 들어온 수량**이다. 발주만 하고 안 온 물량이 평균을 끌면
  -- 아직 존재하지도 않는 재고의 가격이 원가에 섞인다.
  select case when sum(received_qty) > 0
              then sum((amount / nullif(volume,0)) * received_qty) / sum(received_qty)
         end
    into v_avg
    from order_records
   where ingredient_id = p_ingredient and status in ('received','partial');

  -- 로스로 나누지 않는다(0041). 산 값 그대로가 기준단가다.
  -- 버린 것은 폐기 이벤트로 재고에서 빠지고 월 손익의 폐기 손실로 잡힌다.
  return v_avg;
end;
$fn$;

-- ── ingredient_list ─────────────────────────────
drop function if exists public.ingredient_list(uuid);

CREATE OR REPLACE FUNCTION public.ingredient_list(p_store uuid)
 RETURNS TABLE(id uuid, name text, category_name text, base_unit base_unit, per_volume numeric, safety_stock numeric, vendor_name text, memo text, stock_total numeric, base_price numeric, soon_out boolean, last_inbound_at date)
 LANGUAGE sql
 STABLE
AS $function$
  select
    i.id,
    i.name,
    c.name                              as category_name,
    i.base_unit,
    i.per_volume,
    i.safety_stock,
    v.name                              as vendor_name,
    i.memo,
    coalesce(stock_total_base(i.id), 0) as stock_total,
    base_unit_price(i.id)               as base_price,   -- null 을 0 으로 바꾸지 않는다(산출 불가 ≠ 0원)
    coalesce(s.soon_out, false)         as soon_out,
    s.last_inbound_at
  from ingredients i
  left join categories c on c.id = i.category_id
  left join vendors    v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.store_id = p_store and coalesce(i.active, true)
  order by i.name;
$function$;

-- ── ingredient_detail ─────────────────────────────
CREATE OR REPLACE FUNCTION public.ingredient_detail(p_ingredient uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'category_id', i.category_id,
    'category_name', c.name,
    'base_unit', i.base_unit,
    'per_volume', i.per_volume,
    'safety_stock', i.safety_stock,
    'min_order_qty', i.min_order_qty,
    'memo', i.memo,
    'default_vendor_id', i.default_vendor_id,
    'vendor_name', v.name,
    'stock_total', coalesce(stock_total_base(i.id), 0),
    'sealed_count', coalesce(s.sealed_count, 0),
    'opened_remain', coalesce(s.opened_remain, 0),
    'soon_out', coalesce(s.soon_out, false),
    'last_inbound_at', s.last_inbound_at,
    'base_price', base_unit_price(i.id),
    -- 화면의 avg/low/high 는 저장 컬럼이 아니라 **이 집계**다.
    'purchase', (
      select jsonb_build_object(
        'avg',  case when sum(o.received_qty) > 0
                     then sum((o.amount / nullif(o.volume,0)) * o.received_qty) / sum(o.received_qty) end,
        'low',  min(o.amount / nullif(o.volume,0)),
        'high', max(o.amount / nullif(o.volume,0)),
        'count', count(*))
      from order_records o
      where o.ingredient_id = i.id and o.status in ('received','partial')),
    'price_trends', (
      select coalesce(jsonb_agg(jsonb_build_object('date', t.trend_date, 'price', t.unit_price)
                                order by t.trend_date), '[]'::jsonb)
      from price_trends t where t.ingredient_id = i.id),
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', po.id, 'url', po.url, 'name', po.purchase_name,
               'vendor_id', po.vendor_id,
               'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name)
             order by po.amount / nullif(po.volume,0)), '[]'::jsonb)
      from purchase_options po left join vendors pv on pv.id = po.vendor_id
      where po.ingredient_id = i.id and not po.hidden),
    -- 최근 발주 이력 — ING-03 의 "구매 이력" 목록.
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ordered_at', o.ordered_at, 'status', o.status,
               'volume', o.volume, 'amount', o.amount, 'qty', o.qty,
               'received_qty', o.received_qty, 'vendor_name', ov.name,
               'unit_price', o.amount / nullif(o.volume, 0))
             order by o.ordered_at desc), '[]'::jsonb)
      from (select * from order_records where ingredient_id = i.id order by ordered_at desc limit 20) o
      left join vendors ov on ov.id = o.vendor_id)
  )
  from ingredients i
  left join categories c on c.id = i.category_id
  left join vendors    v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.id = p_ingredient;
$function$;

-- ── save_ingredient ─────────────────────────────
CREATE OR REPLACE FUNCTION public.save_ingredient(p_store uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id        uuid := nullif(p_payload->>'id', '')::uuid;
  v_name      text    := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);

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


  return v_id;
end;
$function$;

-- ── save_category ─────────────────────────────
CREATE OR REPLACE FUNCTION public.save_category(p_store uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_id   uuid := nullif(p_payload->>'id','')::uuid;
  v_name text := btrim(p_payload->>'name');
  v_kind category_kind := coalesce((p_payload->>'kind')::category_kind, 'ingredient');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '카테고리 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if exists (select 1 from categories
              where store_id = p_store and kind = v_kind and lower(btrim(name)) = lower(v_name)
                and (v_id is null or id <> v_id)) then
    raise exception '이미 같은 이름의 카테고리가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into categories (store_id, name, kind, sort_order)
    values (p_store, v_name, v_kind,
            coalesce((p_payload->>'sort_order')::int,
                     (select coalesce(max(sort_order), 0) + 1 from categories where store_id = p_store and kind = v_kind)))
    returning id into v_id;
  else
    update categories set
      name = v_name,
      sort_order = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '카테고리를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$function$;

-- ── settings_lists ─────────────────────────────
CREATE OR REPLACE FUNCTION public.settings_lists(p_store uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from ingredients i where i.category_id = c.id and i.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'ingredient'),
    'recipe_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from recipes r where r.category_id = c.id and r.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'recipe'),
    'material_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from materials m where m.category_id = c.id and m.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'material'),
    'materials', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'category_id', m.category_id,
               'category_name', mc.name, 'unit_cost', m.unit_cost, 'unit_label', m.unit_label,
               'memo', m.memo,
               'used_count', (select count(*) from recipe_extra_costs ec where ec.material_id = m.id))
             order by m.name), '[]'::jsonb)
      from materials m left join categories mc on mc.id = m.category_id
      where m.store_id = p_store and m.active),
    'vendors', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name,
               'used_count', (select count(*) from order_records o where o.vendor_id = v.id))
             order by v.name), '[]'::jsonb)
      from vendors v where v.store_id = p_store and not v.hidden),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ch.id, 'code', ch.code, 'name', ch.name,
               'fee_rate', ch.fee_rate, 'fee_note', ch.fee_note, 'active', ch.active)
             order by ch.sort_order), '[]'::jsonb)
      from sales_channels ch where ch.store_id = p_store)
  );
$function$;

-- ── assert_no_rpc_overloads ─────────────────────────────
CREATE OR REPLACE FUNCTION public.assert_no_rpc_overloads()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare r record; msg text := '';
begin
  for r in
    select p.proname, count(*) as c,
           string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as sigs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname ~ '^(e[0-9]+_|recompute_recipe|refresh_order_candidate|consume_stock|stock_total_base|base_unit_price|fixed_cost_rate|sales_summary|recipe_material_cost)'
     group by p.proname having count(*) > 1
  loop
    msg := msg || format(E'\n  %s (%s개): %s', r.proname, r.c, r.sigs);
  end loop;
  if msg <> '' then
    raise exception E'전파 RPC 오버로드 발견:%', msg;
  end if;
end;
$function$;
-- ── 조리 폐기를 원장에서 갈라낸다 ─────────────────────────────
-- 지금까지 "제육볶음 18개 소진 (폐기 2개 포함)" 한 줄로 뭉쳐 있었다.
-- note 에 적혀 있긴 했지만 **문자열**이라 걸러낼 수도 더할 수도 없었다.
-- 이제 판매분은 consume, 조리 폐기분은 discard 로 따로 남긴다.
--
-- 구분 규칙: discard 이면서 sales_item_id 가 있으면 조리 폐기, 없으면 식재료 폐기.
-- 되돌림 보정(adjust)은 어느 쪽을 되돌린 것인지 알아야 하므로 waste 플래그로 표시한다.
alter table inventory_events add column if not exists waste boolean not null default false;

comment on column inventory_events.waste is
  '이 행이 조리 폐기분(메뉴를 만들어 놓고 못 팔아 버린 몫)인지. 판매분과 갈라 집계한다(0041).';

create index if not exists inventory_events_waste_ix
  on inventory_events (sales_item_id, waste) where sales_item_id is not null;

-- 기존 행 소급: 조리 폐기가 섞여 있던 consume 을 지금 갈라낼 수는 없다.
-- 원장은 덮어쓰지 않는다(절대원칙 4). 과거분은 waste=false 인 채로 두고,
-- 앞으로 기록되는 것부터 갈라진다. 금액 기준 조리 폐기(waste_menu)는
-- daily_sales_items.qty_waste 에서 계산하므로 과거분도 손익에는 정확히 잡혀 있다.

create or replace function public.reconcile_sales_consumption(
  p_sales_item uuid, p_zero boolean default false
) returns jsonb language plpgsql as $fn$
declare
  it       daily_sales_items%rowtype;
  ds       daily_sales%rowtype;
  v_sold   numeric;
  v_waste  numeric;
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

  -- 팔린 몫과 버린 몫을 따로 센다. 합계는 같지만 원장에서는 다른 사건이다.
  if p_zero or it.recipe_id is null then
    v_sold := 0; v_waste := 0;
  else
    v_sold  := it.qty_hall + it.qty_delivery + it.qty_takeout;
    v_waste := coalesce(it.qty_waste, 0);
  end if;

  for rec in
    with target as (
      select n.ingredient_id, false as waste, sum(n.amount) as need
        from recipe_ingredient_needs(it.recipe_id, v_sold) n group by 1
      union all
      select n.ingredient_id, true, sum(n.amount)
        from recipe_ingredient_needs(it.recipe_id, v_waste) n group by 1
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
    -- 목표치 대조: 지금 있어야 할 양과 이미 반영된 양의 **차이만** 낸다.
    -- 되돌렸다 다시 적용하지 않는다 — RLS 아래에서 원장 삭제는 조용히 0행이다.
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

      -- 재고가 바닥나 한 톨도 못 가져갔으면 이벤트를 만들지 않는다.
      -- 나간 게 없는데 원장에 줄이 생기면 "왜 이만큼 남았는지"의 설명이 흐려진다.
      -- 다음 재계산 때 재고가 있으면 그때 빠진다(목표치 대조라 자동으로 따라잡는다).
      if v_taken > 0 then
      -- ⚠ discard 는 volume_delta 에 **버린 양**을 담아야 한다(check 제약).
      --   폐기 손실 금액이 이 컬럼 × 기준단가로 계산되기 때문이다.
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, volume_delta,
         sales_item_id, waste, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id,
         (case when rec.waste then 'discard' else 'consume' end)::inventory_event_type,
         -v_taken,
         case when rec.waste then v_taken end,
         p_sales_item, rec.waste,
         it.menu_name || ' ' ||
         case when rec.waste then v_waste || '개 조리 폐기' else v_sold || '개 판매 소진' end,
         (v_day::timestamp at time zone business_tz()));
      end if;
    else
      perform restore_stock(rec.ingredient_id, -v_delta);
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, waste, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id, 'adjust', -v_delta, p_sales_item, rec.waste,
         case when rec.waste then
                case when v_waste = 0 then it.menu_name || ' 조리 폐기 취소'
                     else it.menu_name || ' 조리 폐기 수량 조정 (' || v_waste || '개)' end
              else
                case when v_sold = 0 then it.menu_name || ' 판매 취소 보정'
                     else it.menu_name || ' 판매 수량 조정 (' || v_sold || '개)' end
         end,
         (v_day::timestamp at time zone business_tz()));
    end if;

    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'lines', v_lines,
    'sold_qty', v_sold, 'waste_qty', v_waste, 'shortages', v_short);
end;
$fn$;


-- ── sales_summary : 조리 폐기 이중 집계 방지 ──────────────────
CREATE OR REPLACE FUNCTION public.sales_summary(p_store uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  -- ⚠ sales_item_id 가 있는 폐기는 **조리 폐기**다(0041). 그쪽은 daily_sales_items.qty_waste
  --   에서 이미 v_waste_menu 로 잡히므로 여기서 또 더하면 이중 집계가 된다.
  select coalesce(sum(coalesce(ev.volume_delta, 0) * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
    into v_waste_ing
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard' and ev.sales_item_id is null
    -- ⚠ 되돌린 폐기는 빼야 한다. 0038 이 real_loss_rate 에서만 고치고 여기는 놓쳐서,
    --   폐기를 취소해도 월 손익의 폐기 손실은 그대로 남아 있었다(실측 7,760원).
    and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)
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
$function$;

-- ── 로스율 컬럼 제거 ─────────────────────────────────────────
-- 위에서 참조하던 함수를 전부 다시 만들었으므로 이제 안전하게 지운다.
-- 남겨 두면 "화면에 없는데 DB 에는 있는 값"이 되어 다음 사람이 되살린다.
alter table ingredients drop column if exists loss_rate;
alter table categories  drop column if exists default_loss_rate;

drop function if exists public.real_loss_rate(uuid);

select public.assert_no_rpc_overloads();
