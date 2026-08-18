-- ════════════════════════════════════════════════════════════════
-- 0010 · 금액·수량 값 제약 보강 (불변식 6)
--
-- 근거: 가이드 §2 불변식 6
--   "금액과 수량은 음수·NaN·Infinity를 허용하지 않는다.
--    분모 0, 로스율 100% 이상, 판매가/매출 0을 명시적으로 처리한다."
--
-- 감사 결과 (core ↔ SQL 대조, packages/core/tests/sqlParity.test.ts):
--   · recipes.price          — CHECK 없음 → **음수 판매가 저장 가능**.
--                              그러면 세금(price*10/110)·고정지출(rate*price)·순이익률이 모두 뒤집힌다.
--   · ingredients.loss_rate  — 100% 이상이면 base_unit_price 의 분모 `1 - v_loss` 가 0 또는 음수가 되어
--                              null 또는 **음수 단가**가 나온다(CV-8).
--   · fixed_costs_monthly.total_revenue — 음수 매출이면 고정지출률 부호가 뒤집힌다.
--
-- 이미 있는 제약(확인함, 중복 추가하지 않음):
--   recipes.base_servings > 0 · recipe_lines.input_qty >= 0 ·
--   order_records.volume > 0 / amount >= 0 / qty > 0
--
-- 모두 `not valid` 로 추가한다. 기존 행이 있어도 마이그레이션이 실패하지 않고, 신규 쓰기부터 적용된다.
-- 데이터 정리 후 `alter table ... validate constraint ...` 로 소급 검증할 것.
--
-- ⚠ [환경 미검증] Docker 부재로 로컬 DB에서 실행·검증하지 못했다.
--   적용 전 `supabase db reset` 으로 반드시 확인할 것.
-- ════════════════════════════════════════════════════════════════

do $$
begin
  -- 판매가는 음수일 수 없다. 0 은 '미입력/판매 중지'로 허용한다(A-04 잠정 처리).
  if not exists (select 1 from pg_constraint where conname = 'recipes_price_ck') then
    alter table public.recipes
      add constraint recipes_price_ck check (price >= 0) not valid;
  end if;

  -- 로스율은 0 이상 100 미만. 100% 이상이면 남는 양이 없어 기준단가를 정의할 수 없다.
  -- (core baseUnitPrice 가 lossRate >= 1 을 null 로 막는 것과 같은 계약)
  if not exists (select 1 from pg_constraint where conname = 'ingredients_loss_rate_ck') then
    alter table public.ingredients
      add constraint ingredients_loss_rate_ck check (loss_rate >= 0 and loss_rate < 100) not valid;
  end if;

  -- 월 매출은 음수일 수 없다. (컬럼이 not null default 0 이라 0 = '미입력' → 고정지출률 null 잠정, G-07)
  if not exists (select 1 from pg_constraint where conname = 'fixed_costs_monthly_revenue_ck') then
    alter table public.fixed_costs_monthly
      add constraint fixed_costs_monthly_revenue_ck check (total_revenue >= 0) not valid;
  end if;
end $$;

-- ── base_unit_price 의 로스율 경계 보정 (CV-8) ─────────────────
-- 현행은 `nullif(1 - v_loss, 0)` 이라 **정확히 0** 만 걸러낸다. 로스율 120% 면 1-1.2 = -0.2 가 그대로
-- 통과해 음수 단가가 나온다. 위 CHECK 이 신규 쓰기를 막지만, 기존 행과 not valid 구간을 위해
-- 함수에서도 방어한다(방어를 한 겹만 두지 않는다).
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

  select coalesce(real_loss_rate(p_ingredient), loss_rate) / 100.0
    into v_loss from ingredients where id = p_ingredient;

  -- 로스율이 0 미만이거나 100% 이상이면 기준단가를 정의할 수 없다 → null(잠정).
  -- was: return v_avg / nullif(1 - v_loss, 0);   ← 100% 초과에서 음수 단가
  if v_loss is null or v_loss < 0 or v_loss >= 1 then return null; end if;

  return v_avg / (1 - v_loss);
end;
$$;

comment on function public.base_unit_price(uuid) is
  '기준 단가 = 구매이력 수량 가중평균 ÷ (1 − 로스율). 이력 없음·로스율 100% 이상은 null(잠정). core baseUnitPrice 와 같은 계약.';
