-- ════════════════════════════════════════════════════════════════
-- 0011 · 실측 로스율이 추정 로스율을 삼키는 문제 (P0, 원가 과소 계상)
--
-- 증상 (로컬 DB 실증):
--   대파 loss_rate = 15%, 구매이력 3건, 폐기 이력 0건
--     real_loss_rate()            → 0.000   (null 이 아님)
--     coalesce(real, loss_rate)   → 0.000   ← **추정 15% 가 무시됨**
--     base_unit_price()           → 3.8333  (로스 미반영)
--   기대값은 가중평균 3.8333 ÷ (1 − 0.15) = 4.5098 이다.
--
-- 원인:
--   `real_loss_rate` 가 폐기 이력이 **하나도 없을 때도** 0 을 돌려준다.
--   `coalesce` 는 null 일 때만 추정값으로 넘어가므로, 0 은 "실측 결과 로스가 없다"로 해석되어
--   등록 시 입력한 추정 로스율을 덮어쓴다.
--
-- 영향:
--   기준단가 과소 → 레시피 재료 원가 과소 → **순이익 과대 계상**.
--   신규 등록 직후(폐기 이력이 없는 시점)에 항상 발생하므로 사실상 모든 식재료가 영향을 받는다.
--
-- 해결:
--   폐기 **이벤트가 0건**이면 "아직 실측된 로스율이 없음" = null 을 돌려준다.
--   폐기가 실제로 기록됐는데 그 합이 0 인 경우(예: 0g 폐기)는 실측 0% 로 인정한다 — 측정은 된 것이다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.real_loss_rate(p_ingredient uuid)
returns numeric language plpgsql stable security invoker as $$
declare
  v_events   bigint;
  v_discard  numeric;
  v_purchase numeric;
begin
  select count(*), coalesce(sum(volume_delta), 0)
    into v_events, v_discard
    from inventory_events
   where ingredient_id = p_ingredient and type = 'discard';

  -- 측정 자체가 없으면 null(잠정) — 0% 로 단정하지 않는다.
  if v_events = 0 then return null; end if;

  select coalesce(sum(volume * qty), 0) into v_purchase
    from order_records
   where ingredient_id = p_ingredient and status in ('received', 'partial');

  if v_purchase <= 0 then return null; end if;

  return v_discard / v_purchase * 100.0;
end;
$$;

comment on function public.real_loss_rate(uuid) is
  '실측 로스율(%) = 누적 폐기량 ÷ 누적 구매량 × 100. 폐기 이력이 없으면 null(추정 로스율로 폴백되도록).';
