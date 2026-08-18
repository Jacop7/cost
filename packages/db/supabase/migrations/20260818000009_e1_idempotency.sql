-- ════════════════════════════════════════════════════════════════
-- 0009 · E1 입고 확정 멱등성 + 과입고 방지
--
-- 문제 (가이드 P0-2 · 불변식 8):
--   `e1_confirm_inbound` 에 중복 확정 방어가 없다. 같은 주문으로 다시 호출하면
--   (연타 · 재시도 · 네트워크 재전송 · 앱 복귀 후 재실행)
--     · p_actual_qty 를 명시한 경우 **재고가 이중 증가**한다
--     · price_trends 행이 하나 더 쌓인다        ← append-only, 정정 불가
--     · inventory_events 에 입고 이벤트가 중복 적재된다  ← append-only, 정정 불가
--     · monthly_pl.material_cost 가 이중 가산된다
--   p_actual_qty 를 생략하면 `o.qty - o.received_qty = 0` 이라 우연히 수량만 0 이 되지만,
--   **추이·이벤트 행은 그대로 중복 생성**된다.
--   또 `received_qty` 가 `qty` 를 넘지 못하게 막는 제약이 없어 과입고가 가능하다.
--
-- 해결:
--   1) 멱등성 키 — 같은 키로 두 번 호출하면 두 번째는 아무것도 바꾸지 않고 duplicate 로 응답한다.
--      DB 유니크 인덱스로 보장하므로 앱의 debounce 에 의존하지 않는다(가이드 §9.7).
--   2) 행 잠금(for update) — 키 없이 동시에 두 번 들어와도 직렬화된다.
--   3) 남은 수량 클램프 — 어떤 경로로도 received_qty 가 qty 를 넘지 않는다.
--   4) 상태 가드 — 이미 입고 완료/취소된 주문은 조용히 무시하거나 명시적으로 거부한다.
--
-- ⚠ [환경 미검증] Docker 부재로 로컬 DB에서 실행·검증하지 못했다.
--   적용 전 `supabase db reset` 으로 반드시 확인할 것.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 멱등성 키 ───────────────────────────────────────────────
alter table public.inventory_events
  add column if not exists idempotency_key text;

comment on column public.inventory_events.idempotency_key is
  '클라이언트가 만든 1회성 키. 같은 키의 이벤트는 매장 내에서 한 번만 적재된다(중복 입고 방어).';

-- 매장 안에서만 유일하면 된다. null 은 여러 개 허용(키 없이 호출한 기존 경로 호환).
create unique index if not exists inventory_events_idempotency_uidx
  on public.inventory_events (store_id, idempotency_key)
  where idempotency_key is not null;

-- ── 2) 과입고 방지 제약 ────────────────────────────────────────
-- 기존 행이 있을 수 있으므로 not valid 로 추가한다(신규 쓰기부터 적용).
-- 데이터 정리 후 `alter table ... validate constraint order_records_received_qty_ck;` 로 소급 검증할 것.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'order_records_received_qty_ck'
  ) then
    alter table public.order_records
      add constraint order_records_received_qty_ck
      check (received_qty >= 0 and received_qty <= qty) not valid;
  end if;
end $$;

-- ── 3) E1 재정의 ───────────────────────────────────────────────
-- 본문은 0008 판과 같고, 앞부분에 잠금·멱등·클램프 가드를 추가했다.
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
  update order_records
     set received_qty = received_qty + v_qty,
         status = case when received_qty + v_qty >= qty then 'received' else 'partial' end
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

comment on function public.e1_confirm_inbound(uuid, numeric, text) is
  'E1 입고 확정. 멱등성 키 재호출은 no-op, 남은 수량을 넘는 입고는 클램프, 이미 전량 입고면 no-op.';
