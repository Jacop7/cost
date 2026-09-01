-- ════════════════════════════════════════════════════════════════
-- 16 · 수정 내역 보관 30일 (0076)
--
-- 사장님: "사용자는 최근 7일 확인 → 서버는 30일 보관 → 핵심 장부는 영구 보존"
--
-- 이 정책이 안전한 이유는 하나다:
--   **수정 내역을 통째로 지워도 재고·단가·손익이 하나도 안 움직인다.**
-- 그게 사실인지 여기서 확인한다. 사실이 아니라면 지우면 안 되는 데이터다.
-- ════════════════════════════════════════════════════════════════

-- 청소는 전 매장 유지보수 문이라 service_role/소유자만 부른다. 시험 본문이
-- executor 권한을 넓히지 않도록 소유자 호출을 헬퍼 하나로 고정한다.
create function pg_temp.purge_changes_for_test() returns integer
language plpgsql as $h$
declare v_n integer;
begin
  set local role postgres;
  v_n := purge_entity_changes();
  set local role margincook_rpc_executor;
  return v_n;
end $h$;

do $t$
declare
  v_ing  uuid := pg_temp.ing('대파');
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_day  date := pg_temp.today();
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
  execute 'set local role margincook_rpc_executor';
  v_n := pg_temp.purge_changes_for_test();
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
  v_day date := pg_temp.today();
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
  execute 'set local role margincook_rpc_executor';
  v_n := pg_temp.purge_changes_for_test();
  perform pg_temp.eq('40일 지난 것만 지워진다', v_n, 1, 0);
  perform pg_temp.eq('나머지는 남는다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()), v_new - 1, 0);

  -- 29일 된 것은 살아 있어야 한다 — 경계에서 하루 일찍 지우면 안 된다.
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '29 days'
   where id = (select id from entity_change_events
                where store_id = pg_temp.store() order by occurred_at desc limit 1);
  execute 'set local role margincook_rpc_executor';
  perform pg_temp.eq('29일 된 것은 안 지운다', pg_temp.purge_changes_for_test(), 0, 0);

  -- ⚠ 청소가 실패해도 영업 시작이 막히면 안 된다 — 곁일이다.
  perform pg_temp.ok('영업 시작에 청소가 붙어 있다',
    pg_get_functiondef('public.open_business_day(uuid,date,time)'::regprocedure)
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
  execute 'set local role margincook_rpc_executor';

  v_n := pg_temp.purge_changes_for_test();
  perform pg_temp.ok('20일 된 기록은 살아 있다',
    exists (select 1 from entity_change_events where id = v_old));

  -- ④ 정상 경로(영업 시작)의 30일 정리는 계속 돈다.
  execute 'reset role';
  update entity_change_events set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  execute 'set local role margincook_rpc_executor';

  /*
   * ⚠ 닫았다 다시 여는 것으로는 확인이 안 된다. 그 경로는 `reopen_business_day` 라
   *   청소가 안 붙어 있다 — 처음에 그렇게 짰다가 시험이 빨갛게 돼서 알았다.
   *   청소는 **새 영업일을 만들 때** 도는 곁일이므로, 오늘 장부를 과거 날짜로 옮겨
   *   진짜 `open_business_day` 가 돌게 만든다(트랜잭션 안이라 롤백된다).
   */
  execute 'reset role';
  update business_days set business_date = date '2020-01-02', status = 'closed'
   where store_id = pg_temp.store() and business_date = pg_temp.today();
  execute 'set local role margincook_rpc_executor';

  perform pg_temp.open_today();          -- 여기서 청소가 곁일로 돈다
  perform pg_temp.ok('영업 시작이 40일 된 기록을 정리한다',
    not exists (select 1 from entity_change_events where id = v_old));
end $t$;


-- ── 함수 권한의 기본값 (0135 · 0136) ──────────────────────────
/*
 * ⚠ 이건 한 함수의 문제가 아니라 **기본값**의 문제다. 그리고 그 기본값은 **두 층**이다 —
 *   한쪽만 걷으면 절반만 걷힌다. 0135 가 실제로 그랬다.
 *
 *       PUBLIC 은 PostgreSQL 의 **전역** 기본값   → `in schema` 를 **빼야** 걷힌다
 *       anon   은 Supabase 의 **스키마별** 기본값 → `in schema` 를 **줘야** 걷힌다
 *
 *   실측: `in schema` 만 쓰면 새로 만든 함수가 `PUBLIC=true anon=true` 로 그대로 생긴다.
 *   (0135 에는 "template 기본값이 이긴다"고 적었는데 **틀린 설명이었다.** template 과
 *    무관하다. 0136 이 바로잡았다.)
 *
 *   빨개지면 두 층 중 하나가 빠진 것이다. 0136 의 세 문장을 그대로 쓰면 된다:
 *       alter default privileges for role postgres
 *         revoke execute on functions from public;                    -- 전역
 *       alter default privileges for role postgres in schema public
 *         revoke execute on functions from anon;                      -- 스키마별
 *       alter default privileges for role postgres in schema public
 *         grant  execute on functions to authenticated, service_role;
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

  -- 0174부터 반대 계약이다. 앱은 공식 facade만 호출하며 내부 계산·몸통은 실행 역할에만 연다.
  perform pg_temp.ok('정상 facade는 인증 사용자가 부를 수 있다',
    has_function_privilege('authenticated',
      'public.transition_business_state(uuid, text, time)', 'execute'));
  perform pg_temp.ok('내부 계산은 인증 사용자에게 닫혀 있다',
    not has_function_privilege('authenticated',
      'public.base_unit_price(uuid)', 'execute'));
  perform pg_temp.ok('RLS 도우미도 Data API 문이 아니다',
    not has_function_privilege('authenticated', 'public.my_store_ids()', 'execute'));

  -- 그리고 그 예외는 **정말로** 막혀 있어야 한다. 목록에만 적고 열려 있으면 의미가 없다.
  perform pg_temp.ok('크론 전용 함수는 인증 사용자도 못 부른다',
    not has_function_privilege('authenticated', 'public.close_due_business_days()', 'execute'));
  perform pg_temp.ok('크론 전용 함수는 anon 도 못 부른다',
    not has_function_privilege('anon', 'public.close_due_business_days()', 'execute'));
  /*
   * ⚠ 마감 **몸통**은 권한 검사를 안 한다. 열어 두면 사장님이 직접 불러
   *   `close_method`·`closed_at` 을 아무 값으로나 적을 수 있다(0138).
   *   사람이 들어오는 문은 `close_business_day` 하나뿐이어야 한다.
   */
  perform pg_temp.ok('마감 몸통은 인증 사용자도 못 부른다',
    not has_function_privilege('authenticated',
      'public.close_business_day_row(uuid,business_close_method)', 'execute'));
  -- 0160 부터 사람의 문은 전이 RPC 다 — close_business_day 도 내부 몸통이 됐다.
  perform pg_temp.ok('그래도 정상 문은 열려 있다',
    has_function_privilege('authenticated', 'public.transition_business_state(uuid, text, time)', 'execute')
    and not has_function_privilege('authenticated', 'public.close_business_day(uuid)', 'execute'));

  /*
   * ⚠ 앞의 두 줄은 **지금 있는** 함수만 본다. 정작 위험한 건 다음에 만들어질 함수다 —
   *   0135 의 확인이 딱 그래서 통과했고, 실제로는 절반만 걷혀 있었다.
   *   그러니 **진짜로 하나 만들어** 본다(트랜잭션 안이라 롤백된다).
   *
   *   빨개지면 기본 권한 두 층 중 하나가 빠진 것이다(0136):
   *     PUBLIC 은 전역   → `alter default privileges for role postgres revoke … from public`
   *     anon   은 스키마별 → `… for role postgres in schema public revoke … from anon`
   */
  execute 'reset role';
  execute 'create function public.zz_grant_probe() returns int language sql as ''select 1''';
  -- ⚠ 빨개지면 기본 권한 **두 층** 중 하나가 빠진 것이다(위 머리말 참고).
  perform pg_temp.ok('새로 만든 함수는 PUBLIC 이 못 부른다',
    not has_function_privilege('public', 'public.zz_grant_probe()', 'execute'));
  perform pg_temp.ok('새로 만든 함수는 anon 도 못 부른다',
    not has_function_privilege('anon', 'public.zz_grant_probe()', 'execute'));
  perform pg_temp.ok('새 함수는 인증 사용자에게 자동 공개되지 않는다',
    not has_function_privilege('authenticated', 'public.zz_grant_probe()', 'execute'));
  perform pg_temp.ok('새 함수는 전용 실행 역할에도 자동 공개되지 않는다',
    not has_function_privilege('margincook_rpc_executor', 'public.zz_grant_probe()', 'execute'));
  perform pg_temp.ok('새 함수는 service_role에는 열린다',
    has_function_privilege('service_role', 'public.zz_grant_probe()', 'execute'));
  execute 'drop function public.zz_grant_probe()';
  execute 'set local role margincook_rpc_executor';
end $t$;


-- ── SECURITY DEFINER 허용 목록 (0136) ─────────────────────────
/*
 * definer 함수는 **RLS 를 지나간다.** 그래서 하나 늘 때마다 그게 매장을 가리는지
 * 사람이 봐야 한다 — `purge_entity_changes` 가 안 가려서 이번 일이 났다.
 *
 * 여기 목록을 못 박아 두면, 새 definer 함수가 생길 때 시험이 빨개진다.
 * 그때 할 일은 목록에 이름을 더하는 게 아니라 **그 함수가 매장을 가리는지 보는 것**이다.
 *
 * 현재 허용 항목의 근거:
 *   my_store_ids                 auth.uid() 로 자기 매장만. 이게 RLS 의 뿌리다.
 *   purge_entity_changes         매장을 안 가린다. 대신 30일 고정 + anon 차단(0135).
 *   set_operating_hours          첫 줄이 assert_my_store 다(0132).
 *   save_settings · save_store_tax  settings 를 쓴다 — 앱 롤의 직접 쓰기를 걷어낸 뒤(0164)
 *                                definer 만 쓸 수 있다. 둘 다 첫 줄이 assert_my_store 다.
 *   (settings_sync_operating_rule 은 0164 에서 지웠다 — settings 는 표시 폼이고 권위는 규칙이다.)
 *   stores_default_operating_rule 트리거 전용. 직접 못 부른다.
 *   stores_default_settings · stores_default_time_settings
 *                                트리거 전용(0165). definer 인 이유는 settings·
 *                                store_time_settings 가 앱 롤에 안 열려 있어서다 —
 *                                예전엔 시간대 트리거가 invoker 라 매장 생성이 42501 로 죽었다.
 *   create_store                 매장 생성의 공식 문(0165). auth.uid() 로 주인을 정하고
 *                                초기화 셋이 다 생겼는지 확인한다.
 *   close_due_business_days      매장을 안 가린다. 그래서 사람에게는 **아예 안 연다** —
 *                                크론(service_role)만 부른다(0137).
 *   close_business_day           첫 줄이 assert_my_store 다. definer 인 이유는 권한을
 *                                걷어낸 몸통(`close_business_day_row`)을 부르기 위해서다(0138).
 *                                0160 부터 앱 롤에는 안 열린 내부 몸통이다.
 *   save_sale                    같은 이유다(0145) — 몸통 `apply_sale_items` 를 부른다.
 *   amend_ended_business_day     같은 이유다(0145). 첫 줄이 assert_my_store.
 *   open_business_day            같은 이유다(0154) — 기한 지난 옛 날을 닫을 때 매장
 *                                검사 없는 몸통 `close_business_day_row` 를 부른다.
 *                                첫 줄이 assert_my_store 다.
 *   set_store_timezone           직접 쓰기를 걷어낸 store_time_settings 에 쓴다(0156).
 *                                첫 줄이 assert_my_store, 영업 중이면 45011 로 거부.
 *   transition_business_state    전이 한 문(0157) — 매장 검사 없는 몸통
 *                                set_break_row 를 부른다. 첫 줄이 assert_my_store.
 *   apply_due_breaks             매장을 안 가린다 — 크론(service_role)만 부른다(0157).
 *                                close_due_business_days 와 같은 자세.
 *   apply_operating_hours        무판본 저장 몸통(0163). 앱 롤엔 안 열린다 — 토큰 필수 문
 *                                set_operating_hours 만 여기로 온다.
 *   archive_my_store · retire_my_account
 *                                auth.uid() 소유 매장만 아카이브하고 원장을 보존하는 앱 문(0173).
 *   schedule_store_purge · purge_archived_store
 *                                보존 종료·승인·백업 근거가 필요한 service_role 전용 문(0173).
 *   report_client_rpc_error      auth.uid()별 5분 버킷에 최소 오류 지문만 기록하는 앱 문(0176).
 *                                ops 원본 표는 앱 롤에 닫혀 있고 서버가 예상 오류를 다시 거른다.
 *   ops_health_status            매장 원장을 읽지 않고 Cron·집계 신호만 내는 service_role 전용 문(0176).
 *   apply_international_tax_for_sales_item · reconcile_international_tax_after_sale_item
 *                                INTL-1D 판매행 trigger 전용 몸통. 앱·service_role·RPC 실행 역할에는
 *                                모두 닫혀 있고, capability가 꺼져 있으면 쓰지 않는다(0181).
 *   apply_international_tax_for_sales_item_body · initialize_international_tax_activation_boundary
 *                                INTL-1F 활성일 검사 뒤 계산하는 몸통과 신규 프로필 활성 경계
 *                                트리거다. 둘 다 Data API에 직접 열지 않는다(0187).
 *   assert_sales_tax_line_balanced
 *                                INTL-1D deferred constraint trigger의 검사 몸통. 앱 세션 commit에서도
 *                                RLS/표 SELECT 권한에 막히지 않는다. 매장을 고르거나 값을 반환하지 않고
 *                                trigger가 건드린 한 계산선만 검사하며 직접 실행 문은 모든 앱 역할에 닫힌다.
 *   initialize_user_preferences  auth.users 트리거 전용. 앱 언어 표는 직접 열지 않는다(0182).
 *   get_user_preferences · save_app_language
 *                                auth.uid() 한 사람의 언어와 판본만 읽고 쓴다(0182).
 *   international_tax_app_state · international_tax_regions · recipe_tax_app_state ·
 *   sales_tax_app_detail         모두 assert_my_store로 매장 경계를 고정하는 INTL-1E facade다.
 *   international_tax_shadow_compare
 *                                INTL-1F 스테이징 관측 전용. 전 매장 ID를 받으므로 앱에는 닫고
 *                                service_role만 실행하며 업무 테이블은 쓰지 않는다.
 *   save_store_market_profile · save_store_tax_profile · save_menu_tax_override
 *                                INTL-1F 판본 검사 쓰기 facade. capability와 앱 판본을 먼저
 *                                확인하고, 표 직접 쓰기는 앱에 열지 않는다.
 */
do $t$
declare v_now text; v_want text;
begin
  /*
   * ⚠ **시그니처까지** 본다. 이름만 비교하면 `set_operating_hours` 의 인자가 위험하게
   *   바뀌어도(예: 매장 인자가 빠져도) 이름이 같아 그대로 통과한다.
   *   definer 는 RLS 를 지나가므로 "무엇을 받는가"가 곧 권한 경계다.
   */
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                    ' | ' order by p.proname, pg_get_function_identity_arguments(p.oid))
    into v_now
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
     and pg_get_userbyid(p.proowner) = 'postgres';

  v_want := concat_ws(' | ',
    'amend_ended_business_day(p_store uuid, p_date date, p_base_revision integer, p_items jsonb, p_etc_items jsonb, p_extra_items jsonb, p_reason text)',
    'apply_due_breaks()',
    'apply_international_tax_for_sales_item(p_sales_item uuid, p_force boolean)',
    'apply_international_tax_for_sales_item_body(p_sales_item uuid, p_force boolean)',
    'apply_operating_hours(p_store uuid, p_weekly_hours jsonb, p_weekly_breaks jsonb, p_base_rule_id uuid, p_base_revision integer)',
    'archive_my_store(p_store uuid, p_reason text)',
    'assert_sales_tax_line_balanced()',
    'close_business_day(p_store uuid)',
    'close_due_business_days()',
    'create_store(p_name text, p_timezone text)',
    'get_user_preferences()',
    'initialize_international_tax_activation_boundary()',
    'initialize_user_preferences()',
    'international_tax_app_state(p_store uuid)',
    'international_tax_regions(p_store uuid, p_country international_country_code)',
    'international_tax_shadow_compare(p_store uuid, p_date date)',
    'my_store_ids()',
    'open_business_day(p_store uuid, p_date date, p_close_time time without time zone)',
    'ops_health_status()',
    'purge_archived_store(p_store uuid, p_backup_reference text)',
    'purge_entity_changes()',
    'recipe_tax_app_state(p_store uuid, p_recipe uuid)',
    'reconcile_international_tax_after_sale_item()',
    'report_client_rpc_error(p_code text, p_detail text, p_client_platform text)',
    'retire_my_account()',
    'sales_tax_app_detail(p_store uuid, p_from date, p_to date)',
    'save_app_language(p_language text, p_base_revision integer)',
    'save_menu_tax_override(p_store uuid, p_recipe uuid, p_tax_profile uuid, p_tax_category text, p_treatment tax_treatment, p_base_revision integer)',
    'save_sale(p_store uuid, p_date date, p_items jsonb, p_etc_items jsonb, p_extra_items jsonb, p_base_revision integer, p_open_day boolean, p_open_close_time time without time zone)',
    'save_settings(p_store uuid, p_payload jsonb, p_base_revision integer)',
    'save_store_market_profile(p_store uuid, p_payload jsonb, p_base_profile_id uuid, p_base_revision integer)',
    'save_store_tax(p_store uuid, p_mode tax_mode, p_items jsonb, p_base_revision integer)',
    'save_store_tax_profile(p_store uuid, p_payload jsonb, p_base_profile_id uuid, p_base_revision integer)',
    'schedule_store_purge(p_store uuid, p_purge_after timestamp with time zone, p_approved_by text, p_approval_reference text, p_reason text)',
    'set_operating_hours(p_store uuid, p_weekly_hours jsonb, p_weekly_breaks jsonb, p_base_rule_id uuid, p_base_revision integer)',
    'set_store_timezone(p_store uuid, p_timezone text)',
    'stores_default_operating_rule()',
    'stores_default_settings()',
    'stores_default_time_settings()',
    'transition_business_state(p_store uuid, p_action text, p_close_time time without time zone)');

  perform pg_temp.eq_t('postgres 권한의 SECURITY DEFINER 목록이 그대로다', coalesce(v_now, '(없음)'), v_want);

  perform pg_temp.ok('전용 실행 역할 소유 함수는 모두 SECURITY DEFINER다', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and pg_get_userbyid(p.proowner) = 'margincook_rpc_executor'
       and not p.prosecdef));

  -- 그리고 그중 anon 이 부를 수 있는 건 하나도 없어야 한다.
  perform pg_temp.eq('definer 함수 중 anon 이 부를 수 있는 것',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
        and has_function_privilege('anon', p.oid, 'execute')), 0, 0);
end $t$;
