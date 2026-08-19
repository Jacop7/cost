-- ════════════════════════════════════════════════════════════════
-- 10 · 세금 항목 (0052·0053·0054)
--
-- 사장님: "세금도 사용자가 추가 수정할 수 있어"
--
-- 지키는 것 세 가지
--   ① 항목이 비면 부가세뿐 — 기존 검산값이 안 움직인다
--   ② 항목을 더하면 판매가 대비 %로 합산된다
--   ③ 그날 판 뒤에 항목을 고쳐도 **그날 장부는 안 움직인다**
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_br  jsonb;
begin
  -- ── ① 항목이 비면 부가세뿐 ──────────────────────────────────
  perform pg_temp.eq('빈 항목 = 부가세만', tax_of(12000, 'included', '[]'::jsonb), 1090.909, 0.01);
  perform pg_temp.eq('별도는 0', tax_of(12000, 'separate', '[]'::jsonb), 0, 0);
  perform pg_temp.eq('면세는 0', tax_of(12000, 'exempt', '[]'::jsonb), 0, 0);
  perform pg_temp.eq('레시피 세금 = 검산값', recipe_tax(v_rcp), 1090.909, 0.01);

  -- ⚠ null 과 빈 객체도 견뎌야 한다. save_recipe 가 '{}' 를 넣던 자리다(0054).
  perform pg_temp.eq('null 항목도 부가세만', tax_of(12000, 'included', null), 1090.909, 0.01);
  perform pg_temp.eq('빈 객체도 부가세만', tax_of(12000, 'included', '{}'::jsonb), 1090.909, 0.01);

  -- ── ② 항목을 더하면 합산 ────────────────────────────────────
  perform pg_temp.eq('카드 수수료 2.5% 합산',
    tax_of(12000, 'included', '[{"name":"카드 수수료","rate":2.5}]'::jsonb), 1390.909, 0.01);
  perform pg_temp.eq('별도 + 항목이면 항목만',
    tax_of(12000, 'separate', '[{"name":"카드 수수료","rate":2.5}]'::jsonb), 300, 0.01);
  perform pg_temp.eq('요율 0은 세지 않는다',
    tax_of(12000, 'included', '[{"name":"없는 세금","rate":0}]'::jsonb), 1090.909, 0.01);

  -- 내역 — 화면이 '(−) 세금'을 펼칠 때 쓴다.
  v_br := tax_breakdown(12000, 'included', '[{"name":"카드 수수료","rate":2.5}]'::jsonb);
  perform pg_temp.eq('내역 2줄', jsonb_array_length(v_br), 2, 0);
  perform pg_temp.eq_t('첫 줄은 부가세', v_br->0->>'name', '부가세');
  perform pg_temp.ok('부가세는 기본 항목 표시', (v_br->0->>'builtin')::boolean is true);
  perform pg_temp.eq('내역 합 = 세금',
    (select sum((i->>'amount')::numeric) from jsonb_array_elements(v_br) i), 1390.909, 0.01);

  -- ── 저장이 값을 검사한다 ────────────────────────────────────
  perform pg_temp.raises('이름 빈 항목 거부',
    format('select save_recipe_tax_items(%L, %L, %L::jsonb)', pg_temp.store(), v_rcp,
           '[{"name":"  ","rate":2.5}]'), '22000');
  perform pg_temp.raises('음수 요율 거부',
    format('select save_recipe_tax_items(%L, %L, %L::jsonb)', pg_temp.store(), v_rcp,
           '[{"name":"이상한 세금","rate":-1}]'), '22000');
  perform pg_temp.raises('100% 이상 거부',
    format('select save_recipe_tax_items(%L, %L, %L::jsonb)', pg_temp.store(), v_rcp,
           '[{"name":"전부","rate":100}]'), '22000');

  -- 남의 매장 것은 못 고친다 (RLS 계약).
  perform pg_temp.raises('남의 매장 거부',
    format('select save_recipe_tax_items(%L, %L, %L::jsonb)',
           '00000000-0000-0000-0000-0000000000ff', v_rcp, '[]'), null);

  -- ── 레시피 저장이 같은 화면에서 항목을 받는다 (0055) ────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10,
    'tax_items', jsonb_build_array(jsonb_build_object('name', '  카드 수수료  ', 'rate', 2.5))));
  perform pg_temp.eq('저장 경로로 들어간 항목이 계산된다', recipe_tax(v_rcp), 1390.909, 0.01);
  perform pg_temp.eq_t('이름 앞뒤 공백은 다듬어 저장',
    (select tax_items->0->>'name' from recipes where id = v_rcp), '카드 수수료');

  -- 헤더만 고치는 저장은 항목을 지우지 않는다 — 키가 없으면 그대로 둔다.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 13000, 'base_servings', 10));
  perform pg_temp.eq('키가 없으면 항목은 그대로',
    jsonb_array_length((select tax_items from recipes where id = v_rcp)), 1, 0);
  -- 빈 배열을 보내면 지운다 — "다 뺐다"는 뜻이다.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10,
    'tax_items', jsonb_build_array()));
  perform pg_temp.eq('빈 배열이면 지운다', recipe_tax(v_rcp), 1090.909, 0.01);

  perform pg_temp.raises('저장 경로도 요율을 검사한다',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(), jsonb_build_object(
      'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10,
      'tax_items', jsonb_build_array(jsonb_build_object('name','전부','rate',100)))::text), '22000');

  -- 상세 조회가 항목과 내역을 함께 준다 — 화면이 두 번 물어볼 필요가 없다.
  declare v_d jsonb := recipe_detail(v_rcp);
  begin
    perform pg_temp.ok('상세에 세금 항목이 있다', (v_d->'tax_items') is not null);
    perform pg_temp.eq('상세의 세금액', (v_d->>'tax')::numeric, 1090.909, 0.01);
    perform pg_temp.eq('상세의 세금 내역 1줄(부가세)', jsonb_array_length(v_d->'tax_breakdown'), 1, 0);
  end;
