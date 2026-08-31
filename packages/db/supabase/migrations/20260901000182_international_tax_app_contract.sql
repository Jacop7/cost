-- 0182 · INTL-1E 앱 전환을 위한 비활성 읽기 계약과 사용자별 앱 언어.
--
-- 국제 세금 read/write capability는 계속 false다. 이 migration은 다음 앱이 사용할
-- 응답 모양을 먼저 고정하고, 앱 언어만 매장 settings에서 사용자 선호로 분리한다.

begin;

create table public.user_preferences (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  app_language  text check (app_language in ('ko','en')),
  source_locale text,
  revision      integer not null default 1 check (revision > 0),
  created_at    timestamptz not null default clock_timestamp(),
  updated_at    timestamptz not null default clock_timestamp()
);

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from public, anon, authenticated, service_role;

insert into public.user_preferences(user_id, app_language, source_locale)
select u.id,
       case
         when s.locale in ('ko','ko-KR') then 'ko'
         when s.locale in ('en','en-US','en-GB','en-AU','en-CA') then 'en'
         else null
       end,
       s.locale
  from auth.users u
  left join public.stores st on st.owner_id=u.id
  left join public.settings s on s.store_id=st.id
on conflict (user_id) do nothing;

create or replace function public.initialize_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.user_preferences(user_id) values(new.id)
  on conflict (user_id) do nothing;
  return new;
end
$$;
create trigger auth_user_initialize_preferences
after insert on auth.users
for each row execute function public.initialize_user_preferences();
revoke all on function public.initialize_user_preferences()
  from public, anon, authenticated, service_role, margincook_rpc_executor;

create or replace function public.get_user_preferences()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_preferences%rowtype;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode='42501', detail='AUTH_REQUIRED';
  end if;
  select * into v_row from public.user_preferences where user_id=v_user;
  if not found then
    insert into public.user_preferences(user_id) values(v_user)
    on conflict (user_id) do nothing;
    select * into v_row from public.user_preferences where user_id=v_user;
  end if;
  return jsonb_build_object(
    'app_language',v_row.app_language,
    'needs_confirmation',v_row.app_language is null,
    'source_locale',v_row.source_locale,
    'revision',v_row.revision
  );
end
$$;

