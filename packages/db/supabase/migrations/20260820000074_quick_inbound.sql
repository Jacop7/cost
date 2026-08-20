-- ════════════════════════════════════════════════════════════════
-- 0074 · 빠른 입고 — 발주 없이 산 것을 바로 넣는다
--
-- 지금 재고를 늘리는 유일한 길은 **발주 → 입고 확정** 2단계다.
-- 시장에서 그냥 사 온 걸 넣으려면 있지도 않은 발주부터 만들어야 한다 —
-- 사장님 머릿속에 없는 단계다.
--
-- ⚠ **한 RPC 여야 한다.** 화면에서 e7 → e1 을 두 번 부르면 중간에 끊겼을 때
--   "발주는 있는데 입고는 안 된" 유령 발주가 남는다. 사장님은 그걸 정리할 방법이 없다.
--
-- ⚠ **멱등키를 받는다.** 버튼을 두 번 누르면 두 번 입고된다. e1 이 이미 멱등을
--   지원하므로 그 키를 그대로 흘려보낸다.
--
-- ⚠ 발주 기록은 **남긴다**(source='manual'). 기준단가가 그 기록에서 나오므로
--   기록 없이 재고만 늘리면 단가를 계산할 수 없다. 구매 이력에도 그대로 보인다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.quick_inbound(
  p_store uuid,
  p_ingredient uuid,
  p_volume numeric,          -- 팩 1개 용량(기준단위)
  p_amount numeric,          -- 팩 1개 금액. 실제 결제금액 ÷ 개수
  p_qty numeric default 1,   -- 몇 개 샀나
  p_vendor uuid default null,
  p_occurred_at date default null,
  p_idempotency_key text default null
) returns jsonb language plpgsql as $fn$
declare
  v_day   date := coalesce(p_occurred_at, business_day());
  v_order uuid;
  v_res   jsonb;
begin
  perform assert_my_store(p_store);

  if coalesce(p_volume, 0) <= 0 then
    raise exception '용량은 0보다 커야 해요' using errcode = '22000';
  end if;
  if coalesce(p_amount, -1) < 0 then
    raise exception '금액은 0 이상이어야 해요' using errcode = '22000';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception '수량은 1개 이상이어야 해요' using errcode = '22000';
  end if;
  if v_day > business_day() then
    raise exception '미래 날짜로는 입고할 수 없어요 (요청 %, 오늘 %)', v_day, business_day()
      using errcode = '22000';
  end if;

  -- ⚠ 같은 키로 이미 들어왔으면 새 발주를 만들지 않는다. e1 안에서 걸러도
  --   발주는 이미 생긴 뒤라 유령이 남는다 — 여기서 먼저 막아야 한다.
  if p_idempotency_key is not null then
    select ev.order_record_id into v_order
      from inventory_events ev
     where ev.store_id = p_store and ev.idempotency_key = p_idempotency_key
     limit 1;
    if v_order is not null then
      return jsonb_build_object('order_id', v_order, 'duplicate', true);
    end if;
  end if;

  -- 발주를 만들고 곧바로 확정한다. 한 트랜잭션이라 중간이 남지 않는다.
  v_order := e7_place_order(p_store, p_ingredient, p_vendor, null,
                            p_volume, p_amount, p_qty, v_day, 'manual');
  v_res := e1_confirm_inbound(v_order, p_qty, p_idempotency_key, v_day);

  return v_res || jsonb_build_object('order_id', v_order, 'quick', true);
end;
$fn$;

comment on function public.quick_inbound(uuid, uuid, numeric, numeric, numeric, uuid, date, text) is
  '발주 없이 산 것을 바로 입고한다 — 발주 기록은 manual 로 남긴다(0074). 한 트랜잭션·멱등.';

/**
 * 확정 전 미리보기 — 화면의 '반영 미리보기'가 이걸 쓴다.
 *
 * ⚠ 앱이 따로 계산하면 확정 후 숫자와 갈린다. 사장님이 4.81 을 보고 눌렀는데
 *   4.85 가 되면 그 화면을 두 번 다시 안 믿는다. 서버가 같은 공식으로 낸다.
 */
create or replace function public.quick_inbound_preview(
  p_store uuid, p_ingredient uuid,
  p_volume numeric, p_amount numeric, p_qty numeric default 1
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_add    numeric := coalesce(p_volume, 0) * coalesce(p_qty, 0);
  v_spent  numeric := coalesce(p_amount, 0) * coalesce(p_qty, 0);
  v_vol0   numeric;
  v_amt0   numeric;
  v_stock  numeric;
begin
  perform assert_my_store(p_store);

  select coalesce(sum(o.volume * o.received_qty), 0), coalesce(sum(o.amount * o.received_qty), 0)
    into v_vol0, v_amt0
    from order_records o
   where o.ingredient_id = p_ingredient and o.status in ('received','partial');

  v_stock := stock_total_base(p_ingredient);

  return jsonb_build_object(
    'stock_before', v_stock,
    'stock_after', v_stock + v_add,
    'added', v_add,
    'paid', v_spent,
    -- 이번 입고만의 단가 — "이번엔 얼마에 샀나"
    'inbound_unit_price', case when v_add > 0 then v_spent / v_add end,
    'base_price_before', base_unit_price(p_ingredient),
    -- 확정 후 기준단가. base_unit_price 와 **같은 공식**이어야 한다(0072).
    'base_price_after', case when v_vol0 + v_add > 0
                             then (v_amt0 + v_spent) / (v_vol0 + v_add) end,
    -- 이 입고가 원가를 흔드는 메뉴 수 — "연결 레시피 2개가 함께 바뀌어요"
    'affected_recipes', (select count(distinct l.recipe_id) from recipe_lines l
                          where l.ingredient_id = p_ingredient));
end;
$fn$;

select public.assert_no_rpc_overloads();
