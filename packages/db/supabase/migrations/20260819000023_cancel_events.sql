-- ════════════════════════════════════════════════════════════════
-- 0023 · E11 입고 취소 · E12 발주 취소 (P0, 화면이 약속한 동작이 서버에 없음)
--
-- 실증된 문제:
--   ① 앱 `OrdersHomeScreen` 에 '입고 취소' 버튼과 확인 다이얼로그가 있고, 문구가
--      "늘어난 재고와 구매 이력, 기준단가 반영이 함께 되돌아가요" 라고 **약속**한다.
--      그런데 **E1 역전파 RPC 가 존재하지 않는다.** 지금은 로컬 배열에서 카드만 지운다.
--      연결하면 사장님이 취소를 눌러도 재고·price_trends·monthly_pl·레시피 손익이 전부 남는다.
--   ② `order_status` 에 `canceled` 값은 있으나 이를 세팅하는 함수가 public 함수 어디에도 없다.
--   ③ status 를 직접 'canceled' 로 UPDATE 하면 `base_unit_price` 가 **NULL** 이 된다
--      (base_unit_price 는 status in ('received','partial') 만 보므로 구매 이력이 통째로 빠진다).
--      문서 ③ 은 "발주됨 → 취소: 재고·단가 영향 없음" 이라고 규정한다 — 정면 위반이다.
--
-- 설계 (절대원칙 4 append-only 와 양립):
--   · 원장(inventory_events)은 **지우지 않는다.** 반대 부호 보정 이벤트를 쌓는다.
--   · price_trends 의 과거 점도 지우지 않는다. 취소 시점의 **재계산된 단가로 새 점**을 찍는다.
--     그래야 "왜 단가가 되돌아갔는지"가 추이에 남는다.
--   · monthly_pl.material_cost 는 파생 집계라 차감으로 정정한다.
--   · base_unit_price 는 order_records.status 만 보므로 상태를 되돌리면 자동으로 따라온다.
--
-- ③ 대응:
--   발주 취소(E12)는 **아직 입고되지 않은 발주만** 취소할 수 있다. 이미 입고된 건은
--   먼저 입고 취소(E11)를 거쳐야 한다. 그래야 "취소는 재고·단가에 영향 없음" 이 성립한다.
-- ════════════════════════════════════════════════════════════════

-- ── E11 · 입고 취소 ───────────────────────────────────────────
create or replace function public.e11_inbound_reverted(
  p_order uuid,
  p_reason text default null
) returns jsonb language plpgsql security invoker as $$
declare
  o          order_records%rowtype;
  v_qty      numeric := 0;
  v_unit     numeric;
  v_month    text;
  v_day      date := business_day();
  rec        record;
  ev         record;
begin
  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if o.received_qty <= 0 then
    -- 입고된 적이 없으면 되돌릴 것도 없다. 오류로 만들지 않는다(사용자는 이미 취소된 걸 다시 눌렀을 뿐).
    return jsonb_build_object('order_id', p_order, 'nothing_to_revert', true, 'reverted_qty', 0);
  end if;

  -- 1) 이 발주로 늘어난 재고를 되돌린다.
  --    어느 봉지에서 왔는지 알 수 없으므로 개봉분에 얹지 않고 **미개봉 개수**에서 뺀다
  --    (입고는 미개봉으로 들어왔으므로 대칭이다). 0 아래로는 내려가지 않는다.
  for ev in
    select ingredient_id, sum(count_delta) as delta
      from inventory_events
     where order_record_id = p_order and type = 'inbound'
     group by ingredient_id
  loop
    v_qty := v_qty + ev.delta;

    update inventory_states
       set sealed_count = greatest(coalesce(sealed_count,0) - ev.delta, 0)
     where ingredient_id = ev.ingredient_id;

    -- 원장은 지우지 않는다. 반대 부호 보정 이벤트를 쌓는다.
    insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id, note, occurred_at)
         values (o.store_id, ev.ingredient_id, 'adjust', -ev.delta, p_order,
                 coalesce(p_reason, '입고 취소 보정'), now());
  end loop;

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

  -- 4) 월 재료비에서 차감한다(파생 집계이므로 정정한다).
  v_month := to_char(coalesce(o.ordered_at, v_day), 'YYYY-MM');
  update monthly_pl
     set material_cost = greatest(coalesce(material_cost,0) - (o.amount / nullif(o.qty,0) * v_qty), 0)
   where store_id = o.store_id and month = v_month;

  -- 5) 영향 레시피 손익 재계산 (단가가 바뀌었다)
  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day);
  end loop;

  -- 6) 재고가 줄었으니 후보를 다시 판정한다.
  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'nothing_to_revert', false,
    'reverted_qty', v_qty, 'unit_price', v_unit, 'status', 'ordered');
end;
$$;

comment on function public.e11_inbound_reverted(uuid, text) is
  'E11 입고 취소. 재고·단가·월 재료비·레시피 손익을 되돌린다. 원장은 지우지 않고 보정 이벤트를 쌓는다.';

-- ── E12 · 발주 취소 ───────────────────────────────────────────
create or replace function public.e12_order_canceled(
  p_order uuid,
  p_reason text default null
) returns jsonb language plpgsql security invoker as $$
declare
  o order_records%rowtype;
begin
  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if o.status = 'canceled' then
    return jsonb_build_object('order_id', p_order, 'already_canceled', true);
  end if;

  -- 이미 입고된 건은 그냥 취소할 수 없다. 취소하면 base_unit_price 계산에서 빠져
  -- **재고는 남았는데 단가는 사라지는** 모순이 생긴다.
  -- 먼저 E11 로 입고를 되돌린 뒤 취소해야 "취소는 재고·단가에 영향 없음"(③)이 성립한다.
  if o.received_qty > 0 then
    raise exception '이미 입고된 발주입니다. 입고 취소(E11)를 먼저 실행하세요 (입고 수량 %)', o.received_qty;
  end if;

  update order_records
     set status = 'canceled'::order_status
   where id = p_order;

  -- 발주가 없어졌으므로 후보의 '주문함' 상태가 풀려야 한다(파생이므로 재판정만 하면 된다).
  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object('order_id', p_order, 'already_canceled', false, 'status', 'canceled');
end;
$$;

comment on function public.e12_order_canceled(uuid, text) is
  'E12 발주 취소. 미입고 발주만 취소 가능. 재고·단가는 변하지 않고 후보의 주문함 상태만 풀린다.';

select public.assert_no_rpc_overloads();
