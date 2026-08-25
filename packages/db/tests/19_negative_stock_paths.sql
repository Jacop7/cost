-- ════════════════════════════════════════════════════════════════
-- 19 · 음수 재고의 쓰기 경로 (0105 · 0106)
--
-- 0102 는 판매 소진만 고쳤다. 나머지 두 경로는 여전히 0 에서 잘렸고,
-- 그중 하나는 잘리다 못해 **거꾸로 늘어났다.** 둘 다 여기서 잠근다.
--
--   ① 입고 취소 — 들어온 만큼 통째로 되돌린다. 결과가 음수여도 그대로 둔다.
--   ② 폐기      — 있는 만큼만 뺀다. 음수 재고에서 재고를 늘리지 않는다.
--   ③ 원장      — 어느 경우든 `합계 = 잔액` 이 성립한다.
--
-- ⚠ ①과 ②는 정책이 반대다. 헷갈리면 안 된다 —
--   취소는 **없던 일로 만드는 것**이라 전부 되돌려야 하고,
--   폐기는 **실제로 버리는 것**이라 없는 걸 버릴 수는 없다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 입고 취소가 음수를 만든다 ───────────────────────────────
do $t$
declare
  v_i     uuid := pg_temp.ing('대파');
  v_day   date := business_day();
  v_res   jsonb;
  v_rev   jsonb;
  v_order uuid;
begin
  -- 1,200g 을 4,800원에 — 4.00원/g 이라 검산값을 건드리지 않는다.
  v_res   := quick_inbound(pg_temp.store(), v_i, 1200, 4800, 1, null, v_day, 'T19-A');
  v_order := (v_res->>'order_id')::uuid;

  -- 그 사이 팔려나가 560g 만 남은 상황을 만든다.
  perform e5_stock_adjusted(v_i, 560, false, 'T19 기준 맞추기');
  perform pg_temp.eq('취소 전 재고', stock_total_base(v_i), 560, 0.001);

  v_rev := e11_inbound_reverted(v_order, 'T19 취소');

  perform pg_temp.eq('되돌린 기준단위 총량', (v_rev->>'reverted_base')::numeric, 1200, 0.001);

  /*
   * 여기가 이 파일의 이유다. 예전엔 있는 560g 만 되돌리고 640g 을 버린 뒤
   * `shortfall: 640` 을 정상 결과인 양 돌려줬다. 그러면 "1,200g 을 취소했다"는
   * 사실이 장부 어디에도 없다 — 640g 은 그냥 사라진다.
   */
  perform pg_temp.eq('취소 후 재고 = 560 − 1,200', stock_total_base(v_i), -640, 0.001);
  perform pg_temp.ok('부족분을 정상 결과로 돌려주지 않는다', not (v_rev ? 'shortfall'));

  perform pg_temp.eq('취소 이벤트는 입고 전체의 반대',
    (select coalesce(sum(count_delta), 0) from inventory_events
      where order_record_id = v_order and type = 'adjust'), -1200, 0.001);

  perform pg_temp.ok('`미반영` 메모를 더 이상 달지 않는다',
    not exists (select 1 from inventory_events
                 where order_record_id = v_order and note like '%미반영%'));

  perform pg_temp.eq('원장 합 = 잔액',
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_i),
    stock_total_base(v_i), 0.001);

  -- 취소는 기록일 뿐 단가를 흔들지 않는다(0072).
  perform pg_temp.ok('취소해도 기준단가는 값이 남는다', base_unit_price(v_i) is not null);
end $t$;


-- ── ② 폐기는 음수에서 재고를 늘리지 않는다 ────────────────────
do $t$
declare
  v_i      uuid := pg_temp.ing('양파');
  v_took   numeric;
  v_before numeric;
begin
  -- 음수 장부를 만든다. 판매가 재고보다 많았던 상태다.
  perform e5_stock_adjusted(v_i, 0, false, 'T19 기준 맞추기');
  update inventory_states set stock_total = -640 where ingredient_id = v_i;
  v_before := stock_total_base(v_i);
  perform pg_temp.eq('폐기 전 재고', v_before, -640, 0.001);

  /*
   * 0102 의 식은 `least(p_amount, v_before)` 였다. 재고가 음수면
   *   least(100, −640) = −640  →  stock = −640 − (−640) = 0
   * 폐기 한 번에 부족분이 통째로 지워졌다. 반환값도 −640 이라
   * 부르는 쪽은 원장에 **+640** 을 적었다.
   */
  v_took := consume_stock(v_i, 100, false);
  perform pg_temp.eq('뺄 게 없으면 0을 뺀다', v_took, 0, 0.001);
  perform pg_temp.eq('폐기가 재고를 늘리지 않는다', stock_total_base(v_i), -640, 0.001);

  -- 양수 구간에서는 있는 만큼만 빼는 정책이 그대로다(기획안 §5.6).
  perform e5_stock_adjusted(v_i, 300, false, 'T19 기준 맞추기');
  v_took := consume_stock(v_i, 500, false);
  perform pg_temp.eq('있는 만큼만 뺀다', v_took, 300, 0.001);
  perform pg_temp.eq('폐기는 0 아래로 안 내려간다', stock_total_base(v_i), 0, 0.001);

  -- 판매·취소 경로는 반대다.
  v_took := consume_stock(v_i, 500, true);
  perform pg_temp.eq('판매는 필요량 전체를 뺀다', v_took, 500, 0.001);
  perform pg_temp.eq('그래서 음수가 된다', stock_total_base(v_i), -500, 0.001);
end $t$;


-- ── ③ 사용자 입력값은 여전히 음수 불가 ────────────────────────
-- 음수가 되는 건 **계산 결과인 장부 잔액 하나뿐**이다. 입력칸이 아니다.
do $t$
declare v_i uuid := pg_temp.ing('대파');
begin
  perform pg_temp.raises('입고 용량 음수는 거부',
    format('select quick_inbound(%L, %L, -1000, 4000, 1)', pg_temp.store(), v_i), '22000');
  perform pg_temp.raises('입고 수량 음수는 거부',
    format('select quick_inbound(%L, %L, 1000, 4000, -1)', pg_temp.store(), v_i), '22000');
  -- 실사도 마찬가지다. 사장님이 `−750` 을 적어 넣는 길은 없다 —
  -- 음수는 판매·취소가 만든 **결과**일 때만 생긴다.
  perform pg_temp.raises('실사 수량 음수는 거부',
    format('select e5_stock_adjusted(%L, -750, false)', v_i), '22000');
end $t$;
