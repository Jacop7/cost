-- ════════════════════════════════════════════════════════════════
-- 20 · 부족 판정 두 가지 (0107)
--
-- 판정이 하나였을 때 이게 안 잡혔다 —
--     소고기 100g · 소불고기 1개 필요량 150g  →  못 만드는데 조용했다
-- `재고 <= 0` 만 봤기 때문이다. 0 이 아니면 있는 줄 알았다.
--
-- 그리고 반대쪽 실수도 막아야 한다 — 판매 **수량을 줄이는데** 부족 경고가
-- 뜨면 안 된다. 줄이면 오히려 재고가 돌아온다.
-- ════════════════════════════════════════════════════════════════

-- 결과에서 레시피 하나를 꺼낸다.
create function pg_temp.rc(p_res jsonb, p_name text) returns jsonb
language sql immutable as $h$
  select x from jsonb_array_elements(p_res->'recipes') x where x->>'name' = p_name limit 1
$h$;

-- 그 레시피 안에서 재료 하나를 꺼낸다.
create function pg_temp.ig(p_res jsonb, p_recipe text, p_ing text) returns jsonb
language sql immutable as $h$
  select y from jsonb_array_elements(pg_temp.rc(p_res, p_recipe)->'ingredients') y
   where y->>'name' = p_ing limit 1
$h$;


-- ── ① 영업 시작 — 1개도 못 만드는가 ───────────────────────────
do $t$
declare
  v_beef uuid := pg_temp.ing('소고기 불고기감');
  v_res  jsonb;
begin
  -- 재고는 있지만 1인분에 모자란다. 예전 판정(`<= 0`)이 놓치던 구간이다.
  perform e5_stock_adjusted(v_beef, 100, false, 'T20 기준 맞추기');
  v_res := recipe_shortages(pg_temp.store());

  perform pg_temp.eq_t('판정 종류를 밝힌다', v_res->>'mode', 'start');
  perform pg_temp.ok('100g 으로는 150g 짜리를 못 만든다',
    pg_temp.rc(v_res, '소불고기') is not null);
  perform pg_temp.eq('1개 필요량을 실어 준다',
    (pg_temp.ig(v_res, '소불고기', '소고기 불고기감')->>'need')::numeric, 150, 0.001);
  perform pg_temp.eq('현재 재고도 그대로',
    (pg_temp.ig(v_res, '소불고기', '소고기 불고기감')->>'stock')::numeric, 100, 0.001);

  -- 1개는 만들 수 있으면 여기 안 들어온다. 안전재고(2kg) 미달이어도 마찬가지다 —
  -- 그건 `소진 임박` 이고 전체 부족 재고에서 본다.
  perform e5_stock_adjusted(v_beef, 200, false, 'T20 기준 맞추기');
  v_res := recipe_shortages(pg_temp.store());
  perform pg_temp.ok('1개는 만들 수 있으면 경고에 안 넣는다',
    pg_temp.ig(v_res, '소불고기', '소고기 불고기감') is null);

  -- ⚠ 음수 재고 확인은 여기서 안 한다. `update inventory_states` 로 만들면
  --   원장을 건너뛰어 뒤 블록의 `원장 합 = 잔액` 이 정확히 그만큼 어긋난다
  --   (실제로 750 만큼 틀렸다). 아래 ②에서 **실제 판매로** 음수를 만들어 확인한다.

  -- 같은 재료가 여러 메뉴를 막아도 상단 숫자는 하나로 센다.
  perform pg_temp.ok('재료 수 <= 레시피별 재료 수 합',
    (v_res->>'ingredient_count')::int
      <= (select coalesce(sum((x->>'count')::int), 0)
            from jsonb_array_elements(v_res->'recipes') x));
end $t$;


-- ── ② 판매 — 이번에 더 빠질 몫만 본다 ─────────────────────────
do $t$
declare
  v_beef uuid := pg_temp.ing('소고기 불고기감');
  v_r    uuid := pg_temp.rcp('소불고기');
  v_day  date;
  v_res  jsonb;
  v_item jsonb;
