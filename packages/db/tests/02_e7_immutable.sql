-- ════════════════════════════════════════════════════════════════
-- 02 · E7 발주 등록은 **기록만** 한다 (절대원칙 2)
--
-- 가이드 P0-6: "E7 전후 재고, 기준단가, 재고 이벤트 수가 변하지 않는 테스트를 반드시 둔다."
--
-- 왜 중요한가: 발주는 "살 예정"이지 "산 것"이 아니다. 여기서 재고가 늘면
-- 아직 오지도 않은 물건으로 원가를 계산하게 되고, 입고(E1) 때 이중 반영된다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing    uuid := pg_temp.ing('대파');
  v_vendor uuid;
  v_order  uuid;
  b_stock  numeric; a_stock  numeric;
  b_price  numeric; a_price  numeric;
  b_events bigint;  a_events bigint;
  b_trend  bigint;  a_trend  bigint;
begin
  select id into v_vendor from vendors where store_id = pg_temp.store() limit 1;

  select stock_total_base(v_ing), base_unit_price(v_ing),
         (select count(*) from inventory_events where ingredient_id = v_ing),
         (select count(*) from price_trends     where ingredient_id = v_ing)
    into b_stock, b_price, b_events, b_trend;

  v_order := e7_place_order(pg_temp.store(), v_ing, v_vendor, null,
                            1000, 4000, 3, business_day() + 1);

  select stock_total_base(v_ing), base_unit_price(v_ing),
         (select count(*) from inventory_events where ingredient_id = v_ing),
         (select count(*) from price_trends     where ingredient_id = v_ing)
    into a_stock, a_price, a_events, a_trend;

  perform pg_temp.ok('E7 이 발주를 만들었다', v_order is not null);
  perform pg_temp.eq('E7 전후 재고 불변',        a_stock,  b_stock,  0);
  perform pg_temp.eq('E7 전후 기준단가 불변',    a_price,  b_price,  0);
  perform pg_temp.eq('E7 전후 재고이벤트 수 불변', a_events, b_events, 0);
  -- 단가 추이도 마찬가지다. 발주가 추이에 점을 찍으면 그래프가 거짓말한다.
  perform pg_temp.eq('E7 전후 단가추이 수 불변', a_trend,  b_trend,  0);

  -- 발주 자체는 남아야 한다 — 기록만 한다는 게 "아무것도 안 한다"는 뜻은 아니다.
  perform pg_temp.ok('발주 레코드가 남았다',
    exists (select 1 from order_records where id = v_order and status <> 'received'));
end $t$;
