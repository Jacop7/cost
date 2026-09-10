-- 0201 · 예약 편집 대상은 유지하고 현재 가격 quote는 현지 날짜의 프로필로 계산한다.
-- 0188은 최신 예약 프로필의 구성 항목으로 오늘 quote까지 계산했다.
-- 0191의 기존 날짜별 권위를 재사용하며 RPC signature/owner/ACL은 바꾸지 않는다.
begin;

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
  v_before jsonb;
  v_after jsonb;
begin
  select jsonb_build_object('owner',proowner,'acl',proacl,'config',proconfig,
    'definer',prosecdef,'volatility',provolatile,'return_type',prorettype)
    into v_before from pg_proc where oid='public.recipe_tax_app_state(uuid,uuid)'::regprocedure;
  v_def:=replace(pg_get_functiondef('public.recipe_tax_app_state(uuid,uuid)'::regprocedure),chr(13),'');
  v_old:=$old$    select * into v_calc_override from public.menu_tax_overrides
     where recipe_id=p_recipe and tax_profile_id=v_tax.id
       and effective_from<=public.store_local_date(p_store)
     order by effective_from desc limit 1;
    v_category:=v_calc_override.tax_category;
    if v_category is not null then
      select treatment into v_treatment from public.tax_category_catalog
       where tax_profile_id=v_tax.id and code=v_category and active;
    else
      v_treatment:=coalesce(v_calc_override.treatment,v_tax.default_treatment);
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
    if v_components is not null then
      v_quote:=public.calculate_international_tax(
        v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
        v_treatment,v_price,v_components);
    end if;
$old$;
  if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then
    raise exception '0201: recipe_tax_app_state quote anchor must occur exactly once';
  end if;
  v_new:=replace(v_def,v_old,'');
  v_new:=replace(v_new,$old$  v_calc_override public.menu_tax_overrides%rowtype;
  v_treatment public.tax_treatment;
  v_category text;
  v_components jsonb;
$old$,'');
  v_old:='  return jsonb_build_object(';
  if (length(v_new)-length(replace(v_new,v_old,'')))/length(v_old)<>1 then
    raise exception '0201: recipe_tax_app_state response anchor must occur exactly once';
  end if;
  v_new:=replace(v_new,v_old,$new$  -- v_tax/v_override are the latest editable reservation. The quote is for today.
  v_quote:=public.current_recipe_tax_quote(p_recipe,public.store_local_date(p_store));
  return jsonb_build_object($new$);
  execute v_new;

  select jsonb_build_object('owner',proowner,'acl',proacl,'config',proconfig,
    'definer',prosecdef,'volatility',provolatile,'return_type',prorettype)
    into v_after from pg_proc where oid='public.recipe_tax_app_state(uuid,uuid)'::regprocedure;
  if v_before is distinct from v_after then
    raise exception '0201: recipe_tax_app_state execution contract changed';
  end if;
end
$patch$;

comment on function public.recipe_tax_app_state(uuid,uuid) is
  '예약 과세 편집 판본은 최신 행을 유지하고 현재 가격 quote는 매장 현지 날짜의 current_recipe_tax_quote를 반환한다.';

commit;
