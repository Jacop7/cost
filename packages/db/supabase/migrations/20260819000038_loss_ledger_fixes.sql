-- ════════════════════════════════════════════════════════════════
-- 0038 · 로스율·원장 확정 버그 6건
--
-- 로스율 설계 논의(사용자 입력을 없애고 실적으로 측정할지)와 **무관하게** 틀린 것들이다.
-- 어느 설계를 고르든 아래는 고쳐져 있어야 한다.
--
--  (A) 폐기량 0 인 폐기 이벤트가 추정 로스율을 영구히 파괴한다  ← 라이브 데이터에 이미 존재
--  (B) 입고 취소가 개수에서 그램을 빼 재고를 전멸시킨다
--  (C) 입고 취소의 월 재료비 차감액이 per_volume 배 틀리다
--  (D) 기준단가·실측로스율이 발주량(qty)을 쓰고 실입고량(received_qty)을 안 쓴다
--  (E) 실측 로스율이 100% 를 넘으면 기준단가가 null 이 되고, 그게 원가 0원으로 조용히 삼켜진다
--  (F) 잘못 입력한 폐기를 되돌릴 방법이 없다
-- ════════════════════════════════════════════════════════════════

-- ── (F) 폐기 취소를 위한 연결 ─────────────────────────────────
-- 원장은 지우지 않는다(0018). 되돌림은 반대 이벤트를 쌓고, 원본을 가리켜 상쇄를 표시한다.
alter table inventory_events
  add column if not exists reverses_event_id uuid references inventory_events(id);

comment on column inventory_events.reverses_event_id is
  '이 이벤트가 되돌리는 원본 이벤트. 되돌려진 폐기는 실측 로스율 계산에서 빠진다(0038).';

-- 한 이벤트는 한 번만 되돌릴 수 있다. 두 번 되돌리면 재고가 두 배로 늘어난다.
-- ⚠ 행 잠금(select ... for update)으로는 못 막는다 — inventory_events 에는 원장 보존을 위해
--   UPDATE 정책이 없고, RLS 아래에서 FOR UPDATE 는 UPDATE 정책 검사에 걸려 **0행을 돌려준다**.
--   (실증: e2_discard_reverted 가 방금 만든 폐기 행을 "찾을 수 없다"고 했다.)
--   그래서 잠금이 아니라 유니크 인덱스로 보장한다.
create unique index if not exists inventory_events_reverses_uk
  on inventory_events (reverses_event_id) where reverses_event_id is not null;

comment on column inventory_events.volume_delta is
  '폐기량(기준단위, 양수). discard 이벤트에서만 채워지며 count_delta 와 부호가 반대인 짝이다(0038).';

-- ── (A) 폐기량 0 인 유령 폐기 행 정리 ─────────────────────────
-- 아무것도 버리지 않았는데 남은 행이다. "측정했다"는 뜻을 갖게 되어 추정 로스율을 0 으로 덮어썼다.
-- 실제 사건이 아니므로 지운다(원장 보존 원칙은 **일어난 일**을 지키는 것이지 no-op 을 지키는 게 아니다).
delete from inventory_events
 where type = 'discard' and coalesce(volume_delta, 0) = 0 and coalesce(count_delta, 0) = 0;

-- 구조로 재발을 막는다. 함수만 고치면 직접 insert 로 다시 뚫린다.
do $ck$ begin
  alter table inventory_events
    add constraint inventory_events_discard_positive_ck
    check (type <> 'discard' or coalesce(volume_delta, 0) > 0) not valid;
  alter table inventory_events validate constraint inventory_events_discard_positive_ck;
exception when duplicate_object then null;
end $ck$;

-- ── (A) e2_discard — 버릴 게 없으면 아무 일도 하지 않는다 ─────
-- 반환형이 void -> jsonb 로 바뀐다(화면이 "몇 g 버렸는지"를 받아 알릴 수 있게).
drop function if exists public.e2_discard(uuid, numeric, date);

