-- ════════════════════════════════════════════════════════════════
-- 22 · 낡은 화면의 덮어쓰기와 마감 경합 (0117 · 0118 · 0119)
--
-- 실측으로 확인한 것 —
--     기기 A 저장 → 제육 5 · 김치 0
--     기기 B 저장 → 제육 0 · 김치 3      ← 제육 5개가 사라짐
--     두 호출 다 **성공**을 반환했다. 아무도 몰랐다.
--
-- 원인이 둘이라 막는 것도 둘이다.
--   ① 전체 교체였다 → **부분 수정**으로 바꿨다(안 보낸 메뉴는 그대로)
--   ② 같은 자리를 두 곳에서 고치면 나중 것이 이겼다 → **판본 검사**
--
-- ⚠ 경합 자체(두 세션 동시)는 이 하네스에서 못 잰다 — 한 세션에서 돌고 롤백한다.
--   대신 **경합 없이도 성립해야 하는 관계**를 못 박는다. 낡은 판본으로 저장하면
--   동시가 아니어도 거부되어야 한다. 실제 사고도 동시성 없이 났다.
-- ════════════════════════════════════════════════════════════════

create function pg_temp.qty(p_date date, p_recipe uuid) returns numeric
language sql stable as $h$
  select coalesce((select it.qty_hall from daily_sales_items it
                     join daily_sales ds on ds.id = it.daily_sales_id
                    where ds.store_id = pg_temp.store() and ds.sale_date = p_date
                      and it.recipe_id = p_recipe), 0)
$h$;

create function pg_temp.rev(p_date date) returns int
language sql stable as $h$
  select coalesce((select revision from daily_sales
                    where store_id = pg_temp.store() and sale_date = p_date), 0)
$h$;


-- ── ① 부분 수정 — 안 보낸 메뉴는 그대로 둔다 ──────────────────
do $t$
declare
  r_je  uuid := pg_temp.rcp('제육볶음');
  r_ki  uuid := pg_temp.rcp('김치찌개');
  v_day date;
  v_rev int;
begin
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)
  v_day := business_day();

  perform save_sale(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je, 'qty_hall', 0),
    jsonb_build_object('recipe_id', r_ki, 'qty_hall', 0)));

  -- 제육만 보낸다. 김치는 목록에 없다.
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 5)));
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_ki, 'qty_hall', 3)));

  -- ⚠ 예전엔 두 번째 저장이 제육을 0 으로 만들었다. 그게 사고의 실체다.
  perform pg_temp.eq('안 보낸 메뉴는 안 지워진다', pg_temp.qty(v_day, r_je), 5, 0.001);
  perform pg_temp.eq('보낸 메뉴는 반영된다', pg_temp.qty(v_day, r_ki), 3, 0.001);

  -- 지울 때는 **0 을 명시**한다. 목록에서 빼는 것으로는 안 지워진다.
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 0)));
  perform pg_temp.eq('0 을 명시하면 지워진다', pg_temp.qty(v_day, r_je), 0, 0.001);
  perform pg_temp.eq('그 사이 김치는 그대로', pg_temp.qty(v_day, r_ki), 3, 0.001);

  -- 저장할 때마다 판본이 오른다.
  v_rev := pg_temp.rev(v_day);
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_ki, 'qty_hall', 4)));
  perform pg_temp.eq('저장하면 판본이 오른다', pg_temp.rev(v_day), v_rev + 1, 0);
end $t$;


-- ── ② 판본 검사 — 낡은 화면은 거부된다 ────────────────────────
do $t$
declare
  r_je  uuid := pg_temp.rcp('제육볶음');
  r_ki  uuid := pg_temp.rcp('김치찌개');
  v_day date := business_day();
  v_seen int;