create or replace function public.save_app_language(p_language text, p_base_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_preferences%rowtype;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode='42501', detail='AUTH_REQUIRED';
  end if;
  if p_language not in ('ko','en') then
    raise exception '지원하지 않는 앱 언어예요' using errcode='22000', detail='INVALID_APP_LANGUAGE';
  end if;
  if p_base_revision is null then
    raise exception '편집 기준 판본이 필요해요' using errcode='22000', detail='BASE_REQUIRED';
  end if;

  select * into v_row from public.user_preferences where user_id=v_user for update;
  if not found then
    raise exception '사용자 언어 설정이 없어요' using errcode='22000', detail='PREFERENCES_NOT_FOUND';
  end if;
  if v_row.revision <> p_base_revision then
    raise exception '다른 기기에서 언어 설정이 변경됐어요'
      using errcode='45009', detail='REVISION_CONFLICT';
  end if;
  if v_row.app_language is not distinct from p_language then
    return jsonb_build_object('changed',false,'app_language',v_row.app_language,'revision',v_row.revision);
  end if;

  update public.user_preferences
     set app_language=p_language, revision=revision+1, updated_at=clock_timestamp()
   where user_id=v_user
   returning * into v_row;
  return jsonb_build_object('changed',true,'app_language',v_row.app_language,'revision',v_row.revision);
end
$$;

create or replace function public.international_tax_app_state(p_store uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_market public.store_market_profiles%rowtype;
  v_tax public.store_tax_profiles%rowtype;
  v_audit public.international_tax_migration_audits%rowtype;
begin
  perform public.assert_my_store(p_store);
  select * into v_audit from public.international_tax_migration_audits where store_id=p_store;
  select * into v_market from public.store_market_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_market.id is not null then
    select * into v_tax from public.store_tax_profiles
     where store_id=p_store and market_profile_id=v_market.id and effective_to is null
     order by effective_from desc limit 1;
  end if;

  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'local_date',public.store_local_date(p_store),
    'onboarding_status',case
      when v_market.id is not null and v_tax.id is not null then 'profile_ready'
      when v_audit.decision='manual_review_required' then 'manual_review_required'
      else 'country_confirmation_required' end,
    'migration',case when v_audit.id is null then null else jsonb_build_object(
      'decision',v_audit.decision,'reason_codes',v_audit.reason_codes,
      'future_effective_from',v_audit.future_effective_from) end,
    'market_profile',case when v_market.id is null then null else jsonb_build_object(
      'id',v_market.id,'store_id',v_market.store_id,
      'country_code',v_market.country_code,'region_code',v_market.region_code,
      'currency_code',v_market.currency_code,'business_locale_code',v_market.business_locale_code,
      'price_basis',v_market.price_basis,'effective_from',v_market.effective_from,
      'effective_to',v_market.effective_to,'revision',v_market.revision) end,
    'tax_profile',case when v_tax.id is null then null else jsonb_build_object(
      'id',v_tax.id,'store_id',v_tax.store_id,'market_profile_id',v_tax.market_profile_id,
      'default_treatment',v_tax.default_treatment,'effective_from',v_tax.effective_from,
      'effective_to',v_tax.effective_to,'revision',v_tax.revision,
      'components',coalesce((select jsonb_agg(jsonb_build_object(
        'id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
        'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
        'applies_to_treatments',c.applies_to_treatments,'sort_order',c.sort_order)
        order by c.sort_order,c.id) from public.store_tax_components c where c.tax_profile_id=v_tax.id),'[]'::jsonb),
      'categories',coalesce((select jsonb_agg(jsonb_build_object(
        'code',c.code,'name',c.name,'treatment',c.treatment,'active',c.active) order by c.code)
        from public.tax_category_catalog c where c.tax_profile_id=v_tax.id),'[]'::jsonb),
      'remittance',coalesce((select jsonb_agg(jsonb_build_object(
        'tax_component_id',r.tax_component_id,'sales_channel_code',r.sales_channel_code,
        'remittance_owner',r.remittance_owner) order by r.tax_component_id,r.sales_channel_code)
        from public.channel_tax_remittance r where r.store_id=p_store
          and exists(select 1 from public.store_tax_components c where c.id=r.tax_component_id and c.tax_profile_id=v_tax.id)),'[]'::jsonb)
    ) end
  );
end
$$;

create or replace function public.international_tax_regions(p_store uuid, p_country public.international_country_code)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.assert_my_store(p_store);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'country_code',r.country_code,'region_code',r.region_code,
    'parent_region_code',r.parent_region_code,'jurisdiction_level',r.jurisdiction_level,
    'name',r.name) order by r.name)
    from public.tax_region_catalog r where r.country_code=p_country and r.active),'[]'::jsonb);
end
$$;

create or replace function public.recipe_tax_app_state(p_store uuid, p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_tax uuid; v_override public.menu_tax_overrides%rowtype;
begin
  perform public.assert_my_store(p_store);
  if not exists(select 1 from public.recipes where id=p_recipe and store_id=p_store) then
    raise exception '이 매장의 메뉴가 아니에요' using errcode='42501', detail='STORE_SCOPE_MISMATCH';
  end if;
  select id into v_tax from public.store_tax_profiles
   where store_id=p_store and effective_to is null order by effective_from desc limit 1;
  if v_tax is not null then
    select * into v_override from public.menu_tax_overrides
     where recipe_id=p_recipe and tax_profile_id=v_tax;
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'tax_profile_id',v_tax,
    'tax_category',v_override.tax_category,
    'treatment',v_override.treatment,
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'name',c.name,'treatment',c.treatment) order by c.code)
      from public.tax_category_catalog c where c.tax_profile_id=v_tax and c.active),'[]'::jsonb)
  );
end
$$;

