-- 0188 · INTL-1F 국제 세금 확정값을 기존 손익·기타매출 장부에 연결
--
-- 국제 snapshot만 만들고 daily_sales_items.unit_tax / daily_sales.etc_tax를
-- legacy 값으로 남기면 손익 RPC가 서로 다른 세금을 읽는다. 활성일 이후에는 국제
-- 계산값을 기존 합계 열에도 투영해 모든 기존 손익 조회가 같은 DB 권위를 보게 한다.

begin;

alter table public.daily_sales
  add column etc_tax_snapshot jsonb;
comment on column public.daily_sales.etc_tax_snapshot is
  '활성일 이후 기타매출의 항목별 국제 세금 입력·확정 금액 snapshot. 과거 legacy 행은 null이다.';

-- 0181 계산 몸통이 만든 채널별 확정 세액을 기존 손익 합계 열에 정확히 투영한다.
-- 세 채널의 반올림 합계를 총수량으로 나눈 값이므로 기존 unit_tax×수량 집계도 같은 합계다.
create or replace function public.apply_international_tax_for_sales_item(
  p_sales_item uuid,p_force boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap jsonb:=public.app_capabilities();
  v_test boolean:=session_user='postgres'
    and current_setting('margincook.international_tax_force',true) is not distinct from 'owner_test'
    and current_setting('margincook.international_tax_activation_test',true) is not distinct from 'on';
  v_store uuid;
  v_date date;
  v_boundary date;
  v_result jsonb;
  v_qty numeric;
  v_tax numeric;
begin
  if p_force and not v_test then
    v_result:=public.apply_international_tax_for_sales_item_body(p_sales_item,true);
  else
    if not (v_cap#>>'{international_tax,write_enabled}')::boolean and not v_test then
      return jsonb_build_object('enabled',false,'changed',false,'lines','[]'::jsonb);
    end if;
    select i.store_id,d.sale_date into v_store,v_date
      from public.daily_sales_items i join public.daily_sales d on d.id=i.daily_sales_id
     where i.id=p_sales_item;
    if v_store is null then
      raise exception '국제 세금 계산의 판매행을 찾을 수 없어요'
        using errcode='22000',detail='SALES_ITEM_NOT_FOUND';
    end if;
    select activation_date into v_boundary
      from public.international_tax_activation_boundaries where store_id=v_store;
    if v_boundary is null then
      raise exception '국제 세금 활성 경계를 찾을 수 없어요'
        using errcode='45013',detail='ACTIVATION_BOUNDARY_NOT_AVAILABLE';
    end if;
    if v_date<v_boundary then
      return jsonb_build_object('enabled',true,'changed',false,
        'reason','before_activation','activation_date',v_boundary,'lines','[]'::jsonb);
    end if;
    v_result:=public.apply_international_tax_for_sales_item_body(p_sales_item,p_force or v_test);
  end if;

  select coalesce(sum(s.final_quantity),0),coalesce(sum(s.tax_total),0)
    into v_qty,v_tax
    from public.daily_sales_item_tax_snapshots s
   where s.daily_sales_item_id=p_sales_item;
  if v_qty>0 then
    update public.daily_sales_items
       set unit_tax=v_tax/v_qty,
           unit_tax_calculation_version='international_tax_v1'
     where id=p_sales_item
       and (unit_tax is distinct from v_tax/v_qty
         or unit_tax_calculation_version is distinct from 'international_tax_v1');
  elsif exists(select 1 from public.daily_sales_item_tax_snapshots s
                where s.daily_sales_item_id=p_sales_item) then
    update public.daily_sales_items
       set unit_tax=0,unit_tax_calculation_version='international_tax_v1'
     where id=p_sales_item
       and (unit_tax is distinct from 0
         or unit_tax_calculation_version is distinct from 'international_tax_v1');
  end if;
  return v_result||jsonb_build_object('legacy_tax_total',v_tax);
end
$$;

-- 기타매출은 메뉴가 없어 daily_sales_item snapshot을 쓸 수 없다. 한 장부의 항목을
-- 채널별로 같은 국제 계산기에 넣고, 결과와 프로필 판본을 daily_sales에 함께 굳힌다.
create or replace function public.apply_international_tax_for_daily_sales(p_sales uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap jsonb:=public.app_capabilities();
  v_test boolean:=session_user='postgres'
    and current_setting('margincook.international_tax_force',true) is not distinct from 'owner_test'
    and current_setting('margincook.international_tax_activation_test',true) is not distinct from 'on';
  v_sales public.daily_sales%rowtype;
  v_market public.store_market_profiles%rowtype;
  v_profile public.store_tax_profiles%rowtype;
  v_boundary date;
  v_item jsonb;
  v_channel public.international_sales_channel_code;
  v_components jsonb;
  v_quote jsonb;
  v_lines jsonb:='[]'::jsonb;
  v_total numeric:=0;
  v_price numeric;
  v_qty numeric;
begin
  if not (v_cap#>>'{international_tax,write_enabled}')::boolean and not v_test then
    return jsonb_build_object('enabled',false,'changed',false);
  end if;
  select * into v_sales from public.daily_sales where id=p_sales for update;
  if v_sales.id is null then
    raise exception '기타매출 장부를 찾을 수 없어요'
      using errcode='22000',detail='DAILY_SALES_NOT_FOUND';
  end if;
  select activation_date into v_boundary
    from public.international_tax_activation_boundaries where store_id=v_sales.store_id;
  if v_boundary is null then
    raise exception '국제 세금 활성 경계를 찾을 수 없어요'
      using errcode='45013',detail='ACTIVATION_BOUNDARY_NOT_AVAILABLE';
  end if;
  if v_sales.sale_date<v_boundary then
    return jsonb_build_object('enabled',true,'changed',false,'reason','before_activation');
  end if;
  select * into v_market from public.store_market_profiles m
   where m.store_id=v_sales.store_id and v_sales.sale_date>=m.effective_from
     and (m.effective_to is null or v_sales.sale_date<=m.effective_to);
  select * into v_profile from public.store_tax_profiles t
   where t.store_id=v_sales.store_id and t.market_profile_id=v_market.id
     and v_sales.sale_date>=t.effective_from
     and (t.effective_to is null or v_sales.sale_date<=t.effective_to);
  if v_market.id is null or v_profile.id is null then
    raise exception '기타매출 판매일의 국제 세금 프로필을 찾을 수 없어요'
      using errcode='45013',detail='TAX_PROFILE_NOT_AVAILABLE';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(v_sales.etc_items,'[]'::jsonb)) loop
    begin
      v_price:=coalesce((v_item->>'price')::numeric,0);
      v_qty:=coalesce((v_item->>'qty')::numeric,1);
      v_channel:=coalesce(v_item->>'channel','hall')::public.international_sales_channel_code;
    exception when others then
      raise exception '기타매출 세금 입력이 올바르지 않아요'
        using errcode='22000',detail='INVALID_ETC_TAX_INPUT';
    end;
    if v_price<0 or v_qty<0 then
      raise exception '기타매출 금액과 수량은 음수일 수 없어요'
        using errcode='22000',detail='INVALID_ETC_TAX_INPUT';
    end if;
    select jsonb_agg(jsonb_build_object(
      'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
      'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
      'applies_to_treatments',to_jsonb(c.applies_to_treatments),
      'remittance_owner',r.remittance_owner) order by c.sort_order,c.id)
      into v_components
      from public.store_tax_components c
      join public.channel_tax_remittance r on r.tax_component_id=c.id
        and r.store_id=c.store_id and r.sales_channel_code=v_channel
     where c.tax_profile_id=v_profile.id;
    if v_components is null then
      raise exception '기타매출 세금 구성 항목이 완결되지 않았어요'
        using errcode='45013',detail='TAX_PROFILE_INCOMPLETE';
    end if;
    v_quote:=public.calculate_international_tax(
      v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
      v_profile.default_treatment,v_price*v_qty,v_components);
    v_total:=v_total+(v_quote->>'tax_total')::numeric;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'name',coalesce(v_item->>'name','기타 매출'),'channel',v_channel,
      'price',v_price,'quantity',v_qty,'quote',v_quote));
  end loop;

  update public.daily_sales
     set etc_tax=v_total,etc_tax_calculation_version='international_tax_v1',
         etc_tax_snapshot=jsonb_build_object(
           'calculation_version','international_tax_v1',
           'market_profile_id',v_market.id,'market_profile_revision',v_market.revision,
           'tax_profile_id',v_profile.id,'tax_profile_revision',v_profile.revision,
           'country_code',v_market.country_code,'region_code',v_market.region_code,
           'currency_code',v_market.currency_code,'minor_unit',public.international_currency_minor_unit(v_market.currency_code),
           'price_basis',v_market.price_basis,'treatment',v_profile.default_treatment,
           'lines',v_lines,'tax_total',v_total)
   where id=v_sales.id
     and (etc_tax is distinct from v_total
       or etc_tax_calculation_version is distinct from 'international_tax_v1'
       or etc_tax_snapshot is distinct from jsonb_build_object(
           'calculation_version','international_tax_v1',
           'market_profile_id',v_market.id,'market_profile_revision',v_market.revision,
           'tax_profile_id',v_profile.id,'tax_profile_revision',v_profile.revision,
           'country_code',v_market.country_code,'region_code',v_market.region_code,
           'currency_code',v_market.currency_code,'minor_unit',public.international_currency_minor_unit(v_market.currency_code),
           'price_basis',v_market.price_basis,'treatment',v_profile.default_treatment,
           'lines',v_lines,'tax_total',v_total));
  return jsonb_build_object('enabled',true,'changed',found,'tax_total',v_total,'lines',v_lines);
end
$$;

create or replace function public.reconcile_international_tax_after_daily_sales()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.apply_international_tax_for_daily_sales(new.id);
  return new;
end
$$;
create trigger daily_sales_80_international_etc_tax
after insert or update of etc_items,etc_revenue on public.daily_sales
for each row execute function public.reconcile_international_tax_after_daily_sales();

-- 읽기 계약에 구성 안정 키를 빠뜨리면 앱이 저장할 판본을 재구성할 수 없다.
do $state_contract$
declare v_def text;v_new text;
begin
  v_def:=pg_get_functiondef('public.international_tax_app_state(uuid)'::regprocedure);
  v_new:=replace(v_def,$old$'id',c.id,'kind'$old$,$new$'id',c.id,'config_key',c.config_key,'kind'$new$);
  if v_new=v_def then
    raise exception '0188: international_tax_app_state 구성 키 응답을 찾지 못했습니다';
  end if;
  execute v_new;
end
$state_contract$;

-- 메뉴 현재 손익은 앱이 세율을 다시 계산하지 않도록 같은 DB numeric 계산의 quote를 준다.
create or replace function public.recipe_tax_app_state(p_store uuid,p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market public.store_market_profiles%rowtype;
  v_tax public.store_tax_profiles%rowtype;
  v_override public.menu_tax_overrides%rowtype;
  v_treatment public.tax_treatment;
  v_category text;
  v_components jsonb;
  v_price numeric;
  v_quote jsonb;
begin
  perform public.assert_my_store(p_store);
  select price into v_price from public.recipes where id=p_recipe and store_id=p_store;
  if not found then
    raise exception '이 매장의 메뉴가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH';
  end if;
  select * into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_market.id is not null then
    select * into v_tax from public.store_tax_profiles
     where store_id=p_store and market_profile_id=v_market.id and effective_to is null
     order by effective_from desc limit 1;
  end if;
  if v_tax.id is not null then
    select * into v_override from public.menu_tax_overrides
     where recipe_id=p_recipe and tax_profile_id=v_tax.id;
    v_category:=v_override.tax_category;
    if v_category is not null then
      select treatment into v_treatment from public.tax_category_catalog
       where tax_profile_id=v_tax.id and code=v_category and active;
    else
      v_treatment:=coalesce(v_override.treatment,v_tax.default_treatment);
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
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),'tax_profile_id',v_tax.id,
    'tax_profile_revision',v_tax.revision,'default_treatment',v_tax.default_treatment,
    'override_revision',coalesce(v_override.revision,0),
    'tax_category',v_category,'treatment',v_override.treatment,
    'currency_code',v_market.currency_code,'minor_unit',
      case when v_market.id is null then null else public.international_currency_minor_unit(v_market.currency_code) end,
    'price_basis',v_market.price_basis,'quote',v_quote,
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'name',c.name,'treatment',c.treatment) order by c.code)
      from public.tax_category_catalog c where c.tax_profile_id=v_tax.id and c.active),'[]'::jsonb));
