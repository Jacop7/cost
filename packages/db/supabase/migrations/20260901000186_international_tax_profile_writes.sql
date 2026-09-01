-- 0186 · INTL-1F 국제 시장·세금·메뉴 과세 설정 쓰기 문
--
-- capability가 꺼진 동안에도 전체 쓰기 계약을 배포·시험할 수 있게 몸통을 완성하되,
-- 앱 요청은 write_enabled가 열리기 전까지 실패 폐쇄한다. 프로필은 다음 미개장
-- 영업일부터 새 판본으로 적용하고, 금액 원장이 생긴 매장의 시장 계약은 바꾸지 않는다.

begin;

alter table public.store_tax_components add column config_key text;

-- 0179의 판본 불변 트리거는 config_key 백필도 일반 수정으로 본다.
-- 배포 전 기존 자동 이관 프로필에 행이 있을 수 있으므로 이 일회성 백필만 명시적으로 연다.
alter table public.store_tax_components disable trigger store_tax_components_version_guard;
with numbered as (
  select id,
         case when kind='primary' then 'primary'
              else 'component_' || row_number() over (
                partition by tax_profile_id,kind order by sort_order,id) end as config_key
    from public.store_tax_components
)
update public.store_tax_components c set config_key=n.config_key
  from numbered n where n.id=c.id;
alter table public.store_tax_components enable trigger store_tax_components_version_guard;

