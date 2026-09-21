-- ═══════════════════════════════════════════════════════════════
-- 34 · 앱 롤은 공식 RPC만 실행하고 원장·내부 몸통을 직접 건드리지 못한다
--
-- 기존 01~33은 내부 공식까지 재는 백색상자 시험이라 costkeep_rpc_executor로 돈다.
-- 이 파일은 실제 Data API 역할(authenticated)로 전환해 외부 공격면을 따로 잰다.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 전용 실행 역할은 로그인·RLS 우회·앱의 SET ROLE 경로가 없다 ──────────────

select pg_temp.ok('RPC 실행 역할은 로그인할 수 없다', not (
  select rolcanlogin from pg_roles where rolname = 'costkeep_rpc_executor'));
select pg_temp.ok('RPC 실행 역할은 authenticated 권한을 상속한다',
  pg_has_role('costkeep_rpc_executor', 'authenticated', 'member'));
select pg_temp.ok('authenticated는 RPC 실행 역할로 전환할 수 없다', not
  pg_has_role('authenticated', 'costkeep_rpc_executor', 'member'));

select pg_temp.eq('authenticated에 열린 public 함수는 공식 facade 136개뿐이다', (
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and has_function_privilege('authenticated', p.oid, 'execute'))::numeric, 136);
select pg_temp.ok('푸시 기기는 로그인 facade로만 등록·상태 확인·해제하고 token 표는 직접 읽지 못한다',
  has_function_privilege('authenticated','public.register_push_device(uuid,uuid,text,text,text)','execute')
  and has_function_privilege('authenticated','public.push_device_registration_status(uuid,uuid)','execute')
  and has_function_privilege('authenticated','public.deactivate_push_device(uuid,uuid)','execute')
  and not has_function_privilege('anon','public.register_push_device(uuid,uuid,text,text,text)','execute')
  and not has_function_privilege('anon','public.push_device_registration_status(uuid,uuid)','execute')
  and not has_function_privilege('anon','public.deactivate_push_device(uuid,uuid)','execute')
  and not has_table_privilege('authenticated','public.push_device_registrations','select,insert,update,delete'));
select pg_temp.ok('판매 채널 설정은 조회·추가·삭제·복구 facade만 열린다',
  has_function_privilege('authenticated','public.sales_channel_settings(uuid)','execute')
  and has_function_privilege('authenticated','public.create_sales_channel(uuid,text,integer)','execute')
  and has_function_privilege('authenticated','public.delete_sales_channel(uuid,uuid,integer)','execute')
  and has_function_privilege('authenticated','public.restore_sales_channel(uuid,uuid,integer)','execute')
  and not has_function_privilege('authenticated','public.sales_channel_assert_mutation_allowed(uuid)','execute')
  and not has_function_privilege('authenticated','public.sales_channel_has_reference(uuid,uuid)','execute'));
select pg_temp.ok('매출 작성 수명주기 17개 공개면만 앱 역할에 열린다',
  has_function_privilege('authenticated','public.sales_lifecycle_clock(uuid)','execute')
  and has_function_privilege('authenticated','public.sales_feed(uuid,date,date,date,integer)','execute')
  and has_function_privilege('authenticated','public.sales_day_read(uuid,date)','execute')
  and has_function_privilege('authenticated','public.sales_authoritative_range_detail(uuid,date,date)','execute')
  and has_function_privilege('authenticated','public.sales_authoritative_channel_profit(uuid,date,date)','execute')
  and has_function_privilege('authenticated','public.open_sales_draft(uuid,date,uuid)','execute')
  and has_function_privilege('authenticated','public.sales_draft_detail(uuid,uuid)','execute')
  and has_function_privilege('authenticated','public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb)','execute')
  and has_function_privilege('authenticated','public.discard_sales_draft(uuid,uuid,integer)','execute')
  and has_function_privilege('authenticated','public.close_sales_draft_as_holiday(uuid,uuid,integer,integer,text)','execute')
  and has_function_privilege('authenticated','public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text)','execute')
  and has_function_privilege('authenticated','public.get_sales_command_receipt(uuid,text,uuid,text)','execute')
  and has_function_privilege('authenticated','public.begin_inventory_count(uuid,uuid)','execute')
  and has_function_privilege('authenticated','public.commit_inventory_count_batch(uuid,uuid,jsonb,uuid)','execute')
  and has_function_privilege('authenticated','public.cancel_inventory_count(uuid,uuid)','execute')
  and has_function_privilege('authenticated','public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text)','execute')
  and has_function_privilege('authenticated','public.set_sales_calendar_day(uuid,date,text,integer,text)','execute')
  and not has_function_privilege('authenticated','public.publish_sales_basis_version(uuid,date)','execute')
  and not has_function_privilege('authenticated','public.next_unopened_business_date(uuid)','execute')
  and not has_function_privilege('authenticated','public.reconcile_sales_consumption_components(uuid,boolean)','execute'));
