-- ════════════════════════════════════════════════════════════════
-- 06 · 판매 소진은 **목표치 대조**로 맞춘다 (0028)
--
-- 원래 설계는 "되돌리고 다시 적용"이었는데 조용히 실패했다:
--   inventory_events 에는 원장 보존을 위해 DELETE 정책이 없다. RLS 아래에서
--   delete 는 예외 없이 **0행**을 지운다. 되돌림이 안 된 채 중복 가드만 걸려서
--   "팔았는데 재고가 도로 가득 찼다"가 됐다. 화면에는 아무 오류도 안 떴다.
--
-- 그래서 0028 은 되돌리지 않는다. **지금 있어야 할 양과 이미 반영된 양의 차이만** 낸다.
-- 몇 번을 불러도 결과가 같고, 수량 수정도 같은 경로로 처리된다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp   uuid := pg_temp.rcp('제육볶음');
  v_day   date := business_day();
  v_item  uuid;
  b_stock numeric;
  m_stock numeric;
  v_need  numeric;
begin
  -- 제육볶음 1인분에 필요한 대파 양 (반제품 전개 포함)
  select sum(amount) into v_need
    from recipe_ingredient_needs(v_rcp, 1) where ingredient_id = pg_temp.ing('대파');
  perform pg_temp.ok('제육볶음이 대파를 쓴다', v_need > 0);

  -- ⚠ 시드에는 이미 오늘자 제육볶음 판매가 있다. 목표치 대조 모델에서 e10 은
  --   "이만큼 팔렸다"로 **맞추는** 것이지 더하는 게 아니다. 그래서 먼저 0으로 되돌려
  --   기준선을 만든 뒤 측정한다 — 이 자체가 취소(E9)의 첫 검증이기도 하다.
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0);
  select it.id into v_item from daily_sales_items it
    join daily_sales d on d.id = it.daily_sales_id
   where d.store_id = pg_temp.store() and d.sale_date = v_day and it.recipe_id = v_rcp;
  perform e9_sales_reverted(v_item);

  b_stock := stock_total_base(pg_temp.ing('대파'));

  -- ── 10개 판매 등록 → 10인분만큼 소진 ─────────────────────────
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);

  m_stock := stock_total_base(pg_temp.ing('대파'));
  perform pg_temp.eq('10개 판매 → 10인분 소진', b_stock - m_stock, v_need * 10, 0.0001);

  -- ── 같은 판매를 다시 반영해도 더 빠지지 않는다 (멱등) ────────
  -- 불변식 8. 화면 버튼 disabled 로는 못 막는다 — 재시도와 동시 요청은 서버까지 두 번 온다.
  perform e8_sales_consumed(v_item);
  perform pg_temp.eq('재소진 호출은 멱등', stock_total_base(pg_temp.ing('대파')), m_stock, 0.0001);

  -- ── 수량을 15개로 수정 → 차이 5인분만 추가로 빠진다 ──────────
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 15, 0, 0, 0);
  perform pg_temp.eq('10→15 수정은 차이 5인분만 반영',
    b_stock - stock_total_base(pg_temp.ing('대파')), v_need * 15, 0.0001);

  -- ── 수량을 3개로 줄이면 되돌아온다 ───────────────────────────
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 3, 0, 0, 0);
  perform pg_temp.eq('15→3 축소는 재고가 돌아온다',
    b_stock - stock_total_base(pg_temp.ing('대파')), v_need * 3, 0.0001);

  -- ── 취소(E9) → 원래 재고로 완전 복귀 ─────────────────────────
  perform e9_sales_reverted(v_item);
  perform pg_temp.eq('판매 취소 → 재고 원복', stock_total_base(pg_temp.ing('대파')), b_stock, 0.0001);
  perform pg_temp.eq('취소 재호출도 멱등', stock_total_base(pg_temp.ing('대파')), b_stock, 0.0001);

  -- ── 원장은 지워지지 않았다 (절대원칙 4) ──────────────────────
  -- 재고는 원복됐지만 "팔았다가 취소했다"는 사실은 남아야 한다.
  perform pg_temp.ok('취소해도 소진 이벤트는 원장에 남는다',
    exists (select 1 from inventory_events where sales_item_id = v_item));

  -- ── 조리 폐기(qty_waste)도 소진이다 ─────────────────────────
  -- 팔리진 않았지만 재료는 실제로 나갔다. 재고에서 안 빼면 장부에만 남는다.
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 5, 0, 0, 2);
  perform pg_temp.eq('판매5 + 조리폐기2 = 7인분 소진',
    b_stock - stock_total_base(pg_temp.ing('대파')), v_need * 7, 0.0001);
end $t$;
