-- ════════════════════════════════════════════════════════════════
-- 03 · E1 입고 확정 — 전파와 이중 확정 방어
--
-- 가이드 P0-2: "이미 입고 확정된 주문을 다시 확정해도 이중 반영되지 않도록
--               DB 수준에서 방어한다."
-- 불변식 8: 빠른 반복 탭이 이중 반영되면 안 된다. 화면 버튼 disabled 로는 못 막는다 —
--           네트워크 재시도와 동시 요청은 서버까지 두 번 온다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing    uuid := pg_temp.ing('대파');
  v_vendor uuid;
  v_order  uuid;
  b_stock  numeric; m_stock numeric; a_stock numeric;
  b_events bigint;  m_events bigint;
  b_trend  bigint;  m_trend  bigint;
  v_vol    numeric := 1000;
  v_qty    numeric := 3;
begin
  select id into v_vendor from vendors where store_id = pg_temp.store() limit 1;
  select stock_total_base(v_ing),
         (select count(*) from inventory_events where ingredient_id = v_ing),
         (select count(*) from price_trends     where ingredient_id = v_ing)
    into b_stock, b_events, b_trend;

  v_order := e7_place_order(pg_temp.store(), v_ing, v_vendor, null,
                            v_vol, 4000, v_qty, business_day());

  -- ── 1회 확정 ─────────────────────────────────────────────────
  perform e1_confirm_inbound(v_order, v_qty, 'test-key-1');
  select stock_total_base(v_ing),
         (select count(*) from inventory_events where ingredient_id = v_ing),
         (select count(*) from price_trends     where ingredient_id = v_ing)
    into m_stock, m_events, m_trend;

  -- 재고는 **기준단위**로 늘어야 한다: 개수 × 용량 (0034 에서 통일)
  perform pg_temp.eq('E1 재고 증가 = 개수 × 용량', m_stock - b_stock, v_qty * v_vol, 0.0001);
  perform pg_temp.eq('E1 이 재고이벤트 1건 남김', m_events - b_events, 1, 0);
  -- 절대원칙 4: 추이는 1차부터 항상 적재한다.
  perform pg_temp.eq('E1 이 단가추이 1건 남김', m_trend - b_trend, 1, 0);
  perform pg_temp.eq_t('발주 상태가 입고완료',
    (select status::text from order_records where id = v_order), 'received');

  -- ── 같은 키로 재확정 (재시도·중복 탭) ────────────────────────
  perform e1_confirm_inbound(v_order, v_qty, 'test-key-1');
  select stock_total_base(v_ing) into a_stock;
  perform pg_temp.eq('같은 키 재확정 → 재고 그대로', a_stock, m_stock, 0);
  perform pg_temp.eq('같은 키 재확정 → 이벤트 안 늘어남',
    (select count(*) from inventory_events where ingredient_id = v_ing), m_events, 0);

  -- ── 키 없이 재확정 (다른 경로로 들어온 중복) ─────────────────
  perform e1_confirm_inbound(v_order, v_qty, null);
  perform pg_temp.eq('키 없이 재확정 → 재고 그대로', stock_total_base(v_ing), m_stock, 0);
  perform pg_temp.eq('키 없이 재확정 → 이벤트 안 늘어남',
    (select count(*) from inventory_events where ingredient_id = v_ing), m_events, 0);

  -- ── 원장 항등식: 이벤트 합계 = 재고 (0034/0035) ──────────────
  perform pg_temp.eq('원장 합계 = 현재 재고',
    (select coalesce(sum(count_delta),0) from inventory_events where ingredient_id = v_ing),
    stock_total_base(v_ing), 0.0001);
end $t$;
