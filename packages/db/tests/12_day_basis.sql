-- ════════════════════════════════════════════════════════════════
-- 12 · 매출 화면 전체가 그날 기준이다 (0058)
--
-- 사장님: "레시피에서 수정값이 매출페이지에 전부 반영되는 거지?"
-- 재 보니 여섯 군데가 따라 움직였다. 메뉴 손익 상세만 고정돼 있고
-- 합계·분석·되짚기는 현재 값으로 다시 계산해서, 같은 화면 안의 두 숫자가
-- 서로 다른 말을 했다.
--
-- 여기서 못 박는 계약
--   ① 판매가·재료 단가·부자재·세금 항목·고정지출을 한꺼번에 바꿔도
--      **그날 매출 화면의 모든 숫자**가 안 움직인다
--   ② 레시피 화면(현재값)은 **움직인다** — "지금 팔면 얼마 남나"는 다른 질문이다
--   ③ 되짚기 재료비 합계 = 손익의 재료비. 두 화면이 같은 말을 해야 한다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_ing uuid := pg_temp.ing('돼지고기 앞다리');
  v_ven uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day date := business_day();

  -- 수정 전 / 후를 같은 이름으로 비교하려고 나란히 든다.
  b0 jsonb; b1 jsonb;   -- 메뉴 손익 상세
  s0 jsonb; s1 jsonb;   -- 손익 합계
  m0 jsonb;
  m1 jsonb;   -- 재료 되짚기
  e0 jsonb; e1 jsonb;   -- 부자재 되짚기
  f0 jsonb; f1 jsonb;   -- 고정 지출 되짚기
  r0 numeric;
