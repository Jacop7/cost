-- ════════════════════════════════════════════════════════════════
-- 0106 · 음수 재고에서 폐기하면 재고가 **늘어났다**
--
-- 0102 가 남긴 구멍이다. 자르는 쪽 식이 이랬다.
--
--     v_take := least(p_amount, coalesce(v_before, 0));
--
-- 재고가 절대 음수가 될 수 없던 시절엔 맞았다. 이제는 아니다.
--
--     재고 −640g 에서 100g 폐기
--       least(100, −640) = −640
--       stock_total = −640 − (−640) = 0        ← 재고가 늘었다
--       반환값도 −640                            ← 원장에 +640 이 적힌다
--
-- 측정으로 확인했다(롤백함):
--     음수 재고에서 폐기 100g → 반환 −640, 재고 −640 → 0
--
-- 부족분이 폐기 한 번에 조용히 지워진다. 음수 재고를 도입한 이유가
-- **부족을 보존하는 것**인데, 폐기가 그 증거를 지우고 있었다.
--
-- 바닥을 0 으로 깐다 — 뺄 게 없으면 0 을 뺀다. 늘리지는 않는다.
-- ⚠ 폐기가 음수로 못 내려가는 정책은 그대로다(기획안 §5.6, 초과 폐기는 범위 밖).
--   이 고침은 "안 내려간다"를 "거꾸로 올라간다"로 만들지 않을 뿐이다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.consume_stock(
  p_ingredient uuid, p_amount numeric, p_allow_negative boolean default false)
returns numeric language plpgsql as $fn$
declare
  v_before numeric;
  v_take   numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  select stock_total into v_before
    from public.inventory_states
   where ingredient_id = p_ingredient
   for update;

  if not found then return 0; end if;

  -- 판매·입고취소 — 필요량 전체를 뺀다. 자르면 원장에 부족분이 안 남는다(0102).
  -- 폐기      — 있는 만큼만 뺀다. ⚠ `greatest(0, ...)` 이 빠지면 음수 재고에서
  --             거꾸로 늘어난다(0106). 뺄 게 없으면 0 이지 음수가 아니다.
  v_take := case when p_allow_negative then p_amount
                 else greatest(0, least(p_amount, coalesce(v_before, 0))) end;

  if v_take = 0 then return 0; end if;

  update public.inventory_states
     set stock_total = stock_total - v_take,
         updated_at = now()
   where ingredient_id = p_ingredient;

  return v_take;
end;
$fn$;

comment on function public.consume_stock(uuid, numeric, boolean) is
  '재고를 뺀다. `p_allow_negative` 면 **필요량 전체**를 빼고 잔액이 음수가 될 수 있다(0102). '
  '판매 소진·입고 취소는 true, 폐기는 false — 폐기는 있는 만큼만 빼고 **절대 늘리지 않는다**(0106).';

select public.assert_no_rpc_overloads();
