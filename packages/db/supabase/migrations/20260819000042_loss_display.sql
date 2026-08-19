-- ════════════════════════════════════════════════════════════════
-- 0042 · 로스율을 **표시 전용**으로 되살린다
--
-- 사장님: "로스율은 식재료 상세페이지에 표시는 되어야 하는데
--          폐기이력이 함께 나오면서"
--
-- 0041 에서 로스율을 없앤 것은 **기준단가 공식에서** 뺀 것이다.
-- "얼마나 버리고 있나"는 사장님이 알아야 하는 숫자다 — 다만 원가를 조용히
-- 움직이면 안 될 뿐이다. 그래서 여기서 돌아오는 값은 어디에도 곱해지지 않는다.
--
-- ⚠ 이 함수를 base_unit_price 에 다시 물리지 말 것. 그러면 0041 이전으로 돌아간다:
--   폐기를 입력할수록 실측이 추정을 대체해 단가가 **내려가는** 역전이 생겼다.
--
-- ── 계산 규칙 (0038 에서 배운 것을 그대로 지킨다) ────────────
--   분자: 되돌려지지 않은 폐기의 volume_delta 합
--   분모: 실입고량 Σ(volume × received_qty) — 발주량을 쓰면 아직 안 온 물량이
--         분모를 부풀려 로스율이 과소 산출된다(부분 입고에서 드러난다)
--   폐기 기록이 0건이면 rate 는 null — 0% 로 단정하지 않는다("측정 없음"과 다르다)
--
-- ── 두 가지 폐기를 갈라서 보여준다 (0041 의 waste 플래그) ────
--   보관 폐기: 상해서 버렸다  → 발주량이 많거나 보관이 문제
--   조리 폐기: 만들었는데 못 팔았다 → 판매 예측이 문제
--   원인이 다르면 사장님이 할 일도 다르다. 한 숫자로 뭉치면 알 수 없다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.ingredient_loss(p_ingredient uuid)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_storage_amt numeric := 0;   -- 보관 폐기량 (기준단위)
  v_cooking_amt numeric := 0;   -- 조리 폐기량 (기준단위)
  v_storage_n   int := 0;
  v_cooking_n   int := 0;
  v_purchased   numeric := 0;
  v_price       numeric;
  v_total       numeric;
begin
  select
    coalesce(sum(case when not ev.waste then ev.volume_delta end), 0),
    coalesce(sum(case when     ev.waste then ev.volume_delta end), 0),
    count(*) filter (where not ev.waste),
    count(*) filter (where     ev.waste)
    into v_storage_amt, v_cooking_amt, v_storage_n, v_cooking_n
    from inventory_events ev
   where ev.ingredient_id = p_ingredient
     and ev.type = 'discard'
     -- 되돌린 폐기는 세지 않는다. 취소했는데 로스율이 남으면 사장님이 안 믿는다.
     and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id);

  select coalesce(sum(volume * received_qty), 0) into v_purchased
    from order_records
   where ingredient_id = p_ingredient and status in ('received', 'partial');

  v_price := base_unit_price(p_ingredient);
  v_total := v_storage_amt + v_cooking_amt;

  return jsonb_build_object(
    'purchased',      v_purchased,
    'storage_amount', v_storage_amt,
    'cooking_amount', v_cooking_amt,
    'storage_count',  v_storage_n,
    'cooking_count',  v_cooking_n,
    'total_amount',   v_total,
    -- 버린 금액 — 비율보다 이쪽이 먼저 와닿는다.
    'total_cost',     case when v_price is not null then v_total * v_price end,
    -- 측정이 없으면 null. 0% 는 "안 버렸다"는 뜻이라 "모른다"와 다르다.
    'rate',         case when (v_storage_n + v_cooking_n) > 0 and v_purchased > 0
                         then v_total / v_purchased * 100 end,
    'storage_rate', case when v_storage_n > 0 and v_purchased > 0
                         then v_storage_amt / v_purchased * 100 end,
    'cooking_rate', case when v_cooking_n > 0 and v_purchased > 0
                         then v_cooking_amt / v_purchased * 100 end);
end;
$fn$;

comment on function public.ingredient_loss(uuid) is
  '실측 로스율 — **표시 전용**(0042). 기준단가에 곱하지 않는다. 되돌린 폐기 제외, 분모는 실입고량.';

-- ── stock_history 에 waste 를 실어 화면이 두 폐기를 구분하게 한다 ──
-- 반환 컬럼이 늘어나므로 create or replace 로는 못 바꾼다.
drop function if exists public.stock_history(uuid, date, date);

