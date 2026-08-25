-- ════════════════════════════════════════════════════════════════
-- 08 · 화면의 추가·수정이 실제로 저장되는가
--
-- "식재료 추가/수정 · 레시피 추가/수정 · 발주 추가/수정 · 매출 추가/수정 —
--  다 실데이터지?" 에 대한 답을 코드로 못 박는다.
--
-- 각 화면이 실제로 부르는 RPC 를 그대로 호출하고, 저장된 값을 **다시 읽어**
-- 확인한다. 저장 함수가 오류를 안 내는 것과 값이 실제로 남는 것은 다르다.
-- ════════════════════════════════════════════════════════════════

-- ⚠ 오늘 영업일이 열려 있어야 판매를 적을 수 있다.
--   날이 바뀌면 아무도 안 연 채 테스트가 돈다 — 실제로 08-23 아침에 이 파일이 빨개졌다.
--   07·12 와 같은 수로 여기서 연다. 트랜잭션 안이라 곧 되돌려진다.
do $open$ begin
  perform open_business_day(pg_temp.store());
exception when others then null; end $open$;

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
  -- ⚠ 방금 만든 메뉴는 **오늘 기준(영업 시작 스냅샷)에 없다**(0050).
  --   실제 사장님도 영업 중에 새 메뉴를 만들면 다음 영업일부터 판다.
  --   테스트는 영업일을 닫았다 다시 열어 새 기준을 잡는다.
  perform close_business_day(pg_temp.store());
  perform reopen_business_day(pg_temp.store(), v_day);
  update business_days set snapshot = build_day_snapshot(pg_temp.store())
   where store_id = pg_temp.store() and business_date = v_day;

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

-- ════════════════════════════════════════════════════════════════
-- 0043 · 플랫폼 수수료는 **한 번만** 빠진다
--
-- 고정지출의 'commission' 과 채널 fee_rate 가 둘 다 손익에서 차감돼
-- 같은 돈을 두 번 뺐다(실측 19일 503,397원). 채널 쪽을 없앴다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare j jsonb := sales_summary(pg_temp.store(), business_day() - 20, business_day());
begin
  -- 손익에 채널 수수료 항목이 아예 없어야 한다. 있으면 누가 되살린 것이다.
  perform pg_temp.ok('순이익에 channel_fee 가 없다', not (j ? 'channel_fee'));
  perform pg_temp.eq('sales_channels 에 fee_rate 컬럼 없음',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'sales_channels'
        and column_name in ('fee_rate', 'fee_note')), 0, 0);

  -- 손익 항등식 — 빠지는 항목이 정확히 이것뿐이다.
  perform pg_temp.eq('순이익 = 매출 − 재료 − 부자재 − 세금 − 폐기 − 일일추가 − 고정비',
    (j->>'profit')::numeric,
    (j->>'revenue')::numeric - (j->>'material_cost')::numeric
      - (j->>'extra_material_cost')::numeric - (j->>'tax')::numeric
      - (j->>'waste_loss')::numeric - (j->>'daily_extra')::numeric
      - (j->>'fixed_cost')::numeric, 0.01);

  -- 채널은 세 개로 고정이다 — 새로 만들 수 없어야 한다.
  perform pg_temp.raises('채널 신규 생성은 거부',
    format('select save_channel(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"네이버주문"}'), '22000');

  -- 이름 수정은 된다.
  declare v_ch uuid;
  begin
    select id into v_ch from sales_channels where store_id = pg_temp.store() and code = 'delivery';
    perform save_channel(pg_temp.store(), jsonb_build_object('id', v_ch, 'name', '배민·쿠팡'));
    perform pg_temp.eq_t('채널 이름 수정됨',
      (select name from sales_channels where id = v_ch), '배민·쿠팡');
  end;
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0046 · 팔 수 없는 메뉴는 팔리지 않는다
--
-- 재고 0 에서 팔면 원장이 소진을 기록하지 못한다(실측: 대파 125g 필요·차감 0g·
-- 이벤트 0건). 매출과 재료비는 남는데 재고에서 나간 흔적이 없어, 다음 입고 때
-- 재고가 실제보다 많아지고 그 오차가 영영 안 지워진다. 그래서 **막는다.**
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_pa  uuid := pg_temp.ing('대파');
  v_day date := business_day();
begin
  -- 오늘 판매를 0 으로 되돌려 기준선을 만든다.
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 0);

  -- ── 재료가 있으면 팔린다 ────────────────────────────────────
  perform pg_temp.ok('재료가 있으면 판매 가능', recipe_blocked_by(v_rcp) is null);
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 2, 0, 0, 0);

  /*
   * ── 재료가 바닥나도 **막지 않는다** (0102) ──────────────────
   *
   * ⚠ 예전엔 22000 으로 거부했다. 그런데 판매가 재고를 넘어 음수가 되면
   *   그 메뉴를 **영영 못 고치게** 된다 — 수량 수정도 같은 문으로 들어오기 때문이다
   *   (실측: 소불고기가 −750g 이 되자 재조정이 튕겼다).
   *   기획안 §2.1·§4.4: "판매는 재고 부족 여부와 관계없이 기록한다."
   *   부족은 막는 게 아니라 **알리는 것**이다 — 응답의 shortages 와 매출 상단 안내.
   *
   * ⚠ '판매 중지'(사장님이 끈 메뉴)는 여전히 막는다. 그건 재고가 아니라 의도다.
   */
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 0);
  perform e2_discard(v_pa, 0);
  perform pg_temp.eq_t('막는 재료를 알려준다', recipe_blocked_by(v_rcp), '대파');

  perform pg_temp.ok('재료가 없어도 판매는 기록된다',
    e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 5, 0, 0, 0) is not null);
  perform pg_temp.ok('그만큼 재고가 음수로 내려간다',
    stock_total_base(v_pa) < 0);
  perform pg_temp.eq('원장 합 = 잔액 (음수여도)',
    (select stock_total from inventory_states where ingredient_id = v_pa),
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_pa), 0.001);

  -- ⚠ 수량 0(지우기)은 당연히 된다 — 오입력을 영영 못 지우면 안 된다.
  perform pg_temp.ok('0 으로 지우기도 된다',
    e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 0) is not null);
  perform pg_temp.eq('지우면 재고가 되돌아온다',
    stock_total_base(v_pa), 0, 0.001);

  -- 조리 폐기만 적는 것도 같은 문이다.
  perform pg_temp.ok('재료가 없어도 조리 폐기는 기록된다',
    e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 3) is not null);
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 0);

  -- ── 판매중지 메뉴는 막힌다 ──────────────────────────────────
  declare v_rice uuid := pg_temp.rcp('공기밥');
  begin
    perform deactivate_recipe(v_rice);
    perform pg_temp.raises('판매중지 메뉴는 판매 거부',
      format('select e10_sale_recorded(%L,%L,%L,3,0,0,0)', pg_temp.store(), v_day, v_rice), '22000');
    perform pg_temp.ok('판매중지 메뉴도 0 으로 지우기는 된다',
      e10_sale_recorded(pg_temp.store(), v_day, v_rice, 0, 0, 0, 0) is not null);
  end;

  -- ── 목록이 막힘 사유를 함께 준다 (화면이 배지를 그릴 근거) ──
  perform pg_temp.eq_t('recipe_list 가 blocked_by 를 준다',
    (select blocked_by from recipe_list(pg_temp.store()) where id = v_rcp), '대파');
end $t$;
