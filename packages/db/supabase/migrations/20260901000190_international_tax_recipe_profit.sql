-- 0190 · INTL-1F 현재 레시피 손익도 국제 세금 권위 사용
--
-- 판매 저장만 새 세액을 쓰고 레시피 목록·손익 추이가 tax_of()를 계속 쓰면 같은 메뉴의
-- 현재 손익이 화면마다 갈린다. 활성일 이후 현재/해당일 quote를 한 내부 함수로 만들고
-- 목록과 E3/E4 재계산이 그 net_sales·tax_total을 함께 사용하게 한다.

begin;

create or replace function public.current_recipe_tax_quote(p_recipe uuid,p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipe public.recipes%rowtype;
  v_market public.store_market_profiles%rowtype;
  v_tax public.store_tax_profiles%rowtype;
  v_override public.menu_tax_overrides%rowtype;
  v_boundary date;
  v_treatment public.tax_treatment;
  v_components jsonb;
begin
  select * into v_recipe from public.recipes where id=p_recipe;
  if v_recipe.id is null or p_date is null then return null; end if;
  if not (public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean then return null; end if;
  select activation_date into v_boundary from public.international_tax_activation_boundaries
   where store_id=v_recipe.store_id;
  if v_boundary is null or p_date<v_boundary then return null; end if;

  select * into v_market from public.store_market_profiles m
   where m.store_id=v_recipe.store_id and p_date>=m.effective_from
     and (m.effective_to is null or p_date<=m.effective_to)
   order by m.effective_from desc limit 1;
  if v_market.id is null then return null; end if;
  select * into v_tax from public.store_tax_profiles t
   where t.store_id=v_recipe.store_id and t.market_profile_id=v_market.id
     and p_date>=t.effective_from and (t.effective_to is null or p_date<=t.effective_to)
   order by t.effective_from desc limit 1;
  if v_tax.id is null then return null; end if;

  select * into v_override from public.menu_tax_overrides o
   where o.recipe_id=p_recipe and o.tax_profile_id=v_tax.id
     and o.effective_from<=p_date
   order by o.effective_from desc limit 1;
  if v_override.tax_category is not null then
    select treatment into v_treatment from public.tax_category_catalog c
     where c.tax_profile_id=v_tax.id and c.code=v_override.tax_category and c.active;
  else
    v_treatment:=coalesce(v_override.treatment,v_tax.default_treatment);
  end if;
  if v_treatment is null then
    raise exception '메뉴의 과세 상태를 확정할 수 없어요'
      using errcode='45013',detail='TAX_TREATMENT_NOT_AVAILABLE';
  end if;
  select jsonb_agg(jsonb_build_object(
    'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
    'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
    'applies_to_treatments',to_jsonb(c.applies_to_treatments),
    'remittance_owner',r.remittance_owner) order by c.sort_order,c.id)
    into v_components from public.store_tax_components c
    join public.channel_tax_remittance r on r.tax_component_id=c.id
      and r.store_id=c.store_id and r.sales_channel_code='hall'
   where c.tax_profile_id=v_tax.id;
  if v_components is null then
    raise exception '메뉴 세금 구성 항목이 완결되지 않았어요'
      using errcode='45013',detail='TAX_PROFILE_INCOMPLETE';
  end if;
  return public.calculate_international_tax(
    v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
    v_treatment,v_recipe.price,v_components);
end
$$;

revoke execute on function public.current_recipe_tax_quote(uuid,date)
  from public,anon,authenticated,service_role;
grant execute on function public.current_recipe_tax_quote(uuid,date) to margincook_rpc_executor;

create or replace function public.recipe_list(p_store uuid)
returns table(id uuid,name text,price numeric,tax_mode tax_mode,base_servings integer,
  target_profit_rate numeric,avg_monthly_sales numeric,active boolean,category_id uuid,
  category_name text,material_cost numeric,extra_cost numeric,tax numeric,fixed_cost numeric,
  profit numeric,profit_rate numeric,material_rate numeric,unknown_cost_lines integer,blocked_by text)
language sql
stable security definer
set search_path to 'public','pg_temp'
as $$
  with base as (
    select r.*,c.name cat_name,public.recipe_material_cost(r.id) mat,
      coalesce((select sum(amount_per_serving) from public.recipe_extra_costs ec where ec.recipe_id=r.id),0) ext,
      coalesce((iq.quote->>'tax_total')::numeric,public.tax_of(r.price,r.tax_mode,r.tax_items)) tx,
      coalesce((iq.quote->>'net_sales')::numeric,r.price-public.tax_of(r.price,r.tax_mode,r.tax_items)) net,
      coalesce(public.fixed_cost_rate(r.store_id,public.store_local_month(r.store_id)),0) rate,
      (select count(*)::int from public.recipe_lines l where l.recipe_id=r.id
        and l.ingredient_id is not null and public.base_unit_price(l.ingredient_id) is null) unknown_lines,
      public.recipe_blocked_by(r.id) blocked
    from public.recipes r left join public.categories c on c.id=r.category_id
    left join lateral (select public.current_recipe_tax_quote(
      r.id,public.store_local_date(r.store_id)) quote) iq on true
    where r.store_id=p_store)
  select b.id,b.name,b.price,b.tax_mode,b.base_servings,b.target_profit_rate,b.avg_monthly_sales,
    coalesce(b.active,true),b.category_id,b.cat_name,b.mat,b.ext,b.tx,b.rate*b.price,
    b.net-b.mat-b.ext-(b.rate*b.price),
    case when b.price>0 then (b.net-b.mat-b.ext-(b.rate*b.price))/b.price else 0 end,
    case when b.price>0 then b.mat/b.price else 0 end,b.unknown_lines,b.blocked
  from base b order by coalesce(b.active,true) desc,b.name
$$;

-- 손익 추이도 같은 quote를 써야 레시피 목록과 다음 원가/고정비 변경점이 갈리지 않는다.
do $recompute$
declare v_def text;v_new text;
begin
  v_def:=pg_get_functiondef('public.recompute_recipe(uuid,trend_cause,date,uuid)'::regprocedure);
  v_new:=replace(v_def,
    '  v_tax      numeric;',
    '  v_tax      numeric;' || chr(10) ||
    '  v_net      numeric;' || chr(10) ||
    '  v_quote    jsonb;');
  v_new:=replace(v_new,$old$  v_tax := tax_of(r.price, r.tax_mode, r.tax_items);$old$,$new$  v_quote := public.current_recipe_tax_quote(p_recipe,v_day);
  v_tax := coalesce((v_quote->>'tax_total')::numeric,tax_of(r.price,r.tax_mode,r.tax_items));
  v_net := coalesce((v_quote->>'net_sales')::numeric,r.price-v_tax);$new$);
  v_new:=replace(v_new,$old$  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;$old$,$new$  v_profit := v_net - v_material - v_extra - v_fixed;$new$);
  if v_new=v_def
     or position('v_quote    jsonb' in v_new)=0
     or position('v_quote := public.current_recipe_tax_quote' in v_new)=0
     or position('v_profit := v_net - v_material' in v_new)=0 then
    raise exception '0190: recompute_recipe 국제 손익 조각을 모두 교체하지 못했습니다';
  end if;
  execute v_new;
end
$recompute$;

comment on function public.current_recipe_tax_quote(uuid,date) is
  'INTL-1F 활성일과 해당일 프로필을 사용한 레시피 현재 세금·순매출 DB numeric quote. 활성 전은 null이다.';
comment on function public.recipe_list(uuid) is
  '레시피 목록 권위. 국제 활성일 이후 tax_total과 net_sales는 current_recipe_tax_quote를 사용한다.';

do $verify$
declare v text;
begin
  v:=lower(pg_get_functiondef('public.recipe_list(uuid)'::regprocedure));
  if position('current_recipe_tax_quote' in v)=0 or position('b.net-b.mat' in v)=0 then
    raise exception '0190: recipe_list가 국제 순매출을 쓰지 않습니다';
  end if;
  v:=lower(pg_get_functiondef('public.recompute_recipe(uuid,trend_cause,date,uuid)'::regprocedure));
  if position('current_recipe_tax_quote' in v)=0 or position('v_profit := v_net' in v)=0 then
    raise exception '0190: recompute_recipe가 국제 순매출을 쓰지 않습니다';
  end if;
  if has_function_privilege('authenticated','public.current_recipe_tax_quote(uuid,date)','execute') then
    raise exception '0190: 레시피 국제 세금 몸통이 앱에 직접 열렸습니다';
  end if;
end
$verify$;

commit;
