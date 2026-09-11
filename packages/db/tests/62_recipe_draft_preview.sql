-- 0205: draft preview and minimum-price recommendation. Run via run.mjs + _prelude.sql; always rollback.
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


-- run.mjs adds _prelude and rollback; all fixtures are synthetic and rolled back.
do $draft$
declare x jsonb; s uuid; r uuid; d date; m uuid; t uuid; fm uuid; ft uuid;
 country text; price numeric; body jsonb; q jsonb; before_row jsonb; before_count bigint; rec_price numeric;
 linked uuid; ingredient uuid; c uuid; legacy_store uuid:=pg_temp.store();
begin
 foreach country in array array['KR','US','GB','AU','CA'] loop
  x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;r:=(x->>'recipe')::uuid;d:=(x->>'date')::date;
  m:=pg_temp.ctx_market(s,d,d,country);t:=pg_temp.ctx_tax(s,m,d,d,10);
  fm:=pg_temp.ctx_market(s,d+1,null,'GB');ft:=pg_temp.ctx_tax(s,fm,d+1,null,20);
  insert into public.fixed_costs_monthly(store_id,month,total_revenue,items)
    values(s,to_char(d,'YYYY-MM'),1000,'[{"key":"rent","total":200}]')
    on conflict(store_id,month) do update set total_revenue=excluded.total_revenue,items=excluded.items;
  insert into public.materials(store_id,name,unit_cost) values(s,'Preview linked',2) returning id into linked;
  price:=case when country='KR' then 12000 else 12.34 end;
  -- The generic fixture starts at 12.34; KR stored prices must use integer won.
  -- Keep rejection coverage before repairing only the synthetic fixture.
  if country='KR' then
   set local role authenticated;
   perform pg_temp.raises('KR invalid stored price is rejected',
     format('select public.recipe_price_recommendation(%L,%L)',s,r),'22023');
   set local role postgres;
  end if;
  update public.recipes set price=case when country='KR' then 12000 else 12.34 end where id=r and store_id=s;
  body:=jsonb_build_object('recipe_id',null,'price',price,'base_servings',10,'target_profit_rate',30,'lines','[]'::jsonb,
    'extras',jsonb_build_array(jsonb_build_object('material_id',linked,'qty',3,'amount',999),jsonb_build_object('material_id',null,'qty',9,'amount',1)));
  select to_jsonb(a) into before_row from public.recipes a where id=r;
  select count(*) into before_count from public.recipes where store_id=s;
  set local role authenticated;
  q:=public.recipe_draft_preview(s,body);
  perform pg_temp.ok('draft actor/store/full input identity '||country,q->'input'=body and (q->>'actor_id')::uuid=auth.uid() and (q->>'store_id')::uuid=s);
  perform pg_temp.ok('draft current context not future '||country,(q#>>'{context,market_id}')::uuid=m and (q#>>'{context,tax_profile_id}')::uuid=t and q->>'local_date'=d::text);
  perform pg_temp.eq('server linked cost ignores cache; independent amount not qty multiplied',(q#>>'{one,extra}')::numeric,7);
  perform pg_temp.eq('batch extras are per-serving times servings',(q#>>'{batch,extra}')::numeric,70);
  if country='KR' then
   perform pg_temp.eq('KR 12000 tax1091',(q#>>'{one,tax}')::numeric,1091);
   perform pg_temp.eq('KR 12000 net10909',(q#>>'{one,net_sales}')::numeric,10909);
  elsif country='US' then
   perform pg_temp.eq('US 12.34 tax1.23',(q#>>'{one,tax}')::numeric,1.23);
   perform pg_temp.eq('US net12.34',(q#>>'{one,net_sales}')::numeric,12.34);
   perform pg_temp.eq('US customer13.57',(q#>>'{one,customer_total}')::numeric,13.57);
  end if;
  perform pg_temp.ok('recommendation meets target',(q#>>'{recommendation,profit_rate}')::numeric>=0.30 and q#>>'{recommendation,status}'='ready');
  rec_price:=(q#>>'{recommendation,price}')::numeric;
  -- Exhaustive oracle below the candidate, independent of the jump implementation.
  set local role postgres;
  perform pg_temp.ok('all lower minor-unit prices fail target '||country,not exists(
    select 1 from generate_series(1,(rec_price/(case when country='KR' then 1 else 0.01 end))::integer-1) u
    cross join lateral (select u*(case when country='KR' then 1::numeric else 0.01 end) as p) v
    cross join lateral (select public.calculate_international_tax(
      (q#>>'{context,price_basis}')::public.tax_price_basis,
      (q#>>'{context,minor_unit}')::smallint,'taxable',v.p,q#>'{quote,components}') as quote) z
    where (z.quote->>'net_sales')::numeric-7-0.2*v.p>=0.3*v.p));
  set local role authenticated;
  q:=public.recipe_draft_preview(s,body||jsonb_build_object('price',rec_price));
  perform pg_temp.ok('recommended input reaches target',q#>>'{one,meets_target}'='true');
  q:=public.recipe_draft_preview(s,body||jsonb_build_object('price',rec_price-case when country='KR' then 1 else 0.01 end));
  perform pg_temp.ok('previous minor unit fails target',q#>>'{one,meets_target}'='false');
  q:=public.recipe_draft_preview(s,body||'{"price":0}');
  perform pg_temp.ok('zero valid, rate and target null',q#>'{one,profit_rate}'='null'::jsonb and q#>'{one,meets_target}'='null'::jsonb);
  perform pg_temp.raises('unknown field cannot inject context',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"local_date":"2000-01-01"}'),'22023');
  perform pg_temp.raises('wrong store',format('select public.recipe_draft_preview(%L,%L::jsonb)',legacy_store,body),'42501');
  perform pg_temp.raises('unknown recipe',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||jsonb_build_object('recipe_id',gen_random_uuid())),'42501');
  perform pg_temp.raises('invalid ingredient',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('ingredient_id',gen_random_uuid(),'input_qty',1)))),'42501');
  perform pg_temp.raises('subrecipe forbidden',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"lines":[{"sub_recipe_id":"00000000-0000-4000-8000-000000000001","input_qty":1}]}'),'22023');
  perform pg_temp.raises('fractional servings',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"base_servings":1.5}'),'22023');
  perform pg_temp.raises('nonfinite string',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"price":"NaN"}'),'22023');
  perform pg_temp.raises('negative price',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"price":-1}'),'22023');
  perform pg_temp.raises('minor precision',format('select public.recipe_draft_preview(%L,%L::jsonb)',s,body||'{"price":1.001}'),'22023');
  set local role postgres;
  perform pg_temp.ok('draft never creates or changes a recipe',before_row=(select to_jsonb(a) from public.recipes a where id=r) and before_count=(select count(*) from public.recipes where store_id=s));
  perform pg_temp.ok('draft never writes ledger/receipt/history',not exists(select 1 from public.recipe_write_receipts where store_id=s)
    and not exists(select 1 from public.inventory_events where store_id=s) and not exists(select 1 from public.entity_change_events where store_id=s)
    and not exists(select 1 from public.profit_trends where recipe_id=r));
  insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision) values(r,s,t,'exempt',d,1);
  set local role authenticated;
  q:=public.recipe_draft_preview(s,body||jsonb_build_object('recipe_id',r));
  perform pg_temp.ok('edit uses current exemption',q#>>'{context,treatment}'='exempt' and (q#>>'{one,tax}')::numeric=0);
  q:=public.recipe_draft_preview(s,body);
  perform pg_temp.ok('new recipe still uses store default',q#>>'{context,treatment}'='taxable' and (q#>>'{one,tax}')::numeric>0);
  q:=public.recipe_price_recommendation(s,r);
  perform pg_temp.ok('saved recommendation binds actual recipe',q#>>'{input,recipe_id}'=r::text and q#>>'{context,treatment}'='exempt');
  perform pg_temp.eq('saved recommendation uses country-valid stored price '||country,(q#>>'{input,price}')::numeric,price);
  set local role postgres;
  ingredient:=public.save_ingredient(s,jsonb_build_object('name','Preview no cost','base_unit','g','per_volume',1,'safety_stock',0,'min_order_qty',1));
  body:=body||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('ingredient_id',ingredient,'input_qty',100)));
  set local role authenticated;
  q:=public.recipe_draft_preview(s,body);
  perform pg_temp.ok('missing ingredient price preserved',q#>'{one,material}'='null'::jsonb and q#>'{one,profit}'='null'::jsonb and q#>>'{recommendation,status}'='basis_missing');
  set local role postgres;
  update public.fixed_costs_monthly set total_revenue=0 where store_id=s;
  set local role authenticated;
  q:=public.recipe_draft_preview(s,body||'{"lines":[]}');
  perform pg_temp.ok('missing fixed denominator preserved',q#>'{one,fixed}'='null'::jsonb and q#>'{one,profit}'='null'::jsonb);
  set local role postgres;
 end loop;
end $draft$;
select pg_temp.ok('private preview and activation boundary remain closed',
 not has_function_privilege('authenticated','public.recipe_draft_preview_internal(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.recipe_draft_preview(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('service_role','public.recipe_draft_preview(uuid,jsonb)','EXECUTE')
 and not has_table_privilege('margincook_rpc_executor','public.international_tax_activation_boundaries','SELECT')
 and not has_column_privilege('margincook_rpc_executor','public.international_tax_activation_boundaries','activation_date','SELECT'));

do $quantities$
declare x jsonb; s uuid; d date; m uuid; t uuid; ingredient uuid; body jsonb; q jsonb;
begin
 x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;d:=(x->>'date')::date;
 m:=pg_temp.ctx_market(s,d,null,'KR');t:=pg_temp.ctx_tax(s,m,d,null,10);
 ingredient:=public.save_ingredient(s,jsonb_build_object('name','Preview known price','base_unit','g','per_volume',1,'safety_stock',0,'min_order_qty',1));
 perform public.quick_inbound(s,ingredient,1000,4000,1,null,d,'PREVIEW-QUANTITY');
 body:=jsonb_build_object('recipe_id',null,'price',12000,'base_servings',10,'target_profit_rate',40,
   'lines',jsonb_build_array(jsonb_build_object('ingredient_id',ingredient,'input_qty',250)),'extras','[]'::jsonb);
 set local role authenticated;
 q:=public.recipe_draft_preview(s,body);
 perform pg_temp.eq('250g batch /10 servings at4 per g =100',(q#>>'{one,material}')::numeric,100);
 q:=public.recipe_draft_preview(s,body||'{"base_servings":5}');
 perform pg_temp.eq('same batch /5 servings =200',(q#>>'{one,material}')::numeric,200);
end $quantities$;

do $compound$
declare x jsonb; s uuid; r uuid; d date; m uuid; t uuid; c uuid; body jsonb; q jsonb;
begin
 x:=pg_temp.ctx_store();s:=(x->>'store')::uuid;r:=(x->>'recipe')::uuid;d:=(x->>'date')::date;
 m:=pg_temp.ctx_market(s,d,null,'US');t:=pg_temp.ctx_tax(s,m,d,null,10);
 insert into public.store_tax_components(store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments)
 values(s,t,'additional','additional','Compound',5,'custom','primary_tax_inclusive',array['taxable'::public.tax_treatment]) returning id into c;
 insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
 values(s,c,'hall','merchant'),(s,c,'delivery','merchant'),(s,c,'takeout','merchant');
 insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision) values(r,s,t,'exempt',d+1,1);
 body:=jsonb_build_object('recipe_id',r,'price',12.34,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb);
 set local role authenticated;
 q:=public.recipe_draft_preview(s,body);
 perform pg_temp.eq('compound per-component rounded 1.23+.68=1.91',(q#>>'{one,tax}')::numeric,1.91);
 perform pg_temp.ok('future exemption not applied today',q#>>'{context,treatment}'='taxable');
 set local role postgres;
 insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision) values(r,s,t,'zero_rated',d,1);
 set local role authenticated;
 q:=public.recipe_draft_preview(s,body);
 perform pg_temp.ok('zero rated distinct and zero tax',q#>>'{context,treatment}'='zero_rated' and (q#>>'{one,tax}')::numeric=0);
end $compound$;