begin
  -- 스냅샷이 있어야 필요량이 나온다. 닫혀 있으면 다시 연다(다른 테스트와 같은 처리).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  v_day := business_day();

  -- ⚠ 오늘 장부에 이미 판매가 적혀 있을 수 있다(앱으로 넣은 실데이터). 그러면
  --   목표치 대조가 델타 0 을 내서 아무것도 안 빠진다 — 실제로 그렇게 틀렸다.
  --   먼저 0 으로 되돌려 출발점을 고정한다.
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 0)));

  perform e5_stock_adjusted(v_beef, 10000, false, 'T20 기준 맞추기');
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 10)));
  perform pg_temp.eq('10개 팔면 1,500g 이 빠진다', stock_total_base(v_beef), 8500, 0.001);

  -- 이제 재고를 300g 으로 낮춘다. 5개를 더 팔려면 750g 이 필요하니 모자란다.
  perform e5_stock_adjusted(v_beef, 300, false, 'T20 기준 맞추기');

  /*
   * ⚠ 여기가 핵심이다. 10 → 7 은 **되돌리는** 저장이다.
   *   전체 판매량(7개 × 150g = 1,050g)으로 재면 300g 뿐이라 부족으로 보이지만,
   *   실제로는 450g 이 재고로 돌아온다. 경고가 뜨면 거짓말이다.
   */
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 7)));
  perform pg_temp.eq_t('판정 종류를 밝힌다', v_res->>'mode', 'sale');
  perform pg_temp.eq('수량을 줄이는 저장은 부족이 아니다',
    (v_res->>'ingredient_count')::int, 0, 0);

  -- 같은 수량을 다시 저장해도 더 빠질 게 없다(0028 목표치 대조와 같은 셈).
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 10)));
  perform pg_temp.eq('같은 수량 재호출도 부족이 아니다',
    (v_res->>'ingredient_count')::int, 0, 0);

  -- 15개로 늘리면 **늘어난 5개분**만 잰다.
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 15)));
  v_item := pg_temp.ig(v_res, '소불고기', '소고기 불고기감');
  perform pg_temp.ok('늘리는 저장은 부족을 잡는다', v_item is not null);
  perform pg_temp.eq('필요 수량은 증가분 5개 × 150g', (v_item->>'need')::numeric, 750, 0.001);
  perform pg_temp.eq('현재 재고를 그대로 준다', (v_item->>'stock')::numeric, 300, 0.001);

  -- 재고가 넉넉하면 늘려도 조용하다.
  perform e5_stock_adjusted(v_beef, 10000, false, 'T20 기준 맞추기');
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 15)));
  perform pg_temp.ok('넉넉하면 경고하지 않는다',
    pg_temp.ig(v_res, '소불고기', '소고기 불고기감') is null);

  -- ── 미리보기 = 실제 차감 ─────────────────────────────────────
  -- 이게 어긋나면 그 경고는 두 번 다시 못 믿는다.
  perform e5_stock_adjusted(v_beef, 300, false, 'T20 기준 맞추기');
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 15)));
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 15)));
  perform pg_temp.eq('미리 잰 필요 수량만큼 실제로 빠졌다',
    stock_total_base(v_beef),
    300 - (pg_temp.ig(v_res, '소불고기', '소고기 불고기감')->>'need')::numeric, 0.001);
  perform pg_temp.eq('그래서 음수가 된다', stock_total_base(v_beef), -450, 0.001);

  perform pg_temp.eq('원장 합 = 잔액',
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_beef),
    stock_total_base(v_beef), 0.001);

  -- 음수가 된 재료는 영업 시작 판정에도 그대로 실린다. 0 으로 감추지 않는다.
  v_res := recipe_shortages(pg_temp.store());
  perform pg_temp.eq('음수 재고도 그대로 실어 준다',
    (pg_temp.ig(v_res, '소불고기', '소고기 불고기감')->>'stock')::numeric, -450, 0.001);
end $t$;
