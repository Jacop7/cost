-- 0203: read-only input-price simulation. No recipe/ledger writes.
begin;
create function public.recipe_price_simulation(p_store uuid,p_recipe uuid,p_price numeric)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $f$
declare
  r public.recipes%rowtype; m public.store_market_profiles%rowtype;
  t public.store_tax_profiles%rowtype; o public.menu_tax_overrides%rowtype;
  d date; treatment public.tax_treatment; q jsonb; context jsonb; reason text;
  minor integer; material numeric; extra numeric; rate numeric; fixed numeric; profit numeric;
  revenue numeric; fixed_total numeric; missing jsonb; result jsonb; rows jsonb:='{}';
  n integer; mode text;
begin
  perform public.assert_my_store(p_store);
  select * into r from public.recipes where id=p_recipe and store_id=p_store;
  if not found then raise exception '이 매장의 메뉴가 아니에요'
    using errcode='42501',detail='STORE_SCOPE_MISMATCH'; end if;
  if p_price is null or p_price::text in ('NaN','Infinity','-Infinity') or p_price<0
     or p_price>90071992547409 then
    raise exception '판매가 범위를 확인해 주세요' using errcode='22023',detail='INVALID_SIMULATION_PRICE';
  end if;
  d:=public.store_local_date(p_store);
  result:=jsonb_build_object('contract_version',1,'store_id',p_store,'recipe_id',p_recipe,
    'input_price',p_price,'local_date',d,'base_servings',r.base_servings,
    'recipe_updated_at',r.updated_at,'recommendation_status','not_supported');
  select * into m from public.store_market_profiles where store_id=p_store
    and effective_from<=d and (effective_to is null or d<=effective_to)
    order by effective_from desc limit 1;
  if not (public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean then reason:='disabled';
  elsif m.id is null then reason:='market_missing';
  end if;
  if reason is not null then return result||jsonb_build_object('status','unavailable','reason',reason,
    'context',null,'quote',null,'basis',null,'one',null,'batch',null); end if;
  minor:=public.international_currency_minor_unit(m.currency_code);
  if round(p_price,minor)<>p_price then raise exception '통화 소수 자릿수를 확인해 주세요'
    using errcode='22023',detail='INVALID_SIMULATION_PRICE_PRECISION'; end if;
  select * into t from public.store_tax_profiles where store_id=p_store and market_profile_id=m.id
    and effective_from<=d and (effective_to is null or d<=effective_to)
    order by effective_from desc limit 1;
  if t.id is null then return result||jsonb_build_object('status','unavailable','reason','tax_missing',
    'context',null,'quote',null,'basis',null,'one',null,'batch',null); end if;
  -- The existing private quote helper owns the protected activation boundary.
  -- Do not grant this facade/executor direct access to the boundary table.
  q:=public.recipe_tax_quote_for_price(p_recipe,d,p_price);
  if q is null then return result||jsonb_build_object('status','unavailable','reason','not_active',
    'context',null,'quote',null,'basis',null,'one',null,'batch',null); end if;
  select * into o from public.menu_tax_overrides where recipe_id=p_recipe and tax_profile_id=t.id
    and effective_from<=d order by effective_from desc limit 1;
  if o.tax_category is not null then
    select c.treatment into treatment from public.tax_category_catalog c
      where c.tax_profile_id=t.id and c.code=o.tax_category and c.active;
  else treatment:=coalesce(o.treatment,t.default_treatment); end if;
  if treatment is null then raise exception '현재 메뉴 과세 설정을 확인해 주세요'
    using errcode='45013',detail='TAX_TREATMENT_NOT_AVAILABLE'; end if;
  context:=jsonb_build_object('market_id',m.id,'market_revision',m.revision,'country_code',m.country_code,
    'currency_code',m.currency_code,'business_locale_code',m.business_locale_code,'minor_unit',minor,
    'price_basis',m.price_basis,'tax_profile_id',t.id,'tax_profile_revision',t.revision,
    'treatment',treatment,'tax_category',o.tax_category,'override_revision',coalesce(o.revision,0),
    'sales_channel_code','hall');
  select coalesce(jsonb_agg(n.ingredient_id order by n.ingredient_id),'[]') into missing
    from public.recipe_ingredient_needs(p_recipe,1) n where public.base_unit_price(n.ingredient_id) is null;
  material:=case when jsonb_array_length(missing)=0 then public.recipe_material_cost(p_recipe) else null end;
  select coalesce(sum(amount_per_serving),0) into extra from public.recipe_extra_costs where recipe_id=p_recipe;
  rate:=public.fixed_cost_rate(p_store,to_char(d,'YYYY-MM'));
  select f.total_revenue,coalesce((select sum((x->>'total')::numeric) from jsonb_array_elements(f.items) x),0)
    into revenue,fixed_total from public.fixed_costs_monthly f where f.store_id=p_store and f.month=to_char(d,'YYYY-MM');
  fixed:=rate*p_price;
  profit:=(q->>'net_sales')::numeric-material-extra-fixed;
  foreach mode in array array['one','batch'] loop
    n:=case when mode='one' then 1 else r.base_servings end;
    rows:=rows||jsonb_build_object(mode,jsonb_build_object('servings',n,
      'listed_total',p_price*n,'tax',(q->>'tax_total')::numeric*n,
      'net_sales',(q->>'net_sales')::numeric*n,'customer_total',(q->>'customer_total')::numeric*n,
      'material',material*n,'extra',extra*n,'fixed',fixed*n,'profit',profit*n,
      'profit_rate',profit/nullif(p_price,0),'meets_target',profit/nullif(p_price,0)>=r.target_profit_rate/100));
  end loop;
  return result||rows||jsonb_build_object('status','ready','reason',null,'context',context,'quote',q,
    'basis',jsonb_build_object('material_per_serving',material,'extra_per_serving',extra,
      'missing_ingredient_price_ids',missing,'fixed_month',to_char(d,'YYYY-MM'),'fixed_revenue',revenue,
      'fixed_total',fixed_total,'fixed_rate',rate,'target_profit_rate',r.target_profit_rate,
      'profit_rate_denominator','listed_total','batch_basis','per_serving_comparison'));
end $f$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_price_simulation(uuid,uuid,numeric) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.recipe_price_simulation(uuid,uuid,numeric) from public,anon,service_role;
grant execute on function public.recipe_price_simulation(uuid,uuid,numeric) to authenticated;
comment on function public.recipe_price_simulation(uuid,uuid,numeric) is
  'Current-date hall price simulation; input price only, no recipe or ledger writes. Batch compares per-serving results.';
select public.assert_no_rpc_overloads();
commit;
