-- ════════════════════════════════════════════════════════════════
-- 21 · 여러 메뉴가 같은 재료를 나눠 쓸 때 (0107)
--
-- 20 번은 재료 하나·메뉴 하나만 봤다. 그건 제일 쉬운 경우다.
-- 실제로 위험한 건 **판정 축과 표시 축이 다른** 자리다 —
--     부족 여부는 재료별 **합계**로 판정한다
--     화면에 적는 필요 수량은 **메뉴별**이다
-- 둘을 헷갈리면 어느 한쪽이 반드시 거짓말을 한다.
--
-- ⚠ 여기 전제값들은 **틀린 구현이 조용히 통과하지 못하도록** 골랐다.
--   메뉴별로만 재는 구현, 전체 판매량으로 재는 구현이 각각 여기서 걸린다.
-- ════════════════════════════════════════════════════════════════

-- 대파 1인분: 제육 25g · 김치 20g · 된장 15g (시드 고정값)
create function pg_temp.pa_need(p_res jsonb, p_recipe text) returns numeric
language sql immutable as $h$
  select (jsonb_path_query_first(
            p_res->'recipes',
            ('$[*] ? (@.name == "' || p_recipe || '").ingredients[*] ? (@.name == "대파")')::jsonpath
          )->>'need')::numeric
$h$;


-- ── ① 혼자서는 안 모자란데 합치면 모자란다 ────────────────────
do $t$
declare
  v_pa   uuid := pg_temp.ing('대파');
  r_je   uuid := pg_temp.rcp('제육볶음');
  r_ki   uuid := pg_temp.rcp('김치찌개');
  r_do   uuid := pg_temp.rcp('된장찌개');
  v_day  date;
  v_res  jsonb;
  v_items jsonb;
  v_before numeric;
  v_sum  numeric;
begin
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  v_day := business_day();

  v_items := jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 10),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 10),
    jsonb_build_object('recipe_id', r_do, 'qty_hall', 10));

  -- 출발점 고정 — 오늘 이미 적힌 판매가 있으면 델타가 달라진다.
  perform save_sale(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 0),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 0),
    jsonb_build_object('recipe_id', r_do, 'qty_hall', 0)));

  /*
   * 각 10개면 250 + 200 + 150 = 600g. 재고는 500g.
   * ⚠ **어느 메뉴도 혼자서는 안 모자란다**(250·200·150 < 500).
   *   메뉴별로만 재는 구현은 여기서 조용히 통과한다 — 그래서 이 값을 골랐다.
   */
  perform e5_stock_adjusted(v_pa, 500, false, 'T21 기준 맞추기');
  v_before := stock_total_base(v_pa);

  v_res := sale_shortages(pg_temp.store(), v_day, v_items);
  perform pg_temp.eq('합치면 모자란 걸 잡는다', (v_res->>'ingredient_count')::int, 1, 0);
  perform pg_temp.eq('막히는 메뉴는 셋 다', (v_res->>'recipe_count')::int, 3, 0);

  -- 화면에 적는 필요 수량은 **메뉴별**이다. 합계(600)를 세 줄에 다 적으면 안 된다.
  perform pg_temp.eq('제육볶음 몫', pg_temp.pa_need(v_res, '제육볶음'), 250, 0.001);
  perform pg_temp.eq('김치찌개 몫', pg_temp.pa_need(v_res, '김치찌개'), 200, 0.001);
  perform pg_temp.eq('된장찌개 몫', pg_temp.pa_need(v_res, '된장찌개'), 150, 0.001);

  select coalesce(sum((y->>'need')::numeric), 0) into v_sum
    from jsonb_array_elements(v_res->'recipes') x,
         jsonb_array_elements(x->'ingredients') y
   where y->>'name' = '대파';
  perform pg_temp.eq('메뉴별 몫을 더하면 합계', v_sum, 600, 0.001);

  -- 미리보기 = 실제 차감. 어긋나면 그 경고는 두 번 다시 못 믿는다.
  perform save_sale(pg_temp.store(), v_day, v_items);
  perform pg_temp.eq('미리 잰 만큼 정확히 빠졌다', v_before - stock_total_base(v_pa), 600, 0.001);
  perform pg_temp.eq('그래서 음수가 된다', stock_total_base(v_pa), -100, 0.001);
  perform pg_temp.eq('원장 합 = 잔액',
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_pa),
    stock_total_base(v_pa), 0.001);
end $t$;


-- ── ② 한 번의 저장에 늘리기와 줄이기가 섞일 때 ────────────────
-- 여기가 `전체 판매량으로 재는 구현`이 걸리는 자리다.
do $t$
declare
  v_pa  uuid := pg_temp.ing('대파');
  r_je  uuid := pg_temp.rcp('제육볶음');
  r_ki  uuid := pg_temp.rcp('김치찌개');
  v_day date;
  v_res jsonb;
  v_before numeric;
begin
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  v_day := business_day();

  perform save_sale(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 10),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 10)));
  perform e5_stock_adjusted(v_pa, 100, false, 'T21 기준 맞추기');
  v_before := stock_total_base(v_pa);

  /*
   * 제육 10→14 (대파 +100g) · 김치 10→5 (대파 −100g) ⇒ **순증 0**
   * 전체 판매량으로 재면 14×25 + 5×20 = 450g > 100g 이라 거짓 경고가 뜬다.
   * 실제로는 한 톨도 더 안 빠진다.
   */
  v_res := sale_shortages(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 14),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 5)));
  perform pg_temp.eq('순증이 0이면 부족이 아니다', (v_res->>'ingredient_count')::int, 0, 0);

  perform save_sale(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 14),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 5)));
  perform pg_temp.eq('재고도 안 움직인다', stock_total_base(v_pa), v_before, 0.001);

  -- 이번엔 순증이 재고를 넘는다. 제육 14→20 (+150) · 김치 5→4 (−20) ⇒ 순증 130
  v_before := stock_total_base(v_pa);
  v_res := sale_shortages(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 20),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 4)));
  perform pg_temp.eq('순증이 재고를 넘으면 잡는다', (v_res->>'ingredient_count')::int, 1, 0);
  perform pg_temp.eq('늘어난 메뉴의 몫만 적는다', pg_temp.pa_need(v_res, '제육볶음'), 150, 0.001);
  -- ⚠ 줄어드는 메뉴는 부족 목록에 **섞이면 안 된다.** 재고를 돌려주는 쪽이다.
  perform pg_temp.ok('줄어드는 메뉴는 목록에 없다',
    jsonb_path_query_first(v_res->'recipes', '$[*] ? (@.name == "김치찌개")') is null);

  perform save_sale(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 20),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 4)));
  perform pg_temp.eq('순증만큼만 빠졌다', v_before - stock_total_base(v_pa), 130, 0.001);
  perform pg_temp.eq('원장 합 = 잔액',
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_pa),
    stock_total_base(v_pa), 0.001);
end $t$;
