-- ════════════════════════════════════════════════════════════════
-- 0020 · 전파 격차 일괄 수정 (P0 4건)
--
-- 전파 매트릭스 감사(에이전트 36개·실 DB 실증)가 확인한 것들:
--   A. 반제품(sub_recipe_id) 원가가 0원 — recompute_recipe 가 반제품 라인을 통째로 버린다.
--      실증: 양념장(1인분 850원)을 쓰는 불고기의 material_rate 가 0.00%, 순이익률 59.61%.
--   B. E2 폐기가 기준단가를 21% 바꾸는데 price_trends 에 점이 없다 (절대원칙 4 위반).
--      실증: 300g 폐기 → 실측로스율 30% → 단가 4.706→5.714, price_trends 0점.
--   C. E4 가 p_month 를 recompute_recipe 에 넘기지 않아 **과거 월을 수정해도 오늘 월 률로 덮어쓴다.**
--      실증: 반환값은 0.313(6월)인데 실제 적용은 0%.
--   D. order_candidates 가 **생겨야 할 때 안 생기고 사라져야 할 때 안 사라진다.**
--      후보 생성은 e5/e6 본문에 인라인, 해소는 e1 의 무조건 delete 하나뿐.
--      실증: 폐기로 재고 0 이 되어도 후보 0건 / 판매로 재고 0 이 되어도 후보 0건 /
--            부분입고로 재고가 안전재고 미만인데 후보는 삭제됨 / 실사로 재고를 채워도 후보가 pending 으로 남음.
-- ════════════════════════════════════════════════════════════════

-- ── A. 반제품 원가를 포함한 재료원가 ──────────────────────────
-- 반제품은 그 자체가 레시피다. 1인분 원가를 재귀적으로 구해야 한다.
-- 순환 참조(A가 B를, B가 A를)는 깊이 제한으로 막는다 — 무한 재귀는 트랜잭션을 죽인다.
create or replace function public.recipe_material_cost(p_recipe uuid, p_depth int default 0)
returns numeric language plpgsql stable security invoker as $$
declare
  v_base numeric;
  v_sum  numeric := 0;
  rec    record;
begin
  if p_depth > 5 then
    -- 반제품이 5단계를 넘으면 설계 오류이거나 순환이다. 0 으로 끊어 트랜잭션을 지킨다.
    return 0;
  end if;

  select base_servings into v_base from recipes where id = p_recipe;
  if v_base is null or v_base = 0 then return 0; end if;

  -- 직접 재료
  select coalesce(sum((rl.input_qty / v_base) * coalesce(base_unit_price(rl.ingredient_id), 0)), 0)
    into v_sum
    from recipe_lines rl
   where rl.recipe_id = p_recipe and rl.ingredient_id is not null;

  -- 반제품 — 하위 레시피의 1인분 원가 × 사용량
  for rec in
    select rl.sub_recipe_id, rl.input_qty
      from recipe_lines rl
     where rl.recipe_id = p_recipe and rl.sub_recipe_id is not null
  loop
    v_sum := v_sum + (rec.input_qty / v_base) * recipe_material_cost(rec.sub_recipe_id, p_depth + 1);
  end loop;

  return v_sum;
end;
$$;

comment on function public.recipe_material_cost(uuid, int) is
  '레시피 1인분 재료원가. 직접 재료 + **반제품(sub_recipe_id) 재귀**. 깊이 5 초과는 순환으로 보고 끊는다.';

-- ── D. 발주 후보 재산출 — 단일 출처 ──────────────────────────
-- 재고를 바꾸는 **모든** 경로가 이 함수를 호출한다. 후보 생성·갱신·해소를 한 곳에서 판정해야
-- "생겨야 할 때 안 생기고 사라져야 할 때 안 사라지는" 문제가 사라진다.
create or replace function public.refresh_order_candidate(p_ingredient uuid)
returns void language plpgsql security invoker as $$
declare
  ing        ingredients%rowtype;
  v_total    numeric;
  v_safe     numeric;
  v_soon     boolean;
  v_reasons  candidate_reason[] := '{}';
  v_rec_qty  numeric;
  v_ordered  boolean;
