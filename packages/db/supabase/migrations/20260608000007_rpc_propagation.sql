-- ════════════════════════════════════════════════════════════════
-- 0007 · 전파 이벤트 RPC E1~E7 (⑦ 4장)
-- 각 함수는 단일 트랜잭션 = 원자성. 화면 간 정합성 보장.
-- 재고·단가·이력은 E1·E2·E5 에서만 변동. 손익 영향(E1~E4)은 추이 점 적재.
-- ════════════════════════════════════════════════════════════════

-- ── E1 · 입고 확정 (ORD-03) ────────────────────────────────────
-- 재고+ → 뱃지 → 이력 → 단가 → 추이 점 → 레시피 손익 → 월 재료비 → 후보 해소 → 급등 판정
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
  v_month    text := to_char(now(),'YYYY-MM');
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
       values (o.ingredient_id, o.store_id, v_qty, current_date)
  on conflict (ingredient_id) do update
       set sealed_count = inventory_states.sealed_count + v_qty,
           last_inbound_at = current_date;

  -- 3) 재고 이벤트(입고) 이력 = 최근 주문
  insert into inventory_events (store_id, ingredient_id, type, count_delta, order_record_id)
       values (o.store_id, o.ingredient_id, 'inbound', v_qty, p_order);

  -- 4) 기준 단가 재계산 + 5) 가격 추이 점
  v_unit := base_unit_price(o.ingredient_id);
  insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
       values (o.store_id, o.ingredient_id, current_date, v_unit, p_order);

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

-- ── E2 · 폐기 (ING-04) ─────────────────────────────────────────
create or replace function public.e2_discard(
  p_ingredient uuid, p_remain_volume numeric
) returns void language plpgsql security invoker as $$
declare v_store uuid; rec record;
begin
  select store_id into v_store from ingredients where id = p_ingredient;
  -- 폐기량 기록 → 실측 로스율은 real_loss_rate()가 이력 기반 동적 산출
  insert into inventory_events (store_id, ingredient_id, type, volume_delta)
       values (v_store, p_ingredient, 'discard', p_remain_volume);
  -- 재고 개봉분 비우기
  update inventory_states set opened_count = 0, opened_remain = null
   where ingredient_id = p_ingredient;
  -- 기준 단가 보정 반영 → 영향 레시피 손익(주황 점)
  for rec in select distinct recipe_id from recipe_lines where ingredient_id = p_ingredient loop
    perform recompute_recipe(rec.recipe_id, 'material');
  end loop;
end;
$$;

-- ── E3 · 레시피 저장/수정 (RCP-03) ─────────────────────────────
create or replace function public.e3_recipe_saved(p_recipe uuid)
returns void language plpgsql security invoker as $$
begin
  perform recompute_recipe(p_recipe, 'recipe');  -- 파랑 점
end;
$$;

-- ── E4 · 고정 지출 저장 (MY-02) ────────────────────────────────
-- 률 재계산 → 전 레시피 손익 재계산(회색 점) → 월 손익 리포트 갱신
create or replace function public.e4_fixed_cost_saved(p_store uuid, p_month text)
returns jsonb language plpgsql security invoker as $$
declare
  v_rate numeric;
  v_rev  numeric;
  v_fix  numeric;
  v_mat  numeric;
  rec    record;
begin
  v_rate := fixed_cost_rate(p_store, p_month);

  -- 전 레시피 손익 재계산 (회색 점)
  for rec in select id from recipes where store_id = p_store and active loop
    perform recompute_recipe(rec.id, 'fixed');
  end loop;

  -- 월 손익 리포트 갱신
  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;

  select coalesce(material_cost,0) into v_mat from monthly_pl
   where store_id = p_store and month = p_month;

  insert into monthly_pl (store_id, month, revenue, fixed_cost, material_cost, profit, profit_rate)
       values (p_store, p_month, coalesce(v_rev,0), coalesce(v_fix,0), coalesce(v_mat,0),
               coalesce(v_rev,0) - coalesce(v_fix,0) - coalesce(v_mat,0),
               case when coalesce(v_rev,0) > 0
                    then round((coalesce(v_rev,0)-coalesce(v_fix,0)-coalesce(v_mat,0))/v_rev*100,2)
                    else 0 end)
  on conflict (store_id, month) do update
       set revenue = excluded.revenue, fixed_cost = excluded.fixed_cost,
           profit = excluded.profit, profit_rate = excluded.profit_rate;

  return jsonb_build_object('fixed_cost_rate', v_rate, 'month', p_month);
