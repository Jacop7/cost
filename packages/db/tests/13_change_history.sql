-- ════════════════════════════════════════════════════════════════
-- 13 · 수정 내역 (0063~0067)
--
-- 기획: docs/식재료-레시피-수정내역-최종기획.md
--
-- 지키는 것
--   ① 값이 달라진 것만 기록한다 — 같은 값 저장은 내역을 만들지 않는다
--   ② 한 번의 저장·입고는 카드 한 장이다 (필드마다 나누지 않는다)
--   ③ 반영 상태는 **값 비교가 아니라 기록 시점**으로 판정한다
--   ④ 식재료 단가 변경 하나가 식재료·레시피 양쪽에 같은 묶음으로 남는다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_ing uuid := pg_temp.ing('대파');
  n0    int;
  ev    jsonb;
begin
  select count(*) into n0 from entity_change_events where entity_id = v_rcp;

  -- ── ① 같은 값 저장은 기록하지 않는다 ────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10));
  perform pg_temp.eq('같은 값 저장은 내역을 만들지 않는다',
    (select count(*) from entity_change_events where entity_id = v_rcp), n0, 0);

  -- ── ② 한 번의 저장 = 카드 한 장, 바뀐 필드만 ────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 13500, 'memo', '점심 특선', 'base_servings', 10));
  perform pg_temp.eq('저장 한 번은 카드 한 장',
    (select count(*) from entity_change_events where entity_id = v_rcp), n0 + 1, 0);

  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('직접 수정으로 남는다', ev->>'source_type', 'direct');
  perform pg_temp.eq_t('판매가 전값', (select c->>'before' from jsonb_array_elements(ev->'changes') c
                                        where c->>'key' = 'price'), '12000');
  perform pg_temp.eq_t('판매가 새값', (select c->>'after' from jsonb_array_elements(ev->'changes') c
                                        where c->>'key' = 'price'), '13500');
  perform pg_temp.ok('메모도 같은 카드에 담긴다',
    exists (select 1 from jsonb_array_elements(ev->'changes') c where c->>'key' = 'memo'));
  perform pg_temp.ok('안 바뀐 필드는 없다',
    not exists (select 1 from jsonb_array_elements(ev->'changes') c where c->>'key' = 'base_servings'));
  perform pg_temp.ok('판매가가 바뀌었으니 매출에 영향', (ev->>'affects_sales')::boolean);

  -- ── 메모만 고치면 매출과 무관하다 ───────────────────────────
  perform save_ingredient(pg_temp.store(), jsonb_build_object(
    'id', v_ing, 'name', '대파', 'base_unit', 'g', 'per_volume', 1000,
    'safety_stock', 2, 'min_order_qty', 1,
    'category_id', (select category_id from ingredients where id = v_ing),
    'default_vendor_id', (select default_vendor_id from ingredients where id = v_ing),
    'memo', '제육볶음·파채에 사용'));
  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'ingredient', v_ing, null, 5)->'items', '$[0]');
  perform pg_temp.ok('메모 수정은 매출 계산과 무관', (ev->>'affects_sales')::boolean is false);
  perform pg_temp.eq_t('상태도 무관', ev->>'state', 'irrelevant');
  perform pg_temp.eq('메모 한 줄만 바뀐다', jsonb_array_length(ev->'changes'), 1, 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- ③ 반영 상태 — 값 비교가 아니라 기록 시점으로 판정한다
--
-- 12,000 → 20,000 → 다시 12,000 으로 되돌리면 현재 값과 스냅샷이 같아진다.
-- 값을 비교하면 "반영됨"으로 보이지만, 실제로는 둘 다 오늘 매출에 안 들어갔다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('순두부찌개');
  v_day date := business_day();
  ev    jsonb;
begin
  -- ── 영업 전 수정 → 오늘 시작 때 담긴다 → 반영 ───────────────
  begin perform close_business_day(pg_temp.store()); exception when others then null; end;
  update business_days set business_date = v_day - 410
   where store_id = pg_temp.store() and business_date = v_day;

  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '순두부찌개', 'price', 9500, 'base_servings', 10));
  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('영업 전 수정은 반영', ev->>'state', 'reflected');

  perform open_business_day(pg_temp.store());
  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('영업 시작 뒤에도 그 수정은 반영', ev->>'state', 'reflected');

  -- ── 영업 중 수정 → 미반영 ───────────────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '순두부찌개', 'price', 11000, 'base_servings', 10));
  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('영업 중 수정은 미반영', ev->>'state', 'not_reflected');

  -- ⚠ 값을 되돌려도 미반영이다. 값 비교로 판정하면 여기서 틀린다.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '순두부찌개', 'price', 9500, 'base_servings', 10));
  perform pg_temp.eq_t('되돌려도 오늘 매출엔 안 들어간다',
    (jsonb_path_query_first(
      entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[0]'))->>'state',
    'not_reflected');
  perform pg_temp.eq_t('앞선 수정도 여전히 미반영',
    (jsonb_path_query_first(
      entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 5)->'items', '$[1]'))->>'state',
    'not_reflected');

  -- ── 오늘 기준에 없는 메뉴는 첫 판매 때 지금 값으로 담긴다(0062) → 반영 ─
  declare v_new uuid;
  begin
    v_new := save_recipe(pg_temp.store(), jsonb_build_object(
      'name', '영업 중 신메뉴', 'price', 6000, 'base_servings', 1));
    perform save_recipe(pg_temp.store(), jsonb_build_object(
      'id', v_new, 'name', '영업 중 신메뉴', 'price', 6500, 'base_servings', 1));
    perform pg_temp.eq_t('오늘 기준에 없는 메뉴의 수정은 반영',
      (jsonb_path_query_first(
        entity_change_history(pg_temp.store(), 'recipe', v_new, null, 5)->'items', '$[0]'))->>'state',
      'reflected');
  end;
end $t$;

-- ════════════════════════════════════════════════════════════════
-- ④ 입고 한 번이 식재료·레시피 양쪽에 같은 묶음으로 남는다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing  uuid := pg_temp.ing('대파');
  v_ven  uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day  date := business_day();
  v_ing_ev jsonb;
  v_rcp_ev jsonb;
  v_corr uuid;
begin
  begin perform open_business_day(pg_temp.store()); exception when others then null; end;

  -- 대파를 비싸게 들인다 — 4.00 → 오른다
  perform e1_confirm_inbound(
    e7_place_order(pg_temp.store(), v_ing, v_ven, null, 1000, 6000, 3, v_day), 3, 'TEST-0066');

  v_ing_ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'ingredient', v_ing, null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('식재료 카드 제목', v_ing_ev->>'title', '기준 단가 변경');
  perform pg_temp.eq_t('출처는 입고', v_ing_ev->>'source_type', 'inbound');
  perform pg_temp.eq('단가 전값',
    (select (c->>'before')::numeric from jsonb_array_elements(v_ing_ev->'changes') c
      where c->>'key' = 'unit_price'), 4.0, 0.0001);
  perform pg_temp.ok('단가가 올랐다',
    (select (c->>'after')::numeric from jsonb_array_elements(v_ing_ev->'changes') c
      where c->>'key' = 'unit_price') > 4.0);
  perform pg_temp.ok('연결 레시피 수를 함께 알린다',
    (v_ing_ev->>'affected_recipes')::int > 0);

  v_corr := (v_ing_ev->>'correlation_id')::uuid;
  perform pg_temp.ok('같은 묶음으로 레시피에도 남는다',
    exists (select 1 from entity_change_events
             where correlation_id = v_corr and entity_type = 'recipe'));

  v_rcp_ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', pg_temp.rcp('제육볶음'), null, 5)->'items', '$[0]');
  perform pg_temp.eq_t('레시피 카드 제목', v_rcp_ev->>'title', '대파 기준 단가 자동 반영');
  perform pg_temp.eq_t('출처는 식재료 전파', v_rcp_ev->>'source_type', 'ingredient');
  perform pg_temp.eq_t('원본 이름을 알려 준다', v_rcp_ev->>'source_name', '대파');
  perform pg_temp.eq('재료비 전값',
    (select (c->>'before')::numeric from jsonb_array_elements(v_rcp_ev->'changes') c
      where c->>'key' = 'material_cost'), 2806.40, 0.01);
  perform pg_temp.ok('재료비가 올랐다',
    (select (c->>'after')::numeric from jsonb_array_elements(v_rcp_ev->'changes') c
      where c->>'key' = 'material_cost') > 2806.40);
  perform pg_temp.ok('순이익 전후도 함께 남는다',
    exists (select 1 from jsonb_array_elements(v_rcp_ev->'changes') c where c->>'key' = 'profit'));
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 목록 페이지네이션 — 같은 시각 이벤트가 경계에서 새지 않는다
--
-- 전파는 한 트랜잭션에서 여러 건이 **같은 시각**으로 들어간다.
-- 커서가 시각뿐이면 그 경계에서 빠지거나 겹친다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp  uuid := pg_temp.rcp('계란말이');
  v_p1   jsonb;
  v_p2   jsonb;
  v_all  int;
  v_seen int;
begin
  -- 카드 5장을 만든다
  for i in 1..5 loop
    perform save_recipe(pg_temp.store(), jsonb_build_object(
      'id', v_rcp, 'name', '계란말이', 'price', 7000 + i * 100, 'base_servings', 10));
  end loop;

  select count(*) into v_all from entity_change_events
   where entity_type = 'recipe' and entity_id = v_rcp;
  perform pg_temp.ok('카드가 여러 장 쌓였다', v_all >= 5);

  v_p1 := entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 2);
  perform pg_temp.eq('첫 장은 2건', jsonb_array_length(v_p1->'items'), 2, 0);
  perform pg_temp.ok('더 있으면 커서를 준다', (v_p1->>'next_cursor') is not null);

  v_p2 := entity_change_history(pg_temp.store(), 'recipe', v_rcp, v_p1->>'next_cursor', 2);
  perform pg_temp.eq('둘째 장도 2건', jsonb_array_length(v_p2->'items'), 2, 0);
  perform pg_temp.ok('두 장이 겹치지 않는다',
    not exists (
      select 1 from jsonb_array_elements(v_p1->'items') a,
                    jsonb_array_elements(v_p2->'items') b
       where a->>'id' = b->>'id'));

  -- 끝까지 넘겨서 전부 한 번씩만 나오는지
  declare v_cur text := null; v_page jsonb; v_ids uuid[] := '{}';
  begin
    loop
      v_page := entity_change_history(pg_temp.store(), 'recipe', v_rcp, v_cur, 2);
      v_ids := v_ids || array(select (x->>'id')::uuid from jsonb_array_elements(v_page->'items') x);
      v_cur := v_page->>'next_cursor';
      exit when v_cur is null;
    end loop;
    v_seen := array_length(v_ids, 1);
    perform pg_temp.eq('전부 한 번씩 나온다', v_seen, v_all, 0);
    perform pg_temp.eq('중복 없다', (select count(distinct x) from unnest(v_ids) x), v_all, 0);
  end;
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 남은 자동 전파 — 고정지출과 입고 취소 (0069)
--
-- 사장님이 직접 고치지 않았는데 숫자가 움직이는 경우가 둘 더 있다.
--   고정지출 저장 → 고정지출률 → **전 메뉴**의 순이익
--   입고 취소   → 기준단가가 되돌아감 → 연결 메뉴 원가
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('제육볶음');
  v_ing uuid := pg_temp.ing('대파');
  v_ven uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day date := business_day();
  v_ord uuid;
  ev    jsonb;
  n0    int;