begin
  select * into ing from ingredients where id = p_ingredient;
  if not found then return; end if;

  -- 재고는 **총량(기준단위)** 으로 본다. 안전재고는 개수 기준이므로 개당 용량을 곱해 맞춘다.
  v_total := stock_total_base(p_ingredient);
  v_safe  := coalesce(ing.safety_stock, 0) * coalesce(ing.per_volume, 0);
  select coalesce(soon_out, false) into v_soon from inventory_states where ingredient_id = p_ingredient;

  if v_total < v_safe then
    v_reasons := array_append(v_reasons, 'safety_stock'::candidate_reason);
  end if;
  if coalesce(v_soon, false) then
    v_reasons := array_append(v_reasons, 'soon_out'::candidate_reason);
  end if;

  -- 이미 도착하지 않은 발주가 있으면 '주문함' 상태다. 별도 컬럼에 저장하지 않고 **파생**시킨다
  -- (저장하면 발주가 취소·완료돼도 상태가 남아 어긋난다).
  select exists (
    select 1 from order_records
     where ingredient_id = p_ingredient and status in ('ordered','partial')
  ) into v_ordered;

  if array_length(v_reasons, 1) is null then
    -- 사유가 하나도 없으면 후보가 아니다. 재고를 채웠으면 후보는 사라져야 한다.
    delete from order_candidates where ingredient_id = p_ingredient;
    return;
  end if;

  -- 권장 발주량 = 안전재고까지 채우는 데 필요한 구매단위 개수(최소 발주량 이상)
  v_rec_qty := greatest(
    ceil((v_safe - v_total) / nullif(ing.per_volume, 0)),
    coalesce(ing.min_order_qty, 1));

  insert into order_candidates (store_id, ingredient_id, reasons, recommended_qty, status)
       values (ing.store_id, p_ingredient, v_reasons, v_rec_qty,
               (case when v_ordered then 'ordered' else 'pending' end)::candidate_status)
  on conflict (store_id, ingredient_id) do update
       -- 사유·권장량은 **현재 상태로 덮어쓴다.** 예전엔 누적되기만 해서 해소돼도 남았다.
       set reasons = excluded.reasons,
           recommended_qty = excluded.recommended_qty,
           status = excluded.status,
           updated_at = now();
end;
$$;

comment on function public.refresh_order_candidate(uuid) is
  '발주 후보 재산출 단일 출처. 재고를 바꾸는 모든 경로가 호출한다. 사유가 없어지면 후보를 삭제한다.';

-- ── B. E2 폐기 — 단가가 바뀌므로 price_trends 에 점을 남긴다 ──
create or replace function public.e2_discard(
  p_ingredient uuid, p_remain_volume numeric, p_occurred_at date default null
) returns void language plpgsql security invoker as $$
declare
  v_store   uuid;
  v_day     date := coalesce(p_occurred_at, business_day());
  v_before  numeric;
  v_discard numeric;
  v_unit    numeric;
  rec       record;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 폐기할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day();
  end if;

  select store_id into v_store from ingredients where id = p_ingredient;

  -- 남은 양을 받아 폐기량을 역산한다(화면은 "얼마 남았는지"를 입력받는다).
  v_before := stock_total_base(p_ingredient);
  v_discard := greatest(v_before - greatest(p_remain_volume, 0), 0);

  if v_discard > 0 then
    perform consume_stock(p_ingredient, v_discard);
  end if;

  insert into inventory_events (store_id, ingredient_id, type, count_delta, volume_delta, occurred_at)
       values (v_store, p_ingredient, 'discard', -v_discard, v_discard,
               (v_day::timestamp at time zone business_tz()));

  -- 폐기는 실측 로스율을 올려 **기준단가를 바꾼다.** 절대원칙 4 에 따라 추이 점을 남긴다.
  -- (이전에는 profit_trends 만 찍고 price_trends 는 비어 있어 단가가 왜 뛰었는지 추적할 수 없었다.)
  v_unit := base_unit_price(p_ingredient);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price)
         values (v_store, p_ingredient, v_day, v_unit);
  end if;

  -- 영향 레시피 손익 재계산
  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = p_ingredient and store_id = v_store
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day);
  end loop;

  -- 재고가 줄었으니 후보를 다시 판정한다.
  perform refresh_order_candidate(p_ingredient);
end;
$$;

