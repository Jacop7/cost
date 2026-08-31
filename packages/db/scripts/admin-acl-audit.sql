begin;

-- regprocedure::text 비교가 접속 롤의 search_path에 흔들리지 않도록 트랜잭션 동안 고정한다.
set local search_path = pg_catalog, public;

-- P1-1 · 호스티드 Supabase 앱 롤 공격면 감사. 영구 변경은 하지 않고 프로브도 rollback한다.
-- 이 파일은 admin-acl.sh --remote audit와 verify ④의 admin-acl-audit.test.mjs가 함께 사용한다.
select pg_advisory_xact_lock(hashtextextended('margincook:admin-acl-audit', 0));
create table public._acl_probe_postgres (id int);
create temporary table _acl_approved_rpc (signature text primary key) on commit drop;
create temporary table _acl_non_mobile_rpc (signature text primary key, consumer text not null) on commit drop;
insert into _acl_approved_rpc(signature) values
  -- P2-6 회귀 표식: ('comment_only_rpc(uuid)')는 주석이며 허용 목록으로 읽으면 안 된다.
  ('amend_ended_business_day(uuid,date,integer,jsonb,jsonb,jsonb,text)'),
  ('app_capabilities()'),
  ('archive_my_store(uuid,text)'),
  ('business_day_state(uuid)'), ('create_store(text,text)'), ('day_menu_basis(uuid,date)'),
  ('day_menu_detail(uuid,date,uuid)'), ('deactivate_ingredient(uuid)'),
  ('deactivate_material(uuid)'), ('deactivate_recipe(uuid)'), ('delete_category(uuid)'),
  ('delete_purchase_option(uuid)'), ('delete_vendor(uuid)'), ('e11_inbound_reverted(uuid,text)'),
  ('e12_order_canceled(uuid,text)'), ('e1_confirm_inbound(uuid,numeric,text,date)'),
  ('e2_discard(uuid,numeric,date)'), ('e2_discard_reverted(uuid,text)'),
  ('e5_stock_adjusted(uuid,numeric,boolean,text,date)'),
  ('e7_place_order(uuid,uuid,uuid,uuid,numeric,numeric,numeric,date,order_source,date)'),
  ('entity_change_history(uuid,text,uuid,text,integer,integer)'),
  ('fixed_cost_revenue_check(uuid,text)'), ('get_settings(uuid)'), ('ingredient_detail(uuid)'),
  ('ingredient_list(uuid)'), ('operating_hours_status(uuid)'), ('order_board(uuid)'),
  ('purchase_history(uuid,date,date)'),
  ('quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)'),
  ('quick_inbound_preview(uuid,uuid,numeric,numeric,numeric)'),
  ('range_menu_detail(uuid,date,date,uuid)'), ('recipe_detail(uuid)'), ('recipe_list(uuid)'),
  ('recipe_pick_list(uuid,uuid)'), ('recipe_profit_history(uuid,timestamp with time zone,uuid,integer)'),
  ('recipe_shortages(uuid)'), ('reorder_categories(uuid,uuid[])'), ('retire_channel(uuid)'),
  ('retire_my_account()'),
  ('report_client_rpc_error(text,text,text)'),
  ('sale_shortages(uuid,date,jsonb)'), ('sales_channel_fixed(uuid,date,date)'),
  ('sales_day(uuid,date)'), ('sales_etc_by_channel(uuid,date,date)'),
  ('sales_extra_usage(uuid,date,date)'), ('sales_fixed_breakdown(uuid,date,date)'),
  ('sales_material_usage(uuid,date,date)'), ('sales_range(uuid,date,date)'),
  ('sales_tax_breakdown(uuid,date,date)'), ('sales_waste_breakdown(uuid,date,date)'),
  ('save_category(uuid,jsonb)'), ('save_channel(uuid,jsonb)'),
  ('save_fixed_costs(uuid,text,numeric,jsonb)'), ('save_ingredient(uuid,jsonb)'),
  ('save_material(uuid,jsonb)'), ('save_purchase_option(uuid,jsonb)'), ('save_recipe(uuid,jsonb)'),
  ('save_sale(uuid,date,jsonb,jsonb,jsonb,integer,boolean,time without time zone)'),
  ('save_settings(uuid,jsonb,integer)'), ('save_store_tax(uuid,tax_mode,jsonb,integer)'),
  ('save_vendor(uuid,jsonb)'), ('set_operating_hours(uuid,jsonb,jsonb,uuid,integer)'),
  ('set_store_timezone(uuid,text)'), ('settings_lists(uuid)'), ('stock_history(uuid,date,date)'),
  ('transition_business_state(uuid,text,time without time zone)');