select pg_temp.ok('현재·지연 재고 사건은 공개 facade로만 기록·정정한다',
  has_function_privilege('authenticated','public.record_current_inbound(uuid,numeric,text)','execute')
  and has_function_privilege('authenticated','public.record_current_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text)','execute')
  and has_function_privilege('authenticated','public.record_current_discard(uuid,numeric)','execute')
  and has_function_privilege('authenticated','public.record_current_stock_adjustment(uuid,numeric,boolean,text)','execute')
  and has_function_privilege('authenticated','public.record_current_stock_quantity(uuid,text,numeric,numeric,text,text)','execute')
  and has_function_privilege('authenticated','public.record_delayed_inbound(uuid,numeric,text,timestamptz)','execute')
  and has_function_privilege('authenticated','public.record_delayed_discard(uuid,numeric,timestamptz,text,uuid)','execute')
  and has_function_privilege('authenticated','public.record_delayed_stock_adjustment(uuid,numeric,boolean,text,timestamptz,uuid)','execute')
  and has_function_privilege('authenticated','public.inventory_event_occurrence_context(uuid)','execute')
  and has_function_privilege('authenticated','public.inventory_event_local_timestamp(uuid,date,time)','execute')
  and has_function_privilege('authenticated','public.record_delayed_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text,timestamptz)','execute')
  and has_function_privilege('authenticated','public.sales_inventory_count_requirement(uuid)','execute')
  and has_function_privilege('authenticated','public.correct_absorbed_inventory_event(uuid,uuid,integer,numeric,numeric,text,uuid)','execute')
  and not has_function_privilege('authenticated','public.apply_delayed_inventory_event_resolution()','execute'));
select pg_temp.ok('매출 초안·판본·명령·실사 내부 표는 앱 역할이 직접 쓰지 못한다',
  not has_table_privilege('authenticated','public.sales_day_drafts','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.sales_day_versions','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.sales_day_heads','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.sales_command_receipts','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.inventory_count_sessions','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.inventory_count_batches','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.sales_inventory_delta_components','insert,update,delete,truncate,references,trigger'));
select pg_temp.ok('고정 지출 기준은 로그인 facade만 열리고 내부 계산은 닫혀 있다',
  has_function_privilege('authenticated','public.get_fixed_cost_basis(uuid,text)','execute')
  and has_function_privilege('authenticated','public.save_fixed_cost_basis(uuid,smallint,integer)','execute')
  and not has_function_privilege('anon','public.get_fixed_cost_basis(uuid,text)','execute')
  and not has_function_privilege('anon','public.save_fixed_cost_basis(uuid,smallint,integer)','execute')
  and not has_function_privilege('authenticated','public.fixed_cost_basis_result(uuid,text)','execute'));
select pg_temp.ok('고정 지출 항목 설정·월별 금액 입력은 로그인 facade만 열린다',
  has_function_privilege('authenticated','public.get_fixed_cost_configuration(uuid,text)','execute')
  and has_function_privilege('authenticated','public.cancel_fixed_cost_reentry(uuid,uuid,integer)','execute')
  and has_function_privilege('authenticated','public.fixed_cost_change_history(uuid,text,text,text)','execute')
  and has_function_privilege('authenticated','public.revert_fixed_cost_change(uuid,bigint,bigint)','execute')
  and not has_function_privilege('authenticated','public.revert_fixed_cost_reentry(uuid,uuid)','execute')
  and has_function_privilege('authenticated','public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer)','execute')
  and has_function_privilege('authenticated','public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)','execute')
  and not has_function_privilege('anon','public.get_fixed_cost_configuration(uuid,text)','execute')
  and not has_function_privilege('anon','public.cancel_fixed_cost_reentry(uuid,uuid,integer)','execute')
  and not has_function_privilege('anon','public.fixed_cost_change_history(uuid,text,text,text)','execute')
  and not has_function_privilege('anon','public.revert_fixed_cost_change(uuid,bigint,bigint)','execute')
  and not has_function_privilege('anon','public.revert_fixed_cost_reentry(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','public.save_fixed_costs(uuid,text,numeric,jsonb)','execute')
  and not has_function_privilege('anon','public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer)','execute')
  and not has_function_privilege('anon','public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)','execute')
  and not has_function_privilege('authenticated','public.fixed_cost_configuration_result(uuid,text)','execute')
  and not has_function_privilege('authenticated','public.normalize_fixed_cost_configuration(jsonb)','execute'));
