-- ════════════════════════════════════════════════════════════════
-- 0013 · E1 입고 확정이 실행 즉시 실패하던 버그 (P0, 기능 전면 불능)
--
-- 증상 (로컬 DB 실행으로 발견):
--   select e1_confirm_inbound(<order>, 1, 'K1');
--   ERROR: column "status" is of type order_status but expression is of type text
--   CONTEXT: PL/pgSQL function e1_confirm_inbound(uuid,numeric,text) line 48
--
--   → **호출할 때마다 예외 → 트랜잭션 전체 롤백**. 재고·이벤트·추이·월 재료비 어느 것도 기록되지 않는다.
--     실증: 호출 4회 후에도 sealed_count 2(불변), inventory_events 0, price_trends 0, received_qty 0.
--
-- 원인:
--   `status = case when ... then 'received' else 'partial' end`
--   CASE 식의 결과 타입이 `text` 로 추론되는데 컬럼은 `order_status` enum 이다.
--   PostgreSQL 은 UPDATE 대입에서 text → enum 암묵 변환을 허용하지 않는다.
--   INSERT 는 리터럴이 컬럼 타입으로 직접 해석돼 통과하지만(그래서 e7_place_order 는 정상),
--   CASE 를 거치면 공통 타입이 먼저 text 로 정해져 실패한다.
--
-- 이 버그는 0007 최초 정의부터 있었고 0008·0009 가 본문을 그대로 옮기며 유지됐다.
-- 아무도 실행해 본 적이 없어 드러나지 않았다 — 가이드가 요구한 "현행 동작 재현"이 실제로
-- 잡아낸 결함이다.
--
-- 해결: CASE 결과를 `order_status` 로 명시 캐스팅한다. 로직은 그대로다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null,      -- null이면 남은 수량 전부(자동 입고 F-13)
  p_idempotency_key text default null     -- 같은 키 재호출은 no-op
) returns jsonb language plpgsql security invoker as $$
declare
  o          order_records%rowtype;
  v_qty      numeric;
  v_remain   numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_month    text := business_month();
  v_today    date := business_day();
  rec        record;
begin
  -- 행 잠금: 키 없이 동시에 두 번 들어와도 직렬화되어 순서대로 처리된다.
  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  -- 멱등: 같은 키가 이미 적재됐으면 아무것도 바꾸지 않는다.
  if p_idempotency_key is not null and exists (
    select 1 from inventory_events
     where store_id = o.store_id and idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'order_id', p_order, 'duplicate', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  if o.status = 'canceled' then
    raise exception 'order % is canceled', p_order;
  end if;

  -- 이미 전량 입고된 주문은 no-op. 오류로 만들면 실제로 성공한 행동에 실패 화면이 뜬다.
  v_remain := o.qty - o.received_qty;
  if v_remain <= 0 then
    return jsonb_build_object(
      'order_id', p_order, 'already_received', true, 'received_qty', 0,
      'unit_price', base_unit_price(o.ingredient_id), 'price_spike', false);
  end if;

  -- 남은 수량을 넘겨 받을 수 없다(과입고 방지). 0 이하 입력은 거부한다.
  v_qty := least(coalesce(p_actual_qty, v_remain), v_remain);
  if v_qty <= 0 then
    raise exception 'actual qty must be positive (order %, requested %)', p_order, p_actual_qty;
  end if;

  v_avg_prev := base_unit_price(o.ingredient_id);

  -- 1) 발주 레코드 상태 갱신 (부분입고 지원)
  --    ⚠ CASE 결과는 text 로 추론되므로 enum 으로 명시 캐스팅해야 한다(이 파일의 수정 대상).
  update order_records
     set received_qty = received_qty + v_qty,
         status = (case when received_qty + v_qty >= qty then 'received' else 'partial' end)::order_status
   where id = p_order;

  -- 2) 재고 미개봉 +실수량 + 최근 입고일
  insert into inventory_states (ingredient_id, store_id, sealed_count, last_inbound_at)
       values (o.ingredient_id, o.store_id, v_qty, v_today)
  on conflict (ingredient_id) do update
       set sealed_count = inventory_states.sealed_count + v_qty,
           last_inbound_at = v_today;

  -- 3) 재고 이벤트(입고) 이력 — 멱등성 키를 함께 적재해 재호출을 DB가 막는다.
  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id, idempotency_key)
       values (o.store_id, o.ingredient_id, 'inbound', v_qty, p_order, p_idempotency_key);

  -- 4) 기준 단가 재계산 + 5) 가격 추이 점
  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, v_today, v_unit, p_order);

  -- 6) 영향 레시피 손익 재계산 (주황 점)
  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material');
  end loop;

  -- 7) 월 재료비 합산 (입고 금액)
  insert into monthly_pl (store_id, month, material_cost)
       values (o.store_id, v_month, o.amount / nullif(o.qty,0) * v_qty)
  on conflict (store_id, month) do update
       set material_cost = monthly_pl.material_cost + (o.amount / nullif(o.qty,0) * v_qty);

  -- 8) 발주 후보 해소(주문함→해당 건 제거)
  delete from order_candidates
   where ingredient_id = o.ingredient_id and store_id = o.store_id;

  -- 9) 급등 판정 (평균 대비 ±15%)
  if v_avg_prev is not null and v_avg_prev > 0 then
    v_spike := abs(v_unit - v_avg_prev) / v_avg_prev >= 0.15;
  end if;

  return jsonb_build_object(
    'order_id', p_order, 'received_qty', v_qty,
    'unit_price', v_unit, 'price_spike', v_spike,
    'duplicate', false, 'already_received', false);
end;
$$;
