-- MY tax and monthly fixed-cost history. Existing financial calculations remain authoritative.
begin;
create table public.store_configuration_changes (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check(kind in ('tax','fixed_cost')),
  source text not null check(source in ('market','tax_profile','legacy_tax','fixed_cost')),
  month text,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  effective_from date,
  before_value jsonb,
  after_value jsonb not null,
  check(month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
create index store_configuration_changes_lookup on public.store_configuration_changes(store_id,kind,id desc);
alter table public.store_configuration_changes enable row level security;
revoke all on public.store_configuration_changes from public,anon,authenticated,service_role;

create function public.record_configuration_change(p_store uuid,p_source text,p_month text,p_before jsonb,p_after jsonb,p_effective date default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_before is not distinct from p_after then return; end if;
  insert into public.store_configuration_changes(store_id,kind,source,month,actor_id,effective_from,before_value,after_value)
  values(p_store,case when p_source='fixed_cost' then 'fixed_cost' else 'tax' end,p_source,p_month,auth.uid(),p_effective,p_before,p_after);
end $$;
revoke all on function public.record_configuration_change(uuid,text,text,jsonb,jsonb,date) from public,anon,authenticated,service_role;
grant execute on function public.record_configuration_change(uuid,text,text,jsonb,jsonb,date) to margincook_rpc_executor;

create function public.record_configuration_row_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before jsonb; v_after jsonb;
begin
  if tg_table_name='fixed_costs_monthly' then
    if tg_op='UPDATE' then v_before:=jsonb_build_object('total_revenue',old.total_revenue,'items',old.items); end if;
    v_after:=jsonb_build_object('total_revenue',new.total_revenue,'items',new.items);
    perform public.record_configuration_change(new.store_id,'fixed_cost',new.month,v_before,v_after);
  else
    v_before:=jsonb_build_object('tax_mode',old.tax_mode,'tax_items',old.tax_items);
    v_after:=jsonb_build_object('tax_mode',new.tax_mode,'tax_items',new.tax_items);
    perform public.record_configuration_change(new.store_id,'legacy_tax',null,v_before,v_after);
  end if;
  return new;
end $$;
revoke all on function public.record_configuration_row_change() from public,anon,authenticated,service_role;
create trigger fixed_configuration_history after insert or update on public.fixed_costs_monthly
for each row execute function public.record_configuration_row_change();
create trigger legacy_tax_configuration_history after update of tax_mode,tax_items on public.settings
for each row execute function public.record_configuration_row_change();

-- Preserve before-values before the writer replaces a not-yet-effective profile.
-- Patch the existing validated writer, retaining its signature, owner and ACL.
do $patch$
declare v_def text; v_before text; v_after text; v_signature text; v_marker text; v_source text;
begin
  foreach v_source in array array['market','tax_profile'] loop
    v_signature:=case when v_source='market' then 'public.save_store_market_profile(uuid,jsonb,uuid,integer)' else 'public.save_store_tax_profile(uuid,jsonb,uuid,integer)' end;
    v_def:=pg_get_functiondef(v_signature::regprocedure);
    v_before:=case when v_source='market' then
      'case when v_current.id is null then null else jsonb_build_object(''country_code'',v_current.country_code,''region_code'',v_current.region_code,''currency_code'',v_current.currency_code,''business_locale_code'',v_current.business_locale_code,''price_basis'',v_current.price_basis) end'
      else 'public.tax_profile_payload(v_current.id)' end;
    v_after:=case when v_source='market' then 'p_payload' else 'public.tax_profile_payload(v_new)' end;
    v_marker:=case when v_source='market' then 'v_effective:=public.next_unopened_business_date(p_store);' else 'v_effective:=greatest(public.next_unopened_business_date(p_store),v_market.effective_from);' end;
    if position(v_marker in v_def)=0 or position('return jsonb_build_object(''changed'',true,''profile_id'',v_new,' in v_def)=0 then
      raise exception '0204: unrecognized writer %',v_signature;
    end if;
    v_def:=regexp_replace(v_def,'declare','declare v_history_before jsonb;','i');
    v_def:=replace(v_def,v_marker,'v_history_before:='||v_before||'; '||v_marker);
    v_def:=replace(v_def,'return jsonb_build_object(''changed'',true,''profile_id'',v_new,',
      format('perform public.record_configuration_change(p_store,%L,null,v_history_before,%s,v_effective); return jsonb_build_object(''changed'',true,''profile_id'',v_new,',v_source,v_after));
    execute v_def;
  end loop;
end $patch$;

create function public.store_configuration_history(p_store uuid,p_kind text,p_month text default null,p_cursor text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_items jsonb; v_cursor bigint; v_last bigint; v_count bigint;
begin
  perform public.assert_my_store(p_store);
  if p_kind not in ('tax','fixed_cost') or p_kind is null then raise exception '수정 내역 종류가 올바르지 않아요' using errcode='22000'; end if;
  if p_month is not null and p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception '월 형식이 올바르지 않아요' using errcode='22000'; end if;
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{1,19}$' then raise exception '잘못된 커서' using errcode='22000'; end if;
    v_cursor:=p_cursor::bigint;
  end if;
  select count(*) into v_count from public.store_configuration_changes c where c.store_id=p_store and c.kind=p_kind and (p_month is null or c.month=p_month);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id desc),'[]'),min(x.sort_id) into v_items,v_last from (
    select c.id as sort_id,c.id::text as id,c.source,c.month,c.occurred_at,c.effective_from,c.before_value,c.after_value
    from public.store_configuration_changes c where c.store_id=p_store and c.kind=p_kind and (p_month is null or c.month=p_month)
      and (v_cursor is null or c.id<v_cursor) order by c.id desc limit 20
  ) x;
  return jsonb_build_object('items',v_items,'count',v_count,'next_cursor',case when exists(
    select 1 from public.store_configuration_changes c where c.store_id=p_store and c.kind=p_kind and (p_month is null or c.month=p_month) and c.id<v_last
  ) then v_last::text else null end);
end $$;
revoke all on function public.store_configuration_history(uuid,text,text,text) from public,anon,service_role;
grant execute on function public.store_configuration_history(uuid,text,text,text) to authenticated;
grant select on public.store_configuration_changes to margincook_rpc_executor;
create policy configuration_history_owner_read on public.store_configuration_changes for select
  to margincook_rpc_executor using (
    exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
grant create on schema public to margincook_rpc_executor;
alter function public.store_configuration_history(uuid,text,text,text) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
comment on table public.store_configuration_changes is 'Server-recorded before/after settings changes from migration 0204 onward. No fabricated historical backfill. App roles cannot modify history.';
select public.assert_no_rpc_overloads();
commit;
