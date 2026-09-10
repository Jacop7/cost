-- 0202: additive current context. Run via run.mjs + _prelude.sql; always rollback.
-- Helpers are also consumed by the isolated migration/concurrency harness.
create function pg_temp.ctx_store(p_timezone text default 'Asia/Seoul') returns jsonb
language plpgsql as $f$
declare v_owner uuid:=pg_temp.new_owner(); v_store uuid; v_recipe uuid;
begin
  perform pg_temp.as_owner(v_owner);
  v_store:=(public.create_store('현재 시장 시험',p_timezone)->>'store_id')::uuid;
  set local role postgres;
  if exists(select 1 from public.store_market_profiles where store_id=v_store) then
    raise exception 'context fixture requires a new store without profiles';
  end if;
  insert into public.recipes(store_id,name,price) values(v_store,'현재 가격',12.34) returning id into v_recipe;
  return jsonb_build_object('owner',v_owner,'store',v_store,'recipe',v_recipe,
    'date',public.store_local_date(v_store));
end $f$;

create function pg_temp.ctx_market(p_store uuid,p_from date,p_to date,p_country text default 'US')
returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into public.store_market_profiles(store_id,country_code,region_code,currency_code,
    business_locale_code,price_basis,effective_from,effective_to)
  values(p_store,p_country::public.international_country_code,
    case p_country when 'US' then 'US-NY' when 'CA' then 'CA-ON' else null end,
    (case p_country when 'KR' then 'KRW' when 'US' then 'USD' when 'GB' then 'GBP'
      when 'AU' then 'AUD' when 'CA' then 'CAD' end)::public.international_currency_code,
    (case p_country when 'KR' then 'ko-KR' else 'en-'||p_country end)::public.business_locale_code,
    (case p_country when 'US' then 'tax_exclusive' else 'tax_inclusive' end)::public.tax_price_basis,
    p_from,p_to) returning id into v_id;
  return v_id;
end $f$;

create function pg_temp.ctx_tax(p_store uuid,p_market uuid,p_from date,p_to date,p_rate numeric default 10)
returns uuid language plpgsql as $f$
declare v_id uuid; v_component uuid;
begin
  insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from,effective_to)
  values(p_store,p_market,'taxable',p_from,p_to) returning id into v_id;
  insert into public.store_tax_components(store_id,tax_profile_id,config_key,kind,name,rate_pct,
    jurisdiction_level,calculation_basis,applies_to_treatments)
  values(p_store,v_id,'primary','primary','Synthetic tax',p_rate,'national','primary_tax_exclusive',
    array['taxable'::public.tax_treatment]) returning id into v_component;
  insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(p_store,v_component,'hall','merchant'),(p_store,v_component,'delivery','merchant'),
    (p_store,v_component,'takeout','merchant');
  insert into public.tax_category_catalog(store_id,tax_profile_id,code,name,treatment)
  values(p_store,v_id,'standard','Standard','taxable');
  return v_id;
end $f$;

-- CONTEXT-CASES: the harness loads only the helper prefix above.
do $boundary$
declare x jsonb; d date; f date; s uuid; r uuid; m0 uuid; m1 uuid; p0 uuid; p1 uuid;
  a jsonb; q jsonb; c jsonb; v_offset integer; v_country text; v_saved jsonb;