end
$$;

revoke execute on function public.apply_international_tax_for_daily_sales(uuid),
  public.reconcile_international_tax_after_daily_sales()
  from public,anon,authenticated,service_role,margincook_rpc_executor;

comment on function public.apply_international_tax_for_daily_sales(uuid) is
  'INTL-1F 활성일 이후 기타매출 항목을 국제 세금 공식으로 계산해 합계와 입력·프로필 snapshot을 함께 굳힌다.';
comment on function public.recipe_tax_app_state(uuid,uuid) is
  'INTL-1F 메뉴 과세 판본과 DB numeric 현재 가격 quote를 함께 반환해 앱의 세금 재계산을 막는다.';

do $verify$
declare v text;
begin
  if (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0188: 권위 연결 단계에서 capability를 켰습니다';
  end if;
  v:=lower(pg_get_functiondef('public.international_tax_app_state(uuid)'::regprocedure));
  if position('config_key' in v)=0 then
    raise exception '0188: 앱 세금 프로필 응답에 구성 안정 키가 없습니다';
  end if;
  v:=lower(pg_get_functiondef('public.apply_international_tax_for_sales_item(uuid,boolean)'::regprocedure));
  if position('unit_tax_calculation_version' in v)=0 then
    raise exception '0188: 국제 메뉴 세금이 기존 손익 합계 열에 연결되지 않았습니다';
  end if;
  if has_function_privilege('authenticated','public.apply_international_tax_for_daily_sales(uuid)','execute') then
    raise exception '0188: 기타매출 국제 세금 몸통이 앱에 직접 열렸습니다';
  end if;
end
$verify$;

commit;
