-- Current menu settings apply before opening / after closing. Frozen sales retain their dated profiles.
begin;

create or replace function public.next_unopened_business_date(p_store uuid)
returns date language plpgsql stable set search_path=pg_catalog,public as $$
declare v_date date:=public.store_local_date(p_store);
begin
  if exists(select 1 from public.business_days where store_id=p_store and status in ('open','break')) then
    v_date:=v_date+1;
  end if;
  while exists(select 1 from public.business_days where store_id=p_store and business_date=v_date) loop
    v_date:=v_date+1;
  end loop;
  return v_date;
end $$;

-- Only current-menu readers use this date. Ledger, snapshot, correction and historical quote
-- functions continue to receive the original business date. The release boundary is not advanced.
create function public.current_tax_settings_date(p_store uuid)
returns date language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare d date:=public.store_local_date(p_store); boundary date; boundary_reason text; m public.store_market_profiles%rowtype; t public.store_tax_profiles%rowtype;
begin
  -- Private helper: caller facades own store authorization; server maintenance also uses it.
  if exists(select 1 from public.business_days where store_id=p_store and status in ('open','break')) then return d; end if;
  if not exists(select 1 from public.business_days where store_id=p_store and business_date=d and status='closed') then return d; end if;
  select activation_date,reason into boundary,boundary_reason from public.international_tax_activation_boundaries where store_id=p_store;
  if boundary is null then return d; end if;
  select * into m from public.store_market_profiles where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  select * into t from public.store_tax_profiles where store_id=p_store and market_profile_id=m.id and effective_to is null order by effective_from desc limit 1;
  -- An owner's first settings after closing may be previewed now; dated sales still use
  -- the immutable activation boundary. Scheduled release/cutover profiles are not advanced.
  if boundary>d and not (boundary_reason='profile_created_after_cutover' and t.created_by is not null and t.effective_from=boundary) then return d; end if;
  return greatest(d,m.effective_from,t.effective_from);
end $$;
revoke all on function public.current_tax_settings_date(uuid) from public,anon,authenticated,service_role;
grant execute on function public.current_tax_settings_date(uuid) to margincook_rpc_executor;