-- ── recompute_recipe — 반제품 포함 원가 사용 ──────────────────
create or replace function public.recompute_recipe(
  p_recipe uuid,
  p_cause trend_cause,
  p_occurred_at date default null
) returns void language plpgsql security invoker as $$
declare
  r          recipes%rowtype;
  v_day      date := coalesce(p_occurred_at, business_day());
  v_month    text;
  v_tax      numeric;
  v_material numeric := 0;
  v_extra    numeric := 0;
  v_fixed    numeric;
  v_rate     numeric;
  v_profit   numeric;
  v_pr       numeric;
  v_mr       numeric;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 기록할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day();
  end if;
  v_month := to_char(v_day, 'YYYY-MM');

  select * into r from recipes where id = p_recipe;
  if not found then return; end if;

  -- 반제품 포함 (A 수정)
  v_material := recipe_material_cost(p_recipe);

  select coalesce(sum(amount_per_serving),0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_tax  := case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end;

  -- 해당 월 률이 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  -- 0% 로 확정하면 순이익률이 부풀려진다(실증: 33.49% → 64.79%).
  v_rate := fixed_cost_rate(r.store_id, v_month);
  if v_rate is null then
    select fixed_cost_rate(r.store_id, month) into v_rate
      from fixed_costs_monthly
     where store_id = r.store_id and month <= v_month
       and fixed_cost_rate(r.store_id, month) is not null
     order by month desc limit 1;
  end if;
  v_fixed := coalesce(v_rate, 0) * r.price;

  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;
  v_pr := case when r.price > 0 then round(v_profit / r.price * 100, 2) else 0 end;
  v_mr := case when r.price > 0 then round(v_material / r.price * 100, 2) else 0 end;

  insert into profit_trends (store_id, recipe_id, trend_date, profit_rate, material_rate, cause)
  values (r.store_id, p_recipe, v_day, v_pr, v_mr, p_cause);
end;
$$;

-- ── C. E4 — p_month 를 재계산에 전달 ─────────────────────────
create or replace function public.e4_fixed_cost_saved(p_store uuid, p_month text)
returns jsonb language plpgsql security invoker as $$
declare
  v_rate numeric;
  v_rev  numeric;
  v_fix  numeric;
  v_mat  numeric;
  v_day  date;
  rec    record;
begin
  v_rate := fixed_cost_rate(p_store, p_month);

  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;

  -- **그 달의 마지막 날**(오늘을 넘지 않게)에 점을 찍는다.
  -- 과거 월을 수정했는데 오늘 날짜로 점을 찍으면 그 달의 추이가 아니라 오늘 추이가 된다.
  v_day := least((to_date(p_month, 'YYYY-MM') + interval '1 month - 1 day')::date, business_day());

  for rec in select id from recipes where store_id = p_store and coalesce(active, true) loop
    perform recompute_recipe(rec.id, 'fixed', v_day);
  end loop;

  select coalesce(sum(material_cost),0) into v_mat
    from monthly_pl where store_id = p_store and month = p_month;

  insert into monthly_pl (store_id, month, revenue, fixed_cost, material_cost)
       values (p_store, p_month, coalesce(v_rev,0), coalesce(v_fix,0), coalesce(v_mat,0))
  on conflict (store_id, month) do update
       set revenue = excluded.revenue,
           fixed_cost = excluded.fixed_cost;

  return jsonb_build_object('month', p_month, 'rate', v_rate, 'revenue', v_rev, 'fixed', v_fix);
end;
$$;

-- ── 재고를 바꾸는 나머지 경로도 후보를 재판정하게 ─────────────
-- E5(실사)·E1(입고)·E8(판매 소진)에 refresh_order_candidate 를 건다.
create or replace function public.e5_stock_adjusted(
  p_ingredient uuid, p_sealed numeric, p_opened smallint, p_soon boolean
) returns void language plpgsql security invoker as $$
declare v_store uuid;
begin
  select store_id into v_store from ingredients where id = p_ingredient;

  insert into inventory_states (ingredient_id, store_id, sealed_count, opened_count, soon_out)
       values (p_ingredient, v_store, p_sealed, p_opened, p_soon)
  on conflict (ingredient_id) do update
       set sealed_count = excluded.sealed_count,
           opened_count = excluded.opened_count,
           soon_out = excluded.soon_out;

  insert into inventory_events (store_id, ingredient_id, type, count_delta, occurred_at)
       values (v_store, p_ingredient, 'stocktake', 0, now());

  -- 실사로 재고를 채웠으면 후보가 사라져야 하고, 줄었으면 생겨야 한다.
  perform refresh_order_candidate(p_ingredient);
end;
$$;
