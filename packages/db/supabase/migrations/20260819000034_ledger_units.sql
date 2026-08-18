-- ════════════════════════════════════════════════════════════════
-- 0034 · 재고 원장의 단위를 하나로 (그리고 실사 변동량 기록)
--
-- `inventory_events.count_delta` 가 이벤트 종류마다 다른 단위였다:
--
--   E1 입고     : +2      ← 구매단위 **개수**
--   E8 판매소진 : -1600   ← 기준단위 **그램**
--   E2 폐기     : -220    ← 기준단위 그램
--   E5 실사     : 0       ← 아예 기록 안 함
--
-- 그래서 원장을 위에서 아래로 더해도 현재 재고가 나오지 않는다. 화면이 "잔량"을 그리려면
-- 다시 계산해야 하고, 그 계산은 종류별 분기를 알아야 한다 — 두 개의 진실이 생긴다.
-- 실사는 더 나쁘다. 변동량이 0 이라 "언제 얼마나 맞췄는지"가 영영 사라진다.
--
-- 원장의 단위를 **기준단위(g/ml/개)** 하나로 통일하고, 실사도 실제 증감을 남긴다.
-- 기존 입고 행은 개당 용량을 곱해 소급 보정한다.
-- ════════════════════════════════════════════════════════════════

-- ── 기존 입고 이벤트 소급 보정 ────────────────────────────────
-- 개수로 적힌 값을 기준단위로 환산한다. 두 번 돌아도 안전하도록 표시를 남긴다.
alter table inventory_events add column if not exists unit_normalized boolean not null default false;

update inventory_events ev
   set count_delta = ev.count_delta * i.per_volume,
       unit_normalized = true
  from ingredients i
 where i.id = ev.ingredient_id
   and ev.type = 'inbound'
   and not ev.unit_normalized;

update inventory_events set unit_normalized = true where not unit_normalized;

comment on column inventory_events.count_delta is
  '재고 증감 — **기준단위(g/ml/개)**. 종류와 무관하게 같은 단위다(0034).';

-- ── E1 재작성 — 입고를 기준단위로 기록 ────────────────────────
create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null,
  p_idempotency_key text default null,
  p_occurred_at date default null
) returns jsonb language plpgsql as $fn$
declare
  o          order_records%rowtype;
  v_qty      numeric;   -- 구매단위 개수
  v_base     numeric;   -- 기준단위 총량
  v_per      numeric;
  v_remain   numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_today    date := coalesce(p_occurred_at, business_day());
  v_month    text;
  rec        record;
begin
  if v_today > business_day() then
    raise exception '미래 날짜로는 입고할 수 없습니다 (요청 %, 오늘 %)', v_today, business_day()
      using errcode = '22000';
  end if;
  v_month := to_char(v_today, 'YYYY-MM');

  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  -- 멱등성: 같은 키로 두 번 오면 아무것도 하지 않는다. 방어는 여기(+유니크 인덱스)가 한다.
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

  select per_volume into v_per from ingredients where id = o.ingredient_id;
  v_base := v_qty * coalesce(v_per, 0);

  v_avg_prev := base_unit_price(o.ingredient_id);

  update order_records
     set received_qty = received_qty + v_qty,
         status = (case when received_qty + v_qty >= qty then 'received' else 'partial' end)::order_status
   where id = p_order;

  insert into inventory_states (ingredient_id, store_id, sealed_count, last_inbound_at)
       values (o.ingredient_id, o.store_id, v_qty, v_today)
  on conflict (ingredient_id) do update
       set sealed_count = inventory_states.sealed_count + v_qty,
           last_inbound_at = greatest(coalesce(inventory_states.last_inbound_at, v_today), v_today);

  -- ⚠ 기준단위로 기록한다. 소진(E8)·폐기(E2)와 같은 단위여야 원장을 더할 수 있다.
  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id,
                                idempotency_key, note, occurred_at, unit_normalized)
       values (o.store_id, o.ingredient_id, 'inbound', v_base, p_order, p_idempotency_key,
               v_qty || '개 입고', (v_today::timestamp at time zone business_tz()), true);

  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, v_today, v_unit, p_order);

  -- 단가 급등 경고 — 직전 평균 대비 20% 이상.
  if v_avg_prev is not null and v_avg_prev > 0 and v_unit is not null then
    v_spike := v_unit > v_avg_prev * 1.2;
  end if;

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_today);
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
$fn$;