begin
  -- 앞 파일들이 오늘을 닫아 뒀을 수 있다. 열려 있어야 판다.
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);

  b0 := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  s0 := sales_summary(pg_temp.store(), v_day, v_day);
  m0 := sales_material_usage(pg_temp.store(), v_day, v_day);
  e0 := sales_extra_usage(pg_temp.store(), v_day, v_day);
  f0 := sales_fixed_breakdown(pg_temp.store(), v_day, v_day);
  r0 := (select material_cost from recipe_list(pg_temp.store()) where id = v_rcp);

  /*
   * ③ 두 화면이 같은 말을 하는가.
   *
   * ⚠ 되짚기와 손익 재료비는 **같지 않다.** 다른 질문에 답한다 —
   *     되짚기      "이 재료를 얼마나 썼나"  → 조리 폐기도 쓴 것이다
   *     손익 재료비 "판 것의 원가는 얼마인가" → 조리 폐기는 폐기 손실로 따로 뺀다
   *   차이는 정확히 조리 폐기다. 예전엔 그날 조리 폐기가 0이라 우연히 같았고,
   *   폐기가 있는 날 데이터가 들어오자 바로 어긋났다(실측 4,788.70원).
   */
  /*
   * ⚠ 0098 이후 **되짚기 = 손익 재료비**다. 조리 폐기도 재고 부족분도 빼지 않는다.
   *
   *   예전엔 되짚기가 재고 원장을 셌다. 조리 폐기만큼 더 나갔고, 재고가 모자라면
   *   `consume_stock` 이 이벤트를 잘라 덜 나갔다. 두 보정을 달아야 겨우 맞았다
   *   (실측 08-24: 22,425원 어긋남).
   *
   *   이제 그날 기준값 × 판매 수량으로 낸다. 조리 폐기는 처음부터 안 들어가고,
   *   재고가 모자라도 판 것의 원가는 달라지지 않는다. 보정할 게 없다.
   */
  perform pg_temp.eq('되짚기 재료비 = 손익 재료비',
    (m0->>'total')::numeric,
    (s0->>'material_cost')::numeric, 0.01);
  perform pg_temp.eq('되짚기 고정비 = 손익 고정비',
    (f0->>'total')::numeric, (s0->>'fixed_cost')::numeric, 0.01);
  perform pg_temp.eq('고정 항목별 합 = 고정비 합계',
    (select coalesce(sum((i->>'amount')::numeric), 0)
       from jsonb_array_elements(f0->'items') i),
    (f0->>'total')::numeric, 0.01);

  -- ── 마스터 데이터를 한꺼번에 흔든다 ─────────────────────────
  -- 판매가 · 부자재 삭제 · 세금 항목 추가 · 재료 단가 급등 · 인건비 인상.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 20000, 'base_servings', 10,
    'extras', jsonb_build_array()));
  -- ⚠ 세금은 레시피가 아니라 **매장**이 정한다(0087). 여기서 함께 흔든다.
  -- ⚠ 부가세도 항목이다(0090). 빼고 보내면 세금이 되레 줄어 '흔든다'가 안 된다.
  perform save_store_tax(pg_temp.store(), 'included',
    '[{"name":"부가세","rate":9.0909090909},{"name":"카드 수수료","rate":2.5}]'::jsonb);
  perform e1_confirm_inbound(
    e7_place_order(pg_temp.store(), v_ing, v_ven, null, 5000, 150000, 4, v_day), 4, 'TEST-0058');
  perform save_fixed_costs(pg_temp.store(), business_month(), 12000000,
    (select jsonb_agg(case when x->>'key' = 'labor'
        then jsonb_set(jsonb_set(x, '{total}', '4000000'), '{lines}', '[]'::jsonb) || '{"mode":"total"}'::jsonb
        else x end)
       from fixed_costs_monthly, jsonb_array_elements(items) x
      where store_id = pg_temp.store() and month = business_month()));

  b1 := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  s1 := sales_summary(pg_temp.store(), v_day, v_day);
  m1 := sales_material_usage(pg_temp.store(), v_day, v_day);
  e1 := sales_extra_usage(pg_temp.store(), v_day, v_day);
  f1 := sales_fixed_breakdown(pg_temp.store(), v_day, v_day);

  -- ① 매출 화면은 전부 그대로 ─────────────────────────────────
  perform pg_temp.eq('메뉴 손익 · 판매가',   (b1->>'price')::numeric,         (b0->>'price')::numeric, 0.0001);
  perform pg_temp.eq('메뉴 손익 · 재료비',   (b1->>'material_cost')::numeric, (b0->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('메뉴 손익 · 부자재',   (b1->>'extra_cost')::numeric,    (b0->>'extra_cost')::numeric, 0.0001);
  perform pg_temp.eq('메뉴 손익 · 고정비',   (b1->>'fixed_cost')::numeric,    (b0->>'fixed_cost')::numeric, 0.0001);
  perform pg_temp.eq('메뉴 손익 · 세금',     (b1->>'tax')::numeric,           (b0->>'tax')::numeric, 0.0001);
  perform pg_temp.eq('메뉴 손익 · 순이익',   (b1->>'profit')::numeric,        (b0->>'profit')::numeric, 0.0001);

  perform pg_temp.eq('손익 합계 · 매출',     (s1->>'revenue')::numeric,       (s0->>'revenue')::numeric, 0.0001);
  perform pg_temp.eq('손익 합계 · 재료비',   (s1->>'material_cost')::numeric, (s0->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('손익 합계 · 세금',     (s1->>'tax')::numeric,           (s0->>'tax')::numeric, 0.0001);
  -- ⚠ 여기가 새던 자리다. 고정지출률이 현재 월 설정이라 인건비를 올리면 지난 손익이 따라 움직였다.
  perform pg_temp.eq('손익 합계 · 고정비',   (s1->>'fixed_cost')::numeric,    (s0->>'fixed_cost')::numeric, 0.0001);
  perform pg_temp.eq('손익 합계 · 폐기 손실', (s1->>'waste_loss')::numeric,   (s0->>'waste_loss')::numeric, 0.0001);
  perform pg_temp.eq('손익 합계 · 순이익',   (s1->>'profit')::numeric,        (s0->>'profit')::numeric, 0.0001);

  -- ⚠ 수량은 원장인데 단가만 현재 값이라 재료비 내역이 통째로 올라가던 자리다.
  perform pg_temp.eq('되짚기 · 재료 합계',   (m1->>'total')::numeric,         (m0->>'total')::numeric, 0.0001);
  -- ⚠ 부자재를 지우면 그날 내역에서도 사라지던 자리다.
  perform pg_temp.eq('되짚기 · 부자재 합계', (e1->>'total')::numeric,         (e0->>'total')::numeric, 0.0001);
  perform pg_temp.eq('지운 부자재가 그날 내역엔 남는다',
    jsonb_array_length(e1->'items'), jsonb_array_length(e0->'items'), 0);
  perform pg_temp.eq('되짚기 · 고정 합계',   (f1->>'total')::numeric,         (f0->>'total')::numeric, 0.0001);
  perform pg_temp.eq('되짚기 · 고정 항목 수',
    jsonb_array_length(f1->'items'), jsonb_array_length(f0->'items'), 0);
  perform pg_temp.eq('인건비 항목 배분액도 그대로',
    (select (i->>'amount')::numeric from jsonb_array_elements(f1->'items') i where i->>'key' = 'labor'),
    (select (i->>'amount')::numeric from jsonb_array_elements(f0->'items') i where i->>'key' = 'labor'),
    0.0001);

  -- 되짚기와 손익이 여전히 같은 말을 하는가
  -- 같은 이유로 여기도 조리 폐기를 더해야 맞다.
  -- 레시피를 고쳐도 그날 기준값은 안 움직이므로 등식이 유지된다.
  perform pg_temp.eq('수정 후에도 되짚기 = 손익 재료비',
    (m1->>'total')::numeric,
    (s1->>'material_cost')::numeric, 0.01);
  perform pg_temp.eq('수정 후에도 되짚기 = 손익 (고정비)',
    (f1->>'total')::numeric, (s1->>'fixed_cost')::numeric, 0.01);

  -- ② 레시피 화면은 움직여야 한다 ─────────────────────────────
  perform pg_temp.ok('레시피 현재 재료비는 올랐다',
    (select material_cost from recipe_list(pg_temp.store()) where id = v_rcp) > r0);
  perform pg_temp.eq('레시피 현재 판매가도 새 값',
    (select price from recipe_list(pg_temp.store()) where id = v_rcp), 20000, 0);
  perform pg_temp.eq('레시피 현재 세금도 새 항목 포함',
    recipe_tax(v_rcp), 20000 * 10 / 110.0 + 20000 * 0.025, 0.01);

  -- ③ 다음 영업일 기준에는 새 값이 들어간다 ───────────────────
  perform pg_temp.eq('다음 영업일 기준 판매가',
    (build_day_snapshot(pg_temp.store(), store_local_date(pg_temp.store())) #>> array['recipes', v_rcp::text, 'price'])::numeric, 20000, 0);
  perform pg_temp.ok('다음 영업일 기준 고정지출률도 새 값',
    (build_day_snapshot(pg_temp.store(), store_local_date(pg_temp.store()))->>'fixed_rate')::numeric
      > (s0->>'fixed_rate')::numeric);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 폐기 손실도 버린 날 단가다
--
-- 재료값이 오를 때마다 지난달 폐기 손실이 같이 오르면 안 된다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing  uuid := pg_temp.ing('대파');
  v_ven  uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day  date := business_day();
  v_rem  numeric;
  w0     numeric;
  w1     numeric;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)

  -- 대파를 조금 버린다. e2_discard 의 2번째 인자는 **남은 양**이다.
  v_rem := stock_total_base(v_ing);
  perform e2_discard(v_ing, greatest(v_rem - 100, 0));

  w0 := (sales_summary(pg_temp.store(), v_day, v_day)->>'waste_ingredient')::numeric;
  perform pg_temp.ok('버린 만큼 손실이 잡힌다', w0 > 0);

  -- 대파 값을 두 배 넘게 올린다.
  perform e1_confirm_inbound(
    e7_place_order(pg_temp.store(), v_ing, v_ven, null, 1000, 12000, 5, v_day), 5, 'TEST-0058-WASTE');
  perform pg_temp.ok('현재 단가는 올랐다', base_unit_price(v_ing) > 4.0);

  w1 := (sales_summary(pg_temp.store(), v_day, v_day)->>'waste_ingredient')::numeric;
  perform pg_temp.eq('폐기 손실은 버린 날 단가 그대로', w1, w0, 0.0001);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 기간 메뉴 손익 — 날짜별 기준의 합이다 (0059)
--
-- 사장님: "9,300 · 9,800 · 12,000 · 9,800 … 이걸 어떻게 보여줘?"
--         "합계해서 보여준다고 해둬 — 어떤 합도 보여줘야 하잖아."
-- 평균이 아니라 합이다. 개당은 합 나누기 수량이고, 판매가가 여럿이면 그대로 늘어놓는다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_day date := business_day();
  g0    jsonb;
  g1    jsonb;
  b     jsonb;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);

  -- ── 하루짜리 기간 = 그날 값 ─────────────────────────────────
  -- 두 함수가 같은 하루를 다르게 말하면 화면이 어느 쪽을 믿어야 할지 알 수 없다.
  b  := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  g0 := range_menu_detail(pg_temp.store(), v_day, v_day, v_rcp);

  perform pg_temp.eq('기간(하루) 개당 판매가 = 그날 값',
    (g0->>'unit_price')::numeric, (b->>'price')::numeric, 0.0001);
  perform pg_temp.eq('기간(하루) 개당 재료비 = 그날 값',
    (g0->>'unit_material_cost')::numeric, (b->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('기간(하루) 개당 부자재 = 그날 값',
    (g0->>'unit_extra_cost')::numeric, (b->>'extra_cost')::numeric, 0.0001);
  perform pg_temp.eq('기간(하루) 개당 고정비 = 그날 값',
    (g0->>'unit_fixed_cost')::numeric, (b->>'fixed_cost')::numeric, 0.0001);
  perform pg_temp.eq('기간(하루) 개당 세금 = 그날 값',
    (g0->>'unit_tax')::numeric, (b->>'tax')::numeric, 0.0001);
  perform pg_temp.eq('기간(하루) 개당 순이익 = 그날 값',
    (g0->>'unit_profit')::numeric, (b->>'profit')::numeric, 0.0001);
  perform pg_temp.eq('제육 검산값 그대로', (g0->>'unit_profit')::numeric, 4046.69, 0.01);

  -- 합 = 개당 × 수량
  perform pg_temp.eq('재료비 합 = 개당 × 수량',
    (g0->>'material_cost')::numeric,
    (g0->>'unit_material_cost')::numeric * (g0->>'qty')::numeric, 0.01);
  perform pg_temp.eq('판매가가 한 가지면 목록도 하나',
    jsonb_array_length(g0->'price_points'), 1, 0);

  -- ── 마스터를 흔들어도 기간 값은 그대로 ──────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 20000, 'base_servings', 10,
    'extras', jsonb_build_array()));
  perform e1_confirm_inbound(
    e7_place_order(pg_temp.store(), pg_temp.ing('돼지고기 앞다리'),
      (select id from vendors where store_id = pg_temp.store() limit 1),
      null, 5000, 150000, 4, v_day), 4, 'TEST-0059');

  g1 := range_menu_detail(pg_temp.store(), v_day - 6, v_day, v_rcp);
  perform pg_temp.ok('기간 조회에 여러 날이 담긴다', (g1->>'days')::int > 1);

  -- 같은 기간을 다시 물어도 값이 같아야 한다 — 현재 레시피를 안 읽는다는 뜻이다.
  perform pg_temp.eq('수정해도 기간 재료비 그대로',
    (range_menu_detail(pg_temp.store(), v_day - 6, v_day, v_rcp)->>'material_cost')::numeric,
    (g1->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('수정해도 기간 개당 판매가 그대로',
    (range_menu_detail(pg_temp.store(), v_day - 6, v_day, v_rcp)->>'unit_price')::numeric,
    (g1->>'unit_price')::numeric, 0.0001);
  perform pg_temp.ok('지운 부자재도 기간 내역에 남는다',
    jsonb_array_length(g1->'extras') > 0);
  perform pg_temp.ok('고정지출 항목별 배분이 있다',
    jsonb_array_length(g1->'fixed_items') > 0);
  perform pg_temp.eq('고정 항목 합 = 기간 고정비',
    (select coalesce(sum((i->>'amount')::numeric), 0) from jsonb_array_elements(g1->'fixed_items') i),
    (g1->>'fixed_cost')::numeric, 0.01);

  -- 판매가가 여러 가지면 그대로 늘어놓는다 (평균으로 뭉개지 않는다).
  -- ⚠ `v_day - 3` 에 그 메뉴 판매가 있으리라 **가정하면 안 된다.** 날이 바뀌면 창이
  --   밀려 그 날이 비고, 바꿀 행이 0건이라 판매가가 하나만 남는다
  --   (실제로 08-24 아침에 이 파일이 그렇게 깨졌다).
  --   창 안에서 **실제로 판매가 있는 날**을 골라 그 날 가격만 바꾼다.
  update daily_sales_items it set unit_price = 9300
    from daily_sales ds
   where ds.id = it.daily_sales_id and ds.store_id = pg_temp.store()
     and it.recipe_id = v_rcp
     and ds.sale_date = (
       select min(ds2.sale_date)
         from daily_sales ds2 join daily_sales_items it2 on it2.daily_sales_id = ds2.id
        where ds2.store_id = pg_temp.store() and it2.recipe_id = v_rcp
          and ds2.sale_date between v_day - 6 and v_day - 1);

  -- 불변식은 '둘'이라는 숫자가 아니라 **가짓수만큼 늘어놓는다** 이다.
  -- 숫자를 박으면 시드가 바뀔 때마다 또 깨진다.
  perform pg_temp.eq('판매가 가짓수만큼 목록에 담긴다',
    jsonb_array_length(range_menu_detail(pg_temp.store(), v_day - 6, v_day, v_rcp)->'price_points'),
    (select count(distinct it.unit_price)
       from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
      where ds.store_id = pg_temp.store() and it.recipe_id = v_rcp
        and ds.sale_date between v_day - 6 and v_day), 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 판매 입력 카드도 그날 기준이다 (0061)
--
-- 마지막으로 남아 있던 구멍. 돈 숫자는 전부 고정했는데 **판매를 입력하는 카드**만
-- 현재 레시피를 보고 있어서, 판매가를 고치면 카드는 20,000 을 보여 주고
-- 장부에는 12,000 이 박혔다. 화면이 거짓말을 했다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_day date := business_day();
  m0    jsonb;
  m1    jsonb;
  v_new uuid;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)

  m0 := (select m from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) m
          where (m->>'recipe_id')::uuid = v_rcp);
  perform pg_temp.eq('카드에 보이는 판매가 = 오늘 기준', (m0->>'price')::numeric, 12000, 0);
  perform pg_temp.eq('카드 재료비 = 오늘 기준', (m0->>'material_cost')::numeric, 2806.40, 0.01);
  perform pg_temp.ok('오늘 팔 수 있는 메뉴다', (m0->>'in_basis')::boolean);

  -- ⚠ 세금은 매장 하나에 하나라(0087) 앞 블록의 세금 변경이 **전 메뉴**를 건드렸다.
  --   그래서 손도 안 댄 공기밥도 '그날 기준과 다르다'고 알린다 — 그게 맞다.
  --   같은 트랜잭션이라 앞 블록의 수정이 그대로 살아 있다.
  perform pg_temp.ok('세금이 바뀌면 안 고친 메뉴도 달라졌다고 알린다',
    (select (m->>'changed')::boolean
       from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) m
      where (m->>'recipe_id')::uuid = pg_temp.rcp('공기밥')));

  -- ── 영업 중에 판매가를 고친다 ───────────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 20000, 'base_servings', 10));

  m1 := (select m from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) m
          where (m->>'recipe_id')::uuid = v_rcp);
  perform pg_temp.eq('카드는 여전히 오늘 기준을 보여 준다', (m1->>'price')::numeric, 12000, 0);
  perform pg_temp.eq('고친 값도 함께 준다', (m1->>'current_price')::numeric, 20000, 0);
  perform pg_temp.ok('달라졌다고 알린다', (m1->>'changed')::boolean);

  -- ⚠ 이게 핵심이다 — 카드에 보이는 값과 **실제로 기록되는 값**이 같아야 한다.
  perform pg_temp.eq('카드에 보이는 값 = 팔면 기록되는 값',
    (pg_temp.e10(pg_temp.store(), v_day, v_rcp, 5, 0, 0, 0)->>'unit_price')::numeric,
    (m1->>'price')::numeric, 0.0001);

  -- ── 영업 중에 만든 메뉴는 팔면 오늘 기준에 **더해진다** (0062) ─
  -- 오늘 기록이 없는 메뉴라 움직일 숫자가 없다. 막을 이유가 없었다.
  v_new := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '오늘 만든 메뉴', 'price', 5000, 'base_servings', 1));
  perform pg_temp.ok('아직 오늘 기준에는 없다',
    (select (m->>'in_basis')::boolean is false
       from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) m
      where (m->>'recipe_id')::uuid = v_new));
  perform pg_temp.eq('팔면 그 시점 값으로 기록된다',
    (pg_temp.e10(pg_temp.store(), v_day, v_new, 1, 0, 0, 0)->>'unit_price')::numeric, 5000, 0);
  perform pg_temp.ok('그러면서 오늘 기준에 더해진다',
    (day_snapshot(pg_temp.store(), v_day) #> array['recipes', v_new::text]) is not null);
  -- 더해진 뒤의 수정은 여전히 다음 영업일부터다 — 기준은 한 번 정해지면 그날 안 움직인다.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_new, 'name', '오늘 만든 메뉴', 'price', 9900, 'base_servings', 1));
  perform pg_temp.eq('더해진 뒤 고쳐도 오늘은 그대로',
    (pg_temp.e10(pg_temp.store(), v_day, v_new, 2, 0, 0, 0)->>'unit_price')::numeric, 5000, 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 영업 전에 만들고 고친 것은 **오늘부터** 반영된다
--
-- 사장님: "오늘 만든 메뉴라도 영업 전이면 반영 가능해"
--
-- 기준이 굳는 시점은 '오늘 0시'가 아니라 **영업 시작**이다. 그 전에는 아직
-- 아무것도 정해지지 않았으므로, 만들든 고치든 오늘 장사에 그대로 들어간다.
-- 막히는 것은 **영업을 시작한 뒤**에 만든 메뉴뿐이다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_day date := business_day();
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_a   uuid;   -- 영업 전에 만든 메뉴
  v_b   uuid;   -- 영업 시작 뒤에 만든 메뉴
  v_res jsonb;
  m     jsonb;
begin
  -- ── 오늘을 '영업 전'으로 되돌린다 ───────────────────────────
  -- ⚠ 지우지 않고 날짜를 옮긴다. 매출·입출고·발주가 이 행을 참조해 삭제는 막힌다.
  --   전부 이 트랜잭션 안이라 롤백된다.
  perform pg_temp.close_today();   -- 이미 닫혀 있으면 그대로 둔다(프렐류드 헬퍼)
  update business_days set business_date = v_day - 401
   where store_id = pg_temp.store() and business_date = v_day;
  perform pg_temp.eq_t('되돌리면 영업 전',
    business_day_state(pg_temp.store())->>'status', 'none');

  -- ── ① 영업 전에 메뉴를 만든다 ──────────────────────────────
  v_a := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '영업 전에 만든 메뉴', 'price', 7000, 'base_servings', 1));

  m := (select x from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) x
         where (x->>'recipe_id')::uuid = v_a);
  perform pg_temp.ok('영업 전에는 새 메뉴도 오늘 기준에 든다', (m->>'in_basis')::boolean);
  perform pg_temp.eq('카드에 지금 값이 그대로 보인다', (m->>'price')::numeric, 7000, 0);
  perform pg_temp.ok('영업 전에는 "내일부터" 안내가 없다', (m->>'changed')::boolean is false);

  -- ── 영업 전에 고친 값도 오늘부터다 ─────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 13500, 'base_servings', 10));

  -- ── ② 영업 시작 — 이 시점 값으로 굳는다 ────────────────────
  perform open_business_day(pg_temp.store());
  perform pg_temp.ok('새 메뉴가 오늘 기준에 담겼다',
    (day_snapshot(pg_temp.store(), v_day) #> array['recipes', v_a::text]) is not null);
  perform pg_temp.eq('영업 전에 고친 판매가가 오늘 기준이다',
    (day_snapshot(pg_temp.store(), v_day) #>> array['recipes', v_rcp::text, 'price'])::numeric,
    13500, 0);

  -- ── ③ 실제로 팔린다 ────────────────────────────────────────
  v_res := pg_temp.e10(pg_temp.store(), v_day, v_a, 1, 0, 0, 0);
  perform pg_temp.eq('영업 전에 만든 메뉴가 오늘 팔린다',
    (v_res->>'unit_price')::numeric, 7000, 0);
  perform pg_temp.eq('영업 전에 고친 판매가로 기록된다',
    (pg_temp.e10(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0)->>'unit_price')::numeric,
    13500, 0);

  -- ── ④ 영업 시작 뒤에 만든 메뉴도 팔린다 — 더해질 뿐이다(0062) ─
  v_b := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '영업 중에 만든 메뉴', 'price', 5000, 'base_servings', 1));
  perform pg_temp.ok('아직 오늘 기준에는 없다',
    (select (x->>'in_basis')::boolean is false
       from jsonb_array_elements(day_menu_basis(pg_temp.store(), v_day)) x
      where (x->>'recipe_id')::uuid = v_b));
  perform pg_temp.ok('그래도 팔린다',
    (pg_temp.e10(pg_temp.store(), v_day, v_b, 1, 0, 0, 0)->>'added_to_basis')::boolean);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 첫 판매가 영업 시작을 겸하는 흐름
--
-- 화면은 45001 을 오류로 띄우지 않고 "오늘 영업을 시작할까요?" 를 묻는다.
-- 시작하면 방금 만든 메뉴까지 담긴 기준이 생기고, 그대로 이어서 저장된다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_day date := business_day();
  v_new uuid;
begin
  perform pg_temp.close_today();   -- 이미 닫혀 있으면 그대로 둔다(프렐류드 헬퍼)
  update business_days set business_date = v_day - 402
   where store_id = pg_temp.store() and business_date = v_day;

  v_new := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '아침에 만든 메뉴', 'price', 6500, 'base_servings', 1));

  -- 영업 전에는 서버가 막는다 — 화면이 시작을 먼저 묻는 근거다.
  perform pg_temp.raises('영업 전에는 45001 으로 막는다',
    format('select pg_temp.e10(%L, %L, %L, 1, 0, 0, 0)', pg_temp.store(), v_day, v_new),
    '45001');

  -- 시작하고 그대로 이어서 저장 — 두 번 누르게 하지 않는다.
  perform open_business_day(pg_temp.store());
  perform pg_temp.eq('시작 직후 그 메뉴가 바로 팔린다',
    (pg_temp.e10(pg_temp.store(), v_day, v_new, 2, 0, 0, 0)->>'unit_price')::numeric,
    6500, 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 더하기는 이미 기록된 숫자를 흔들지 않는다 (0062)
--
-- 스냅샷을 굳히는 이유가 그것뿐이므로, 추가가 안전한지가 이 설계의 근거다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_day date := business_day();
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_off uuid := pg_temp.rcp('된장찌개');
  v_new uuid;
  b0 jsonb; b1 jsonb;
  s0 jsonb; s1 jsonb;
begin
  -- 오늘을 영업 전으로 되돌리고, 된장찌개를 꺼 둔 채로 시작한다.
  -- (재료가 떨어져 잠깐 꺼 두는 상황 — 이게 제일 흔하다.)
  perform pg_temp.close_today();   -- 이미 닫혀 있으면 그대로 둔다(프렐류드 헬퍼)
  update business_days set business_date = v_day - 405
   where store_id = pg_temp.store() and business_date = v_day;
  update recipes set active = false where id = v_off;
  perform open_business_day(pg_temp.store());
  perform pg_temp.ok('꺼 둔 메뉴는 오늘 기준에 없다',
    (day_snapshot(pg_temp.store(), v_day) #> array['recipes', v_off::text]) is null);

  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);
  b0 := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  s0 := sales_summary(pg_temp.store(), v_day, v_day);

  -- 입고돼서 다시 켠다 → 오늘 팔 수 있어야 한다
  update recipes set active = true where id = v_off;
  perform pg_temp.eq('껐다 켠 메뉴가 오늘 팔린다',
    (pg_temp.e10(pg_temp.store(), v_day, v_off, 1, 0, 0, 0)->>'unit_price')::numeric, 8000, 0);

  -- 영업 중에 만든 새 메뉴도
  -- ⚠ 매출 증가분은 **이전 기록이 없는 메뉴**로만 잰다. e10 은 수량을 덮어쓰므로
  --   시드에 이미 오늘 판매가 있는 메뉴로 재면 증가가 아니라 감소가 나온다.
  s0 := sales_summary(pg_temp.store(), v_day, v_day);
  v_new := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '영업 중 신메뉴', 'price', 5500, 'base_servings', 1));
  perform pg_temp.eq('영업 중에 만든 메뉴도 팔린다',
    (pg_temp.e10(pg_temp.store(), v_day, v_new, 2, 0, 0, 0)->>'unit_price')::numeric, 5500, 0);

  -- ⚠ 핵심: 더해도 기존 항목은 그대로여야 한다
  b1 := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  perform pg_temp.eq('기존 메뉴 판매가 그대로', (b1->>'price')::numeric, (b0->>'price')::numeric, 0.0001);
  perform pg_temp.eq('기존 메뉴 재료비 그대로', (b1->>'material_cost')::numeric, (b0->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('기존 메뉴 순이익 그대로', (b1->>'profit')::numeric, (b0->>'profit')::numeric, 0.0001);
  -- ⚠ 절대 검산값은 여기서 확인하지 않는다. 앞 블록들이 인건비를 올려 둬서
  --   이 시점의 고정지출률이 다르다 — 검산 3종은 01_checksums 가 지킨다.
  --   여기서 지킬 것은 "더해도 안 움직인다"는 관계다.

  -- 합계는 새로 판 만큼만 늘어야 한다 (기존 기준이 흔들려서가 아니라)
  s1 := sales_summary(pg_temp.store(), v_day, v_day);
  perform pg_temp.eq('매출은 새로 판 만큼만 늘었다',
    (s1->>'revenue')::numeric - (s0->>'revenue')::numeric, 5500 * 2, 0.01);

  /*
   * 종료된 날에는 **판매 경로로는** 더하지 않는다 — 그날 장부는 잠긴 것이다.
   *
   * ⚠ 두 가지가 바뀌었다(0149).
   *   ① `add_to_day_basis` 는 몸통이라 앱 롤이 못 부른다. 소유자로 부른다 —
   *      안 그러면 42501(권한 없음)이 나와서 "막혔다"가 다른 이유로 통과한다.
   *   ② `p_allow_closed => true` 인 **정정 경로**는 종료된 날에도 들어온다. §6.4 의
   *      `판매 내역 추가` 가 그 경로다. 다만 **이미 있는 기준은 그래도 안 건드린다** —
   *      0062 의 불변식은 문이 달라졌다고 풀리지 않는다.
   *      (없던 메뉴를 더하면 estimated_current 로 내려간다 — 27번 ⑯ 이 잰다.)
   */
  perform close_business_day(pg_temp.store());
  set local role postgres;
  perform pg_temp.raises('종료된 날에는 판매 경로로 더하지 않는다',
    format('select add_to_day_basis(%L, %L, %L)', pg_temp.store(), v_day, pg_temp.rcp('계란말이')),
    '45002');

  declare
    v_e0 jsonb := (select snapshot #> array['recipes', pg_temp.rcp('계란말이')::text]
                     from business_days
                    where store_id = pg_temp.store() and business_date = v_day);
  begin
    perform pg_temp.ok('전제: 그 메뉴 기준이 이미 그날에 있다', v_e0 is not null);
    perform pg_temp.eq_t('전제: 아직 그날 기준 그대로다',
      (select basis_quality::text from business_days
        where store_id = pg_temp.store() and business_date = v_day), 'exact');

    perform add_to_day_basis(pg_temp.store(), v_day, pg_temp.rcp('계란말이'), true);

    perform pg_temp.eq_t('정정 경로라도 이미 있는 기준은 안 건드린다',
      (select (snapshot #> array['recipes', pg_temp.rcp('계란말이')::text])::text
         from business_days
        where store_id = pg_temp.store() and business_date = v_day), v_e0::text);
    perform pg_temp.eq_t('건드린 게 없으니 내려가지도 않는다',
      (select basis_quality::text from business_days
        where store_id = pg_temp.store() and business_date = v_day), 'exact');
  end;
  set local role authenticated;
end $t$;
