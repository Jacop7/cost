-- ═══════════════════════════════════════════════════════════════
-- 34 · 앱 롤은 공식 RPC만 실행하고 원장·내부 몸통을 직접 건드리지 못한다
--
-- 기존 01~33은 내부 공식까지 재는 백색상자 시험이라 margincook_rpc_executor로 돈다.
-- 이 파일은 실제 Data API 역할(authenticated)로 전환해 외부 공격면을 따로 잰다.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 전용 실행 역할은 로그인·RLS 우회·앱의 SET ROLE 경로가 없다 ──────────────

select pg_temp.ok('RPC 실행 역할은 로그인할 수 없다', not (
  select rolcanlogin from pg_roles where rolname = 'margincook_rpc_executor'));
select pg_temp.ok('RPC 실행 역할은 authenticated 권한을 상속한다',
  pg_has_role('margincook_rpc_executor', 'authenticated', 'member'));
select pg_temp.ok('authenticated는 RPC 실행 역할로 전환할 수 없다', not
  pg_has_role('authenticated', 'margincook_rpc_executor', 'member'));

select pg_temp.eq('authenticated에 열린 public 함수는 공식 facade 65개뿐이다', (
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and has_function_privilege('authenticated', p.oid, 'execute'))::numeric, 65);

select pg_temp.ok('RLS 정책은 닫힌 my_store_ids 몸통을 호출하지 않는다', not exists (
  select 1 from pg_policy pol
   where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%my_store_ids()%'
      or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%my_store_ids()%'));

-- purge_archived_store는 예약이 없으면 몸통이 스스로 42501(PURGE_NOT_SCHEDULED)을
-- 던지므로 권한 판별력이 없다. 자체 42501이 없는 유지보수 문으로 권한 거부를 잰다.
select pg_temp.raises('RPC 실행 역할은 전 매장 자동 마감 스윕을 부를 수 없다',
  'select close_due_business_days()', '42501');
select pg_temp.raises('RPC 실행 역할은 전 매장 변경 이력 청소를 부를 수 없다',
  'select purge_entity_changes()', '42501');
select pg_temp.ok('RPC 실행 역할에 매장 삭제 몸통 EXECUTE가 없다', not
  has_function_privilege('margincook_rpc_executor',
    'public.purge_archived_store(uuid,text)', 'execute'));

select pg_temp.eq('RPC 실행 역할에 postgres 유지보수 definer가 열린 건수는 0이다', (
  select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles owner_role on owner_role.oid = p.proowner
   where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prosecdef
     and owner_role.rolname = 'postgres'
     and has_function_privilege('margincook_rpc_executor', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute')
)::numeric, 0);

-- RLS가 실제로 다른 사장님의 매장을 숨기는지 재기 위한 두 번째 매장.
do $t$
declare
  v_owner uuid;
  v_store uuid;
  v_ingredient uuid;
begin
  v_owner := pg_temp.new_owner();
  perform pg_temp.as_owner(v_owner);
  v_store := (create_store('P0-5 다른 사장님', 'Asia/Seoul')->>'store_id')::uuid;
  perform set_config('margincook.test.foreign_store', v_store::text, true);
  v_ingredient := save_ingredient(v_store, jsonb_build_object(
    'name', 'P0-5 다른 매장 식재료', 'base_unit', 'g', 'per_volume', 1,
    'safety_stock', 0, 'min_order_qty', 1));
  perform set_config('margincook.test.foreign_ingredient', v_ingredient::text, true);
  perform pg_temp.as_owner(pg_temp.owner());
end
$t$;

-- 여기부터는 백색상자 역할이 아니라 앱의 실제 PostgREST 역할이다.
set local role authenticated;

-- ── 2. 승인된 읽기·쓰기 facade는 정상 동작하고 RLS는 유지된다 ───────────────

select pg_temp.ok('공식 읽기 RPC get_settings는 열린다',
  (get_settings(pg_temp.store())->>'revision')::integer >= 1);

do $t$
declare
  v_category uuid;
  v_before bigint;
  v_after bigint;
begin
  v_category := save_category(
    pg_temp.store(),
    jsonb_build_object('name', 'P0-5 공식 문 시험 ' || gen_random_uuid(), 'sort_order', 999)
  );
  perform pg_temp.ok('공식 쓰기 RPC save_category는 열린다', exists (
    select 1 from categories where id = v_category and store_id = pg_temp.store()));

  select count(*) into v_before from inventory_events where ingredient_id = pg_temp.ing('대파');
  perform e5_stock_adjusted(pg_temp.ing('대파'), 4321, false, 'P0-5 공식 원장 문');
  select count(*) into v_after from inventory_events where ingredient_id = pg_temp.ing('대파');
  perform pg_temp.eq('공식 원장 RPC는 이벤트 한 줄을 추가한다', v_after, v_before + 1);
  perform pg_temp.eq('공식 원장 RPC가 확정 잔액도 맞춘다',
    (select stock_total from inventory_states where ingredient_id = pg_temp.ing('대파')), 4321);
end
$t$;

select pg_temp.eq('RLS로 내 매장은 한 줄 보인다',
  (select count(*) from stores where id = pg_temp.store()), 1);
select pg_temp.eq('RLS로 다른 사장님 매장은 보이지 않는다',
  (select count(*) from stores
    where id = current_setting('margincook.test.foreign_store')::uuid), 0);

select pg_temp.ok('facade도 다른 사장님 매장 설정을 돌려주지 않는다',
  get_settings(current_setting('margincook.test.foreign_store')::uuid) is null);
select pg_temp.raises('facade도 다른 사장님 매장에 쓰지 못한다',
  format('select save_category(%L, %L::jsonb)', current_setting('margincook.test.foreign_store'),
         '{"name":"P0-5 교차 매장 침입","sort_order":1}'), '42501');
select pg_temp.ok('RLS에 기대는 상세 facade는 다른 매장 식재료를 돌려주지 않는다',
  ingredient_detail(current_setting('margincook.test.foreign_ingredient')::uuid) is null);
select pg_temp.ok('RPC 실행 역할은 RLS를 우회하지 않는다', not (
  select rolbypassrls from pg_roles where rolname = 'margincook_rpc_executor'));

-- ── 3. 내부 몸통은 PostgREST에서 직접 호출할 수 없다 ───────────────────────

select pg_temp.raises('consume_stock 직접 호출 거부',
  format('select consume_stock(%L, 1, false)', pg_temp.ing('대파')), '42501');
select pg_temp.raises('restore_stock 직접 호출 거부',
  format('select restore_stock(%L, 1)', pg_temp.ing('대파')), '42501');
select pg_temp.raises('recompute_recipe 직접 호출 거부',
  format('select recompute_recipe(%L, %L::trend_cause, current_date, null)',
         pg_temp.rcp('제육볶음'), 'material'), '42501');
select pg_temp.raises('my_store_ids 직접 호출 거부',
  'select my_store_ids()', '42501');

-- ── 4. 원장·확정값 표는 직접 쓰기 권한이 전부 닫혀 있다 ────────────────────

select pg_temp.eq('원장 10개 × 쓰기 4종의 앱 롤 권한은 0개다', (
  with ledger(name) as (values
    ('inventory_events'), ('inventory_states'), ('business_days'),
    ('daily_sales'), ('daily_sales_items'), ('business_day_revisions'),
    ('business_state_transitions'), ('entity_change_events'),
    ('price_trends'), ('profit_trends')
  )
  select count(*) from ledger
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(privilege_name)
  where has_table_privilege('authenticated', 'public.' || ledger.name, p.privilege_name)
)::numeric, 0);

select pg_temp.raises('재고 원장 직접 insert 거부',
  'insert into inventory_events default values', '42501');
select pg_temp.raises('확정 재고 직접 update 거부',
  'update inventory_states set stock_total = stock_total where false', '42501');
select pg_temp.raises('판매 장부 직접 delete 거부',
  'delete from daily_sales where false', '42501');
select pg_temp.raises('영업일 직접 truncate 거부',
  'truncate business_days', '42501');
