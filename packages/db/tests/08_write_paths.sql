-- ════════════════════════════════════════════════════════════════
-- 08 · 화면의 추가·수정이 실제로 저장되는가
--
-- "식재료 추가/수정 · 레시피 추가/수정 · 발주 추가/수정 · 매출 추가/수정 —
--  다 실데이터지?" 에 대한 답을 코드로 못 박는다.
--
-- 각 화면이 실제로 부르는 RPC 를 그대로 호출하고, 저장된 값을 **다시 읽어**
-- 확인한다. 저장 함수가 오류를 안 내는 것과 값이 실제로 남는 것은 다르다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_id     uuid;
  v_cat    uuid;
  v_vendor uuid;
  v_order  uuid;
  v_rcp    uuid;
  v_day    date := business_day();
  d        jsonb;
  r        record;
begin
  select id into v_cat    from categories where store_id = pg_temp.store() and kind = 'ingredient' limit 1;
  select id into v_vendor from vendors    where store_id = pg_temp.store() limit 1;

  -- ══ 식재료 추가 (ING 폼) ═══════════════════════════════════
  v_id := save_ingredient(pg_temp.store(), jsonb_build_object(
    'name', '테스트 식재료', 'category_id', v_cat,
    'base_unit', 'g', 'per_volume', 500,
    'safety_stock', 3, 'min_order_qty', 2,
    'default_vendor_id', v_vendor, 'memo', '검증용'));
  perform pg_temp.ok('식재료 추가 → id 반환', v_id is not null);

  select name, per_volume, safety_stock, min_order_qty, memo into r
    from ingredients where id = v_id;
  perform pg_temp.eq_t('식재료 이름이 저장됨', r.name, '테스트 식재료');
  perform pg_temp.eq('개당 용량이 저장됨', r.per_volume, 500, 0);
  perform pg_temp.eq('안전재고가 저장됨', r.safety_stock, 3, 0);
  perform pg_temp.eq_t('메모가 저장됨', r.memo, '검증용');

  -- ══ 식재료 수정 ════════════════════════════════════════════
  perform save_ingredient(pg_temp.store(), jsonb_build_object(
    'id', v_id, 'name', '테스트 식재료(수정)', 'category_id', v_cat,
    'base_unit', 'g', 'per_volume', 800, 'safety_stock', 7,
    'min_order_qty', 2, 'memo', '수정됨'));
  select name, per_volume, safety_stock, memo into r from ingredients where id = v_id;
  perform pg_temp.eq_t('식재료 수정 — 이름', r.name, '테스트 식재료(수정)');
  perform pg_temp.eq('식재료 수정 — 용량', r.per_volume, 800, 0);
  perform pg_temp.eq_t('식재료 수정 — 메모', r.memo, '수정됨');
  -- 수정이 새 행을 만들면 재고가 둘로 갈린다.
  perform pg_temp.eq('수정이 새 행을 만들지 않는다',
    (select count(*) from ingredients where store_id = pg_temp.store()
      and name like '테스트 식재료%'), 1, 0);

  -- ══ 구매 옵션 추가 (ING-06) ════════════════════════════════
  perform save_purchase_option(pg_temp.store(), jsonb_build_object(
    'ingredient_id', v_id, 'vendor_id', v_vendor,
    'name', '테스트 옵션', 'volume', 800, 'amount', 5000));
  perform pg_temp.eq('구매 옵션이 저장됨',
    (select count(*) from purchase_options where ingredient_id = v_id), 1, 0);

  -- ══ 레시피 추가 (RCP 폼) ═══════════════════════════════════
  v_rcp := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '테스트 메뉴', 'price', 9000, 'base_servings', 5,
    'tax_mode', 'included', 'target_profit_rate', 35,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id', pg_temp.ing('대파'), 'input_qty', 100),
      jsonb_build_object('ingredient_id', v_id, 'input_qty', 50)),
    'extras', jsonb_build_array(
      jsonb_build_object('name', '포장비', 'amount', 200))));
  perform pg_temp.ok('레시피 추가 → id 반환', v_rcp is not null);
  perform pg_temp.eq('재료 라인 2개가 저장됨',
    (select count(*) from recipe_lines where recipe_id = v_rcp), 2, 0);
  perform pg_temp.eq('추가 지출이 저장됨',
    (select coalesce(sum(amount_per_serving),0) from recipe_extra_costs where recipe_id = v_rcp),
    200, 0.01);

  -- 저장이 곧 계산이다(E3) — 화면이 따로 계산을 부르지 않아도 손익이 나와야 한다.
  select material_cost, profit, price into r from recipe_list(pg_temp.store()) where id = v_rcp;
  perform pg_temp.ok('저장 즉시 재료비가 계산됨', r.material_cost > 0);
  perform pg_temp.eq('판매가가 저장됨', r.price, 9000, 0);
  perform pg_temp.ok('저장 즉시 손익 추이가 적재됨',
    exists (select 1 from profit_trends where recipe_id = v_rcp));

  -- ══ 레시피 수정 — 라인 교체가 이중 등록되지 않는다 ═════════
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '테스트 메뉴(수정)', 'price', 11000, 'base_servings', 5,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id', pg_temp.ing('대파'), 'input_qty', 150)),
    'extras', jsonb_build_array()));
  perform pg_temp.eq('레시피 수정 — 라인이 1개로 교체됨',
    (select count(*) from recipe_lines where recipe_id = v_rcp), 1, 0);
  perform pg_temp.eq('레시피 수정 — 추가 지출이 비워짐',
    (select count(*) from recipe_extra_costs where recipe_id = v_rcp), 0, 0);
  perform pg_temp.eq('레시피 수정 — 판매가 반영',
    (select price from recipes where id = v_rcp), 11000, 0);

  -- ══ 발주 등록 (ORD-02 · E7) ════════════════════════════════
  v_order := e7_place_order(pg_temp.store(), v_id, v_vendor, null,
                            800, 5000, 4, v_day + 2);
  select vendor_id, volume, amount, qty, expected_at, status into r
    from order_records where id = v_order;
  perform pg_temp.eq('발주 수량이 저장됨', r.qty, 4, 0);
  perform pg_temp.eq('발주 금액이 저장됨', r.amount, 5000, 0);
  perform pg_temp.ok('입고 예정일이 저장됨', r.expected_at = v_day + 2);
  perform pg_temp.ok('발주 상태가 대기', r.status <> 'received');

  -- ══ 발주 수정 = 입고 확정 (ORD-03 · E1) ════════════════════
  -- 예정 4개 중 실제 3개만 왔다고 고쳐 확정한다. 화면의 '수량 수정 후 입고' 경로다.
  perform e1_confirm_inbound(v_order, 3, 'test-write-path');
  select received_qty, status into r from order_records where id = v_order;
  perform pg_temp.eq('입고 실수량 3 이 저장됨', r.received_qty, 3, 0);
  -- 주문 4 · 도착 3 → 부분 입고다. 전량 입고로 뭉뚱그리면 덜 온 1개가 사라진다.
  perform pg_temp.eq_t('덜 왔으면 상태가 부분 입고', r.status::text, 'partial');
  perform pg_temp.eq('재고가 3 × 800 만큼 늘었다', stock_total_base(v_id), 2400, 0.0001);
  perform pg_temp.ok('기준단가가 산출됨', base_unit_price(v_id) is not null);

  -- 전량 입고는 '입고완료' 여야 한다.
  declare v_full uuid;
  begin
    v_full := e7_place_order(pg_temp.store(), v_id, v_vendor, null, 800, 5000, 2, v_day);
    perform e1_confirm_inbound(v_full, 2, 'test-write-path-full');
    perform pg_temp.eq_t('전량 왔으면 상태가 입고완료',
      (select status::text from order_records where id = v_full), 'received');
    perform pg_temp.eq('재고가 2 × 800 더 늘었다', stock_total_base(v_id), 4000, 0.0001);
  end;

  -- ══ 매출 등록 (SALES 폼) ═══════════════════════════════════
  d := save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object(
      'recipe_id', v_rcp, 'qty_hall', 6, 'qty_delivery', 2,
      'qty_takeout', 1, 'qty_waste', 1)),
    -- 앱이 보내는 형식 그대로다(features/sales/hooks.ts).
    -- 기타 매출은 단가 × 수량, 일일 추가지출은 금액.
    jsonb_build_array(jsonb_build_object('name', '음료', 'price', 3000, 'qty', 5)),
    jsonb_build_array(jsonb_build_object('name', '얼음', 'amount', 3000, 'memo', '')));
  perform pg_temp.ok('매출 등록 → 결과 반환', d is not null);

  select it.qty_hall, it.qty_delivery, it.qty_takeout, it.qty_waste into r
    from daily_sales_items it join daily_sales s on s.id = it.daily_sales_id
   where s.store_id = pg_temp.store() and s.sale_date = v_day and it.recipe_id = v_rcp;
  perform pg_temp.eq('홀 판매 수량', r.qty_hall, 6, 0);
  perform pg_temp.eq('배달 판매 수량', r.qty_delivery, 2, 0);
  perform pg_temp.eq('포장 판매 수량', r.qty_takeout, 1, 0);
  perform pg_temp.eq('조리 폐기 수량', r.qty_waste, 1, 0);
  -- 합계는 서버가 항목에서 계산한다(3,000 × 5). 화면이 보낸 합계를 믿지 않는다.
  perform pg_temp.eq('기타 매출 합계를 서버가 계산',
    (select etc_revenue from daily_sales
      where store_id = pg_temp.store() and sale_date = v_day), 15000, 0.01);
  perform pg_temp.eq('일일 추가지출이 저장됨',
    (select daily_extra from daily_sales
      where store_id = pg_temp.store() and sale_date = v_day), 3000, 0.01);

  -- ══ 매출 수정 — 같은 날 같은 메뉴는 덮어쓴다 ═══════════════
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object(
      'recipe_id', v_rcp, 'qty_hall', 2, 'qty_delivery', 0,
      'qty_takeout', 0, 'qty_waste', 0)), null, null);
  perform pg_temp.eq('매출 수정 — 행이 늘지 않는다',
    (select count(*) from daily_sales_items it join daily_sales s on s.id = it.daily_sales_id
      where s.store_id = pg_temp.store() and s.sale_date = v_day and it.recipe_id = v_rcp), 1, 0);
  perform pg_temp.eq('매출 수정 — 수량이 2 로 바뀜',
    (select it.qty_hall from daily_sales_items it join daily_sales s on s.id = it.daily_sales_id
      where s.store_id = pg_temp.store() and s.sale_date = v_day and it.recipe_id = v_rcp), 2, 0);

  -- 등록만 되고 재고가 안 빠지면 반쪽이다 — 매출이 재고까지 밀고 가야 한다(E8).
  perform pg_temp.ok('매출이 재고를 소진시켰다',
    exists (select 1 from inventory_events ev
             join daily_sales_items it on it.id = ev.sales_item_id
            where it.recipe_id = v_rcp));
end $t$;