begin
  -- 두 기기가 같은 판본을 본다.
  v_seen := pg_temp.rev(v_day);

  -- 기기 A 가 먼저 저장한다.
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 7)), null, null, v_seen);
  perform pg_temp.eq('A 는 저장된다', pg_temp.qty(v_day, r_je), 7, 0.001);

  -- 기기 B 는 아직 낡은 판본을 들고 있다.
  perform pg_temp.raises('낡은 판본은 거부된다',
    format($q$select save_sale(%L, %L, %L::jsonb, null, null, %s)$q$,
           pg_temp.store(), v_day,
           jsonb_build_array(jsonb_build_object('recipe_id', r_ki, 'qty_hall', 9))::text, v_seen),
    '45009');
  perform pg_temp.eq('거부됐으니 김치는 안 바뀐다', pg_temp.qty(v_day, r_ki), 4, 0.001);
  perform pg_temp.eq('A 의 기록도 그대로', pg_temp.qty(v_day, r_je), 7, 0.001);

  -- 다시 받아서 저장하면 **둘 다** 남는다. 이게 부분 수정의 값어치다.
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_ki, 'qty_hall', 9)), null, null, pg_temp.rev(v_day));
  perform pg_temp.eq('새로고침 후에는 저장된다', pg_temp.qty(v_day, r_ki), 9, 0.001);
  perform pg_temp.eq('A 의 기록은 여전히 그대로', pg_temp.qty(v_day, r_je), 7, 0.001);

  -- 판본을 안 보내면 검사하지 않는다(시드·서버 내부 호출).
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 8)));
  perform pg_temp.eq('판본을 안 보내면 그냥 저장된다', pg_temp.qty(v_day, r_je), 8, 0.001);

  -- 기타 매출도 같은 판본으로 지켜진다 — 배열 통째 교체라 더 위험하다.
  v_seen := pg_temp.rev(v_day);
  perform save_sale(pg_temp.store(), v_day, null,
    jsonb_build_array(jsonb_build_object('name', '소주', 'price', 5000, 'qty', 1)), null, v_seen);
  perform pg_temp.raises('낡은 판본의 기타 매출도 거부된다',
    format($q$select save_sale(%L, %L, null, %L::jsonb, null, %s)$q$,
           pg_temp.store(), v_day,
           jsonb_build_array(jsonb_build_object('name', '맥주', 'price', 6000, 'qty', 1))::text, v_seen),
    '45009');
  perform pg_temp.eq_t('먼저 넣은 소주가 살아 있다',
    (select etc_items->0->>'name' from daily_sales
      where store_id = pg_temp.store() and sale_date = v_day), '소주');
end $t$;


-- ── ③ 마감은 영업일을 잠근 뒤에 집계한다 ──────────────────────
-- 경합 자체는 못 재지만, **잠금이 집계보다 앞**이라는 구조는 확인할 수 있다.
-- 순서가 뒤집히면 판매가 마감 손익에서 샌다(원장엔 있고 마감엔 없다).
do $t$
declare v_def text;
begin
  /*
   * ⚠ 몸통이 `close_business_day_row` 로 옮겨졌다(0137). 수동 마감과 자동 마감이
   *   **같은 몸통**을 쓰게 하려는 것이었다 — 두 벌이면 스냅샷·집계가 갈린다.
   *   그래서 잠금 순서도 거기서 본다. `close_business_day` 만 보던 옛 시험은
   *   이 이동에 빨개졌고, 그게 맞다(그 함수엔 이제 `for update` 가 없다).
   */
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'close_business_day_row';

  perform pg_temp.ok('마감이 영업일 행을 잠근다', position('for update' in v_def) > 0);
  perform pg_temp.ok('잠금이 집계보다 앞이다',
    position('for update' in v_def) < position('v_sum := sales_summary' in v_def));

  -- 그리고 수동·자동 둘 다 그 몸통으로 들어가야 한다. 한쪽이라도 제 길로 새면
  -- 잠금이 없는 마감 경로가 생긴다.
  perform pg_temp.ok('수동 마감이 몸통을 부른다',
    pg_get_functiondef('public.close_business_day(uuid)'::regprocedure)
      like '%close_business_day_row(%');
  perform pg_temp.ok('자동 마감도 같은 몸통을 부른다',
    pg_get_functiondef('public.close_due_business_days()'::regprocedure)
      like '%close_business_day_row(%');

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  perform pg_temp.ok('판매도 같은 행을 잠근다', position('for update' in v_def) > 0);
  -- ⚠ 잠근 **뒤에** 상태를 읽어야 한다. 앞에서 읽으면 기다리는 동안 닫힌 걸 못 본다.
  perform pg_temp.ok('잠근 뒤에 상태를 읽는다',
    position('for update' in v_def) < position('영업은 종료됐어요' in v_def));
end $t$;