-- create_store와 archive_my_store는 각각 신규 계정 온보딩과 폐점 보존 정책의 공식 문이고,
-- app_capabilities는 INTL-1A가 먼저 고정한 서버 계약이라 아직 모바일 호출부가 없다. 모바일
-- 호출 집합과의 자동 대조에서는 이 명시적 비-mobile 예외만 제외한다.
insert into _acl_non_mobile_rpc(signature, consumer) values
  ('create_store(text,text)', 'onboarding'),
  ('archive_my_store(uuid,text)', 'store-retention-policy'),
  ('app_capabilities()', 'international-contract-bootstrap');

-- psql 기반 fresh harness에는 CLI 장부 스키마가 없을 수 있다. 그 경우 SQL 자체가 중단돼
-- 나머지 공격면 metric이 사라지지 않도록 0을 내고, 셸 게이트가 migrations=0으로 실패시킨다.
create temporary table _acl_migration_count (n bigint not null) on commit drop;
do $audit$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    insert into _acl_migration_count values (0);
  else
    execute $sql$insert into _acl_migration_count
                 select count(*) from supabase_migrations.schema_migrations
                  where version in ('20260826000166', '20260826000167')$sql$;
  end if;
end
$audit$;
select 'migrations' || '|' || n || '|expected=2' from _acl_migration_count;

select 'probe_owner' || '|' || coalesce((select r.rolname from pg_class c join pg_roles r on r.oid = c.relowner
                                          where c.oid = 'public._acl_probe_postgres'::regclass), '(없음)') || '|expected=postgres';

select 'probe_dangerous' || '|' || count(*) || '|expected=0'
  from (values ('anon'), ('authenticated')) roles(role_name)
 cross join (values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) privileges(privilege_name)
 where has_table_privilege(role_name, 'public._acl_probe_postgres', privilege_name);

select 'public_dangerous' || '|' || count(*) || '|expected=0'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 cross join (values ('anon'), ('authenticated')) roles(role_name)
 cross join (values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) privileges(privilege_name)
 where n.nspname = 'public' and c.relkind in ('r', 'p')
   and has_table_privilege(role_name, c.oid, privilege_name);

-- RLS가 꺼진 public 표에 앱 롤 권한이 있으면 Data API로 전 행을 읽거나 쓸 수 있다.
select 'rls_disabled_app_tables' || '|' || count(*) || '|expected=0'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
   and c.oid <> 'public._acl_probe_postgres'::regclass
   and exists (
     select 1
       from (values ('anon'), ('authenticated')) roles(role_name)
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege_name)
      where has_table_privilege(role_name, c.oid, privilege_name)
   );

-- 0165·0167이 직접 쓰기를 닫은 권위/감사 표. SELECT와 RLS는 별도 계약이다.
with protected(name) as (values
  ('settings'), ('operating_rules'), ('store_time_settings'),
  ('business_day_revisions'), ('business_state_transitions'), ('stores')
)
select 'protected_objects' || '|' || count(*) || '|expected=6'
  from protected where to_regclass('public.' || name) is not null;