create or replace function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type inventory_event_type,
  count_delta numeric, volume_delta numeric, note text,
  balance numeric, reverted boolean, waste boolean
) language sql stable security invoker as $fn$
  select e.id, e.occurred_on, e.type, e.count_delta, e.volume_delta, e.note,
         e.balance, e.reverted, e.waste
    from (
      select ev.id,
             (ev.occurred_at at time zone business_tz())::date as occurred_on,
             ev.type, ev.count_delta, ev.volume_delta, ev.note, ev.seq, ev.waste,
             exists (select 1 from inventory_events r where r.reverses_event_id = ev.id) as reverted,
             sum(ev.count_delta) over (order by ev.seq
                                       rows between unbounded preceding and current row) as balance
        from inventory_events ev
       where ev.ingredient_id = p_ingredient
    ) e
   where (p_from is null or e.occurred_on >= p_from)
     and (p_to   is null or e.occurred_on <= p_to)
   order by e.seq desc;
$fn$;

-- ── ingredient_detail 에 loss 를 실어 화면이 한 번에 받게 한다 ──
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
    -- 실측 로스율 — **표시 전용**(0042). 어디에도 곱하지 않는다.
    'loss', ingredient_loss(i.id),
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

select public.assert_no_rpc_overloads();

-- ── 조리 폐기는 식재료 화면에서 되돌릴 수 없다 ────────────────
-- 조리 폐기의 주인은 **매출 기록**이다(daily_sales_items.qty_waste).
-- 식재료 화면에서 되돌리면 원장과 매출이 영구히 어긋난다. 실측:
--   판매 후 재고 2,190 → 조리 폐기 되돌림 2,265 → 매출을 같은 값으로 재저장해도 2,265
--   (매출은 3개 폐기라고 하는데 재고는 반영 안 된 채로 굳는다)
--
-- 원인: e2_discard_reverted 가 만드는 보정 이벤트에는 waste 표시가 없어서,
-- reconcile 의 목표치 대조가 판매분 몫으로 잘못 세어 균형이 깨진다.
-- 되돌림 자체를 막는 게 옳다 — 사장님이 고쳐야 할 곳은 그 날 매출이다.
create or replace function public.e2_discard_reverted(p_event uuid, p_reason text default null)
returns jsonb language plpgsql as $fn$
declare
  ev     inventory_events%rowtype;
  v_unit numeric;
  v_day  date := business_day();
  rec    record;
begin
  -- FOR UPDATE 를 쓰지 않는다 — inventory_events 에는 원장 보존을 위해 UPDATE 정책이
  -- 없고, RLS 아래 FOR UPDATE 는 UPDATE 정책 검사에 걸려 0행을 돌려준다.
  -- 중복은 유니크 인덱스(reverses_event_id)가 막는다.
  select * into ev from inventory_events where id = p_event;
  if not found then raise exception '폐기 기록을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if ev.type <> 'discard' then
    raise exception '폐기 기록이 아닙니다' using errcode = '22000';
  end if;
  if ev.sales_item_id is not null then
    raise exception '조리 폐기는 그 날 매출에서 수량을 고쳐 주세요' using errcode = '22000';
  end if;
  if exists (select 1 from inventory_events r where r.reverses_event_id = p_event) then
    return jsonb_build_object('event_id', p_event, 'already_reverted', true);
  end if;

  perform restore_stock(ev.ingredient_id, coalesce(ev.volume_delta, 0));

  insert into inventory_events
    (store_id, ingredient_id, type, count_delta, occurred_at, note, reverses_event_id, unit_normalized)
  values
    (ev.store_id, ev.ingredient_id, 'adjust', coalesce(ev.volume_delta, 0), now(),
     coalesce(p_reason, '폐기 취소'), p_event, true);

  -- 폐기는 기준단가를 바꾸지 않는다(0041). 그래도 추이는 남긴다 — 절대원칙 4.
  v_unit := base_unit_price(ev.ingredient_id);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price)
         values (ev.store_id, ev.ingredient_id, v_day, v_unit);
  end if;

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = ev.ingredient_id and store_id = ev.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day);
  end loop;

  perform refresh_order_candidate(ev.ingredient_id);

  return jsonb_build_object(
    'event_id', p_event, 'already_reverted', false,
    'restored', coalesce(ev.volume_delta, 0), 'unit_price', v_unit);
end;
$fn$;

select public.assert_no_rpc_overloads();
