-- Save the price basis and the complete tax configuration in one transaction.
-- Never leave a replacement market without its tax profile after a failed second request.
begin;
create function public.tax_override_carry(p_profile uuid,p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select distinct on (recipe_id) recipe_id,store_id,tax_category,treatment,revision,updated_at
    from public.menu_tax_overrides where tax_profile_id=p_profile and effective_from<=p_date
    order by recipe_id,effective_from desc
  ) x
$$;
create function public.restore_tax_override_carry(p_profile uuid,p_date date,p_rows jsonb)
returns void language sql security definer set search_path=pg_catalog,public as $$
  insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,tax_category,treatment,effective_from,revision,updated_at)
  select x.recipe_id,x.store_id,p_profile,x.tax_category,x.treatment,p_date,x.revision,x.updated_at
  from jsonb_to_recordset(p_rows) x(recipe_id uuid,store_id uuid,tax_category text,treatment public.tax_treatment,revision integer,updated_at timestamptz)
  join public.store_tax_profiles p on p.id=p_profile and p.store_id=x.store_id
  where x.tax_category is null or exists(select 1 from public.tax_category_catalog c
    where c.tax_profile_id=p_profile and c.code=x.tax_category and c.active)
  on conflict do nothing
$$;
revoke all on function public.tax_override_carry(uuid,date),public.restore_tax_override_carry(uuid,date,jsonb) from public,anon,authenticated,service_role;

do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.save_store_tax_profile(uuid,jsonb,uuid,integer)'::regprocedure);
  d:=regexp_replace(d,'declare','declare v_carry jsonb;','i');
  a:='v_menu_before:=public.tax_menu_change_basis(p_store,v_effective);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0217 carry before anchor'; end if;
  d:=replace(d,a,a||' v_carry:=public.tax_override_carry(v_current.id,v_effective);');
  a:='perform public.propagate_tax_menu_change(p_store,v_effective,v_menu_before);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0217 carry after anchor'; end if;
  d:=replace(d,a,'perform public.restore_tax_override_carry(v_new,v_effective,v_carry); '||a);
  execute d;
  -- The atomic facade records one final menu change, not intermediate market/profile changes.
  d:=replace(d,'FUNCTION public.save_store_tax_profile(', 'FUNCTION public.tax_profile_apply_v2(');
  execute replace(d,a,'');

  -- This migration is not deployed remotely. Historical Windows bodies can use CRLF.
  -- Normalize both sides of the multiline anchor; keep the exact-one guard.
  d:=replace(pg_get_functiondef('public.save_store_market_profile(uuid,jsonb,uuid,integer)'::regprocedure),E'\r\n',E'\n');
  d:=replace(d,'FUNCTION public.save_store_market_profile(', 'FUNCTION public.tax_market_apply_v2(');
  a:=$old$    if public.store_has_money_ledger(p_store) then
      raise exception '금액 기록이 있는 매장의 국가·통화 계약은 바꿀 수 없어요'$old$;
  a:=replace(a,E'\r\n',E'\n');
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0217 market guard anchor'; end if;
  execute replace(d,a,replace($new$    if public.store_has_money_ledger(p_store) and
      (v_current.country_code is distinct from v_country or v_current.region_code is distinct from v_region
       or v_current.currency_code is distinct from v_currency or v_current.business_locale_code is distinct from v_locale) then
      raise exception '금액 기록이 있는 매장의 국가·통화 계약은 바꿀 수 없어요'$new$,E'\r\n',E'\n'));
end $patch$;
revoke all on function public.tax_profile_apply_v2(uuid,jsonb,uuid,integer),public.tax_market_apply_v2(uuid,jsonb,uuid,integer)
  from public,anon,authenticated,service_role;

create function public.save_tax_configuration(p_store uuid,p_market jsonb,p_tax jsonb,
  p_market_id uuid,p_market_revision integer,p_tax_id uuid,p_tax_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.store_market_profiles; t public.store_tax_profiles; mr jsonb; tr jsonb;
  before_values jsonb; carry jsonb; d date; tax_id uuid; tax_revision integer;
begin
  perform public.assert_my_store(p_store);
  perform public.assert_international_tax_write_enabled();
  perform public.assert_write_app_version();
  perform public.lock_business_scope(p_store);
  select * into m from public.store_market_profiles where store_id=p_store and effective_to is null order by effective_from desc limit 1 for update;
  select * into t from public.store_tax_profiles where store_id=p_store and market_profile_id=m.id and effective_to is null order by effective_from desc limit 1 for update;
  if p_market_id is distinct from m.id or p_market_revision is distinct from m.revision
    or p_tax_id is distinct from t.id or p_tax_revision is distinct from t.revision then
    raise exception '다른 기기에서 세금 설정이 변경됐어요' using errcode='45009',detail='REVISION_CONFLICT';
  end if;
  d:=public.next_unopened_business_date(p_store);
  before_values:=public.tax_menu_change_basis(p_store,d);
  carry:=public.tax_override_carry(t.id,d);
  mr:=public.tax_market_apply_v2(p_store,p_market,p_market_id,p_market_revision);
  if (mr->>'changed')::boolean then tax_id:=null; tax_revision:=null;
  else tax_id:=p_tax_id; tax_revision:=p_tax_revision; end if;
  tr:=public.tax_profile_apply_v2(p_store,p_tax,tax_id,tax_revision);
  d:=(tr->>'effective_from')::date;
  if (mr->>'changed')::boolean then perform public.restore_tax_override_carry((tr->>'profile_id')::uuid,d,carry); end if;
  if (mr->>'changed')::boolean or (tr->>'changed')::boolean then
    perform public.propagate_tax_menu_change(p_store,d,before_values);
  end if;
  return tr||jsonb_build_object('changed',(mr->>'changed')::boolean or (tr->>'changed')::boolean,
    'market_profile_id',mr->>'profile_id','market_revision',mr->'revision');
end $$;
revoke all on function public.save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer) from public,anon;
grant execute on function public.save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer) to authenticated,service_role;
comment on function public.save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer) is
  'Atomic MY tax save. CAS both profiles, preserve opening snapshots and valid menu overrides; price basis is editable after money history, currency/country remain guarded.';
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