create or replace function public.sales_tax_app_detail(p_store uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode='22000', message='판매 세금 조회 기간이 올바르지 않아요', detail='INVALID_DATE_RANGE';
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),
    'from',p_from,
    'to',p_to,
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'daily_sales_item_id',s.daily_sales_item_id,'recipe_id',i.recipe_id,'menu_name',i.menu_name,
      'sale_date',d.sale_date,
      'unit_price',i.unit_price,
      'sales_channel_code',s.sales_channel_code,'country_code',s.country_code,
      'region_code',s.region_code,'currency_code',s.currency_code,'minor_unit',s.minor_unit,
      'price_basis',s.price_basis,'treatment',s.treatment,'tax_category',s.tax_category,
      'market_profile_id',s.market_profile_id,'market_profile_revision',s.market_profile_revision,
      'tax_profile_id',s.tax_profile_id,'tax_profile_revision',s.tax_profile_revision,
      'calculation_version',s.calculation_version,'final_quantity',s.final_quantity,
      'listed_total',s.listed_total,'net_sales',s.net_sales,'customer_total',s.customer_total,
      'tax_total',s.tax_total,'merchant_tax_liability',s.merchant_tax_liability,
      'marketplace_tax_liability',s.marketplace_tax_liability,
      'components',coalesce((select jsonb_agg(jsonb_build_object(
        'component_id',c.component_id_snapshot,'kind',c.kind,'name',c.name,
        'rate_pct',c.rate_pct,'jurisdiction_level',c.jurisdiction_level,
        'calculation_basis',c.calculation_basis,'applies_to_treatments',c.applies_to_treatments,
        'remittance_owner',c.remittance_owner,'unrounded_amount',c.unrounded_amount,
        'rounded_amount',c.rounded_amount) order by c.id)
        from public.daily_sales_item_tax_component_snapshots c where c.sales_tax_snapshot_id=s.id),'[]'::jsonb)
      ) order by d.sale_date,i.menu_name,s.sales_channel_code)
      from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id=s.daily_sales_item_id and i.store_id=s.store_id
      join public.daily_sales d on d.id=i.daily_sales_id and d.store_id=i.store_id
      where s.store_id=p_store and d.sale_date between p_from and p_to),'[]'::jsonb)
  );
end
$$;

revoke execute on function public.get_user_preferences() from public, anon;
revoke execute on function public.save_app_language(text,integer) from public, anon;
revoke execute on function public.international_tax_app_state(uuid) from public, anon;
revoke execute on function public.international_tax_regions(uuid,public.international_country_code) from public, anon;
revoke execute on function public.recipe_tax_app_state(uuid,uuid) from public, anon;
revoke execute on function public.sales_tax_app_detail(uuid,date,date) from public, anon;
grant execute on function public.get_user_preferences() to authenticated, service_role;
grant execute on function public.save_app_language(text,integer) to authenticated, service_role;
grant execute on function public.international_tax_app_state(uuid) to authenticated, service_role;
grant execute on function public.international_tax_regions(uuid,public.international_country_code) to authenticated, service_role;
grant execute on function public.recipe_tax_app_state(uuid,uuid) to authenticated, service_role;
grant execute on function public.sales_tax_app_detail(uuid,date,date) to authenticated, service_role;

comment on function public.international_tax_app_state(uuid) is
  'INTL-1E 비활성 앱 계약. capability와 이관 판정·미래 시장/세금 프로필을 한 응답으로 읽는다.';
comment on function public.sales_tax_app_detail(uuid,date,date) is
  'INTL-1E 판매 시점 국제 세금 snapshot 조회. 과거 legacy 합계를 구성 항목으로 역산하지 않는다.';

do $verify$
declare v_cap jsonb:=public.app_capabilities(); v_bad integer;
begin
  if (v_cap#>>'{international_tax,read_enabled}')::boolean
     or (v_cap#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0182: 앱 계약 연결 단계에서 국제 세금 capability를 켰습니다';
  end if;
  select count(*) into v_bad from public.user_preferences
   where app_language is not null and app_language not in ('ko','en');
  if v_bad<>0 then raise exception '0182: 지원하지 않는 앱 언어가 이관됐습니다'; end if;
  if has_table_privilege('authenticated','public.user_preferences','select')
     or has_table_privilege('authenticated','public.user_preferences','insert')
     or has_function_privilege('anon','public.international_tax_app_state(uuid)','execute') then
    raise exception '0182: 앱 계약의 직접 테이블/익명 권한이 열렸습니다';
  end if;
end
$verify$;

commit;