-- ── ④ 부족 검사는 못 쟀으면 못 쟀다고 한다 ────────────────────
do $t$
declare
  r_je  uuid := pg_temp.rcp('제육볶음');
  v_day date := business_day();
  v_res jsonb;
begin
  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 1)));
  perform pg_temp.ok('영업 중이면 잴 수 있다', (v_res->>'has_basis')::boolean);

  /*
   * 스냅샷이 없는 날. 필요량이 전부 0 이라 `부족 0건` 이 나오는데,
   * 그건 "넉넉하다"가 아니라 **"못 쟀다"** 다. 둘을 같은 답으로 두면
   * 영업 시작 직후 재시도에서 경고가 통째로 새어 나간다(실제로 그랬다).
   */
  v_res := sale_shortages(pg_temp.store(), v_day - 60,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 1)));
  perform pg_temp.ok('스냅샷이 없으면 못 쟀다고 한다', not (v_res->>'has_basis')::boolean);
  perform pg_temp.eq('그때 부족은 0건으로 나온다 — 믿으면 안 되는 0이다',
    (v_res->>'ingredient_count')::int, 0, 0);

  -- 메뉴가 없으면 잴 게 없다. "못 쟀다"와는 다르다.
  v_res := sale_shortages(pg_temp.store(), v_day, '[]'::jsonb);
  perform pg_temp.ok('잴 메뉴가 없으면 기준은 있는 걸로 본다', (v_res->>'has_basis')::boolean);
end $t$;


-- ── ⑤ 영업 중에 만든 새 메뉴 (0120) ───────────────────────────
/*
 * 0119 는 "그날 스냅샷에 메뉴가 **하나라도** 있나"만 물었다. 그 질문으로는
 * 영업 중에 만든 메뉴를 못 잡는다 —
 *   기존 메뉴들의 스냅샷이 있으니 has_basis = true 인데,
 *   정작 새 메뉴는 스냅샷에 없어서 필요 재료가 0건으로 계산되고,
 *   부족 경고 없이 저장된 뒤에야 그 메뉴의 스냅샷이 추가된다.
 * 물어야 할 것은 **"이번에 파는 메뉴 전부가 스냅샷에 있나"** 다.
 *
 * ⚠ `bool_and` 는 null 을 **건너뛴다.** 스냅샷에 없는 메뉴는 `jsonb_typeof` 가 null 이라
 *   `null = 'object'` 가 null 이 되고, coalesce 로 눕히지 않으면 그대로 true 가 나온다.
 *   실제로 0120 첫 판이 그렇게 통과했다.
 */
do $t$
declare
  r_je  uuid := pg_temp.rcp('제육볶음');
  r_new uuid;
  v_day date := business_day();
  v_res jsonb;
begin
  -- 영업은 이미 시작돼 있다(위 블록들). 그 뒤에 메뉴를 만든다.
  r_new := save_recipe(pg_temp.store(), jsonb_build_object(
    'name', '영업중 새메뉴', 'price', 10000, 'base_servings', 10,
    'lines', jsonb_build_array(jsonb_build_object(
      'ingredient_id', pg_temp.ing('소고기 불고기감'), 'input_qty', 2000))));

  perform pg_temp.ok('새 메뉴는 그날 스냅샷에 없다',
    day_snapshot(pg_temp.store(), v_day) #> array['recipes', r_new::text] is null);

  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_new, 'qty_hall', 5)));
  perform pg_temp.ok('새 메뉴만 팔면 못 쟀다고 한다', not (v_res->>'has_basis')::boolean);

  -- 하나라도 없으면 그 저장은 못 잰 것이다. 기존 메뉴가 섞여 있어도 마찬가지다.
  v_res := sale_shortages(pg_temp.store(), v_day, jsonb_build_array(
    jsonb_build_object('recipe_id', r_je,  'qty_hall', 1),
    jsonb_build_object('recipe_id', r_new, 'qty_hall', 5)));
  perform pg_temp.ok('기존 메뉴가 섞여 있어도 못 쟀다고 한다', not (v_res->>'has_basis')::boolean);

  v_res := sale_shortages(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', r_je, 'qty_hall', 1)));
  perform pg_temp.ok('스냅샷에 있는 메뉴만 팔면 잰 것이다', (v_res->>'has_basis')::boolean);
end $t$;
