-- ════════════════════════════════════════════════════════════════
-- 07 · 매장 격리와 입력 방어
--
-- 사장님 한 명이 쓰는 앱이라 지금은 티가 안 나지만, 매장이 둘이 되는 순간
-- 여기가 새면 남의 원가가 내 손익에 섞인다. 되돌릴 방법이 없는 종류의 사고다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_other uuid := '00000000-0000-0000-0000-0000000000ff';
  v_jeyuk uuid := pg_temp.rcp('제육볶음');
begin
  -- ── 남의 매장에는 쓸 수 없다 ─────────────────────────────────
  perform pg_temp.raises('남의 매장에 식재료 저장 거부',
    format('select save_ingredient(%L, %L::jsonb)', v_other, '{"name":"침입"}'), '42501');
  perform pg_temp.raises('남의 매장에 메뉴 저장 거부',
    format('select save_ingredient(%L, %L::jsonb)', v_other, '{"name":"침입2"}'), '42501');
  perform pg_temp.raises('남의 매장에 고정지출 저장 거부',
    format('select save_fixed_costs(%L, %L, 1000000, %L::jsonb)', v_other, '2026-08', '[]'), '42501');

  -- ── 남의 매장은 읽을 수도 없다 (RLS) ────────────────────────
  perform pg_temp.eq('내 매장만 보인다', (select count(*) from stores), 1, 0);
  perform pg_temp.eq('내 매장 재료만 보인다',
    (select count(*) from ingredients where store_id <> pg_temp.store()), 0, 0);

  -- ── 필수값·범위 ─────────────────────────────────────────────
  perform pg_temp.raises('빈 메뉴 이름 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(), '{"name":"  ","price":1000}'), '22000');
  perform pg_temp.raises('기준 인분 0 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"인분0","price":1000,"base_servings":0}'), '22000');
  perform pg_temp.raises('음수 판매가 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"음수가","price":-1}'), '22000');

  -- ── 중복 이름 ───────────────────────────────────────────────
  perform pg_temp.raises('같은 이름 메뉴 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"제육볶음","price":12000}'), '23505');

  -- ── 자기 자신을 재료로 쓸 수 없다 (무한 전개 방지) ──────────
  perform pg_temp.raises('메뉴가 자기 자신을 재료로 못 쓴다',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
      jsonb_build_object(
        'id', v_jeyuk, 'name', '제육볶음', 'price', 12000,
        'lines', jsonb_build_array(
          jsonb_build_object('sub_recipe_id', v_jeyuk, 'input_qty', 1)))::text), '22000');

  -- ── 사용 중인 것은 지울 수 없다 ─────────────────────────────
  perform pg_temp.raises('메뉴가 쓰는 식재료 비활성 거부',
    format('select deactivate_ingredient(%L)', pg_temp.ing('대파')), '23503');
  perform pg_temp.raises('식재료가 든 카테고리 삭제 거부',
    format('select delete_category(%L)',
           (select category_id from ingredients where id = pg_temp.ing('대파'))), '23503');

  -- ── 미래 날짜로는 기록할 수 없다 ────────────────────────────
  -- 아직 일어나지 않은 일이 추이에 점을 찍으면 그래프가 앞질러 간다.
  perform pg_temp.raises('미래 날짜 폐기 거부',
    format('select e2_discard(%L, 0, %L::date)', pg_temp.ing('대파'), business_day() + 1));

  -- ── RPC 오버로드는 0 이어야 한다 ────────────────────────────
  -- 같은 이름 함수가 둘이면 PostgREST 가 어느 쪽을 부를지 모른다.
  perform assert_no_rpc_overloads();
  perform pg_temp.ok('RPC 오버로드 없음', true);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0047 · 영업일 경계
--
-- 자정이 아니라 **영업 종료 시각**이 경계다. 10:00~02:00 영업이면
-- 새벽 1시 매출은 전날 장사다 — 안 그러면 하루가 둘로 쪼개진다.
-- ════════════════════════════════════════════════════════════════

