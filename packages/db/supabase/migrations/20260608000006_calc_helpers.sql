-- ════════════════════════════════════════════════════════════════
-- 0006 · 계산 헬퍼 함수 (packages/core 공식의 서버 권위 구현)
-- ⚠ packages/core/src 와 공식이 일치해야 한다. 변경 시 양쪽 동시 수정.
-- ════════════════════════════════════════════════════════════════

-- 기준 단가 = 구매이력 수량 가중평균 ÷ (1 − 로스율).  이력 없으면 null.
-- (① 4.1·8.6, ⑤ 2.3)
create or replace function public.base_unit_price(p_ingredient uuid)
returns numeric language plpgsql stable security invoker as $$
declare
  v_avg  numeric;
  v_loss numeric;
begin
  select case when sum(qty) > 0
              then sum((amount / nullif(volume,0)) * qty) / sum(qty)
         end
    into v_avg
  from order_records
  where ingredient_id = p_ingredient and status in ('received','partial');

  if v_avg is null then return null; end if;

  -- 실측 로스율 우선, 없으면 추정 로스율
  select coalesce(real_loss_rate(p_ingredient), loss_rate) / 100.0
    into v_loss from ingredients where id = p_ingredient;

  return v_avg / nullif(1 - v_loss, 0);
end;
$$;

-- 실측 로스율(%) = 누적 폐기량 ÷ 누적 구매량 × 100.  구매 0이면 null.
create or replace function public.real_loss_rate(p_ingredient uuid)
returns numeric language plpgsql stable security invoker as $$
declare
  v_discard  numeric;
  v_purchase numeric;
begin
  select coalesce(sum(volume_delta),0) into v_discard
    from inventory_events where ingredient_id = p_ingredient and type = 'discard';
  select coalesce(sum(volume * qty),0) into v_purchase
    from order_records where ingredient_id = p_ingredient and status in ('received','partial');
  if v_purchase <= 0 then return null; end if;
  return v_discard / v_purchase * 100.0;
end;
$$;

-- 고정지출률(0~1) = 월 고정 합계 ÷ 월매출.  매출 0이면 null(잠정).
create or replace function public.fixed_cost_rate(p_store uuid, p_month text)
returns numeric language plpgsql stable security invoker as $$
declare
  v_rev  numeric;
  v_fix  numeric;
begin
  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;
  if v_rev is null or v_rev <= 0 then return null; end if;
  return v_fix / v_rev;
end;
$$;

-- 레시피 손익 재계산 후 순이익 추이 점 적재 (E1~E4 공통).  cause 색 점.
create or replace function public.recompute_recipe(p_recipe uuid, p_cause trend_cause)
returns void language plpgsql security invoker as $$
declare
  r          recipes%rowtype;
  v_month    text := to_char(now(),'YYYY-MM');
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
  values (r.store_id, p_recipe, current_date, v_pr, v_mr, p_cause);
end;
$$;