create or replace function public.current_recipe_tax_quote(p_recipe uuid,p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select public.recipe_tax_quote_for_price(r.id,
    case when p_date=public.store_local_date(r.store_id) then public.current_tax_settings_date(r.store_id) else p_date end,r.price)
  from public.recipes r where r.id=p_recipe
$$;

do $patch$
declare sig text; s text; old text; replacement text;
begin
  -- Existing writers already serialize against opening/closing through lock_business_scope.
  foreach sig in array array['public.save_store_market_profile(uuid,jsonb,uuid,integer)','public.save_store_tax_profile(uuid,jsonb,uuid,integer)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    old:='''revision'',v_revision,''effective_from'',v_effective)';
    if position(old in s)=0 then raise exception 'tax timing: writer anchor missing %',sig; end if;
    replacement:='''revision'',v_revision,''effective_from'',v_effective,''application_mode'',case when exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then ''next_business'' else ''immediate'' end)';
    s:=replace(s,old,replacement);
    s:=replace(s,'''revision'',v_current.revision,''effective_from'',v_current.effective_from)',
      '''revision'',v_current.revision,''effective_from'',v_current.effective_from,''application_mode'',case when exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then ''next_business'' else ''immediate'' end)');
    execute s;
  end loop;

  foreach sig in array array['public.international_tax_app_state(uuid)','public.recipe_tax_app_state(uuid,uuid)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    old:='v_local_date := public.store_local_date(p_store);';
    if position(old in s)=0 then raise exception 'tax timing: state date anchor missing %',sig; end if;
    s:=replace(s,'v_local_date date;','v_local_date date; v_settings_date date;');
    s:=replace(s,old,old||' v_settings_date:=public.current_tax_settings_date(p_store);');
    s:=replace(s,'m.effective_from<=v_local_date','m.effective_from<=v_settings_date');
    s:=replace(s,'v_local_date<=m.effective_to','v_settings_date<=m.effective_to');
    s:=replace(s,'t.effective_from<=v_local_date','t.effective_from<=v_settings_date');
    s:=replace(s,'v_local_date<=t.effective_to','v_settings_date<=t.effective_to');
    s:=replace(s,'public.current_recipe_tax_quote(p_recipe,v_local_date)','public.current_recipe_tax_quote(p_recipe,v_settings_date)');
    s:=replace(s,'''local_date'',v_local_date,','''local_date'',v_local_date,''quote_date'',v_settings_date,''application_mode'',case when exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then ''next_business'' else ''immediate'' end,');
    execute s;
  end loop;

  s:=pg_get_functiondef('public.recipe_list(uuid)'::regprocedure);
  old:='r.id,public.store_local_date(r.store_id)) quote';
  if position(old in s)=0 then raise exception 'tax timing: menu list anchor missing'; end if;
  execute replace(s,old,'r.id,public.current_tax_settings_date(r.store_id)) quote');

  foreach sig in array array['public.recipe_price_simulation(uuid,uuid,numeric)','public.recipe_draft_preview_internal(uuid,jsonb)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    old:='d:=public.store_local_date(p_store);';
    if position(old in s)=0 then raise exception 'tax timing: preview anchor missing %',sig; end if;
    -- Keep d as the real local date for monthly costs and input metadata.
    s:=replace(s,'declare','declare settings_date date;');
    s:=replace(s,old,old||' settings_date:=public.current_tax_settings_date(p_store);');
    s:=replace(s,'effective_from<=d','effective_from<=settings_date');
    s:=replace(s,'d<=effective_to','settings_date<=effective_to');
    s:=replace(s,'d<boundary','settings_date<boundary');
    s:=replace(s,'public.recipe_tax_quote_for_price(p_recipe,d,p_price)','public.recipe_tax_quote_for_price(p_recipe,settings_date,p_price)');
    execute s;
  end loop;
end $patch$;

do $promote$
declare sig text; s text;
begin
  foreach sig in array array['public.save_store_market_profile(uuid,jsonb,uuid,integer)','public.save_store_tax_profile(uuid,jsonb,uuid,integer)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    s:=replace(s,'and v_current.price_basis=v_basis then','and v_current.price_basis=v_basis and v_current.effective_from<=public.next_unopened_business_date(p_store) then');
    s:=replace(s,'if public.tax_profile_payload(v_current.id)=v_normalized then','if public.tax_profile_payload(v_current.id)=v_normalized and v_current.effective_from<=public.next_unopened_business_date(p_store) then');
    if sig like '%save_store_market_profile%' then
      s:=replace(s,'  insert into public.store_market_profiles(',
        '  delete from public.store_market_profiles where store_id=p_store and effective_from>=v_effective;
  update public.store_tax_profiles set effective_to=v_effective-1 where store_id=p_store and effective_from<v_effective and (effective_to is null or effective_to>=v_effective);
  update public.store_market_profiles set effective_to=v_effective-1 where store_id=p_store and effective_from<v_effective and (effective_to is null or effective_to>=v_effective);
  insert into public.store_market_profiles(');
    else
      s:=replace(s,'  insert into public.store_tax_profiles(',
        '  delete from public.store_tax_profiles where store_id=p_store and market_profile_id=v_market.id and effective_from>=v_effective;
  update public.store_tax_profiles set effective_to=v_effective-1 where store_id=p_store and market_profile_id=v_market.id and effective_from<v_effective and (effective_to is null or effective_to>=v_effective);
  insert into public.store_tax_profiles(');
    end if;
    execute s;
  end loop;
end $promote$;

alter table public.store_configuration_changes add column application_mode text check(application_mode in ('immediate','next_business'));
do $history$
declare s text;
begin
  s:=pg_get_functiondef('public.record_configuration_change(uuid,text,text,jsonb,jsonb,date)'::regprocedure);
  s:=replace(s,'if p_before is not distinct from p_after then return; end if;','if p_before is not distinct from p_after and p_source in (''fixed_cost'',''legacy_tax'') then return; end if;');
  s:=replace(s,'effective_from,before_value,after_value)','effective_from,before_value,after_value,application_mode)');
  s:=replace(s,'p_effective,p_before,p_after);','p_effective,p_before,p_after,case when p_source=''fixed_cost'' or not exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then ''immediate'' else ''next_business'' end);');
  execute s;
  s:=pg_get_functiondef('public.store_configuration_history(uuid,text,text,text)'::regprocedure);
  execute replace(s,'c.effective_from,c.before_value','c.effective_from,c.application_mode,c.before_value');
end $history$;
comment on function public.current_tax_settings_date(uuid) is 'Current menu UI only: latest settings outside open/break; immutable sales continue using their own business dates. Release boundary retained.';
select public.assert_no_rpc_overloads();
commit;