-- ── E5 재작성 — 실사 변동량을 남긴다 ──────────────────────────
-- 개봉분 잔량도 함께 받는다. 이전에는 미개봉 개수만 받아 "미개봉 1개 + 개봉 800g" 을
-- 표현할 수 없었고, 그래서 실사 후 총량이 화면과 어긋났다.
drop function if exists public.e5_stock_adjusted(uuid, numeric, smallint, boolean);

create or replace function public.e5_stock_adjusted(
  p_ingredient uuid,
  p_sealed numeric,
  p_opened smallint,
  p_soon boolean,
  p_opened_remain numeric default null,
  p_note text default null,
  p_occurred_at date default null
) returns jsonb language plpgsql as $fn$
declare
  v_store  uuid;
  v_per    numeric;
  v_before numeric;
  v_after  numeric;
  v_remain numeric;
  v_day    date := coalesce(p_occurred_at, business_day());
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 실사할 수 없습니다' using errcode = '22000';
  end if;
  if coalesce(p_sealed, -1) < 0 then
    raise exception '재고 수량은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select store_id, per_volume into v_store, v_per from ingredients where id = p_ingredient;
  if v_store is null then raise exception 'ingredient % not found', p_ingredient; end if;

  v_before := coalesce(stock_total_base(p_ingredient), 0);

  -- 개봉분 잔량을 안 주면 "개봉 여부"만으로 판단한다(하위 호환).
  v_remain := coalesce(p_opened_remain, case when coalesce(p_opened, 0) > 0 then coalesce(v_per, 0) else 0 end);
  if v_remain < 0 or (v_per is not null and v_remain >= v_per and v_per > 0) then
    -- 개봉분이 개당 용량 이상이면 미개봉 한 개다. 스스로 정규화한다.
    p_sealed := p_sealed + floor(v_remain / nullif(v_per, 0));
    v_remain := greatest(0, v_remain - floor(v_remain / nullif(v_per, 0)) * v_per);
  end if;

  insert into inventory_states (ingredient_id, store_id, sealed_count, opened_count, opened_remain, soon_out)
       values (p_ingredient, v_store, p_sealed,
               (case when v_remain > 0 then 1 else 0 end)::smallint, v_remain, coalesce(p_soon, false))
  on conflict (ingredient_id) do update
       set sealed_count  = excluded.sealed_count,
           opened_count  = excluded.opened_count,
           opened_remain = excluded.opened_remain,
           soon_out      = excluded.soon_out,
           updated_at    = now();

  v_after := coalesce(stock_total_base(p_ingredient), 0);

  -- 변동량 0 이어도 기록한다 — "확인했다"는 것 자체가 사건이다.
  insert into inventory_events (store_id, ingredient_id, type, count_delta, note, occurred_at, unit_normalized)
       values (v_store, p_ingredient, 'stocktake', v_after - v_before,
               coalesce(nullif(btrim(p_note), ''), '재고 실사'),
               (v_day::timestamp at time zone business_tz()), true);

  perform refresh_order_candidate(p_ingredient);

  return jsonb_build_object(
    'ingredient_id', p_ingredient, 'before', v_before, 'after', v_after, 'delta', v_after - v_before);
end;
$fn$;

-- ── 원장 조회에 잔량 붙이기 ───────────────────────────────────
-- 화면이 잔량을 다시 계산하면 종류별 분기를 앱이 알아야 한다. 서버가 누적해서 준다.
-- 반환 컬럼이 늘어나므로 create or replace 로는 못 바꾼다.
drop function if exists public.stock_history(uuid, date, date);

create or replace function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type inventory_event_type,
  count_delta numeric, volume_delta numeric, note text, balance numeric
) language sql stable security invoker as $fn$
  select e.id, e.occurred_on, e.type, e.count_delta, e.volume_delta, e.note, e.balance
    from (
      select ev.id,
             (ev.occurred_at at time zone business_tz())::date as occurred_on,
             ev.type, ev.count_delta, ev.volume_delta, ev.note,
             ev.occurred_at,
             sum(ev.count_delta) over (order by ev.occurred_at, ev.id
                                       rows between unbounded preceding and current row) as balance
        from inventory_events ev
       where ev.ingredient_id = p_ingredient
    ) e
   where (p_from is null or e.occurred_on >= p_from)
     and (p_to   is null or e.occurred_on <= p_to)
   order by e.occurred_at desc, e.id desc;
$fn$;

select public.assert_no_rpc_overloads();