begin
  begin perform open_business_day(pg_temp.store()); exception when others then null; end;

  -- ── 고정지출 인상 ───────────────────────────────────────────
  select count(*) into n0 from entity_change_events where entity_id = v_rcp;
  perform save_fixed_costs(pg_temp.store(), business_month(), 12000000,
    (select jsonb_agg(case when x->>'key' = 'labor'
        then jsonb_set(jsonb_set(x, '{total}', '4500000'), '{lines}', '[]'::jsonb) || '{"mode":"total"}'::jsonb
        else x end)
       from fixed_costs_monthly, jsonb_array_elements(items) x
      where store_id = pg_temp.store() and month = business_month()));

  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 3)->'items', '$[0]');
  perform pg_temp.eq_t('고정지출 카드 제목', ev->>'title', '고정 지출 자동 반영');
  perform pg_temp.eq_t('출처는 고정지출', ev->>'source_type', 'fixed_cost');
  perform pg_temp.eq('고정지출률 전값',
    (select (c->>'before')::numeric from jsonb_array_elements(ev->'changes') c
      where c->>'key' = 'fixed_rate'), 31.30, 0.01);
  perform pg_temp.ok('률이 올랐다',
    (select (c->>'after')::numeric from jsonb_array_elements(ev->'changes') c
      where c->>'key' = 'fixed_rate') > 31.30);
  perform pg_temp.ok('순이익이 줄어든 것도 함께 남는다',
    (select (c->>'after')::numeric from jsonb_array_elements(ev->'changes') c
      where c->>'key' = 'profit')
    < (select (c->>'before')::numeric from jsonb_array_elements(ev->'changes') c
      where c->>'key' = 'profit'));
  perform pg_temp.ok('전 메뉴가 한 묶음이다', (ev->>'affected_recipes')::int > 0);

  -- ⚠ 률이 안 바뀌는 저장(항목 이름만 손댐)은 기록하지 않는다.
  select count(*) into n0 from entity_change_events where entity_id = v_rcp;
  perform save_fixed_costs(pg_temp.store(), business_month(), 12000000,
    (select items from fixed_costs_monthly
      where store_id = pg_temp.store() and month = business_month()));
  perform pg_temp.eq('률이 그대로면 기록하지 않는다',
    (select count(*) from entity_change_events where entity_id = v_rcp), n0, 0);

  -- ── 입고 취소 ───────────────────────────────────────────────
  -- ⚠ 절대값(4.00)으로 재지 않는다. 앞 블록이 이미 대파를 입고해 둬서 기준이 달라졌다 —
  --   같은 파일 안의 블록들은 한 트랜잭션을 공유한다.
  declare
    v_base0 numeric := base_unit_price(v_ing);
    v_up    numeric;
  begin
    v_ord := e7_place_order(pg_temp.store(), v_ing, v_ven, null, 1000, 9000, 3, v_day);
    perform e1_confirm_inbound(v_ord, 3, 'TEST-0069');
    v_up := base_unit_price(v_ing);
    perform pg_temp.ok('입고로 단가가 올랐다', v_up > v_base0);

    perform e11_inbound_reverted(v_ord, '오입력');
    perform pg_temp.eq('취소하면 단가가 돌아온다', base_unit_price(v_ing), v_base0, 0.0001);

    ev := jsonb_path_query_first(
      entity_change_history(pg_temp.store(), 'ingredient', v_ing, null, 3)->'items', '$[0]');
    perform pg_temp.eq_t('취소 카드 제목', ev->>'title', '입고 취소로 기준 단가 변경');
    perform pg_temp.eq('취소 전값이 오른 단가',
      (select (c->>'before')::numeric from jsonb_array_elements(ev->'changes') c
        where c->>'key' = 'unit_price'), v_up, 0.0001);
    perform pg_temp.eq('취소 후값이 원래 단가',
      (select (c->>'after')::numeric from jsonb_array_elements(ev->'changes') c
        where c->>'key' = 'unit_price'), v_base0, 0.0001);
    perform pg_temp.ok('연결 메뉴에도 같이 남는다', (ev->>'affected_recipes')::int > 0);
  end;

  -- ── 재고·폐기는 여기 담지 않는다(기획 §5) ───────────────────
  -- 단가를 바꾸지 않고, 재고 원장이 이미 단일 출처다.
  select count(*) into n0 from entity_change_events where entity_id = v_ing;
  perform e2_discard(v_ing, greatest(stock_total_base(v_ing) - 50, 0));
  perform pg_temp.eq('폐기는 수정 내역을 만들지 않는다',
    (select count(*) from entity_change_events where entity_id = v_ing), n0, 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 메모는 실제로 저장돼야 한다 (0071)
--
-- 0063 이 recipes.memo 컬럼과 화면·내역 비교까지 만들어 놓고 **save_recipe 에
-- 쓰는 자리를 빠뜨렸다.** 메모를 입력해도 값은 비어 있는데 수정 내역에는
-- "메모 (없음) → 점심 특선" 이 남았다.
--
-- 저장이 안 된 것보다 **원장이 거짓말을 한 것**이 더 나쁘다 —
-- 사장님은 내역을 보고 저장됐다고 믿는다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp uuid := pg_temp.rcp('된장찌개');
  v_ing uuid := pg_temp.ing('두부');
  n0    int;
  ev    jsonb;
begin
  -- ── 레시피 메모: 저장된다 ───────────────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '된장찌개', 'price', 8000, 'base_servings', 10, 'memo', '점심 특선'));
  perform pg_temp.eq_t('레시피 메모가 실제로 저장된다',
    (select memo from recipes where id = v_rcp), '점심 특선');

  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'recipe', v_rcp, null, 3)->'items', '$[0]');
  perform pg_temp.eq_t('내역의 새값이 실제 저장값과 같다',
    (select c->>'after' from jsonb_array_elements(ev->'changes') c where c->>'key' = 'memo'),
    (select memo from recipes where id = v_rcp));

  -- ── 키가 없는 저장은 메모를 건드리지 않는다 ─────────────────
  -- 판매 중지 토글처럼 헤더만 고치는 호출이 메모를 지우면 안 된다(tax_items 와 같은 규칙).
  select count(*) into n0 from entity_change_events where entity_id = v_rcp;
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '된장찌개', 'price', 8000, 'base_servings', 10));
  perform pg_temp.eq_t('키가 없으면 메모는 그대로',
    (select memo from recipes where id = v_rcp), '점심 특선');
  perform pg_temp.eq('그때는 기록도 남기지 않는다',
    (select count(*) from entity_change_events where entity_id = v_rcp), n0, 0);

  -- ── 빈 값을 명시하면 지운다 ─────────────────────────────────
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '된장찌개', 'price', 8000, 'base_servings', 10, 'memo', ''));
  perform pg_temp.ok('빈 메모를 보내면 지워진다',
    (select memo from recipes where id = v_rcp) is null);

  -- ── 식재료 메모도 같은 계약이다 ─────────────────────────────
  perform save_ingredient(pg_temp.store(), jsonb_build_object(
    'id', v_ing, 'name', '두부', 'base_unit', 'ea', 'per_volume', 1,
    'safety_stock', 2, 'min_order_qty', 1,
    'category_id', (select category_id from ingredients where id = v_ing),
    'default_vendor_id', (select default_vendor_id from ingredients where id = v_ing),
    'memo', '찌개용'));
  perform pg_temp.eq_t('식재료 메모도 저장된다',
    (select memo from ingredients where id = v_ing), '찌개용');

  -- ⚠ 상세 응답에도 실려야 화면이 그린다.
  perform pg_temp.eq_t('레시피 상세가 메모를 내려준다',
    recipe_detail(v_rcp)->>'memo', (select memo from recipes where id = v_rcp));
  perform pg_temp.eq_t('식재료 상세가 메모를 내려준다',
    ingredient_detail(v_ing)->>'memo', '찌개용');
end $t$;