create or replace function public.e2_discard(
  p_ingredient uuid, p_remain_volume numeric, p_occurred_at date default null
) returns jsonb language plpgsql as $fn$
declare
  v_store   uuid;
  v_before  numeric;
  v_discard numeric;
  v_unit    numeric;
  v_day     date := coalesce(p_occurred_at, business_day());
  v_event   uuid;
  rec       record;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 폐기할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day()
      using errcode = '22000';
  end if;
  if p_remain_volume is null or p_remain_volume < 0 then
    raise exception '남은 양은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select store_id into v_store from ingredients where id = p_ingredient;
  if v_store is null then raise exception 'ingredient % not found', p_ingredient; end if;

  -- 화면은 "얼마 남았는지"를 받는다. 폐기량은 역산한다.
  v_before  := coalesce(stock_total_base(p_ingredient), 0);
  v_discard := greatest(v_before - p_remain_volume, 0);

  -- ⚠ 버릴 게 없으면 **이벤트를 만들지 않는다.**
  --   예전에는 이 insert 가 `if v_discard > 0` 밖에 있어 0g 폐기 행이 생겼고,
  --   real_loss_rate 가 "측정 있음(=0%)"으로 읽어 사용자가 넣은 추정 로스율을 통째로 덮어썼다.
  --   실증: 청양고추 loss_rate 10% -> 실측 0% -> 기준단가 11.1111 이 10.0000 으로 내려앉음.
  if v_discard <= 0 then
    return jsonb_build_object(
      'ingredient_id', p_ingredient, 'discarded', 0, 'skipped', true,
      'stock', v_before, 'unit_price', base_unit_price(p_ingredient));
  end if;

  perform consume_stock(p_ingredient, v_discard);

  insert into inventory_events (store_id, ingredient_id, type, count_delta, volume_delta, occurred_at, unit_normalized)
       values (v_store, p_ingredient, 'discard', -v_discard, v_discard,
               (v_day::timestamp at time zone business_tz()), true)
    returning id into v_event;

  -- 폐기는 실측 로스율을 올려 기준단가를 바꾼다. 절대원칙 4 에 따라 추이 점을 남긴다.
  v_unit := base_unit_price(p_ingredient);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price)
         values (v_store, p_ingredient, v_day, v_unit);
  end if;

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = p_ingredient and store_id = v_store
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day);
  end loop;

  perform refresh_order_candidate(p_ingredient);

  return jsonb_build_object(
    'ingredient_id', p_ingredient, 'event_id', v_event, 'discarded', v_discard,
    'skipped', false, 'stock', stock_total_base(p_ingredient), 'unit_price', v_unit);
end;
$fn$;

-- ── (F) 폐기 취소 ─────────────────────────────────────────────
-- 오입력한 폐기 하나가 그 식재료의 기준단가를 영구히 바꿔버리는 걸 막는다.
create or replace function public.e2_discard_reverted(p_event uuid, p_reason text default null)
returns jsonb language plpgsql as $fn$
declare
  ev     inventory_events%rowtype;
  v_unit numeric;
  v_day  date := business_day();
  rec    record;
begin
  -- FOR UPDATE 를 쓰지 않는다(위 인덱스 주석 참고). 중복은 유니크 인덱스가 막는다.
  select * into ev from inventory_events where id = p_event;
  if not found then raise exception '폐기 기록을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if ev.type <> 'discard' then
    raise exception '폐기 기록이 아닙니다' using errcode = '22000';
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

  -- 되돌린 폐기는 실측 로스율에서 빠지므로 기준단가가 원래대로 돌아간다.
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

-- ── (D)(E)(F) real_loss_rate 재작성 ───────────────────────────
create or replace function public.real_loss_rate(p_ingredient uuid)
returns numeric language plpgsql stable as $fn$
declare
  v_events   bigint;
  v_discard  numeric;
  v_purchase numeric;
  v_rate     numeric;
begin
  -- 되돌려진 폐기는 세지 않는다(0038). 안 그러면 취소해도 로스율이 그대로 남는다.
  select count(*), coalesce(sum(ev.volume_delta), 0)
    into v_events, v_discard
    from inventory_events ev
   where ev.ingredient_id = p_ingredient
     and ev.type = 'discard'
     and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id);

  -- 측정 자체가 없으면 null(잠정) — 0% 로 단정하지 않는다.
  if v_events = 0 then return null; end if;

  -- ⚠ 실입고량 기준이다. 발주량(qty)을 쓰면 아직 도착하지 않은 물량까지 매입으로 잡혀
  --   분모가 부풀고 실측 로스율이 과소 산출된다(부분 입고에서 드러난다).
  select coalesce(sum(volume * received_qty), 0) into v_purchase
    from order_records
   where ingredient_id = p_ingredient and status in ('received', 'partial');

  if v_purchase <= 0 then return null; end if;

  v_rate := v_discard / v_purchase * 100.0;

  -- 산 것보다 많이 버릴 수는 없다. 이 값이 나오면 데이터 오류이지 측정이 아니다.
  -- 그대로 두면 base_unit_price 가 null 이 되고, 그 null 이 원가 0원으로 조용히 삼켜진다.
  -- 측정을 포기하고(null) 추정치로 떨어지는 편이 안전하다.
  if v_rate >= 100 then return null; end if;

  return v_rate;