begin
  -- Same server date: independent stores put the facade at F-1 and F.
  foreach v_offset in array array[1,0] loop
    x:=pg_temp.ctx_store(); d:=(x->>'date')::date; f:=d+v_offset;
    s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid;
    m0:=pg_temp.ctx_market(s,d-2,f-1,'US'); p0:=pg_temp.ctx_tax(s,m0,d-2,f-1,10);
    m1:=pg_temp.ctx_market(s,f,null,'GB'); p1:=pg_temp.ctx_tax(s,m1,f,null,20);
    set local role authenticated;
    a:=public.international_tax_app_state(s); q:=public.recipe_tax_app_state(s,r); c:=q->'quote_context';
    perform pg_temp.ok('0202: reserved M1/P1 metadata is retained at offset '||v_offset,
      (a#>>'{market_profile,id}')::uuid=m1 and (a#>>'{tax_profile,id}')::uuid=p1
      and (q->>'tax_profile_id')::uuid=p1 and q->>'currency_code'='GBP'
      and q->>'price_basis'='tax_inclusive' and (q->>'minor_unit')::integer=2);
    perform pg_temp.ok('0202: current date/market/provenance agree at offset '||v_offset,
      a->>'local_date'=d::text and c->>'local_date'=d::text and c->>'sales_channel_code'='hall'
      and a->'current_market'=c->'market' and (c#>>'{market,store_id}')::uuid=s
      and (c#>>'{market,id}')::uuid=case when v_offset=1 then m0 else m1 end
      and (c->>'tax_profile_id')::uuid=case when v_offset=1 then p0 else p1 end
      and (c#>>'{market,revision}')::integer=1 and (c->>'tax_profile_revision')::integer=1);
    set local role postgres;
    perform pg_temp.ok('0202: quote exact parity and currency/basis switch atomically',
      q->'quote'=public.current_recipe_tax_quote(r,d)
      and c#>>'{market,currency_code}'=case when v_offset=1 then 'USD' else 'GBP' end
      and c#>>'{market,price_basis}'=case when v_offset=1 then 'tax_exclusive' else 'tax_inclusive' end
      and (q#>>'{quote,tax_total}')::numeric=case when v_offset=1 then 1.23 else 2.06 end
      and (q#>>'{quote,net_sales}')::numeric=case when v_offset=1 then 12.34 else 10.28 end
      and (q#>>'{quote,customer_total}')::numeric=case when v_offset=1 then 13.57 else 12.34 end);
    perform pg_temp.ok('0202: F-1 inclusive end and F inclusive start use their own profiles',
      (public.recipe_tax_quote_for_price(r,f-1,12.34)->>'tax_total')::numeric=1.23
      and (public.recipe_tax_quote_for_price(r,f,12.34)->>'tax_total')::numeric=2.06);
    perform pg_temp.raises('0202: overlapping market range remains rejected',format(
      'select pg_temp.ctx_market(%L::uuid,%L::date,null,%L)',s,d,'US'),'23505');
  end loop;
  foreach v_country in array array['KR','US','GB','AU','CA'] loop
    x:=pg_temp.ctx_store(); d:=(x->>'date')::date; s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid;
    m0:=pg_temp.ctx_market(s,d,null,v_country); p0:=pg_temp.ctx_tax(s,m0,d,null);
    a:=public.international_tax_app_state(s); q:=public.recipe_tax_app_state(s,r);
    perform pg_temp.ok('0202: current launch market projection '||v_country,
      a#>>'{current_market,country_code}'=v_country
      and a->'current_market'=q#>'{quote_context,market}'
      and (a#>>'{current_market,minor_unit}')::integer=
        public.international_currency_minor_unit((a#>>'{current_market,currency_code}')::public.international_currency_code)
      and a#>>'{current_market,business_locale_code}'=case when v_country='KR' then 'ko-KR' else 'en-'||v_country end);
  end loop;
  perform pg_temp.as_owner(pg_temp.owner());
end $boundary$;

do $same_market$
declare x jsonb; s uuid; r uuid; d date; m uuid; p0 uuid; p1 uuid; q jsonb; saved jsonb;
begin
  x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid; d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d-2,null);
  p0:=pg_temp.ctx_tax(s,m,d-2,d,10); p1:=pg_temp.ctx_tax(s,m,d+1,null,20);
  q:=public.recipe_tax_app_state(s,r);
  perform pg_temp.ok('0202: same-market future P1 keeps current P0 provenance',
    (q->>'tax_profile_id')::uuid=p1 and (q#>>'{quote_context,tax_profile_id}')::uuid=p0
    and (q#>>'{quote_context,market,id}')::uuid=m
    and q->'quote'=public.current_recipe_tax_quote(r,d));
  x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid; d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d-2,null); p0:=pg_temp.ctx_tax(s,m,d-2,null,10);
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  set local role authenticated;
  saved:=public.save_menu_tax_override(s,r,p0,null,'exempt',0);
  q:=public.recipe_tax_app_state(s,r);
  set local role postgres;
  perform pg_temp.ok('0202: future override editing remains separate from current quote',
    q->>'treatment'='exempt' and (q->>'override_revision')::integer=(saved->>'revision')::integer
    and (q->>'effective_from')::date>d and (q#>>'{quote,tax_total}')::numeric=1.23
    and (q#>>'{quote_context,tax_profile_id}')::uuid=p0
    and (public.recipe_tax_quote_for_price(r,(q->>'effective_from')::date,12.34)->>'tax_total')::numeric=0);
  perform pg_temp.as_owner(pg_temp.owner());
end $same_market$;

do $nulls$
declare x jsonb; s uuid; r uuid; d date; m uuid; p uuid; a jsonb; q jsonb; scenario text;
  v_cap text;
begin
  foreach scenario in array array['none','future','market-only','gap','before-activation','incomplete'] loop
    x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid; d:=(x->>'date')::date;
    if scenario='future' then
      m:=pg_temp.ctx_market(s,d+1,null); p:=pg_temp.ctx_tax(s,m,d+1,null);
    elsif scenario='gap' then
      m:=pg_temp.ctx_market(s,d-2,d-1); p:=pg_temp.ctx_tax(s,m,d-2,d-1);
      m:=pg_temp.ctx_market(s,d+1,null); p:=pg_temp.ctx_tax(s,m,d+1,null);
    elsif scenario in ('market-only','before-activation','incomplete') then
      m:=pg_temp.ctx_market(s,d-2,null);
      if scenario='before-activation' then
        -- First insert initializes immutable boundary to tomorrow. Do not insert it twice.
        p:=pg_temp.ctx_tax(s,m,d+1,null); p:=pg_temp.ctx_tax(s,m,d-2,d);
      elsif scenario='incomplete' then
        insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
        values(s,m,'taxable',d);
      end if;
    end if;
    a:=public.international_tax_app_state(s);
    if scenario='incomplete' then
      perform pg_temp.raises('0202: incomplete tax still raises original 45013',format(
        'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',s,r),'45013');
    else
      q:=public.recipe_tax_app_state(s,r);
      perform pg_temp.ok('0202: quote/context null is explicit for '||scenario,
        q ? 'quote_context' and q->'quote'='null'::jsonb and q->'quote_context'='null'::jsonb);
    end if;
    perform pg_temp.ok('0202: current market presence is independent from tax readiness: '||scenario,
      a ? 'current_market' and (a->'current_market'<>'null'::jsonb)=
        (scenario in ('market-only','before-activation','incomplete')));
    if scenario='future' then
      perform pg_temp.ok('0202: profile_ready reservation is not a current market',
        a->>'onboarding_status'='profile_ready' and a->'current_market'='null'::jsonb);
    end if;
  end loop;
  -- Rollback-scoped capability fixture; restore the original function immediately.
  x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid; d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d,null); p:=pg_temp.ctx_tax(s,m,d,null);
  v_cap:=pg_get_functiondef('public.app_capabilities()'::regprocedure);
  execute format('create or replace function public.app_capabilities() returns jsonb language sql stable as %L',
    'select '||quote_literal(jsonb_set(public.app_capabilities(),'{international_tax,read_enabled}','false'::jsonb)::text)||'::jsonb');
  q:=public.recipe_tax_app_state(s,r); a:=public.international_tax_app_state(s);
  perform pg_temp.ok('0202: disabled reads preserve market metadata but not an international quote',
    q->'quote'='null'::jsonb and q->'quote_context'='null'::jsonb and a->'current_market'<>'null'::jsonb);
  execute v_cap;
  perform pg_temp.as_owner(pg_temp.owner());
end $nulls$;

do $writes_scope$
declare x jsonb; s uuid; r uuid; d date; m uuid; p uuid; a jsonb; q jsonb; saved jsonb; payload jsonb; foreign_recipe uuid;
begin
  x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; r:=(x->>'recipe')::uuid; d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d-1,null); p:=pg_temp.ctx_tax(s,m,d-1,null);
  select id into strict foreign_recipe from public.recipes where store_id=pg_temp.store() and name='제육볶음';
  perform pg_temp.ok('0202: real market write fixture has no money ledger',not public.store_has_money_ledger(s));
  payload:='{"country_code":"GB","region_code":null,"currency_code":"GBP","business_locale_code":"en-GB","price_basis":"tax_inclusive"}'::jsonb;
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);
  set local role authenticated;
  saved:=public.save_store_market_profile(s,payload,m,1);
  a:=public.international_tax_app_state(s); q:=public.recipe_tax_app_state(s,r);
  perform pg_temp.ok('0202: actual market reservation retains current quote provenance',
    (saved->>'effective_from')::date>d and a#>>'{market_profile,id}'=saved->>'profile_id'
    and (a#>>'{current_market,id}')::uuid=m and (q#>>'{quote_context,tax_profile_id}')::uuid=p);
  perform pg_temp.ok('0202: reservation no-op retains the same ID/revision',
    not (public.save_store_market_profile(s,payload,(saved->>'profile_id')::uuid,(saved->>'revision')::integer)->>'changed')::boolean);
  perform pg_temp.raises('0202: stale reservation CAS still fails',format(
    'select public.save_store_market_profile(%L::uuid,%L::jsonb,%L::uuid,1)',s,payload,m),'45009');
  perform pg_temp.raises('0202: missing or foreign recipe is not readable',format(
    'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',s,foreign_recipe),'42501');
  perform pg_temp.raises('0202: absent recipe is not readable',format(
    'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',s,gen_random_uuid()),'42501');
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('0202: another owner cannot read current market',format(
    'select public.international_tax_app_state(%L::uuid)',s),'42501');
  perform pg_temp.raises('0202: another owner cannot read quote provenance',format(
    'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',s,r),'42501');
  set local role service_role;
  perform pg_temp.raises('0202: service_role grant does not bypass owner scope',format(
    'select public.recipe_tax_app_state(%L::uuid,%L::uuid)',s,r),'42501');
  perform pg_temp.as_owner((x->>'owner')::uuid);
  perform public.archive_my_store(s,'context scope regression');
  perform pg_temp.raises('0202: archived store is not readable',format(
    'select public.international_tax_app_state(%L::uuid)',s),'42501');
  perform pg_temp.as_owner(pg_temp.owner());
end $writes_scope$;

do $acl$
declare f text; role_name text;
begin
  foreach f in array array['public.international_tax_app_state(uuid)','public.recipe_tax_app_state(uuid,uuid)'] loop
    perform pg_temp.ok('0202: facade grants unchanged '||f,
      has_function_privilege('authenticated',f,'execute') and has_function_privilege('service_role',f,'execute')
      and not has_function_privilege('anon',f,'execute'));
  end loop;
  foreach f in array array['public.current_recipe_tax_quote(uuid,date)','public.recipe_tax_quote_for_price(uuid,date,numeric)'] loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      perform pg_temp.ok('0202: internal quote closed to '||role_name||' '||f,not has_function_privilege(role_name,f,'execute'));
    end loop;
    perform pg_temp.ok('0202: internal executor grant retained '||f,has_function_privilege('margincook_rpc_executor',f,'execute'));
  end loop;
end $acl$;