alter table public.store_tax_components
  alter column config_key set not null,
  add constraint store_tax_components_config_key_ck
    check (config_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add constraint store_tax_components_profile_key_uniq unique (tax_profile_id,config_key);

alter table public.menu_tax_overrides
  add column effective_from date not null default '-infinity'::date;
alter table public.menu_tax_overrides
  drop constraint menu_tax_overrides_pkey,
  add primary key (recipe_id,tax_profile_id,effective_from);

-- 0181의 계산 몸통은 main·스테이징에 이미 존재하므로 제자리 수정하지 않는다.
-- 이 전진 migration에서 판매일 이하의 마지막 메뉴 예외만 고르도록 정의를 교체한다.
do $patch_sales_override_date$
declare v_def text;v_new text;
begin
  v_def:=replace(pg_get_functiondef(
    'public.apply_international_tax_for_sales_item(uuid,boolean)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id = v_item.recipe_id and o.tax_profile_id = v_profile.id;$old$,
    $new$      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id = v_item.recipe_id and o.tax_profile_id = v_profile.id
         and o.effective_from <= v_sales.sale_date
       order by o.effective_from desc limit 1;$new$);
  if v_new=v_def or position('o.effective_from <= v_sales.sale_date' in v_new)=0 then
    raise exception '0186: 판매 계산의 메뉴 과세 적용일 조각 교체 실패';
  end if;
  execute v_new;
end
$patch_sales_override_date$;

-- 0185 shadow도 0186 전에는 한 행뿐이라 적용일 열을 읽지 않는다. 열을 만든 뒤에만
-- 같은 판매일 선택 규칙으로 전진시켜 0185 단독 중간 상태도 실행 가능하게 유지한다.
do $patch_shadow_override_date$
declare v_def text;v_new text;
begin
  v_def:=replace(pg_get_functiondef(
    'public.international_tax_shadow_compare(uuid,date)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id=v_item.recipe_id and o.tax_profile_id=v_profile.id;$old$,
    $new$      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id=v_item.recipe_id and o.tax_profile_id=v_profile.id
         and o.effective_from<=p_date
       order by o.effective_from desc limit 1;$new$);
  if v_new=v_def or position('o.effective_from<=p_date' in v_new)=0 then
    raise exception '0186: shadow 계산의 메뉴 과세 적용일 조각 교체 실패';
  end if;
  execute v_new;
end
$patch_shadow_override_date$;

-- 0179의 스냅샷 출처 가드도 같은 메뉴 예외를 다시 읽는다. 계산 몸통만 고치면
-- 미래 적용 예외 또는 이력 2건 이상에서 계산과 가드가 서로 다른 행을 골라 판매를 막는다.
do $patch_snapshot_guard_override_date$
declare v_def text;v_new text;
begin
  v_def:=replace(pg_get_functiondef(
    'public.guard_sales_tax_snapshot_source()'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$      select * into o from public.menu_tax_overrides
       where recipe_id = i.recipe_id and tax_profile_id = new.tax_profile_id;$old$,
    $new$      select * into o from public.menu_tax_overrides
       where recipe_id = i.recipe_id and tax_profile_id = new.tax_profile_id
         and effective_from <= d.sale_date
       order by effective_from desc limit 1;$new$);
  if v_new=v_def or position('effective_from <= d.sale_date' in v_new)=0 then
    raise exception '0186: 판매 스냅샷 가드의 메뉴 과세 적용일 조각 교체 실패';
  end if;
  execute v_new;
end
$patch_snapshot_guard_override_date$;

alter table public.menu_tax_overrides
  add column revision integer not null default 1 check (revision > 0);

-- 메뉴 예외는 판매 스냅샷이 과거를 보존하므로 같은 세금 프로필 안에서 판본을 올려
-- 미래 판매만 바꾼다. updated_at만 허용하던 0179의 임시 봉인은 이 계약으로 교체한다.
drop trigger if exists menu_tax_overrides_90_version_guard on public.menu_tax_overrides;
drop function if exists public.guard_menu_tax_override_version_immutable();
-- 메뉴 예외는 프로필 정의 자체가 아니라 앞으로 생성할 판매 snapshot의 선택값이다.
-- 과거 snapshot은 이미 굳어 있으므로 프로필 사용 뒤에도 RPC를 통해 바꿀 수 있어야 한다.
drop trigger if exists menu_tax_overrides_membership_guard on public.menu_tax_overrides;

create or replace function public.next_unopened_business_date(p_store uuid)
returns date
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare v_date date := public.store_local_date(p_store) + 1;
begin
  while exists(select 1 from public.business_days d
                where d.store_id=p_store and d.business_date=v_date) loop
    v_date:=v_date+1;
  end loop;
  return v_date;
end
$$;

create or replace function public.store_has_money_ledger(p_store uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists(select 1 from public.daily_sales where store_id=p_store)
      or exists(select 1 from public.order_records where store_id=p_store)
      or exists(select 1 from public.fixed_costs_monthly where store_id=p_store)
      or exists(select 1 from public.price_trends where store_id=p_store)
      or exists(select 1 from public.profit_trends where store_id=p_store)
$$;

create or replace function public.assert_international_tax_write_enabled()
returns void
language plpgsql
stable
set search_path = pg_catalog, public
as $$
begin
  if not (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean
     and not (session_user='postgres'
       and current_setting('margincook.international_tax_force',true)
         is not distinct from 'owner_test') then
    raise exception '국제 세금 설정은 아직 사용할 수 없어요'
      using errcode='22000',detail='INTERNATIONAL_TAX_WRITE_DISABLED';
  end if;
end
$$;

create or replace function public.tax_profile_payload(p_profile uuid)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select case when t.id is null then null else jsonb_build_object(
    'default_treatment',t.default_treatment,
    'components',coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',c.config_key,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
        'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
        'applies_to_treatments',to_jsonb(c.applies_to_treatments),'sort_order',c.sort_order,
        'remittance',jsonb_build_object(
          'hall',(select r.remittance_owner from public.channel_tax_remittance r
                   where r.tax_component_id=c.id and r.sales_channel_code='hall'),
          'delivery',(select r.remittance_owner from public.channel_tax_remittance r
                       where r.tax_component_id=c.id and r.sales_channel_code='delivery'),
          'takeout',(select r.remittance_owner from public.channel_tax_remittance r
                      where r.tax_component_id=c.id and r.sales_channel_code='takeout')
        )) order by c.sort_order,c.config_key)
        from public.store_tax_components c where c.tax_profile_id=t.id),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',c.code,'name',c.name,'treatment',c.treatment,'active',c.active)
        order by c.code)
        from public.tax_category_catalog c where c.tax_profile_id=t.id),'[]'::jsonb)
  ) end
  from public.store_tax_profiles t where t.id=p_profile
$$;