end $t$;

-- ════════════════════════════════════════════════════════════════
-- ③ 그날 판 뒤에 항목을 고쳐도 그날 장부는 안 움직인다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_day date := business_day();
  b0    jsonb;
  b1    jsonb;
  v_tx0 numeric;
begin
  perform open_business_day(pg_temp.store());
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);
  b0 := day_menu_detail(pg_temp.store(), v_day, v_rcp);

  perform pg_temp.eq('그날 세금 = 부가세', (b0->>'tax')::numeric, 1090.909, 0.01);
  perform pg_temp.eq('그날 순이익 = 검산값', (b0->>'profit')::numeric, 4046.69, 0.01);
  perform pg_temp.eq('매출 줄에 세금이 굳었다',
    (select unit_tax from daily_sales_items it join daily_sales ds on ds.id = it.daily_sales_id
      where ds.store_id = pg_temp.store() and ds.sale_date = v_day and it.recipe_id = v_rcp),
    1090.909, 0.01);
  perform pg_temp.eq('세금 내역도 그날 구성', jsonb_array_length(b0->'tax_items'), 1, 0);

  -- ⚠ 집계는 그날 팔린 전 메뉴의 합이다. 절대값을 박지 말고 전후를 비교한다.
  v_tx0 := (sales_summary(pg_temp.store(), v_day, v_day)->>'tax')::numeric;

  -- 판 뒤에 카드 수수료를 새로 넣는다.
  perform save_recipe_tax_items(pg_temp.store(), v_rcp, '[{"name":"카드 수수료","rate":2.5}]'::jsonb);

  b1 := day_menu_detail(pg_temp.store(), v_day, v_rcp);
  perform pg_temp.eq('그날 세금 그대로', (b1->>'tax')::numeric, (b0->>'tax')::numeric, 0.0001);
  perform pg_temp.eq('그날 순이익 그대로', (b1->>'profit')::numeric, (b0->>'profit')::numeric, 0.0001);
  perform pg_temp.eq('그날 세금 내역도 그대로', jsonb_array_length(b1->'tax_items'), 1, 0);
  perform pg_temp.eq('집계의 세금도 그대로',
    (sales_summary(pg_temp.store(), v_day, v_day)->>'tax')::numeric, v_tx0, 0.0001);

  -- 레시피 화면(현재값)은 바뀌어야 한다 — "지금 팔면 얼마 남나"이므로.
  perform pg_temp.eq('레시피 현재 세금은 늘었다', recipe_tax(v_rcp), 1390.909, 0.01);
  perform pg_temp.eq('레시피 현재 순이익은 줄었다',
    (select profit from recipe_list(pg_temp.store()) where id = v_rcp),
    4046.69 - 300, 0.01);

  -- 다음 영업일 기준에는 반영된다 — 그날 아침에 뜨는 스냅샷이 곧 새 기준이다.
  -- (내일 날짜로는 영업을 못 열므로 스냅샷 생성기를 직접 본다.)
  perform pg_temp.eq('다음 영업일 기준엔 반영',
    (build_day_snapshot(pg_temp.store()) #>> array['recipes', v_rcp::text, 'tax'])::numeric,
    1390.909, 0.01);
  perform pg_temp.eq('다음 영업일 기준에 항목도 담긴다',
    jsonb_array_length(build_day_snapshot(pg_temp.store())
                       #> array['recipes', v_rcp::text, 'tax_items']), 1, 0);
end $t$;
