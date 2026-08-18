-- ════════════════════════════════════════════════════════════════
-- 0008 · 영업일 기준 시간대 통일 (KST)
--
-- 문제:
--   `to_char(now(),'YYYY-MM')` 과 `current_date` 는 세션 TimeZone 을 따르고 Supabase 기본값은 UTC 다.
--   앱은 기기 로컬(KST)로 날짜를 만들기 때문에 KST 00:00~09:00 구간에서 9시간이 어긋난다.
--     · recompute_recipe 가 **전월** 고정지출률로 이번 달 손익을 확정한다
--     · profit_trends / price_trends 날짜가 하루 밀린다 (append-only 라 사후 정정 불가)
--     · monthly_pl 의 재료비가 잘못된 월에 누적된다
--
-- 해결:
--   영업일 = 매장 시간대의 자정~자정. 1차 범위는 한국 매장이므로 'Asia/Seoul' 고정.
--   세션 GUC(set timezone) 에 의존하지 않고 **함수로 명시**한다. GUC 는 커넥션마다 달라질 수 있어
--   같은 코드가 조용히 다른 날짜를 만들 수 있다.
--
-- 대응 코드: packages/core/src/businessDate.ts (businessMonth / businessDay)
--   core 는 고정 오프셋(+09:00), SQL 은 IANA 'Asia/Seoul' 을 쓴다. KST 는 서머타임이 없어 두 방식의
--   결과가 항상 같다. 서머타임 있는 지역을 지원하게 되면 양쪽 모두 매장 시간대 컬럼 기반으로 바꾼다.
--
-- ⚠ [환경 미검증] 이 마이그레이션은 Docker 부재로 로컬 DB에서 실행·검증하지 못했다.
--   적용 전 `supabase db reset` 으로 반드시 확인할 것.
-- ════════════════════════════════════════════════════════════════

-- ── 영업 시간대 헬퍼 ───────────────────────────────────────────
-- 매장별 시간대를 지원하게 되면 이 함수만 store 기준으로 바꾸면 된다.
create or replace function public.business_tz()
returns text language sql immutable as $$
  select 'Asia/Seoul'::text;
$$;

comment on function public.business_tz() is
  '영업일 기준 시간대. 1차 범위는 한국 매장 고정. 매장별 시간대 지원 시 이 함수를 교체한다.';

-- 영업일(date) — current_date 대신 사용한다.
create or replace function public.business_day(p_at timestamptz default now())
returns date language sql stable as $$
  select (p_at at time zone business_tz())::date;
$$;

comment on function public.business_day(timestamptz) is
  '영업 시간대 기준 날짜. current_date(UTC)를 대체한다. core businessDay() 와 같은 값.';

-- 영업월('YYYY-MM') — to_char(now(),'YYYY-MM') 대신 사용한다.
create or replace function public.business_month(p_at timestamptz default now())
returns text language sql stable as $$
  select to_char(p_at at time zone business_tz(), 'YYYY-MM');
$$;

comment on function public.business_month(timestamptz) is
  '영업 시간대 기준 월 키. to_char(now(),''YYYY-MM'')(UTC)를 대체한다. core businessMonth() 와 같은 값.';

-- ── 기존 함수의 날짜 기준 교체 ─────────────────────────────────
-- 본문은 0006/0007 과 동일하고 날짜 표현식만 바꿨다. 로직 변경 없음.

-- recompute_recipe: v_month 를 영업월로. trend_date 를 영업일로.
create or replace function public.recompute_recipe(p_recipe uuid, p_cause trend_cause)
returns void language plpgsql security invoker as $$
declare
  r          recipes%rowtype;
  v_month    text := business_month();   -- was: to_char(now(),'YYYY-MM')  ← UTC
  v_tax      numeric;
  v_material numeric := 0;
  v_extra    numeric := 0;
  v_fixed    numeric;
  v_rate     numeric;
  v_profit   numeric;
  v_pr       numeric;  -- profit rate %
  v_mr       numeric;  -- material rate %
begin
  select * into r from recipes where id = p_recipe;
  if not found then return; end if;

  -- 재료 원가 = Σ(입력량/N × 기준단가).  단가 null은 0 잠정.
  select coalesce(sum((rl.input_qty / r.base_servings) * coalesce(base_unit_price(rl.ingredient_id),0)),0)
    into v_material
  from recipe_lines rl where rl.recipe_id = p_recipe and rl.ingredient_id is not null;

  select coalesce(sum(amount_per_serving),0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_tax  := case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end;
  v_rate := coalesce(fixed_cost_rate(r.store_id, v_month), 0);
  v_fixed := v_rate * r.price;

  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;
  v_pr := case when r.price > 0 then round(v_profit / r.price * 100, 2) else 0 end;
  v_mr := case when r.price > 0 then round(v_material / r.price * 100, 2) else 0 end;

  insert into profit_trends (store_id, recipe_id, trend_date, profit_rate, material_rate, cause)
  values (r.store_id, p_recipe, business_day(), v_pr, v_mr, p_cause);  -- was: current_date ← UTC
end;
$$;

-- e1_confirm_inbound: v_month 와 세 곳의 current_date 를 영업 기준으로.
create or replace function public.e1_confirm_inbound(
  p_order uuid,
  p_actual_qty numeric default null   -- null이면 주문 수량대로(자동 입고 F-13)
) returns jsonb language plpgsql security invoker as $$
declare
  o          order_records%rowtype;
  v_qty      numeric;
  v_unit     numeric;
  v_avg_prev numeric;
  v_spike    boolean := false;
  v_month    text := business_month();   -- was: to_char(now(),'YYYY-MM')  ← UTC
  v_today    date := business_day();     -- was: current_date              ← UTC
  rec        record;
begin
  select * into o from order_records where id = p_order;
  if not found then raise exception 'order % not found', p_order; end if;

  v_qty := coalesce(p_actual_qty, o.qty - o.received_qty);
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

  -- 3) 재고 이벤트(입고) 이력 = 최근 주문
  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id)
       values (o.store_id, o.ingredient_id, 'inbound', v_qty, p_order);

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
    'unit_price', v_unit, 'price_spike', v_spike);
end;
$$;

-- ── 신규 행의 기본 날짜도 영업일 기준으로 ──────────────────────
-- 발주일이 UTC 로 찍히면 KST 새벽 발주가 전날로 기록되어 도착 예정·입고 지연 판정이 어긋난다.
alter table public.order_records
  alter column ordered_at set default business_day();
