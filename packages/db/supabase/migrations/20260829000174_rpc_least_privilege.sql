-- ============================================================================
-- 0174 · authenticated 는 공식 RPC만 실행하고 원장 표를 직접 쓰지 못한다
--
-- 앱 롤에 내부 도우미 EXECUTE를 남기면 PostgREST에서 몸통을 직접 호출할 수 있다. 반대로
-- 도우미 권한만 걷으면 invoker facade도 함께 깨진다. 그래서 공개 facade는 RLS를 적용받는
-- 비로그인 역할(sikjae_rpc_executor)로 실행하고, 내부 함수·원장 쓰기 권한은 그 역할에만 준다.
-- auth.uid()는 요청 GUC를 읽으므로 SECURITY DEFINER 안에서도 원래 사용자를 그대로 식별한다.
-- ============================================================================

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'sikjae_rpc_executor') then
    create role sikjae_rpc_executor nologin inherit nobypassrls;
  end if;
end
$role$;

alter role sikjae_rpc_executor nologin inherit nobypassrls;
grant authenticated to sikjae_rpc_executor;
grant sikjae_rpc_executor to postgres;
grant usage on schema public to sikjae_rpc_executor;

-- 새 함수도 명시적으로 facade에 넣기 전에는 앱과 executor에 열리지 않는다.
-- executor는 0174 적용 시점의 내부 호출 그래프만 일괄 부여한 뒤 아래에서 전 매장
-- 유지보수 definer를 회수한다. 이후 함수는 검토한 migration이 필요한 역할에만 연다.
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from sikjae_rpc_executor;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

create temporary table _p05_approved_rpc (
  signature text primary key
);

insert into _p05_approved_rpc(signature) values
  ('amend_ended_business_day(uuid,date,integer,jsonb,jsonb,jsonb,text)'),
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

do $facades$
declare
  r record;
begin
  if (select count(*) from _p05_approved_rpc) <> 64 then
    raise exception '0174: 공식 RPC 허용 목록이 64개가 아닙니다';
  end if;

  if exists (
    select 1 from _p05_approved_rpc a
    where to_regprocedure('public.' || a.signature) is null
  ) then
    raise exception '0174: 존재하지 않는 공식 RPC 시그니처가 있습니다';
  end if;

  -- 기존 권한을 먼저 닫고 정확한 facade만 다시 연다.
  revoke execute on all functions in schema public from authenticated;
  grant execute on all functions in schema public to sikjae_rpc_executor, service_role;

  -- 이미 postgres SECURITY DEFINER인 명시적 문지기는 그대로 둔다. 나머지 facade는 RLS가
  -- 적용되는 전용 역할로 실행해 내부 도우미를 호출하되 다른 매장 행에는 접근하지 못한다.
  grant create on schema public to sikjae_rpc_executor;
  for r in
    select p.oid, p.oid::regprocedure::text signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join _p05_approved_rpc a on a.signature = p.oid::regprocedure::text
     where n.nspname = 'public' and p.prokind = 'f' and not p.prosecdef
  loop
    execute format('alter function %s security definer', r.oid::regprocedure);
    execute format('alter function %s set search_path = public, pg_temp', r.oid::regprocedure);
    execute format('alter function %s owner to sikjae_rpc_executor', r.oid::regprocedure);
  end loop;
  revoke create on schema public from sikjae_rpc_executor;

  for r in select signature from _p05_approved_rpc order by signature loop
    execute format('grant execute on function public.%s to authenticated, service_role', r.signature);
  end loop;
end
$facades$;