select pg_temp.ok('앱 역할은 고정 지출 항목 판본을 직접 쓰지 못한다',
  not has_table_privilege('authenticated','public.fixed_cost_item_configurations','insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.fixed_cost_reentry_sessions','select,insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated','public.fixed_cost_reentry_months','select,insert,update,delete,truncate,references,trigger'));
select pg_temp.ok('발주 입고 결과 확인은 로그인 facade만 허용한다',
  has_function_privilege('authenticated','public.resolve_order_inbound(uuid,uuid,text)','execute')
  and not has_function_privilege('anon','public.resolve_order_inbound(uuid,uuid,text)','execute')
  and not has_function_privilege('service_role','public.resolve_order_inbound(uuid,uuid,text)','execute')
  and (select r.rolname='costkeep_rpc_executor' and p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
    from pg_proc p join pg_roles r on r.oid=p.proowner
    where p.oid='public.resolve_order_inbound(uuid,uuid,text)'::regprocedure));
select pg_temp.ok('발주 입고 확인 키는 앱 역할이 직접 읽거나 변경할 수 없다',
  not has_table_privilege('authenticated','public.order_inbound_closed_requests','select,insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('anon','public.order_inbound_closed_requests','select,insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('service_role','public.order_inbound_closed_requests','select,insert,update,delete,truncate,references,trigger'));
select pg_temp.ok('재료 삭제 연결 조회는 로그인 facade만 허용한다',
  has_function_privilege('authenticated','public.ingredient_delete_check(uuid)','execute')
  and not has_function_privilege('anon','public.ingredient_delete_check(uuid)','execute')
  and not has_function_privilege('service_role','public.ingredient_delete_check(uuid)','execute'));
select pg_temp.ok('메뉴 삭제는 로그인 facade만 열리고 원장 직접 삭제·옛 API는 닫혀 있다',
  has_function_privilege('authenticated','public.delete_recipe(uuid,uuid,text)','execute')
  and not has_function_privilege('anon','public.delete_recipe(uuid,uuid,text)','execute')
  and not has_function_privilege('service_role','public.delete_recipe(uuid,uuid,text)','execute')
  and not has_function_privilege('authenticated','public.deactivate_recipe(uuid)','execute')
  and not has_table_privilege('authenticated','public.recipes','delete')
  and not has_schema_privilege('costkeep_rpc_executor','public','create'));
select pg_temp.ok('초안·추천 공개면만 열리고 내부 몸통은 앱 역할에 닫혀 있다',
  has_function_privilege('authenticated','public.recipe_draft_preview(uuid,jsonb)','execute')
  and has_function_privilege('authenticated','public.recipe_price_recommendation(uuid,uuid)','execute')
  and has_function_privilege('costkeep_rpc_executor','public.recipe_draft_preview_internal(uuid,jsonb)','execute')
  and not has_function_privilege('authenticated','public.recipe_draft_preview_internal(uuid,jsonb)','execute')
  and not has_function_privilege('anon','public.recipe_draft_preview_internal(uuid,jsonb)','execute')
  and not has_function_privilege('service_role','public.recipe_draft_preview_internal(uuid,jsonb)','execute'));
select pg_temp.ok('새 재고 취소 공개면은 읽기·실행 facade다',
  has_function_privilege('authenticated','public.stock_revert_candidates(uuid)','execute')
  and has_function_privilege('authenticated','public.revert_latest_stock_event(uuid)','execute'));
select pg_temp.ok('취소 영수증 직접 쓰기는 앱에 닫혀 있다',
  not has_table_privilege('authenticated','public.stock_event_reversal_receipts','insert')
  and not has_table_privilege('authenticated','public.stock_event_reversal_receipts','update')
  and not has_table_privilege('authenticated','public.stock_event_reversal_receipts','delete'));

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
  has_function_privilege('costkeep_rpc_executor',
    'public.purge_archived_store(uuid,text)', 'execute'));