create or replace function public.save_store_market_profile(
  p_store uuid,p_payload jsonb,p_base_profile_id uuid,p_base_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current public.store_market_profiles%rowtype;
  v_effective date;
  v_revision integer;
  v_new uuid;
  v_country public.international_country_code;
  v_region text;
  v_currency public.international_currency_code;
  v_locale public.business_locale_code;
  v_basis public.tax_price_basis;
  v_legacy_currency text;
begin
  perform public.assert_my_store(p_store);
  perform public.assert_international_tax_write_enabled();
  perform public.assert_write_app_version();
  perform public.lock_business_scope(p_store);

  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or (select count(*) from jsonb_object_keys(p_payload))<>5
     or not (p_payload ?& array['country_code','region_code','currency_code','business_locale_code','price_basis']) then
    raise exception '시장 설정의 형식이 올바르지 않아요'
      using errcode='22000',detail='INVALID_MARKET_PROFILE';
  end if;
  v_country:=(p_payload->>'country_code')::public.international_country_code;
  v_region:=nullif(btrim(p_payload->>'region_code'),'');
  v_currency:=(p_payload->>'currency_code')::public.international_currency_code;
  v_locale:=(p_payload->>'business_locale_code')::public.business_locale_code;
  v_basis:=(p_payload->>'price_basis')::public.tax_price_basis;
  if not ((v_country='KR' and v_currency='KRW' and v_locale='ko-KR')
       or (v_country='US' and v_currency='USD' and v_locale='en-US')
       or (v_country='GB' and v_currency='GBP' and v_locale='en-GB')
       or (v_country='AU' and v_currency='AUD' and v_locale='en-AU')
       or (v_country='CA' and v_currency='CAD' and v_locale='en-CA'))
     or (v_country in ('US','CA') and v_region is null)
     or (v_region is not null and not exists(select 1 from public.tax_region_catalog r
          where r.country_code=v_country and r.region_code=v_region and r.active)) then
    raise exception '국가·지역·통화·언어 조합이 올바르지 않아요'
      using errcode='22000',detail='INVALID_MARKET_PROFILE';
  end if;

  select * into v_current from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1 for update;
  if v_current.id is null then
    if p_base_profile_id is not null or p_base_revision is not null then
      raise exception '다른 기기에서 국가·통화 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    if public.store_has_money_ledger(p_store) then
      select currency into v_legacy_currency from public.settings where store_id=p_store;
      if v_legacy_currency is distinct from v_currency::text then
        raise exception '금액 기록이 있는 매장의 통화는 바꿀 수 없어요'
          using errcode='45017',detail='MONEY_LEDGER_EXISTS';
      end if;
    end if;
    v_revision:=1;
  else
    if p_base_profile_id is distinct from v_current.id
       or p_base_revision is distinct from v_current.revision then
      raise exception '다른 기기에서 국가·통화 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    if v_current.country_code=v_country
       and v_current.region_code is not distinct from v_region
       and v_current.currency_code=v_currency
       and v_current.business_locale_code=v_locale
       and v_current.price_basis=v_basis then
      return jsonb_build_object('changed',false,'profile_id',v_current.id,
        'revision',v_current.revision,'effective_from',v_current.effective_from);
    end if;
    if public.store_has_money_ledger(p_store) then
      raise exception '금액 기록이 있는 매장의 국가·통화 계약은 바꿀 수 없어요'
        using errcode='45017',detail='MONEY_LEDGER_EXISTS';
    end if;
    v_revision:=v_current.revision+1;
  end if;

  v_effective:=public.next_unopened_business_date(p_store);
  if v_current.id is not null then
    if v_current.effective_from>=v_effective and not exists(
      select 1 from public.daily_sales_item_tax_snapshots s where s.market_profile_id=v_current.id) then
      delete from public.store_tax_profiles where market_profile_id=v_current.id;
      delete from public.store_market_profiles where id=v_current.id;
    else
      update public.store_tax_profiles set effective_to=v_effective-1
       where market_profile_id=v_current.id and effective_to is null;
      update public.store_market_profiles set effective_to=v_effective-1 where id=v_current.id;
    end if;
  end if;

  insert into public.store_market_profiles(
    store_id,country_code,region_code,currency_code,business_locale_code,
    price_basis,effective_from,revision,created_by)
  values(p_store,v_country,v_region,v_currency,v_locale,v_basis,v_effective,v_revision,auth.uid())
  returning id into v_new;
  return jsonb_build_object('changed',true,'profile_id',v_new,
    'revision',v_revision,'effective_from',v_effective);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception '시장 설정 값이 올바르지 않아요'
    using errcode='22000',detail='INVALID_MARKET_PROFILE';
end
$$;

create or replace function public.save_store_tax_profile(
  p_store uuid,p_payload jsonb,p_base_profile_id uuid,p_base_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market public.store_market_profiles%rowtype;
  v_current public.store_tax_profiles%rowtype;
  v_effective date;
  v_revision integer;
  v_new uuid;
  v_component uuid;
  v_component_ids jsonb:='{}'::jsonb;
  v_row record;
  v_item jsonb;
  v_default public.tax_treatment;
  v_primary_count integer:=0;
  v_keys text[]:=array[]::text[];
  v_codes text[]:=array[]::text[];
  v_normalized jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.assert_international_tax_write_enabled();
  perform public.assert_write_app_version();
  perform public.lock_business_scope(p_store);

  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or (select count(*) from jsonb_object_keys(p_payload))<>3
     or not (p_payload ?& array['default_treatment','components','categories'])
     or jsonb_typeof(p_payload->'components')<>'array'
     or jsonb_typeof(p_payload->'categories')<>'array'
     or jsonb_array_length(p_payload->'components')=0 then
    raise exception '세금 설정의 형식이 올바르지 않아요'
      using errcode='22000',detail='INVALID_TAX_PROFILE';
  end if;
  v_default:=(p_payload->>'default_treatment')::public.tax_treatment;

  for v_row in select value item,ordinality pos from jsonb_array_elements(p_payload->'components') with ordinality loop
    v_item:=v_row.item;
    if jsonb_typeof(v_item)<>'object'
       or (select count(*) from jsonb_object_keys(v_item))<>9
       or not (v_item ?& array['key','kind','name','rate_pct','jurisdiction_level',
         'calculation_basis','applies_to_treatments','sort_order','remittance'])
       or coalesce(v_item->>'key','') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
       or btrim(coalesce(v_item->>'name',''))=''
       or jsonb_typeof(v_item->'rate_pct')<>'number'
       or (v_item->>'rate_pct')::numeric<0 or (v_item->>'rate_pct')::numeric>=100
       or jsonb_typeof(v_item->'sort_order')<>'number'
       or (v_item->>'sort_order')::numeric<>trunc((v_item->>'sort_order')::numeric)
       or jsonb_typeof(v_item->'applies_to_treatments')<>'array'
       or jsonb_array_length(v_item->'applies_to_treatments')=0
       or jsonb_typeof(v_item->'remittance')<>'object'
       or (select count(*) from jsonb_object_keys(v_item->'remittance'))<>3
       or not ((v_item->'remittance') ?& array['hall','delivery','takeout']) then
      raise exception '세금 구성 항목의 형식이 올바르지 않아요'
        using errcode='22000',detail='INVALID_TAX_COMPONENT';
    end if;
    perform (v_item->>'kind')::public.tax_component_kind,
            (v_item->>'jurisdiction_level')::public.tax_jurisdiction_level,
            (v_item->>'calculation_basis')::public.tax_calculation_basis;
    perform array(select jsonb_array_elements_text(v_item->'applies_to_treatments'))::public.tax_treatment[];
    perform (v_item#>>'{remittance,hall}')::public.tax_remittance_owner,
            (v_item#>>'{remittance,delivery}')::public.tax_remittance_owner,
            (v_item#>>'{remittance,takeout}')::public.tax_remittance_owner;
    if v_item->>'kind'='primary' then v_primary_count:=v_primary_count+1; end if;
    if (v_item->>'key')=any(v_keys) then
      raise exception '세금 구성 키가 중복됐어요' using errcode='22000',detail='DUPLICATE_TAX_COMPONENT_KEY';
    end if;
    v_keys:=v_keys||array[v_item->>'key'];
  end loop;
  if v_primary_count<>1 then
    raise exception '기본세는 정확히 하나여야 해요' using errcode='22000',detail='PRIMARY_TAX_REQUIRED';
  end if;

  for v_row in select value item from jsonb_array_elements(p_payload->'categories') loop
    v_item:=v_row.item;
    if jsonb_typeof(v_item)<>'object'
       or (select count(*) from jsonb_object_keys(v_item))<>4
       or not (v_item ?& array['code','name','treatment','active'])
       or coalesce(v_item->>'code','') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
       or btrim(coalesce(v_item->>'name',''))=''
       or jsonb_typeof(v_item->'active')<>'boolean' then
      raise exception '과세 카테고리 형식이 올바르지 않아요'
        using errcode='22000',detail='INVALID_TAX_CATEGORY';
    end if;
    perform (v_item->>'treatment')::public.tax_treatment;
    if (v_item->>'code')=any(v_codes) then
      raise exception '과세 카테고리 코드가 중복됐어요' using errcode='22000',detail='DUPLICATE_TAX_CATEGORY';
    end if;
    v_codes:=v_codes||array[v_item->>'code'];
  end loop;

  select * into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1 for update;
  if v_market.id is null then
    raise exception '국가·통화 설정을 먼저 저장해 주세요'
      using errcode='45013',detail='MARKET_PROFILE_NOT_AVAILABLE';
  end if;
  select * into v_current from public.store_tax_profiles
   where store_id=p_store and market_profile_id=v_market.id and effective_to is null
   order by effective_from desc limit 1 for update;
  if v_current.id is null then
    if p_base_profile_id is not null or p_base_revision is not null then
      raise exception '다른 기기에서 세금 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    v_revision:=1;
  else
    if p_base_profile_id is distinct from v_current.id
       or p_base_revision is distinct from v_current.revision then
      raise exception '다른 기기에서 세금 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    v_normalized:=jsonb_build_object(
      'default_treatment',v_default,
      'components',(select coalesce(jsonb_agg(x order by (x->>'sort_order')::integer,x->>'key'),'[]'::jsonb)
                      from jsonb_array_elements(p_payload->'components') x),
      'categories',(select coalesce(jsonb_agg(x order by x->>'code'),'[]'::jsonb)
                      from jsonb_array_elements(p_payload->'categories') x));
    if public.tax_profile_payload(v_current.id)=v_normalized then
      return jsonb_build_object('changed',false,'profile_id',v_current.id,
        'revision',v_current.revision,'effective_from',v_current.effective_from);
    end if;
    v_revision:=v_current.revision+1;
  end if;

  v_effective:=greatest(public.next_unopened_business_date(p_store),v_market.effective_from);
  if v_market.effective_to is not null and v_effective>v_market.effective_to then
    raise exception '시장 프로필 기간 안에 세금 설정을 적용할 수 없어요'
      using errcode='45018',detail='PROFILE_EFFECTIVE_FROM_INVALID';
  end if;
  if v_current.id is not null then
    if v_current.effective_from>=v_effective and not exists(
      select 1 from public.daily_sales_item_tax_snapshots s where s.tax_profile_id=v_current.id) then
      delete from public.store_tax_profiles where id=v_current.id;
    else
      update public.store_tax_profiles set effective_to=v_effective-1 where id=v_current.id;
    end if;
  end if;

  insert into public.store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from,revision,created_by)
  values(p_store,v_market.id,v_default,v_effective,v_revision,auth.uid()) returning id into v_new;

  for v_row in select value item from jsonb_array_elements(p_payload->'components') loop
    v_item:=v_row.item;
    insert into public.store_tax_components(
      store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
      calculation_basis,applies_to_treatments,sort_order)
    values(p_store,v_new,v_item->>'key',(v_item->>'kind')::public.tax_component_kind,
      btrim(v_item->>'name'),(v_item->>'rate_pct')::numeric,
      (v_item->>'jurisdiction_level')::public.tax_jurisdiction_level,
      (v_item->>'calculation_basis')::public.tax_calculation_basis,
      array(select jsonb_array_elements_text(v_item->'applies_to_treatments'))::public.tax_treatment[],
      (v_item->>'sort_order')::integer)
    returning id into v_component;
    v_component_ids:=jsonb_set(v_component_ids,array[v_item->>'key'],to_jsonb(v_component::text),true);
    insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
    values
      (p_store,v_component,'hall',(v_item#>>'{remittance,hall}')::public.tax_remittance_owner),
      (p_store,v_component,'delivery',(v_item#>>'{remittance,delivery}')::public.tax_remittance_owner),
      (p_store,v_component,'takeout',(v_item#>>'{remittance,takeout}')::public.tax_remittance_owner);
  end loop;
  insert into public.tax_category_catalog(store_id,tax_profile_id,code,name,treatment,active)
  select p_store,v_new,x->>'code',btrim(x->>'name'),(x->>'treatment')::public.tax_treatment,
         (x->>'active')::boolean
    from jsonb_array_elements(p_payload->'categories') x;
  return jsonb_build_object('changed',true,'profile_id',v_new,
    'revision',v_revision,'effective_from',v_effective);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception '세금 설정 값이 올바르지 않아요'
    using errcode='22000',detail='INVALID_TAX_PROFILE';
end
$$;

create or replace function public.save_menu_tax_override(
  p_store uuid,p_recipe uuid,p_tax_profile uuid,p_tax_category text,
  p_treatment public.tax_treatment,p_base_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.store_tax_profiles%rowtype;
  v_row public.menu_tax_overrides%rowtype;
  v_category text:=nullif(btrim(p_tax_category),'');
  v_treatment public.tax_treatment:=p_treatment;
  v_revision integer;
  v_effective date;
begin
  perform public.assert_my_store(p_store);
  perform public.assert_international_tax_write_enabled();
  perform public.assert_write_app_version();
  perform public.lock_business_scope(p_store);
  if not exists(select 1 from public.recipes where id=p_recipe and store_id=p_store) then
    raise exception '이 매장의 메뉴가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH';
  end if;
  select * into v_profile from public.store_tax_profiles
   where id=p_tax_profile and store_id=p_store and effective_to is null
     and market_profile_id=(select id from public.store_market_profiles
       where store_id=p_store and effective_to is null order by effective_from desc limit 1)
   for update;
  if v_profile.id is null then
    raise exception '현재 세금 프로필을 찾을 수 없어요'
      using errcode='45013',detail='TAX_PROFILE_NOT_AVAILABLE';
  end if;
  if (v_category is not null)::integer+(v_treatment is not null)::integer>1 then
    raise exception '과세 카테고리와 과세 상태는 하나만 선택할 수 있어요'
      using errcode='22000',detail='INVALID_MENU_TAX_OVERRIDE';
  end if;
  if v_category is not null then
    select c.treatment into v_treatment from public.tax_category_catalog c
     where c.tax_profile_id=v_profile.id and c.code=v_category and c.active;
    if v_treatment is null then
      raise exception '활성 과세 카테고리를 찾을 수 없어요'
        using errcode='22000',detail='INVALID_MENU_TAX_OVERRIDE';
    end if;
  elsif v_treatment is null then
    -- 행을 지우면 판본이 0으로 돌아가므로 기본값도 명시 행으로 남긴다.
    v_treatment:=v_profile.default_treatment;
  end if;

  v_effective:=greatest(public.next_unopened_business_date(p_store),v_profile.effective_from);
  select * into v_row from public.menu_tax_overrides
   where recipe_id=p_recipe and tax_profile_id=p_tax_profile
   order by effective_from desc limit 1 for update;
  if v_row.recipe_id is null then
    if p_base_revision<>0 then
      raise exception '다른 기기에서 메뉴 과세 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    insert into public.menu_tax_overrides(
      recipe_id,store_id,tax_profile_id,tax_category,treatment,effective_from,revision)
    values(p_recipe,p_store,p_tax_profile,v_category,
      case when v_category is null then v_treatment else null end,v_effective,1);
    v_revision:=1;
  else
    if p_base_revision is distinct from v_row.revision then
      raise exception '다른 기기에서 메뉴 과세 설정이 변경됐어요'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    if v_row.tax_category is not distinct from v_category
       and v_row.treatment is not distinct from
         (case when v_category is null then v_treatment else null end) then
      return jsonb_build_object('changed',false,'revision',v_row.revision,
        'tax_category',v_row.tax_category,'treatment',v_row.treatment);
    end if;
    if v_row.effective_from=v_effective then
      update public.menu_tax_overrides
         set tax_category=v_category,
             treatment=case when v_category is null then v_treatment else null end,
             revision=revision+1,updated_at=clock_timestamp()
       where recipe_id=p_recipe and tax_profile_id=p_tax_profile
         and effective_from=v_effective
       returning revision into v_revision;
    else
      v_revision:=v_row.revision+1;
      insert into public.menu_tax_overrides(
        recipe_id,store_id,tax_profile_id,tax_category,treatment,effective_from,revision)
      values(p_recipe,p_store,p_tax_profile,v_category,
        case when v_category is null then v_treatment else null end,v_effective,v_revision);
    end if;
  end if;
  return jsonb_build_object('changed',true,'revision',v_revision,
    'effective_from',v_effective,'tax_category',v_category,
    'treatment',case when v_category is null then v_treatment else null end);
end
$$;

-- 읽기 응답도 쓰기 판본과 프로필 기본값을 함께 준다.
create or replace function public.recipe_tax_app_state(p_store uuid,p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market uuid;
  v_tax public.store_tax_profiles%rowtype;
  v_override public.menu_tax_overrides%rowtype;
begin
  perform public.assert_my_store(p_store);
  if not exists(select 1 from public.recipes where id=p_recipe and store_id=p_store) then
    raise exception '이 매장의 메뉴가 아니에요' using errcode='42501',detail='STORE_SCOPE_MISMATCH';
  end if;
  select id into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_market is not null then
    select * into v_tax from public.store_tax_profiles
     where store_id=p_store and market_profile_id=v_market and effective_to is null
     order by effective_from desc limit 1;
  end if;
  if v_tax.id is not null then
    select * into v_override from public.menu_tax_overrides
     where recipe_id=p_recipe and tax_profile_id=v_tax.id
     order by effective_from desc limit 1;
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),'tax_profile_id',v_tax.id,
    'tax_profile_revision',v_tax.revision,'default_treatment',v_tax.default_treatment,
    'override_revision',coalesce(v_override.revision,0),
    'tax_category',v_override.tax_category,'treatment',v_override.treatment,
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'name',c.name,'treatment',c.treatment) order by c.code)
      from public.tax_category_catalog c where c.tax_profile_id=v_tax.id and c.active),'[]'::jsonb));
end
$$;

revoke execute on function public.next_unopened_business_date(uuid),
  public.store_has_money_ledger(uuid),public.assert_international_tax_write_enabled(),
  public.tax_profile_payload(uuid) from public,anon,authenticated,margincook_rpc_executor;
revoke execute on function public.save_store_market_profile(uuid,jsonb,uuid,integer),
  public.save_store_tax_profile(uuid,jsonb,uuid,integer),
  public.save_menu_tax_override(uuid,uuid,uuid,text,public.tax_treatment,integer)
  from public,anon,margincook_rpc_executor;
grant execute on function public.save_store_market_profile(uuid,jsonb,uuid,integer),
  public.save_store_tax_profile(uuid,jsonb,uuid,integer),
  public.save_menu_tax_override(uuid,uuid,uuid,text,public.tax_treatment,integer)
  to authenticated,service_role;

comment on function public.save_store_market_profile(uuid,jsonb,uuid,integer) is
  'INTL-1F 국가·지역·통화·표시 언어·가격 기준을 다음 미개장 영업일부터 새 판본으로 저장한다. 금액 원장 이후 변경은 거부한다.';
comment on function public.save_store_tax_profile(uuid,jsonb,uuid,integer) is
  'INTL-1F 법정 기본세·추가세·카테고리·채널 납부 주체를 완결된 새 판본으로 원자 저장한다.';
comment on function public.save_menu_tax_override(uuid,uuid,uuid,text,public.tax_treatment,integer) is
  'INTL-1F 메뉴 과세 예외를 판본 검사해 저장한다. 기본값 복귀도 행을 남겨 ABA 판본 우회를 막는다.';

do $verify$
declare v_count integer;
begin
  if (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0186: 프로필 쓰기 단계에서 capability를 켰습니다';
  end if;
  if exists(select 1 from (values
      ('save_store_market_profile(uuid,jsonb,uuid,integer)'),
      ('save_store_tax_profile(uuid,jsonb,uuid,integer)'),
      ('save_menu_tax_override(uuid,uuid,uuid,text,tax_treatment,integer)')) x(sig)
      where not has_function_privilege('authenticated',('public.'||x.sig)::regprocedure,'execute')) then
    raise exception '0186: 앱 쓰기 facade 권한이 빠졌습니다';
  end if;
  select count(*) into v_count from public.store_tax_components where config_key is null;
  if v_count<>0 then raise exception '0186: 세금 구성 안정 키가 없는 행이 %개입니다',v_count; end if;
  if position('effective_from <= d.sale_date' in pg_get_functiondef(
      'public.guard_sales_tax_snapshot_source()'::regprocedure))=0 then
    raise exception '0186: 판매 스냅샷 가드에 메뉴 과세 적용일 선택이 없습니다';
  end if;
end
$verify$;

commit;