do $t$
begin
  -- 자정을 안 넘는 영업이면 경계도 자정이다(기존 동작 보존).
  perform save_settings(pg_temp.store(), '{"open_time":"11:00","close_time":"22:00"}'::jsonb);
  perform pg_temp.eq_t('자정 안 넘으면 경계 0', business_cutoff()::text, '00:00:00');
  perform pg_temp.eq_t('새벽 1시는 그날',
    business_day('2026-08-21 01:00+09')::text, '2026-08-21');

  -- 자정을 넘으면 종료 시각이 경계다.
  perform save_settings(pg_temp.store(), '{"open_time":"10:00","close_time":"02:00"}'::jsonb);
  perform pg_temp.eq_t('자정 넘으면 경계 = 종료시각', business_cutoff()::text, '02:00:00');
  perform pg_temp.eq_t('새벽 1시는 전날 장사',
    business_day('2026-08-21 01:00+09')::text, '2026-08-20');
  perform pg_temp.eq_t('새벽 3시는 당일',
    business_day('2026-08-21 03:00+09')::text, '2026-08-21');
  perform pg_temp.eq_t('아침 10시는 당일',
    business_day('2026-08-21 10:00+09')::text, '2026-08-21');

  -- 총 영업 시간이 자정을 넘어도 맞는다.
  perform pg_temp.eq('10:00~02:00 은 16시간',
    (get_settings(pg_temp.store())->>'open_minutes')::int, 960, 0);
  perform pg_temp.ok('자정 넘김 표시',
    (get_settings(pg_temp.store())->>'overnight')::boolean is true);

  -- 시작과 종료가 같으면 경계를 정할 수 없다.
  perform pg_temp.raises('시작=종료 거부',
    format('select save_settings(%L, %L::jsonb)', pg_temp.store(),
           '{"open_time":"10:00","close_time":"10:00"}'), '22000');
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 오버로드 가드가 **실제로 잡는가**
--
-- 0080 에서 가드를 public 전체로 넓혔지만, "지금 오버로드가 없다"만 확인하면
-- 가드가 망가져도 통과한다. 일부러 하나 만들어 **실패하는 것까지** 본다.
--
-- 실제로 겪은 일이다 — change_line 에 인자를 더하면서 옛 시그니처가 남았는데
-- 가드는 전파 RPC 이름만 봐서 두 번이나 "clean" 이라고 답했다.
-- ════════════════════════════════════════════════════════════════

do $t$
begin
  -- 지금은 깨끗하다.
  perform assert_no_rpc_overloads();
  perform pg_temp.ok('평소에는 통과한다', true);

  -- ⚠ public 에 함수를 만들려면 권한이 필요하다. 시험용으로만 잠깐 되돌린다
  --   (트랜잭션 안이라 롤백된다).
  execute 'reset role';
  execute $q$
    create function public.change_line(p_a int) returns int
    language sql immutable as 'select p_a'
  $q$;
  execute 'set local role authenticated';

  -- 이제 change_line 이 둘이다 — 가드가 반드시 터져야 한다.
  perform pg_temp.raises('오버로드를 만들면 가드가 막는다',
    'select assert_no_rpc_overloads()', null);

  -- 치우면 다시 통과한다.
  execute 'reset role';
  execute 'drop function public.change_line(int)';
  execute 'set local role authenticated';
  perform assert_no_rpc_overloads();
  perform pg_temp.ok('치우면 다시 통과한다', true);

  -- ⚠ 전파 RPC 이름이 아닌 함수도 잡아야 한다. 전에는 여기가 뚫려 있었다.
  execute 'reset role';
  execute $q$
    create function public.business_day(p_a int) returns int
    language sql immutable as 'select p_a'
  $q$;
  execute 'set local role authenticated';
  perform pg_temp.raises('전파 RPC 가 아닌 이름도 잡는다',
    'select assert_no_rpc_overloads()', null);
  execute 'reset role';
  execute 'drop function public.business_day(int)';
  execute 'set local role authenticated';
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 상세는 last_change 에 display_state 를 **반드시** 담는다
--
-- 앱 파서가 이 키로 배지를 정한다. 빠지면 조용히 '매출 계산과 무관'이 되어
-- 없는 사실을 주장하게 된다 — 실제로 0078 에서 모양이 바뀌며 그렇게 샜다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing uuid := pg_temp.ing('대파');
  v_rcp uuid := pg_temp.rcp('제육볶음');
  lc    jsonb;
begin
  -- ── 기록이 없을 때 ──────────────────────────────────────────
  for lc in
    select ingredient_detail(v_ing)->'last_change'
    union all select recipe_detail(v_rcp)->'last_change'
  loop
    perform pg_temp.ok('last_change 가 있다', lc is not null and lc <> 'null'::jsonb);
    perform pg_temp.ok('display_state 키가 있다', lc ? 'display_state');
    perform pg_temp.ok('아는 상태값이다',
      lc->>'display_state' in ('reflected', 'not_reflected', 'partial', 'irrelevant'));
    perform pg_temp.ok('occurred_at 이 있다', (lc->>'occurred_at') is not null);
    perform pg_temp.ok('event_id 키가 있다', lc ? 'event_id');
  end loop;

  -- ── 기록이 생긴 뒤에도 ──────────────────────────────────────
  begin perform open_business_day(pg_temp.store()); exception when others then null; end;
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12900, 'base_servings', 10));

  lc := recipe_detail(v_rcp)->'last_change';
  perform pg_temp.ok('수정 뒤에도 display_state 가 있다', lc ? 'display_state');
  perform pg_temp.eq_t('영업 중 수정은 미반영', lc->>'display_state', 'not_reflected');
  perform pg_temp.ok('그 사건의 id 를 가리킨다', (lc->>'event_id') is not null);
  perform pg_temp.ok('기록이 있다고 알린다', (lc->>'has_history')::boolean);
end $t$;