select pg_temp.eq('허용한 회계·설정 이력 도우미 밖 postgres definer 노출은 0이다', (
  select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles owner_role on owner_role.oid = p.proowner
   where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prosecdef
     and owner_role.rolname = 'postgres'
     and has_function_privilege('costkeep_rpc_executor', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute')
     and p.oid not in (
       'public.current_tax_settings_date(uuid)'::regprocedure,
       'public.tax_menu_change_basis(uuid,date,uuid)'::regprocedure,
       'public.pending_recipe_tax_quote(uuid)'::regprocedure,
       'public.pending_recipe_tax_quote_for_price(uuid,numeric)'::regprocedure,
       'public.record_configuration_change(uuid,text,text,jsonb,jsonb,date)'::regprocedure,
       'public.current_recipe_tax_quote(uuid,date)'::regprocedure,
       'public.daily_sales_etc_accounting_totals(uuid)'::regprocedure,
       'public.sales_etc_tax_quote(uuid,date,jsonb)'::regprocedure,
       'public.recipe_tax_quote_for_price(uuid,date,numeric)'::regprocedure,
       'public.recipe_draft_preview_internal(uuid,jsonb)'::regprocedure,
       'public.sales_item_accounting_totals(uuid)'::regprocedure,
       'public.refresh_dynamic_sales_item_tax()'::regprocedure)
)::numeric, 0);
select pg_temp.ok('국제 세금 회계 도우미는 비로그인 실행 역할에만 열리고 앱에는 닫혀 있다',
  has_function_privilege('costkeep_rpc_executor',
    'public.current_recipe_tax_quote(uuid,date)','execute')
  and not has_function_privilege('authenticated',
    'public.current_recipe_tax_quote(uuid,date)','execute')
  and has_function_privilege('costkeep_rpc_executor',
    'public.daily_sales_etc_accounting_totals(uuid)','execute')
  and not has_function_privilege('authenticated',
    'public.daily_sales_etc_accounting_totals(uuid)','execute')
  and has_function_privilege('costkeep_rpc_executor',
    'public.sales_etc_tax_quote(uuid,date,jsonb)','execute')
  and not has_function_privilege('authenticated',
    'public.sales_etc_tax_quote(uuid,date,jsonb)','execute')
  and has_function_privilege('costkeep_rpc_executor',
    'public.recipe_tax_quote_for_price(uuid,date,numeric)','execute')
  and not has_function_privilege('authenticated',
    'public.recipe_tax_quote_for_price(uuid,date,numeric)','execute')
  and has_function_privilege('costkeep_rpc_executor',
    'public.sales_item_accounting_totals(uuid)','execute')
  and not has_function_privilege('authenticated',
    'public.sales_item_accounting_totals(uuid)','execute'));

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
  perform set_config('costkeep.test.foreign_store', v_store::text, true);
  v_ingredient := save_ingredient(v_store, jsonb_build_object(
    'name', 'P0-5 다른 매장 식재료', 'base_unit', 'g', 'per_volume', 1,
    'safety_stock', 0, 'min_order_qty', 1));
  perform set_config('costkeep.test.foreign_ingredient', v_ingredient::text, true);
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
    where id = current_setting('costkeep.test.foreign_store')::uuid), 0);

select pg_temp.ok('facade도 다른 사장님 매장 설정을 돌려주지 않는다',
  get_settings(current_setting('costkeep.test.foreign_store')::uuid) is null);
select pg_temp.raises('facade도 다른 사장님 매장에 쓰지 못한다',
  format('select save_category(%L, %L::jsonb)', current_setting('costkeep.test.foreign_store'),
         '{"name":"P0-5 교차 매장 침입","sort_order":1}'), '42501');
select pg_temp.ok('RLS에 기대는 상세 facade는 다른 매장 식재료를 돌려주지 않는다',
  ingredient_detail(current_setting('costkeep.test.foreign_ingredient')::uuid) is null);
select pg_temp.ok('RPC 실행 역할은 RLS를 우회하지 않는다', not (
  select rolbypassrls from pg_roles where rolname = 'costkeep_rpc_executor'));

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

select pg_temp.eq('원장·확정값 14개 × 쓰기 4종의 앱 롤 권한은 0개다', (
  with ledger(name) as (values
    ('inventory_events'), ('inventory_states'), ('business_days'),
    ('daily_sales'), ('daily_sales_items'), ('business_day_revisions'),
    ('business_state_transitions'), ('entity_change_events'),
    ('price_trends'), ('profit_trends'),
    ('daily_sales_item_tax_snapshots'),
    ('daily_sales_item_tax_component_snapshots'), ('sales_tax_events'),
    ('international_tax_migration_audits')
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