-- 0174의 일괄 grant는 기존 invoker facade가 호출하던 내부 도우미를 보존하기 위한
-- 부트스트랩이다. 앱에 열리지 않은 postgres SECURITY DEFINER는 전 매장 삭제·스위프처럼
-- facade가 가질 이유가 없는 유지보수 문이므로 즉시 executor에서 회수한다.
do $revoke_maintenance$
declare
  r record;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles owner_role on owner_role.oid = p.proowner
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and p.prosecdef
       and owner_role.rolname = 'postgres'
       and has_function_privilege('sikjae_rpc_executor', p.oid, 'execute')
       and not has_function_privilege('authenticated', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from sikjae_rpc_executor', r.oid::regprocedure);
  end loop;
end
$revoke_maintenance$;

-- my_store_ids()를 정책 안에서 호출하면 앱 롤의 EXECUTE를 회수할 수 없다. 같은 조건을 정책에
-- 직접 넣어 RLS 결과는 유지하고 함수의 Data API 문만 닫는다.
do $policies$
declare
  r record;
  v_using text;
  v_check text;
  v_roles text;
  v_sql text;
  v_scope constant text := '( SELECT _owned_store.id FROM public.stores _owned_store'
                           || ' WHERE _owned_store.owner_id = auth.uid()'
                           || ' AND _owned_store.archived_at IS NULL )';
begin
  for r in
    select pol.oid, pol.polname, pol.polrelid,
           n.nspname, c.relname,
           pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr,
           pol.polroles
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%my_store_ids()%'
         or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%my_store_ids()%')
  loop
    v_using := replace(r.using_expr,
      '( SELECT my_store_ids() AS my_store_ids)', v_scope);
    v_check := replace(r.check_expr,
      '( SELECT my_store_ids() AS my_store_ids)', v_scope);
    select string_agg(case when x.role_oid = 0 then 'public' else quote_ident(pr.rolname) end, ', ')
      into v_roles
      from unnest(r.polroles) x(role_oid)
      left join pg_roles pr on pr.oid = x.role_oid;

    v_sql := format('alter policy %I on %I.%I to %s',
                    r.polname, r.nspname, r.relname, v_roles);
    if v_using is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end
$policies$;

-- 원장·확정값은 앱 롤이 표를 직접 쓸 수 없다.
revoke insert, update, delete, truncate on
  public.inventory_events, public.inventory_states, public.business_days,
  public.daily_sales, public.daily_sales_items, public.business_day_revisions,
  public.business_state_transitions, public.entity_change_events,
  public.price_trends, public.profit_trends
from public, anon, authenticated;

grant insert on public.inventory_events to sikjae_rpc_executor;
grant insert, update, delete on public.inventory_states to sikjae_rpc_executor;
grant insert, update, delete on public.business_days to sikjae_rpc_executor;
grant insert, update, delete on public.daily_sales, public.daily_sales_items to sikjae_rpc_executor;
grant insert on public.business_day_revisions, public.business_state_transitions,
  public.entity_change_events, public.price_trends, public.profit_trends
to sikjae_rpc_executor;

-- 기존 PUBLIC 쓰기 정책은 전용 실행 역할만 사용하게 한다.
drop policy if exists business_days_rw on public.business_days;
create policy business_days_select on public.business_days
  for select to authenticated
  using (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null));
create policy business_days_rpc_write on public.business_days
  for all to sikjae_rpc_executor
  using (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null))
  with check (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null));

alter policy daily_sales_insert on public.daily_sales to sikjae_rpc_executor;
alter policy daily_sales_update on public.daily_sales to sikjae_rpc_executor;
alter policy daily_sales_delete on public.daily_sales to sikjae_rpc_executor;
alter policy daily_sales_items_insert on public.daily_sales_items to sikjae_rpc_executor;
alter policy daily_sales_items_update on public.daily_sales_items to sikjae_rpc_executor;
alter policy daily_sales_items_delete on public.daily_sales_items to sikjae_rpc_executor;
alter policy inventory_events_insert on public.inventory_events to sikjae_rpc_executor;
alter policy inventory_states_insert on public.inventory_states to sikjae_rpc_executor;
alter policy inventory_states_update on public.inventory_states to sikjae_rpc_executor;
alter policy inventory_states_delete on public.inventory_states to sikjae_rpc_executor;
alter policy entity_change_events_insert on public.entity_change_events to sikjae_rpc_executor;
alter policy price_trends_insert on public.price_trends to sikjae_rpc_executor;
alter policy profit_trends_insert on public.profit_trends to sikjae_rpc_executor;

create policy business_day_revisions_rpc_insert on public.business_day_revisions
  for insert to sikjae_rpc_executor
  with check (business_day_id in (
    select id from public.business_days
     where store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null)
  ));