end;
$$;

-- ── E5 · 재고 수정·실사 (ING-04) → 후보 생성 ───────────────────
create or replace function public.e5_stock_adjusted(
  p_ingredient uuid, p_sealed numeric, p_opened smallint, p_soon boolean
) returns void language plpgsql security invoker as $$
declare
  ing       ingredients%rowtype;
  v_total   numeric;
begin
  select * into ing from ingredients where id = p_ingredient;

  insert into inventory_states (ingredient_id, store_id, sealed_count, opened_count, soon_out)
       values (p_ingredient, ing.store_id, p_sealed, p_opened, p_soon)
  on conflict (ingredient_id) do update
       set sealed_count = p_sealed, opened_count = p_opened, soon_out = p_soon;

  insert into inventory_events (store_id, ingredient_id, type, count_delta)
       values (ing.store_id, p_ingredient, 'adjust', null);

  -- 안전재고 미달/곧소진 → 후보 생성·합산
  v_total := p_sealed + p_opened;
  if p_soon or v_total <= ing.safety_stock then
    insert into order_candidates (store_id, ingredient_id, reasons, recommended_qty, status)
         values (ing.store_id, p_ingredient,
                 case when p_soon then array['soon_out']::candidate_reason[]
                      else array['safety_stock']::candidate_reason[] end,
                 greatest(ing.safety_stock - v_total, ing.min_order_qty), 'pending')
    on conflict (store_id, ingredient_id) do update
         set reasons = (select array_agg(distinct r) from unnest(
                          order_candidates.reasons ||
                          case when p_soon then array['soon_out']::candidate_reason[]
                               else array['safety_stock']::candidate_reason[] end) r),
             status = 'pending';
  end if;
end;
$$;

-- ── E6 · 레시피 계산 실행 (ORD-04) → 부족분 후보 ───────────────
-- 필요량 역산은 클라이언트(packages/core ordering)에서 산출 후 결과(jsonb)를 전달받아 적재.
create or replace function public.e6_recipe_calc(
  p_store uuid, p_from date, p_to date, p_items jsonb, p_result jsonb
) returns uuid language plpgsql security invoker as $$
declare v_run uuid; item record;
begin
  insert into recipe_calc_runs (store_id, period_from, period_to, items, result)
       values (p_store, p_from, p_to, p_items, p_result)
    returning id into v_run;

  for item in select * from jsonb_to_recordset(p_result)
                    as x(ingredient_id uuid, required numeric, shortage numeric)
  loop
    if item.shortage > 0 then
      insert into order_candidates (store_id, ingredient_id, reasons, recommended_qty, status)
           values (p_store, item.ingredient_id, array['recipe']::candidate_reason[], item.shortage, 'pending')
      on conflict (store_id, ingredient_id) do update
           set reasons = (select array_agg(distinct r) from unnest(
                            order_candidates.reasons || array['recipe']::candidate_reason[]) r),
               recommended_qty = greatest(order_candidates.recommended_qty, item.shortage),
               status = 'pending';
    end if;
  end loop;
  return v_run;
end;
$$;

-- ── E7 · 발주 등록 (ORD-02) — 기록만, 재고·단가 불변 ────────────
create or replace function public.e7_place_order(
  p_store uuid, p_ingredient uuid, p_vendor uuid, p_brand uuid,
  p_volume numeric, p_amount numeric, p_qty numeric,
  p_expected date, p_source order_source default 'manual'
) returns uuid language plpgsql security invoker as $$
declare v_order uuid;
begin
  insert into order_records (store_id, ingredient_id, vendor_id, brand_id,
                             volume, amount, qty, expected_at, status, source)
       values (p_store, p_ingredient, p_vendor, p_brand,
               p_volume, p_amount, p_qty, p_expected, 'ordered', p_source)
    returning id into v_order;

  -- 후보 상태 '주문함' 전환 (재고·단가는 변동 없음)
  update order_candidates set status = 'ordered'
   where store_id = p_store and ingredient_id = p_ingredient;

  return v_order;
end;
$$;
