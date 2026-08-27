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
  -- ── ① 세금은 **적은 항목의 합**이다 (0090) ─────────────────
  -- 포함/별도/면세 모드는 없앴다. 항목이 없으면 0원이고, 그게 면세다.
  -- ⚠ 부가세 포함 가격이면 요율은 10 이 아니라 10/110 = 9.0909…% 다.
  perform pg_temp.eq('항목이 없으면 0원 — 그게 면세다',
    tax_of(12000, 'included', '[]'::jsonb), 0, 0);
  perform pg_temp.eq('부가세도 항목 하나다',
    tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909}]'::jsonb), 1090.909, 0.01);
  perform pg_temp.eq('레시피 세금 = 검산값', recipe_tax(v_rcp), 1090.909, 0.01);

  -- ⚠ 모드는 더 이상 읽지 않는다. 같은 항목이면 어떤 모드든 같은 값이어야 한다.
  perform pg_temp.eq('모드는 값에 영향이 없다',
    tax_of(12000, 'exempt', '[{"name":"부가세","rate":9.0909090909}]'::jsonb),
    tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909}]'::jsonb), 0);

  -- ⚠ null 과 빈 객체도 견뎌야 한다. save_recipe 가 '{}' 를 넣던 자리다(0054).
  perform pg_temp.eq('null 항목은 0원', tax_of(12000, 'included', null), 0, 0);
  perform pg_temp.eq('빈 객체도 0원', tax_of(12000, 'included', '{}'::jsonb), 0, 0);

  -- ── ② 여러 줄을 더한다 ──────────────────────────────────────
  perform pg_temp.eq('부가세 + 카드 수수료 2.5%',
    tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909},{"name":"카드 수수료","rate":2.5}]'::jsonb),
    1390.909, 0.01);
  perform pg_temp.eq('부가세를 빼면 카드 수수료만',
    tax_of(12000, 'included', '[{"name":"카드 수수료","rate":2.5}]'::jsonb), 300, 0.01);
  perform pg_temp.eq('요율 0은 세지 않는다',
    tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909},{"name":"없는 세금","rate":0}]'::jsonb),
    1090.909, 0.01);

  -- 내역 — 화면이 '(−) 세금'을 펼칠 때 쓴다. 기본으로 끼워 넣는 줄은 없다.
  v_br := tax_breakdown(12000, 'included',
    '[{"name":"부가세","rate":9.0909090909},{"name":"카드 수수료","rate":2.5}]'::jsonb);
  perform pg_temp.eq('내역 2줄', jsonb_array_length(v_br), 2, 0);
  perform pg_temp.eq_t('첫 줄은 부가세', v_br->0->>'name', '부가세');
  perform pg_temp.ok('부가세도 사장님이 적은 줄이다', (v_br->0->>'builtin')::boolean is false);
  perform pg_temp.eq('내역 합 = 세금',
    (select sum((i->>'amount')::numeric) from jsonb_array_elements(v_br) i), 1390.909, 0.01);
  perform pg_temp.eq('항목이 없으면 내역도 없다',
    jsonb_array_length(tax_breakdown(12000, 'included', '[]'::jsonb)), 0, 0);

  -- ── 세금은 **매장**이 정한다 (0087) ────────────────────────
  -- 0052 는 레시피마다 고치게 했다. 메뉴 50개면 50번 고쳐야 했고 하나를
  -- 빠뜨리면 그 메뉴만 다른 세금으로 손익이 계산된다.
  perform pg_temp.ok('레시피별 세금 저장 RPC 는 없다',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'save_recipe_tax_items'));

  -- 저장이 값을 검사한다.
  perform pg_temp.raises('이름 빈 항목 거부',
    format('select save_store_tax(%L, %L, %L::jsonb, %s)', pg_temp.store(), 'included',
           '[{"name":"  ","rate":2.5}]', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('음수 요율 거부',
    format('select save_store_tax(%L, %L, %L::jsonb, %s)', pg_temp.store(), 'included',
           '[{"name":"이상한 세금","rate":-1}]', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('100% 이상 거부',
    format('select save_store_tax(%L, %L, %L::jsonb, %s)', pg_temp.store(), 'included',
           '[{"name":"전부","rate":100}]', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('남의 매장 거부',
    format('select save_store_tax(%L, %L, %L::jsonb, %s)',
           '00000000-0000-0000-0000-0000000000ff', 'included', '[]', 1), null);

  -- ── 저장하면 **전 레시피**에 퍼지고 손익 변동에 남는다 ──────
  declare
    v_res jsonb;
    v_n   int := (select count(*) from recipes
                   where store_id = pg_temp.store() and coalesce(active, true));
    v_row jsonb;
    v_rev int;
    v_stamp timestamptz;
  begin
    v_rev := pg_temp.settings_rev(pg_temp.store());
    perform pg_temp.raises('세금 저장도 base 없이는 22000 BASE_REQUIRED',
      format('select save_store_tax(%L, %L, %L::jsonb)', pg_temp.store(), 'included',
             '[{"name":"부가세","rate":9.0909090909}]'), '22000');
    perform pg_temp.raises('세금 저장도 낡은 base 는 45009',
      format('select save_store_tax(%L, %L, %L::jsonb, %s)', pg_temp.store(), 'included',
             '[{"name":"부가세","rate":9.0909090909}]', v_rev - 1), '45009');
    perform pg_temp.eq('거부된 세금 저장은 판본 불변', pg_temp.settings_rev(pg_temp.store()), v_rev, 0);

    v_res := save_store_tax(pg_temp.store(), 'included',
      '[{"name":"부가세","rate":9.0909090909},{"name":"  카드 수수료  ","rate":2.5}]'::jsonb,
      v_rev);

    perform pg_temp.ok('바뀌었다고 답한다', (v_res->>'changed')::boolean is true);
    perform pg_temp.eq('세금 변경은 설정 판본을 1 올린다', pg_temp.settings_rev(pg_temp.store()), v_rev + 1, 0);
    perform pg_temp.eq('세금 변경 응답이 새 판본을 준다', (v_res->>'revision')::int, v_rev + 1, 0);
    perform pg_temp.raises('같은 base 로 두 번째 세금 저장(다른 기기)은 45009',
      format('select save_store_tax(%L, %L, %L::jsonb, %s)', pg_temp.store(), 'included',
             '[{"name":"부가세","rate":9.0909090909}]', v_rev), '45009');
    perform pg_temp.eq('활성 레시피 전부에 퍼진다', (v_res->>'recipes')::numeric, v_n, 0);
    perform pg_temp.eq_t('이름 앞뒤 공백은 다듬어 저장',
      (select tax_items->1->>'name' from settings where store_id = pg_temp.store()), '카드 수수료');
    perform pg_temp.eq('제육 세금 = 부가세 + 2.5%', recipe_tax(v_rcp), 1390.909, 0.01);

    -- 손익 변동(RCP-16)에 '세금 반영' 한 줄.
    v_row := recipe_profit_history(v_rcp) -> 'rows' -> 0;
    perform pg_temp.eq_t('손익 변동 제목', v_row->>'title', '세금 반영');
    perform pg_temp.eq_t('대표 원인은 세금', v_row->>'cause_key', 'tax_amount');
    perform pg_temp.eq_t('시트 부제', v_row->>'source_label', '세금 설정');
    perform pg_temp.eq('세금이 300원 늘었다',
      (v_row->>'cause_after')::numeric - (v_row->>'cause_before')::numeric, 300, 0.01);
    perform pg_temp.eq('순이익은 그만큼 준다', (v_row->>'profit_delta')::numeric, -300, 0.01);

    -- 같은 값을 다시 저장하면 아무 일도 없다. 목록에 쓰레기가 쌓이면 안 된다.
    v_rev := pg_temp.settings_rev(pg_temp.store());
    set local role postgres;
    alter table settings disable trigger settings_touch;
    update settings set updated_at = clock_timestamp() + interval '1 hour' where store_id = pg_temp.store();
    alter table settings enable trigger settings_touch;
    select updated_at into v_stamp from settings where store_id = pg_temp.store();
    set local role authenticated;

    v_res := save_store_tax(pg_temp.store(), 'included',
      '[{"name":"부가세","rate":9.0909090909},{"name":"카드 수수료","rate":2.5}]'::jsonb,
      v_rev);
    perform pg_temp.ok('같은 값 재저장은 변동 없음', (v_res->>'changed')::boolean is false);
    perform pg_temp.eq('같은 세금 재저장은 판본 불변', pg_temp.settings_rev(pg_temp.store()), v_rev, 0);
    perform pg_temp.eq('무변경 세금 응답도 현재 판본을 준다', (v_res->>'revision')::int, v_rev, 0);
    perform pg_temp.eq_t('같은 세금 재저장은 updated_at 불변',
      (select updated_at::text from settings where store_id = pg_temp.store()), v_stamp::text);
    perform pg_temp.eq_t('그래서 목록도 그대로',
      (recipe_profit_history(v_rcp) -> 'rows' -> 0 ->> 'id'), v_row->>'id');
  end;

  -- ── 레시피 저장으로는 세금을 못 바꾼다 ──────────────────────
  -- 값이 바뀌는 길은 하나여야 한다(절대원칙 2 와 같은 이유).
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10,
    'tax_items', jsonb_build_array(), 'tax_mode', 'exempt'));
  perform pg_temp.eq('레시피 저장이 항목을 못 지운다', recipe_tax(v_rcp), 1390.909, 0.01);

  -- 원래대로 되돌린다 — 뒤 블록이 검산값(1,090.91)을 쓴다.
  perform save_store_tax(pg_temp.store(), 'included',
    '[{"name":"부가세","rate":9.0909090909}]'::jsonb,
    pg_temp.settings_rev(pg_temp.store()));
  perform pg_temp.eq('되돌리면 부가세만', recipe_tax(v_rcp), 1090.909, 0.01);

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
  v_day date := pg_temp.today();
  b0    jsonb;
  b1    jsonb;
  v_tx0 numeric;
begin
  perform pg_temp.open_today();   -- 닫혀 있어도 열어 준다(프렐류드 헬퍼)
  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);
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
  -- ⚠ 부가세 항목을 빼면 세금이 되레 줄어든다. '더 넣는' 시나리오라 함께 보낸다.
  perform save_store_tax(pg_temp.store(), 'included',
    '[{"name":"부가세","rate":9.0909090909},{"name":"카드 수수료","rate":2.5}]'::jsonb,
    pg_temp.settings_rev(pg_temp.store()));

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
    (build_day_snapshot(pg_temp.store(), store_local_date(pg_temp.store())) #>> array['recipes', v_rcp::text, 'tax'])::numeric,
    1390.909, 0.01);
  -- 부가세 + 카드 수수료 두 줄이 그대로 얼어붙는다.
  perform pg_temp.eq('다음 영업일 기준에 항목도 담긴다',
    jsonb_array_length(build_day_snapshot(pg_temp.store(), store_local_date(pg_temp.store()))
                       #> array['recipes', v_rcp::text, 'tax_items']), 2, 0);
end $t$;
