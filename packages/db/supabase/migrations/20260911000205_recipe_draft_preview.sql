-- 0205: Read-only draft quote and minimum target-price recommendation.
begin;
do $acl$ begin
 if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
  raise exception 'Preview requires executor schema CREATE closed'; end if;
end $acl$;
-- This private definer alone reads the protected activation boundary. Its owner is
-- postgres, like recipe_tax_quote_for_price; no table grants are broadened.
create function public.recipe_draft_preview_internal(p_store uuid,p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $f$
declare
 m public.store_market_profiles; t public.store_tax_profiles; o public.menu_tax_overrides;
 d date; boundary date; v_recipe_id uuid; treatment public.tax_treatment; components jsonb;
 context jsonb; q jsonb; x jsonb; result jsonb; rows jsonb:='{}'; reason text;
 price numeric; servings integer; target numeric; minor smallint; material numeric:=0; extra numeric:=0;
 unit_price numeric; qty numeric; cost numeric; missing jsonb:='[]'; missing_extra jsonb:='[]';
 rate numeric; revenue numeric; fixed_total numeric; fixed numeric; profit numeric; n integer; mode text;
 rec jsonb; rq jsonb; step numeric; high numeric; max_units numeric; margin numeric; required numeric; next_units numeric;
 rec_price numeric; rec_profit numeric; rec_ok boolean:=false; i integer;
begin
 perform public.assert_my_store(p_store);
 if auth.uid() is null then raise exception '인증이 필요합니다' using errcode='42501'; end if;
 if jsonb_typeof(p_input) is distinct from 'object'
   or not (p_input ?& array['recipe_id','price','base_servings','target_profit_rate','lines','extras'])
   or exists(select 1 from jsonb_object_keys(p_input) k where k not in
     ('recipe_id','price','base_servings','target_profit_rate','lines','extras')) then
   raise exception '초안 입력 형식을 확인해 주세요' using errcode='22023'; end if;
 if jsonb_typeof(p_input->'recipe_id') not in ('null','string')
   or (p_input->>'recipe_id' is not null and p_input->>'recipe_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') then
   raise exception '메뉴 식별자를 확인해 주세요' using errcode='22023'; end if;
 v_recipe_id:=(p_input->>'recipe_id')::uuid;
 if v_recipe_id is not null and not exists(select 1 from public.recipes r where r.id=v_recipe_id and r.store_id=p_store) then
   raise exception '이 매장의 메뉴가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH'; end if;
 foreach mode in array array['price','base_servings','target_profit_rate'] loop
   if jsonb_typeof(p_input->mode) is distinct from 'number' then
     raise exception '숫자 입력을 확인해 주세요' using errcode='22023'; end if;
   cost:=(p_input->>mode)::numeric;
   if cost::text in ('NaN','Infinity','-Infinity') or cost<0 or cost>90071992547409 then
     raise exception '숫자 범위를 확인해 주세요' using errcode='22023'; end if;
 end loop;
 price:=(p_input->>'price')::numeric; target:=(p_input->>'target_profit_rate')::numeric;
 cost:=(p_input->>'base_servings')::numeric;
 if cost<1 or cost>2147483647 or trunc(cost)<>cost or target>100 then
   raise exception '기준 인분과 목표를 확인해 주세요' using errcode='22023'; end if;
 servings:=cost::integer;
 foreach mode in array array['lines','extras'] loop
   if jsonb_typeof(p_input->mode) is distinct from 'array' then
     raise exception '구성은 배열이어야 합니다' using errcode='22023'; end if;
   if jsonb_array_length(p_input->mode)>500 then raise exception '구성이 너무 많아요' using errcode='22023'; end if;
   for x in select value from jsonb_array_elements(p_input->mode) loop
     if jsonb_typeof(x) is distinct from 'object' then raise exception '구성 형식을 확인해 주세요' using errcode='22023'; end if;
     if mode='lines' then
       if not(x ?& array['ingredient_id','input_qty']) or exists(select 1 from jsonb_object_keys(x) k where k not in ('ingredient_id','input_qty'))
         or jsonb_typeof(x->'ingredient_id') is distinct from 'string'
         or x->>'ingredient_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
         or jsonb_typeof(x->'input_qty') is distinct from 'number' then
         raise exception '재료 입력을 확인해 주세요' using errcode='22023'; end if;
       qty:=(x->>'input_qty')::numeric;
       if qty<0 or qty>90071992547409 then raise exception '재료량 범위를 확인해 주세요' using errcode='22023'; end if;
       if not exists(select 1 from public.ingredients a where a.id=(x->>'ingredient_id')::uuid and a.store_id=p_store) then
         raise exception '이 매장의 재료가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH'; end if;
       unit_price:=public.base_unit_price((x->>'ingredient_id')::uuid);
       if qty>0 and unit_price is null then missing:=missing||jsonb_build_array(x->>'ingredient_id');
       else material:=material+qty/servings*coalesce(unit_price,0); end if;
     else
       if not(x ?& array['material_id','qty','amount']) or exists(select 1 from jsonb_object_keys(x) k where k not in ('material_id','qty','amount'))
         or jsonb_typeof(x->'material_id') not in ('null','string')
         or (x->>'material_id' is not null and x->>'material_id' !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
         or jsonb_typeof(x->'qty') is distinct from 'number' or jsonb_typeof(x->'amount') is distinct from 'number' then
         raise exception '부자재 입력을 확인해 주세요' using errcode='22023'; end if;
       qty:=(x->>'qty')::numeric; cost:=(x->>'amount')::numeric;
       if qty<0 or qty>90071992547409 or cost<0 or cost>90071992547409 then
         raise exception '부자재 범위를 확인해 주세요' using errcode='22023'; end if;
       if x->>'material_id' is null then extra:=extra+cost; -- independent amount is already per serving
       else
         select a.unit_cost into unit_price from public.materials a where a.id=(x->>'material_id')::uuid and a.store_id=p_store;
         if not found then raise exception '이 매장의 부자재가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH'; end if;
         if qty>0 and unit_price is null then missing_extra:=missing_extra||jsonb_build_array(x->>'material_id');
         else extra:=extra+qty*coalesce(unit_price,0); end if;
       end if;
     end if;
   end loop;
 end loop;
 if jsonb_array_length(missing)>0 then material:=null; end if;
 if jsonb_array_length(missing_extra)>0 then extra:=null; end if;
 d:=public.store_local_date(p_store);
 result:=jsonb_build_object('contract_version',1,'actor_id',auth.uid(),'store_id',p_store,'input',p_input,'local_date',d);
 if not(public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean then reason:='disabled'; end if;
 select activation_date into boundary from public.international_tax_activation_boundaries where store_id=p_store;
 if reason is null and (boundary is null or d<boundary) then reason:='not_active'; end if;
 select * into m from public.store_market_profiles where store_id=p_store and effective_from<=d and (effective_to is null or d<=effective_to) order by effective_from desc limit 1;
 if reason is null and m.id is null then reason:='market_missing'; end if;
 select * into t from public.store_tax_profiles where store_id=p_store and market_profile_id=m.id and effective_from<=d and (effective_to is null or d<=effective_to) order by effective_from desc limit 1;
 if reason is null and t.id is null then reason:='tax_missing'; end if;
 if reason is not null then return result||jsonb_build_object('status','unavailable','reason',reason,'context',null,'quote',null,'basis',null,'one',null,'batch',null,'recommendation',null); end if;
 minor:=public.international_currency_minor_unit(m.currency_code);
 if round(price,minor)<>price then raise exception '통화 소수 자릿수를 확인해 주세요' using errcode='22023',detail='INVALID_SIMULATION_PRICE_PRECISION'; end if;
 select * into o from public.menu_tax_overrides where menu_tax_overrides.recipe_id=v_recipe_id and tax_profile_id=t.id and effective_from<=d order by effective_from desc limit 1;
 if o.tax_category is null then treatment:=coalesce(o.treatment,t.default_treatment);
 else select c.treatment into treatment from public.tax_category_catalog c where c.tax_profile_id=t.id and c.code=o.tax_category and c.active; end if;
 if treatment is null then raise exception '현재 과세 설정을 확인해 주세요' using errcode='45013',detail='TAX_TREATMENT_NOT_AVAILABLE'; end if;
 select jsonb_agg(jsonb_build_object('component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
   'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,'applies_to_treatments',to_jsonb(c.applies_to_treatments),
   'remittance_owner',a.remittance_owner) order by c.sort_order,c.id) into components
   from public.store_tax_components c join public.channel_tax_remittance a on a.tax_component_id=c.id and a.store_id=c.store_id and a.sales_channel_code='hall' where c.tax_profile_id=t.id;
 if components is null or jsonb_array_length(components)<>(select count(*) from public.store_tax_components where tax_profile_id=t.id) then raise exception '세금 구성 항목을 확인해 주세요' using errcode='45013',detail='TAX_PROFILE_INCOMPLETE'; end if;
 context:=jsonb_build_object('market_id',m.id,'market_revision',m.revision,'country_code',m.country_code,'currency_code',m.currency_code,
   'business_locale_code',m.business_locale_code,'minor_unit',minor,'price_basis',m.price_basis,'tax_profile_id',t.id,'tax_profile_revision',t.revision,
   'treatment',treatment,'tax_category',o.tax_category,'override_revision',coalesce(o.revision,0),'sales_channel_code','hall');
 q:=public.calculate_international_tax(m.price_basis,minor,treatment,price,components);
 rate:=public.fixed_cost_rate(p_store,to_char(d,'YYYY-MM'));
 select f.total_revenue,coalesce((select sum((a->>'total')::numeric) from jsonb_array_elements(f.items) a),0) into revenue,fixed_total
   from public.fixed_costs_monthly f where f.store_id=p_store and f.month=to_char(d,'YYYY-MM');
 fixed:=rate*price; profit:=(q->>'net_sales')::numeric-material-extra-fixed;
 foreach mode in array array['one','batch'] loop
   n:=case when mode='one' then 1 else servings end;
   rows:=rows||jsonb_build_object(mode,jsonb_build_object('servings',n,'listed_total',price*n,'tax',(q->>'tax_total')::numeric*n,
     'net_sales',(q->>'net_sales')::numeric*n,'customer_total',(q->>'customer_total')::numeric*n,
     'material',material*n,'extra',extra*n,'fixed',fixed*n,'profit',profit*n,'profit_rate',profit/nullif(price,0),'meets_target',case when price>0 then profit>=price*(target/100) else null end));
 end loop;
 rec:=jsonb_build_object('status','basis_missing','price',null,'quote',null,'profit',null,'profit_rate',null);
 if material is not null and extra is not null and rate is not null then
   -- Minimum positive minor-unit price. No extrapolated tax coefficient or
   -- assumed rounding error bound: tax_total(P) is nondecreasing for P>=0 under
   -- calculate_international_tax's nonnegative component rates and rounding.
   -- For failed P, every larger Q satisfies tax(Q)>=tax(P). Thus Q*margin <
   -- cost+tax(P) rules Q out. Exclusive prices use zero deducted tax.
   -- div plus an exact multiplication check computes a ceiling without rounded
   -- numeric division skipping the equality boundary. See MINIMUM-PROOF.md.
   step:=power(10::numeric,-minor); max_units:=90071992547409/step;
   cost:=material+extra; margin:=1-rate-target/100; high:=1;
   if margin>0 then
     high:=greatest(1,div(cost,margin*step));
     if high*margin*step<cost then high:=high+1; end if;
   end if;
   for i in 1..2048 loop
     exit when high>max_units;
     rec_price:=high*step;
     rq:=public.calculate_international_tax(m.price_basis,minor,treatment,rec_price,components);
     rec_profit:=(rq->>'net_sales')::numeric-material-extra-rate*rec_price;
     rec_ok:=rec_profit>=rec_price*(target/100);
     exit when rec_ok;
     -- With nonpositive margin, profit-target cannot improve as price rises.
     if margin<=0 then high:=max_units+1; exit; end if;
     required:=cost+case when m.price_basis='tax_inclusive' then (rq->>'tax_total')::numeric else 0 end;
     next_units:=div(required,margin*step);
     if next_units*margin*step<required then next_units:=next_units+1; end if;
     high:=greatest(high+1,next_units);
   end loop;
   if rec_ok then
     rec:=jsonb_build_object('status','ready','price',rec_price,'quote',rq,'profit',rec_profit,'profit_rate',rec_profit/rec_price);
   else rec:=jsonb_build_object('status',case when high>max_units then 'range_exhausted' else 'search_limit' end,
     'price',null,'quote',null,'profit',null,'profit_rate',null); end if;
 end if;
 return result||rows||jsonb_build_object('status','ready','reason',null,'context',context,'quote',q,'recommendation',rec,
   'basis',jsonb_build_object('material_per_serving',material,'extra_per_serving',extra,'missing_ingredient_price_ids',missing,
   'missing_material_price_ids',missing_extra,'fixed_month',to_char(d,'YYYY-MM'),'fixed_revenue',revenue,'fixed_total',fixed_total,
   'fixed_rate',rate,'target_profit_rate',target,'profit_rate_denominator','listed_total','batch_basis','per_serving_comparison'));
end $f$;
alter function public.recipe_draft_preview_internal(uuid,jsonb) owner to postgres;
revoke all on function public.recipe_draft_preview_internal(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recipe_draft_preview_internal(uuid,jsonb) to margincook_rpc_executor;

create function public.recipe_draft_preview(p_store uuid,p_input jsonb)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $f$
 select public.recipe_draft_preview_internal(p_store,p_input);
$f$;
create function public.recipe_price_recommendation(p_store uuid,p_recipe uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $f$
declare r public.recipes; body jsonb;
begin
 perform public.assert_my_store(p_store);
 select * into r from public.recipes where id=p_recipe and store_id=p_store;
 if not found then raise exception '이 매장의 메뉴가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH'; end if;
 body:=jsonb_build_object('recipe_id',r.id,'price',r.price,'base_servings',r.base_servings,'target_profit_rate',r.target_profit_rate,
   'lines',coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',l.ingredient_id,'input_qty',l.input_qty) order by l.id) from public.recipe_lines l where l.recipe_id=r.id),'[]'::jsonb),
   'extras',coalesce((select jsonb_agg(jsonb_build_object('material_id',e.material_id,'qty',e.qty,'amount',e.amount_per_serving) order by e.id) from public.recipe_extra_costs e where e.recipe_id=r.id),'[]'::jsonb));
 return public.recipe_draft_preview(p_store,body);
end $f$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_draft_preview(uuid,jsonb) owner to margincook_rpc_executor;
alter function public.recipe_price_recommendation(uuid,uuid) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.recipe_draft_preview(uuid,jsonb),public.recipe_price_recommendation(uuid,uuid) from public,anon,service_role;
grant execute on function public.recipe_draft_preview(uuid,jsonb),public.recipe_price_recommendation(uuid,uuid) to authenticated;
-- Align the existing simulation facade with the audited executor search-path contract.
alter function public.recipe_price_simulation(uuid,uuid,numeric) set search_path=public,pg_temp;
select public.assert_no_rpc_overloads();
commit;
