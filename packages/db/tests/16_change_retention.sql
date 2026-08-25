-- ════════════════════════════════════════════════════════════════
-- 16 · 수정 내역 보관 30일 (0076)
--
-- 사장님: "사용자는 최근 7일 확인 → 서버는 30일 보관 → 핵심 장부는 영구 보존"
--
-- 이 정책이 안전한 이유는 하나다:
--   **수정 내역을 통째로 지워도 재고·단가·손익이 하나도 안 움직인다.**
-- 그게 사실인지 여기서 확인한다. 사실이 아니라면 지우면 안 되는 데이터다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing  uuid := pg_temp.ing('대파');
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_day  date := business_day();
  -- 지우기 전 계산값
  v_price0 numeric;  v_stock0 numeric;  v_mat0 numeric;  v_profit0 numeric;
  v_ledger0 int;     v_orders0 int;     v_ptrend0 int;   v_ftrend0 int;
  v_snap0  jsonb;
  v_n      int;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)

  -- 내역이 쌓이도록 몇 가지를 실제로 바꾼다.
  perform quick_inbound(pg_temp.store(), v_ing, 1000, 6000, 2, null, v_day, 'T16-A');
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12500, 'base_servings', 10));
  perform pg_temp.ok('내역이 쌓였다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()) > 0);

  -- ── 지우기 전 값을 모두 잡는다 ──────────────────────────────
  v_price0  := base_unit_price(v_ing);
  v_stock0  := stock_total_base(v_ing);
  select material_cost, profit into v_mat0, v_profit0
    from recipe_list(pg_temp.store()) where id = v_rcp;
  select count(*) into v_ledger0 from inventory_events where store_id = pg_temp.store();
  select count(*) into v_orders0 from order_records where store_id = pg_temp.store();
  select count(*) into v_ptrend0 from price_trends where store_id = pg_temp.store();
  select count(*) into v_ftrend0 from profit_trends where store_id = pg_temp.store();
  v_snap0 := (select snapshot from business_days
               where store_id = pg_temp.store() and business_date = v_day);

  -- ── 수정 내역을 **전부** 나이 들게 한 뒤 청소한다 ───────────
  -- ⚠ 직접 delete 하면 RLS 에 막혀 0건이 지워지고 조용히 성공한다.
  --   실제 청소 경로(purge_entity_changes)를 그대로 쓴다.
  -- ⚠ 이 원장은 SELECT·INSERT 만 열려 있다 — 사용자가 자기 이력을 고치거나
  --   골라 지울 수 없어야 하기 때문이다. 그래서 **나이를 들리는 것도 막힌다.**
  --   시험용으로만 잠깐 권한을 되돌린다(트랜잭션 안이라 롤백된다).
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '40 days'
   where store_id = pg_temp.store();
  execute 'set local role authenticated';
  v_n := purge_entity_changes();
  perform pg_temp.ok('청소가 실제로 지운다', v_n > 0);
  perform pg_temp.eq('내역이 비었다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()), 0, 0);

  -- ── 계산 근거는 하나도 안 움직여야 한다 ─────────────────────
  perform pg_temp.eq('기준단가 그대로',  base_unit_price(v_ing), v_price0, 0.000001);
  perform pg_temp.eq('재고 그대로',      stock_total_base(v_ing), v_stock0, 0.000001);
  perform pg_temp.eq('레시피 재료비 그대로',
    (select material_cost from recipe_list(pg_temp.store()) where id = v_rcp), v_mat0, 0.000001);
  perform pg_temp.eq('레시피 순이익 그대로',
    (select profit from recipe_list(pg_temp.store()) where id = v_rcp), v_profit0, 0.000001);

  perform pg_temp.eq('재고 원장 그대로',
    (select count(*) from inventory_events where store_id = pg_temp.store()), v_ledger0, 0);
  perform pg_temp.eq('구매·입고 이력 그대로',
    (select count(*) from order_records where store_id = pg_temp.store()), v_orders0, 0);
  perform pg_temp.eq('가격 추이 그대로',
    (select count(*) from price_trends where store_id = pg_temp.store()), v_ptrend0, 0);
  perform pg_temp.eq('손익 추이 그대로',
    (select count(*) from profit_trends where store_id = pg_temp.store()), v_ftrend0, 0);
  perform pg_temp.ok('그날 영업 기준(스냅샷)도 그대로',
    (select snapshot from business_days
      where store_id = pg_temp.store() and business_date = v_day) = v_snap0);

  -- 마스터의 갱신 시각도 남는다 — "마지막으로 언제 고쳤나"는 여기로도 안다.
  perform pg_temp.ok('레시피 updated_at 은 남는다',
    (select updated_at from recipes where id = v_rcp) is not null);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 30일이 지난 것만 지운다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing uuid := pg_temp.ing('양파');
  v_day date := business_day();
  v_old uuid;
  v_new int;
  v_n   int;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  perform pg_temp.open_today();   -- 열린 영업일을 보장한다(프렐류드 헬퍼)

  perform quick_inbound(pg_temp.store(), v_ing, 1000, 2000, 1, null, v_day, 'T16-B');
  select count(*) into v_new from entity_change_events where store_id = pg_temp.store();
  perform pg_temp.ok('새 내역이 있다', v_new > 0);

  -- 한 건만 40일 전으로 밀어 놓는다.
  select id into v_old from entity_change_events
   where store_id = pg_temp.store() order by occurred_at desc limit 1;
  -- ⚠ 이 원장은 SELECT·INSERT 만 열려 있다 — 사용자가 자기 이력을 고치거나
  --   골라 지울 수 없어야 하기 때문이다. 그래서 **나이를 들리는 것도 막힌다.**
  --   시험용으로만 잠깐 권한을 되돌린다(트랜잭션 안이라 롤백된다).
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  execute 'set local role authenticated';
  v_n := purge_entity_changes();
  perform pg_temp.eq('40일 지난 것만 지워진다', v_n, 1, 0);
  perform pg_temp.eq('나머지는 남는다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()), v_new - 1, 0);

  -- 29일 된 것은 살아 있어야 한다 — 경계에서 하루 일찍 지우면 안 된다.
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '29 days'
   where id = (select id from entity_change_events
                where store_id = pg_temp.store() order by occurred_at desc limit 1);
  execute 'set local role authenticated';
  perform pg_temp.eq('29일 된 것은 안 지운다', purge_entity_changes(), 0, 0);

  -- ⚠ 청소가 실패해도 영업 시작이 막히면 안 된다 — 곁일이다.
  perform pg_temp.ok('영업 시작에 청소가 붙어 있다',
    pg_get_functiondef('public.open_business_day(uuid,date)'::regprocedure)
      like '%purge_entity_changes%');
end $t$;


-- ── 누가 부를 수 있는가 (0135) ────────────────────────────────
/*
 * ⚠ 실측으로 확인된 취약점이다. 일회용 새 DB 에서 —
 *     45일 전으로 늙힌 수정내역 128건
 *     set role anon;  select purge_entity_changes(1);   →  128
 *     남은 수정내역 0건
 *   로그인도 안 한 사람이 **모든 매장의** 수정 내역을 지웠다.
 *
 * 원인이 둘이었다 —
 *   ① 이 함수는 definer 인데 매장을 안 가린다(0076 이 일부러 그렇게 뒀다).
 *      대신 **누가 부를 수 있는지**가 좁아야 하는데 안 좁았다.
 *   ② 새 함수의 실행 권한 기본값이 `PUBLIC` 이고 Supabase 기본 권한이 anon 에도 준다.
 *
 * 그리고 `p_days` 를 받으니 `1` 을 넣어 보관 기간을 무시할 수 있었다.
 * 보관 기간은 **정책**이지 호출자가 정할 값이 아니다.
 */
do $t$
declare v_old uuid; v_n int;
begin
  -- ① anon 은 못 부른다. 권한 값이 아니라 **실제로 내려가서** 본다.
  perform pg_temp.raises('anon 은 청소를 못 부른다',
    'set local role anon; select purge_entity_changes()', '42501');

  -- ② 인자가 아예 없다 — 보관 기간을 호출자가 못 줄인다.
  perform pg_temp.eq('인자 있는 옛 함수가 없다',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'purge_entity_changes'
        and pg_get_function_identity_arguments(p.oid) <> ''), 0, 0);
  perform pg_temp.raises('1일을 넣어도 안 먹는다',
    'select purge_entity_changes(1)', '42883');   -- undefined_function

  /*
   * ③ 30일 이내 기록은 유지된다. (위 ② 로 기간을 못 줄이니 이건 그 결과다.)
   * ⚠ 행을 새로 만들지 않고 **있는 것을 늙힌다.** 컬럼 목록을 손으로 적으면
   *   스키마가 바뀔 때 이 시험만 조용히 깨진다 — 실제로 한 번 그랬다.
   */
  execute 'reset role';
  select id into v_old from entity_change_events
   where store_id = pg_temp.store() order by occurred_at desc limit 1;
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '20 days'
   where id = v_old;
  execute 'set local role authenticated';

  v_n := purge_entity_changes();
  perform pg_temp.ok('20일 된 기록은 살아 있다',
    exists (select 1 from entity_change_events where id = v_old));

  -- ④ 정상 경로(영업 시작)의 30일 정리는 계속 돈다.
  execute 'reset role';
  update entity_change_events set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  execute 'set local role authenticated';

  /*
   * ⚠ 닫았다 다시 여는 것으로는 확인이 안 된다. 그 경로는 `reopen_business_day` 라
   *   청소가 안 붙어 있다 — 처음에 그렇게 짰다가 시험이 빨갛게 돼서 알았다.
   *   청소는 **새 영업일을 만들 때** 도는 곁일이므로, 오늘 장부를 과거 날짜로 옮겨
   *   진짜 `open_business_day` 가 돌게 만든다(트랜잭션 안이라 롤백된다).
   */
  execute 'reset role';
  update business_days set business_date = date '2020-01-02', status = 'closed'
   where store_id = pg_temp.store() and business_date = business_day();
  execute 'set local role authenticated';

  perform pg_temp.open_today();          -- 여기서 청소가 곁일로 돈다
  perform pg_temp.ok('영업 시작이 40일 된 기록을 정리한다',
    not exists (select 1 from entity_change_events where id = v_old));
end $t$;


-- ── 함수 권한의 기본값 (0135) ─────────────────────────────────
/*
 * ⚠ 이건 한 함수의 문제가 아니라 **기본값**의 문제다.
 *   Postgres 는 새 함수에 `PUBLIC` 실행 권한을 준다. `alter default privileges` 로
 *   기본값을 고쳐 놔도, 새 DB 에서 새로 만든 함수에 `=X/postgres` 가 그대로 붙는 걸
 *   측정했다 — template 이 들고 있는 기본값이 이긴다.
 *
 *   그래서 0135 가 지금 있는 함수를 명시적으로 걷었는데, **다음 마이그레이션이 함수를
 *   하나 만들면 그 함수는 또 PUBLIC 이다.** 그걸 여기서 잡는다.
 *   빨개지면 그 마이그레이션 끝에 아래 두 줄을 넣으면 된다:
 *       revoke execute on all functions in schema public from public, anon;
 *       grant  execute on all functions in schema public to authenticated, service_role;
 */
do $t$
declare v_n int; v_names text;
begin
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into v_n, v_names
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute');
  perform pg_temp.eq(
    coalesce('anon 이 부를 수 있는 함수: ' || v_names, 'anon 이 부를 수 있는 함수 없음'),
    v_n, 0, 0);

  -- 반대쪽도 본다. 다 걷어 버리면 앱이 통째로 죽는다.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into v_n, v_names
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and not has_function_privilege('authenticated', p.oid, 'execute');
  perform pg_temp.eq(
    coalesce('인증 사용자가 못 부르는 함수: ' || v_names, '인증 사용자는 전부 부를 수 있다'),
    v_n, 0, 0);
end $t$;