with protected(name) as (values
  ('settings'), ('operating_rules'), ('store_time_settings'),
  ('business_day_revisions'), ('business_state_transitions'), ('stores')
)
select 'protected_writes' || '|' || count(*) || '|expected=0'
  from protected
 cross join (values ('anon'), ('authenticated')) roles(role_name)
 cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privileges(privilege_name)
 where to_regclass('public.' || name) is not null
   and has_table_privilege(role_name, 'public.' || name, privilege_name);

-- 원장·확정값 표는 승인된 RPC만 바꾼다. 앱 롤 쓰기 GRANT와 허용 정책이 함께 있거나
-- RLS 자체가 꺼져 있으면 직접 쓰기 경로로 센다. 목록은 packages/db/README.md 권위 데이터와 같다.
with ledger(name) as (values
  ('inventory_events'), ('inventory_states'), ('business_days'), ('daily_sales'), ('daily_sales_items'),
  ('business_day_revisions'), ('business_state_transitions'), ('entity_change_events'),
  ('price_trends'), ('profit_trends')
)
select 'ledger_write_paths' || '|' || count(*) || '|expected=0'
  from ledger l join pg_class c on c.oid = to_regclass('public.' || l.name)
 cross join (values ('anon'), ('authenticated')) roles(role_name)
 cross join (values ('INSERT', 'a'), ('UPDATE', 'w'), ('DELETE', 'd')) privileges(privilege_name, cmd)
 where has_table_privilege(role_name, c.oid, privilege_name)
   and (
     not c.relrowsecurity
     or exists (
       select 1
         from pg_policy pol
        where pol.polrelid = c.oid and pol.polcmd::text in ('*', privileges.cmd)
          and (
            0::oid = any(pol.polroles)
            or (select oid from pg_roles where rolname = roles.role_name) = any(pol.polroles)
          )
     )
   );

-- 미래 integration/ops/Queue 원본은 앱 롤이 스키마나 표·함수를 직접 사용할 수 없다.
with source_schemas(name) as (values ('integration'), ('ops'), ('pgmq'), ('pgmq_public')),
schema_grants as (
  select count(*) n from source_schemas s
  cross join (values ('anon'), ('authenticated')) roles(role_name)
  where to_regnamespace(s.name) is not null and has_schema_privilege(role_name, s.name, 'USAGE')
), table_grants as (
  select count(*) n from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) roles(role_name)
  where n.nspname in ('integration', 'ops', 'pgmq', 'pgmq_public') and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege(role_name, c.oid, 'SELECT')
      or has_table_privilege(role_name, c.oid, 'INSERT')
      or has_table_privilege(role_name, c.oid, 'UPDATE')
      or has_table_privilege(role_name, c.oid, 'DELETE'))
), function_grants as (
  select count(*) n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join (values ('anon'), ('authenticated')) roles(role_name)
  where n.nspname in ('integration', 'ops', 'pgmq', 'pgmq_public')
    and has_function_privilege(role_name, p.oid, 'EXECUTE')
)
select 'source_schema_grants' || '|' || (s.n + t.n + f.n) || '|expected=0'
  from schema_grants s cross join table_grants t cross join function_grants f;

-- 애플리케이션 객체를 플랫폼 내부 롤이 소유하면 앱 팀이 권한을 끝까지 통제할 수 없다.
select 'supabase_admin_objects' || '|' || count(*) || '|expected=0'
  from (
    select c.oid, 'pg_class'::regclass as classid
      from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_roles r on r.oid = c.relowner
     where n.nspname = 'public' and r.rolname = 'supabase_admin'
    union all
    select p.oid, 'pg_proc'::regclass
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
     where n.nspname = 'public' and r.rolname = 'supabase_admin'
  ) o
 where not exists (select 1 from pg_depend d where d.classid = o.classid and d.objid = o.oid and d.deptype = 'e');

-- 현재 승인 계약: anon RPC 0개, 문지기 없는 내부 몸통 11개는 authenticated도 실행 불가.
select 'anon_rpc' || '|' || count(*) || '|expected=0'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind in ('f', 'p')
   and has_function_privilege('anon', p.oid, 'EXECUTE');