end;
$fn$;

-- ── (D) base_unit_price — 실입고량 기준 가중평균 ──────────────
create or replace function public.base_unit_price(p_ingredient uuid)
returns numeric language plpgsql stable as $fn$
declare
  v_avg  numeric;
  v_loss numeric;
begin
  -- 가중치는 **실제로 들어온 수량**이다. 발주만 하고 안 온 물량이 평균을 끌면
  -- 아직 존재하지도 않는 재고의 가격이 원가에 섞인다.
  select case when sum(received_qty) > 0
              then sum((amount / nullif(volume,0)) * received_qty) / sum(received_qty)
         end
    into v_avg
  from order_records
  where ingredient_id = p_ingredient and status in ('received','partial');

  if v_avg is null then return null; end if;

  select coalesce(real_loss_rate(p_ingredient), loss_rate) / 100.0
    into v_loss from ingredients where id = p_ingredient;

  -- 로스율이 0 미만이거나 100% 이상이면 기준단가를 정의할 수 없다 → null(잠정).
  if v_loss is null or v_loss < 0 or v_loss >= 1 then return null; end if;

  return v_avg / (1 - v_loss);
end;
$fn$;

-- ── (B)(C) e11_inbound_reverted — 단위 두 곳 ──────────────────
create or replace function public.e11_inbound_reverted(p_order uuid, p_reason text default null)
returns jsonb language plpgsql as $fn$
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

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day);
  end loop;

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'nothing_to_revert', false,
    'reverted_qty', v_recv, 'reverted_base', v_base,
    'shortfall', v_short,
    'unit_price', v_unit, 'status', 'ordered');
end;
$fn$;

-- ── (E) 원가에서 조용히 빠진 재료를 드러낸다 ──────────────────
-- recipe_material_cost 는 단가가 없는 줄을 coalesce(...,0) 으로 넘긴다. 합계만 보면
-- 그 재료가 공짜인지 빠진 건지 알 수 없다. 목록 화면이 경고할 수 있게 개수를 함께 준다.
drop function if exists public.recipe_list(uuid);

create or replace function public.recipe_list(p_store uuid)
returns table (
  id uuid, name text, price numeric, tax_mode tax_mode, base_servings int,
  target_profit_rate numeric, avg_monthly_sales numeric, active boolean,
  category_id uuid, category_name text,
  material_cost numeric, extra_cost numeric, tax numeric, fixed_cost numeric,
  profit numeric, profit_rate numeric, material_rate numeric,
  unknown_cost_lines int
) language sql stable security invoker as $fn$
  with base as (
    select r.*,
           c.name as cat_name,
           recipe_material_cost(r.id) as mat,
           coalesce((select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = r.id), 0) as ext,
           case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end as tx,
           coalesce(fixed_cost_rate(r.store_id, business_month()), 0) as rate,
           (select count(*) from recipe_lines rl
             where rl.recipe_id = r.id
               and rl.ingredient_id is not null
               and base_unit_price(rl.ingredient_id) is null)::int as unknown_lines
      from recipes r
      left join categories c on c.id = r.category_id
     where r.store_id = p_store
  )
  select b.id, b.name, b.price, b.tax_mode, b.base_servings,
         b.target_profit_rate, b.avg_monthly_sales, coalesce(b.active, true),
         b.category_id, b.cat_name,
         b.mat, b.ext, b.tx, b.rate * b.price,
         b.price - b.tx - b.mat - b.ext - (b.rate * b.price),
         case when b.price > 0 then (b.price - b.tx - b.mat - b.ext - (b.rate * b.price)) / b.price else 0 end,
         case when b.price > 0 then b.mat / b.price else 0 end,
         b.unknown_lines
    from base b
   order by coalesce(b.active, true) desc, b.name;
$fn$;

select public.assert_no_rpc_overloads();

-- ── 원장 조회에 "되돌려짐" 표시 ───────────────────────────────
-- 화면이 폐기 행을 눌러 취소할 수 있어야 하고, 이미 취소된 건 다시 못 누르게 해야 한다.
drop function if exists public.stock_history(uuid, date, date);

create or replace function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type inventory_event_type,
  count_delta numeric, volume_delta numeric, note text, balance numeric, reverted boolean
) language sql stable security invoker as $fn$
  select e.id, e.occurred_on, e.type, e.count_delta, e.volume_delta, e.note, e.balance, e.reverted
    from (
      select ev.id,
             (ev.occurred_at at time zone business_tz())::date as occurred_on,
             ev.type, ev.count_delta, ev.volume_delta, ev.note, ev.seq,
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

select public.assert_no_rpc_overloads();
