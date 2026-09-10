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
    (case when p_country in ('US','CA') then 'tax_exclusive' else 'tax_inclusive' end)::public.tax_price_basis,
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


-- 0203: server-authoritative price simulation, always rollback through run.mjs.
do $sim$
declare x jsonb;s uuid;r uuid;d date;m uuid;t uuid;future_m uuid;future_t uuid;
 country text;price numeric;q jsonb;before_row jsonb;first_result jsonb;
begin
 foreach country in array array['KR','US','GB','AU','CA'] loop
  x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;r:=(x->>'recipe')::uuid;d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d-1,d,country);
  t:=pg_temp.ctx_tax(s,m,d-1,d,10);
  future_m:=pg_temp.ctx_market(s,d+1,null,'GB');future_t:=pg_temp.ctx_tax(s,future_m,d+1,null,20);
  update public.recipes set base_servings=2,target_profit_rate=30 where id=r;
  insert into public.fixed_costs_monthly(store_id,month,total_revenue,items)
    values(s,to_char(d,'YYYY-MM'),1000,'[{"key":"rent","total":200}]')
    on conflict(store_id,month) do update set total_revenue=excluded.total_revenue,items=excluded.items;
  select to_jsonb(z) into before_row from public.recipes z where id=r;
  price:=case when country='KR' then 12000 else 12.34 end;
  set local role authenticated;
  q:=public.recipe_price_simulation(s,r,price);first_result:=q;
  perform pg_temp.ok('0203 current market not reserved '||country,q->>'status'='ready' and q#>>'{context,country_code}'=country
    and (q#>>'{context,market_id}')::uuid=m and (q#>>'{context,tax_profile_id}')::uuid=t and q->>'local_date'=d::text);
  perform pg_temp.ok('0203 current price quote identity '||country,(q->>'input_price')::numeric=price and (q#>>'{one,listed_total}')::numeric=price);
  perform pg_temp.ok('0203 batch comparison server values '||country,
    (q#>>'{batch,net_sales}')::numeric=(q#>>'{one,net_sales}')::numeric*2 and (q#>>'{batch,profit}')::numeric=(q#>>'{one,profit}')::numeric*2);
  if country='KR' then
    perform pg_temp.eq('KR included tax 1091',(q#>>'{one,tax}')::numeric,1091);
    perform pg_temp.eq('KR net 10909',(q#>>'{one,net_sales}')::numeric,10909);
  elsif country='US' then
    perform pg_temp.eq('US exclusive tax1.23',(q#>>'{one,tax}')::numeric,1.23);
    perform pg_temp.eq('US net stays12.34',(q#>>'{one,net_sales}')::numeric,12.34);
    perform pg_temp.eq('US customer13.57',(q#>>'{one,customer_total}')::numeric,13.57);
  end if;
  perform pg_temp.ok('0203 input zero rate is unavailable',public.recipe_price_simulation(s,r,0)#>'{one,profit_rate}'='null'::jsonb);
  perform pg_temp.raises('0203 negative price',format('select public.recipe_price_simulation(%L,%L,-1)',s,r),'22023');
  perform pg_temp.raises('0203 precision',format('select public.recipe_price_simulation(%L,%L,1.001)',s,r),'22023');
  perform pg_temp.raises('0203 NaN',format('select public.recipe_price_simulation(%L,%L,%L::numeric)',s,r,'NaN'),'22023');
  perform pg_temp.raises('0203 missing recipe',format('select public.recipe_price_simulation(%L,%L,1)',s,gen_random_uuid()),'42501');
  set local role postgres;
  perform pg_temp.ok('0203 no recipe mutation',before_row=(select to_jsonb(z) from public.recipes z where id=r));
  perform pg_temp.ok('0203 no writes to recipe histories/inventory/receipts',
    not exists(select 1 from public.recipe_write_receipts where store_id=s)
    and not exists(select 1 from public.inventory_events where store_id=s)
    and not exists(select 1 from public.profit_trends where recipe_id=r)
    and not exists(select 1 from public.entity_change_events where entity_id=r));
  perform pg_temp.ok('0203 exact internal tax parity',first_result->'quote'=public.recipe_tax_quote_for_price(r,d,price));
  update public.fixed_costs_monthly set total_revenue=0 where store_id=s;
  q:=public.recipe_price_simulation(s,r,price);
  perform pg_temp.ok('0203 missing fixed basis is not zero profit',q#>'{basis,fixed_rate}'='null'::jsonb
    and q#>'{one,profit}'='null'::jsonb and q#>'{one,meets_target}'='null'::jsonb);
 end loop;
 x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;r:=(x->>'recipe')::uuid;
 set local role authenticated;
 q:=public.recipe_price_simulation(s,r,100);
 perform pg_temp.ok('0203 no activation never uses legacy estimate',q->>'status'='unavailable' and q->'one'='null'::jsonb);
 perform pg_temp.ok('0203 facade ACL',has_function_privilege('authenticated','public.recipe_price_simulation(uuid,uuid,numeric)','execute')
    and not has_function_privilege('anon','public.recipe_price_simulation(uuid,uuid,numeric)','execute')
    and not has_function_privilege('service_role','public.recipe_price_simulation(uuid,uuid,numeric)','execute')
    and not has_function_privilege('authenticated','public.recipe_tax_quote_for_price(uuid,date,numeric)','execute'));
end $sim$;

-- Same-market future tax/override, compound components and missing input costs.
set local role postgres;
do $current_treatment$
declare x jsonb;s uuid;r uuid;d date;m uuid;t uuid;future_t uuid;c uuid;i uuid;q jsonb;
begin
 x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;r:=(x->>'recipe')::uuid;d:=(x->>'date')::date;
 m:=pg_temp.ctx_market(s,d-1,null,'US');t:=pg_temp.ctx_tax(s,m,d-1,d,10);future_t:=pg_temp.ctx_tax(s,m,d+1,null,20);
 insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision)
   values(r,s,future_t,'exempt',d+1,1);
 q:=public.recipe_price_simulation(s,r,12.34);
 perform pg_temp.ok('0203 same-market future tax/treatment never leaks',q#>>'{context,tax_profile_id}'=t::text
   and q#>>'{context,treatment}'='taxable' and (q#>>'{one,tax}')::numeric=1.23);
 insert into public.store_tax_components(store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments)
   values(s,t,'additional','additional','Synthetic compound',5,'custom','primary_tax_inclusive',array['taxable'::public.tax_treatment]) returning id into c;
 insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
   values(s,c,'hall','merchant'),(s,c,'delivery','merchant'),(s,c,'takeout','merchant');
 q:=public.recipe_price_simulation(s,r,12.34);
 perform pg_temp.eq('0203 compound tax rounds each component',(q#>>'{one,tax}')::numeric,1.91);
 insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision)
   values(r,s,t,'exempt',d,1);
 q:=public.recipe_price_simulation(s,r,12.34);
 perform pg_temp.ok('0203 current exempt is resolved by server',q#>>'{context,treatment}'='exempt' and (q#>>'{one,tax}')::numeric=0);
 update public.menu_tax_overrides set treatment='zero_rated',revision=2 where recipe_id=r and tax_profile_id=t and effective_from=d;
 q:=public.recipe_price_simulation(s,r,12.34);
 perform pg_temp.ok('0203 zero-rated remains distinct',q#>>'{context,treatment}'='zero_rated' and (q#>>'{one,tax}')::numeric=0);
 i:=public.save_ingredient(s,jsonb_build_object('name','Simulation missing price','base_unit','g','per_volume',1,'safety_stock',0,'min_order_qty',1));
 insert into public.recipe_lines(store_id,recipe_id,ingredient_id,input_qty) values(s,r,i,1);
 q:=public.recipe_price_simulation(s,r,12.34);
 perform pg_temp.ok('0203 missing cost does not become free',q#>'{one,material}'='null'::jsonb and q#>'{one,profit}'='null'::jsonb
   and q#>'{basis,missing_ingredient_price_ids}'=jsonb_build_array(i));
 set local role authenticated;
 perform pg_temp.raises('0203 wrong store',format('select public.recipe_price_simulation(%L,%L,10)',pg_temp.store(),r),'42501');
 perform pg_temp.raises('0203 null input',format('select public.recipe_price_simulation(%L,%L,null)',s,r),'22023');
 perform pg_temp.raises('0203 positive infinity',format('select public.recipe_price_simulation(%L,%L,%L::numeric)',s,r,'Infinity'),'22023');
 perform pg_temp.raises('0203 negative infinity',format('select public.recipe_price_simulation(%L,%L,%L::numeric)',s,r,'-Infinity'),'22023');
end $current_treatment$;

-- Activation boundaries remain closed; only the existing private helper reads them.
select pg_temp.ok('0203 does not expose activation boundary table or columns',
  not has_table_privilege('margincook_rpc_executor','public.international_tax_activation_boundaries','SELECT')
  and not has_column_privilege('margincook_rpc_executor','public.international_tax_activation_boundaries','activation_date','SELECT')
  and not has_table_privilege('authenticated','public.international_tax_activation_boundaries','SELECT')
  and has_function_privilege('margincook_rpc_executor','public.recipe_tax_quote_for_price(uuid,date,numeric)','EXECUTE')
  and not has_function_privilege('authenticated','public.recipe_tax_quote_for_price(uuid,date,numeric)','EXECUTE'));