create policy business_state_transitions_rpc_insert on public.business_state_transitions
  for insert to sikjae_rpc_executor
  with check (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null));

-- ── 사후조건 ──────────────────────────────────────────────────────────────────
do $verify$
declare
  v_bad integer;
  v_login boolean;
  v_bypass boolean;
begin
  select rolcanlogin, rolbypassrls into v_login, v_bypass
    from pg_roles where rolname = 'sikjae_rpc_executor';
  if v_login or v_bypass then
    raise exception '0174: RPC 실행 역할이 로그인 또는 RLS 우회 권한을 가집니다';
  end if;
  if not pg_has_role('sikjae_rpc_executor', 'authenticated', 'member')
     or pg_has_role('authenticated', 'sikjae_rpc_executor', 'member') then
    raise exception '0174: RPC 실행 역할의 멤버십 방향이 안전하지 않습니다';
  end if;

  select count(*) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
   where n.nspname = 'public' and r.rolname = 'sikjae_rpc_executor'
     and (not p.prosecdef
       or not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=public, pg_temp']);
  if v_bad <> 0 then
    raise exception '0174: RPC 실행 역할 소유 facade 중 안전하지 않은 함수가 %개입니다', v_bad;
  end if;

  select count(*) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
     and has_function_privilege('authenticated', p.oid, 'execute')
     and not exists (select 1 from _p05_approved_rpc a where a.signature = p.oid::regprocedure::text);
  if v_bad <> 0 then
    raise exception '0174: 허용 목록 밖 authenticated 함수가 %개 남았습니다', v_bad;
  end if;

  select count(*) into v_bad from _p05_approved_rpc a
   where not has_function_privilege('authenticated', ('public.' || a.signature)::regprocedure, 'execute');
  if v_bad <> 0 then
    raise exception '0174: authenticated가 못 부르는 공식 RPC가 %개입니다', v_bad;
  end if;

  if exists (
    select 1 from pg_policy pol
     where coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%my_store_ids()%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%my_store_ids()%'
  ) then
    raise exception '0174: RLS 정책에 my_store_ids() 호출이 남았습니다';
  end if;

  if has_function_privilege('authenticated', 'public.consume_stock(uuid,numeric,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.restore_stock(uuid,numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.recompute_recipe(uuid,trend_cause,date,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.my_store_ids()', 'execute') then
    raise exception '0174: 내부 도우미를 authenticated가 직접 실행할 수 있습니다';
  end if;

  select count(*) into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles owner_role on owner_role.oid = p.proowner
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and p.prosecdef
     and owner_role.rolname = 'postgres'
     and has_function_privilege('sikjae_rpc_executor', p.oid, 'execute')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_bad <> 0 then
    raise exception '0174: RPC 실행 역할에 유지보수 definer가 %개 남았습니다', v_bad;
  end if;

  if has_function_privilege('sikjae_rpc_executor',
       'public.purge_archived_store(uuid,text)', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.schedule_store_purge(uuid,timestamp with time zone,text,text,text)', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.purge_entity_changes()', 'execute')
     or has_function_privilege('sikjae_rpc_executor',
       'public.close_due_business_days()', 'execute') then
    raise exception '0174: 매장 파괴·전역 스위프 함수가 RPC 실행 역할에 열려 있습니다';
  end if;
end
$verify$;

-- 미래 함수의 기본값도 실제 객체로 확인한다.
create function public.zz_rpc_grant_probe_0174() returns integer language sql as 'select 1';
do $probe$
begin
  if has_function_privilege('authenticated', 'public.zz_rpc_grant_probe_0174()', 'execute') then
    raise exception '0174: 새 함수가 authenticated에 자동 공개됩니다';
  end if;
  if has_function_privilege('sikjae_rpc_executor', 'public.zz_rpc_grant_probe_0174()', 'execute') then
    raise exception '0174: 새 함수가 RPC 실행 역할에 자동 공개됩니다';
  end if;
  if not has_function_privilege('service_role', 'public.zz_rpc_grant_probe_0174()', 'execute') then
    raise exception '0174: 새 함수의 service_role 기본 권한이 빠졌습니다';
  end if;
end
$probe$;
drop function public.zz_rpc_grant_probe_0174();