select 'blocked_internal_rpc' || '|' || count(*) || '|expected=0'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and p.proname in ('close_due_business_days', 'close_business_day_row', 'apply_sale_items',
                     'e10_sale_recorded', 'add_to_day_basis', 'apply_due_breaks',
                     'apply_operating_hours', 'set_break_row', 'record_state_transition',
                     'open_business_day', 'close_business_day')
   and has_function_privilege('authenticated', p.oid, 'EXECUTE');

select 'blocked_internal_rpc_objects' || '|' || count(*) || '|expected=11'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and p.proname in ('close_due_business_days', 'close_business_day_row', 'apply_sale_items',
                     'e10_sale_recorded', 'add_to_day_basis', 'apply_due_breaks',
                     'apply_operating_hours', 'set_break_row', 'record_state_transition',
                     'open_business_day', 'close_business_day');

-- 0174 실행 역할은 로그인·RLS 우회가 불가능하고 authenticated의 권한만 상속한다.
-- 반대 방향 멤버십이 생기면 앱이 SET ROLE로 내부 권한을 직접 얻을 수 있으므로 실패다.
select 'rpc_executor_role' || '|' || count(*) || '|expected=1'
  from pg_roles r
 where r.rolname = 'margincook_rpc_executor'
   and not r.rolcanlogin and not r.rolbypassrls
   and pg_has_role(r.oid, 'authenticated'::regrole, 'member')
   and not pg_has_role('authenticated'::regrole, r.oid, 'member');

select 'rpc_executor_facades_invalid' || '|' || count(*) || '|expected=0'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
 where n.nspname = 'public' and r.rolname = 'margincook_rpc_executor'
   and (not p.prosecdef or not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=public, pg_temp']);

-- executor-owned facade는 RLS를 지키는 내부 도우미만 부른다. 앱에 열리지 않은
-- postgres SECURITY DEFINER는 전 매장 스위프·파괴 경계이므로 executor에도 닫힌다.
select 'rpc_executor_privileged_maintenance' || '|' || count(*) || '|expected=0'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles owner_role on owner_role.oid = p.proowner
 where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prosecdef
   and owner_role.rolname = 'postgres'
   and has_function_privilege('margincook_rpc_executor', p.oid, 'EXECUTE')
   and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

select 'rls_policy_helper_calls' || '|' || count(*) || '|expected=0'
  from pg_policy pol
 where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%my_store_ids()%'
    or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%my_store_ids()%';

-- PostgREST로 앱이 직접 부르는 공식 문만 정확한 시그니처로 고정한다. 이름만 비교하면 같은 이름의
-- 새 오버로드가 자동으로 허용되므로 regprocedure 전체를 비교한다. 이 목록에 없는 authenticated
-- 함수는 내부 도우미라도 Data API에서 직접 호출할 수 있으므로 감사 실패다.
select 'facade_rpc_objects' || '|' || count(*) || '|expected=66' from _acl_approved_rpc;

with actual as (
  select p.oid::regprocedure::text signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
)
select 'facade_rpc_missing' || '|' || count(*) || '|expected=0'
  from _acl_approved_rpc a left join actual x using (signature) where x.signature is null;

select 'unapproved_authenticated_rpc' || '|' || count(*) || '|expected=0'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind in ('f', 'p')
   and has_function_privilege('authenticated', p.oid, 'EXECUTE')
   and not exists (select 1 from _acl_approved_rpc a where a.signature = p.oid::regprocedure::text);

-- 바꿀 수 없는 플랫폼 기본 권한은 앱 감사와 분리해 보고한다. 이 값은 성공으로 위장하지 않는다.
select 'platform_default_open' || '|' || count(*) || '|informational'
  from pg_default_acl a join pg_roles r on r.oid = a.defaclrole
 where r.rolname = 'supabase_admin' and a.defaclobjtype = 'r'
   and a.defaclnamespace = 'public'::regnamespace
   and exists (select 1 from unnest(a.defaclacl) x
                where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]');

rollback;
