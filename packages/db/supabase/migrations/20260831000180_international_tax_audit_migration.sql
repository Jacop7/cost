-- 0180 · INTL-1C 현행 세금 감사와 명확한 한국 미래 프로필 이관
--
-- 이 단계는 현재 locale·세금 설정·판매/기타매출 세액을 읽기 전용으로 감사한다.
-- 기존 금액이나 세율을 역산·수정하지 않으며, 정확히 판별되는 한국 표준 부가세 매장만
-- 다음 미개장 영업일부터 쓸 미래 프로필을 만든다. 모호한 매장은 감사 결과만 남긴다.
-- 기존 판매 합계의 계산 판본은 legacy_effective_rate_v1로 명시하되 구성 항목을 지어내지 않는다.

begin;

create temporary table intl_1c_value_baseline on commit drop as
select
  (select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id), '[]'::jsonb) from public.settings s) settings_rows,
  (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.recipes r) recipe_rows,
  (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]'::jsonb) from public.daily_sales d) sales_rows,
  (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) from public.daily_sales_items i) item_rows;

-- ISO 3166-2의 미국 50개 주+DC, 캐나다 10개 주+3개 준주.
insert into public.tax_region_catalog(country_code, region_code, jurisdiction_level, name) values
  ('US','US-AL','state','Alabama'),
  ('US','US-AK','state','Alaska'),
  ('US','US-AZ','state','Arizona'),
  ('US','US-AR','state','Arkansas'),
  ('US','US-CA','state','California'),
  ('US','US-CO','state','Colorado'),
  ('US','US-CT','state','Connecticut'),
  ('US','US-DE','state','Delaware'),
  ('US','US-DC','state','District of Columbia'),
  ('US','US-FL','state','Florida'),
  ('US','US-GA','state','Georgia'),
  ('US','US-HI','state','Hawaii'),
  ('US','US-ID','state','Idaho'),
  ('US','US-IL','state','Illinois'),
  ('US','US-IN','state','Indiana'),
  ('US','US-IA','state','Iowa'),
  ('US','US-KS','state','Kansas'),
  ('US','US-KY','state','Kentucky'),
  ('US','US-LA','state','Louisiana'),
  ('US','US-ME','state','Maine'),
  ('US','US-MD','state','Maryland'),
  ('US','US-MA','state','Massachusetts'),
  ('US','US-MI','state','Michigan'),
  ('US','US-MN','state','Minnesota'),
  ('US','US-MS','state','Mississippi'),
  ('US','US-MO','state','Missouri'),
  ('US','US-MT','state','Montana'),
  ('US','US-NE','state','Nebraska'),
  ('US','US-NV','state','Nevada'),
  ('US','US-NH','state','New Hampshire'),
  ('US','US-NJ','state','New Jersey'),
  ('US','US-NM','state','New Mexico'),
  ('US','US-NY','state','New York'),
  ('US','US-NC','state','North Carolina'),
  ('US','US-ND','state','North Dakota'),
  ('US','US-OH','state','Ohio'),
  ('US','US-OK','state','Oklahoma'),
  ('US','US-OR','state','Oregon'),
  ('US','US-PA','state','Pennsylvania'),
  ('US','US-RI','state','Rhode Island'),
  ('US','US-SC','state','South Carolina'),
  ('US','US-SD','state','South Dakota'),
  ('US','US-TN','state','Tennessee'),
  ('US','US-TX','state','Texas'),
  ('US','US-UT','state','Utah'),
  ('US','US-VT','state','Vermont'),
  ('US','US-VA','state','Virginia'),
  ('US','US-WA','state','Washington'),
  ('US','US-WV','state','West Virginia'),
  ('US','US-WI','state','Wisconsin'),
  ('US','US-WY','state','Wyoming'),
  ('CA','CA-AB','province','Alberta'),
  ('CA','CA-BC','province','British Columbia'),
  ('CA','CA-MB','province','Manitoba'),
  ('CA','CA-NB','province','New Brunswick'),
  ('CA','CA-NL','province','Newfoundland and Labrador'),
  ('CA','CA-NS','province','Nova Scotia'),
  ('CA','CA-NT','province','Northwest Territories'),
  ('CA','CA-NU','province','Nunavut'),
  ('CA','CA-ON','province','Ontario'),
  ('CA','CA-PE','province','Prince Edward Island'),
  ('CA','CA-QC','province','Quebec'),
  ('CA','CA-SK','province','Saskatchewan'),
  ('CA','CA-YT','province','Yukon');

-- 세금 프로필은 국가·지역을 중복 저장하지 않는다. 이 view의 두 값은 시장 프로필에서
-- 파생한 조회 계약이며 capability가 열리기 전까지 앱 롤에는 공개하지 않는다.
create view public.store_tax_profile_contract
with (security_invoker = true)
as
select t.id, t.store_id, t.market_profile_id,
       m.country_code, m.region_code,
       t.default_treatment, t.effective_from, t.effective_to, t.revision,
       t.created_at, t.created_by
  from public.store_tax_profiles t
  join public.store_market_profiles m
    on m.id = t.market_profile_id and m.store_id = t.store_id;

revoke all on table public.store_tax_profile_contract from public, anon, authenticated, service_role;
grant select on table public.store_tax_profile_contract to margincook_rpc_executor;
comment on view public.store_tax_profile_contract is
  'INTL-1C 세금 프로필 조회 투영. country_code/region_code는 store_market_profiles에서 파생하며 store_tax_profiles에 중복 저장하지 않는다.';

create table public.international_tax_migration_audits (
  id                         uuid primary key default gen_random_uuid(),
  store_id                   uuid not null unique references public.stores(id) on delete cascade,
  audited_at                 timestamptz not null default clock_timestamp(),
  source_locale              text,
  source_currency            text,
  source_money_digits        integer,
  source_tax_mode            public.tax_mode,
  source_tax_items           jsonb not null,
  source_recipe_mismatch_count integer not null check (source_recipe_mismatch_count >= 0),
  source_daily_sales_count   integer not null check (source_daily_sales_count >= 0),
  source_sales_item_count    integer not null check (source_sales_item_count >= 0),
  source_menu_tax_total      numeric not null,
  source_etc_revenue_total   numeric not null,
  source_etc_tax_total       numeric not null,
  decision                   text not null check (decision in ('auto_profile_created','manual_review_required')),
  reason_codes               text[] not null,
  future_effective_from      date,
  market_profile_id          uuid,
  tax_profile_id             uuid,
  legacy_calculation_version public.international_tax_calculation_version not null
    default 'legacy_effective_rate_v1',
  check (jsonb_typeof(source_tax_items) = 'array'),
  check (reason_codes <@ array[
    'settings_missing', 'store_archived', 'locale_not_ko',
    'currency_contract_not_krw', 'price_basis_not_inclusive',
    'tax_item_count_not_one', 'standard_vat_not_exact',
    'recipe_tax_mismatch', 'profile_already_exists'
  ]::text[]),
  check ((decision = 'auto_profile_created'
          and cardinality(reason_codes) = 0
          and future_effective_from is not null
          and market_profile_id is not null
          and tax_profile_id is not null)
      or (decision = 'manual_review_required'
          and cardinality(reason_codes) > 0
          and future_effective_from is null
          and market_profile_id is null
          and tax_profile_id is null))
);

alter table public.international_tax_migration_audits enable row level security;
revoke all on table public.international_tax_migration_audits
  from public, anon, authenticated, service_role, margincook_rpc_executor;

create or replace function public.reject_international_tax_migration_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception '국제 세금 이관 감사 기록은 비울 수 없어요'
      using errcode = '42501', detail = 'INTERNATIONAL_TAX_MIGRATION_AUDIT_IMMUTABLE';
  end if;
  if tg_op = 'DELETE'
     and current_setting('margincook.store_purge_id', true) = old.store_id::text then
    if exists (
      select 1 from public.store_lifecycle_events e
       where e.store_id = old.store_id
         and e.event_type = 'physical_purge'
         and coalesce(btrim(e.approval_reference), '') <> ''
         and coalesce(btrim(e.backup_reference), '') <> ''
    ) then
      return old;
    end if;
    raise exception '승인·백업 감사 없는 매장 물리 삭제는 국제 세금 이관 감사를 지울 수 없어요'
      using errcode = '42501', detail = 'STORE_PURGE_AUDIT_REQUIRED';
  end if;
  raise exception '국제 세금 이관 감사 기록은 수정하거나 지울 수 없어요'
    using errcode = '42501', detail = 'INTERNATIONAL_TAX_MIGRATION_AUDIT_IMMUTABLE';
end;
$$;
create trigger international_tax_migration_audits_immutable_row
before update or delete on public.international_tax_migration_audits
for each row execute function public.reject_international_tax_migration_audit_mutation();
create trigger international_tax_migration_audits_immutable_truncate
before truncate on public.international_tax_migration_audits
for each statement execute function public.reject_international_tax_migration_audit_mutation();
revoke all on function public.reject_international_tax_migration_audit_mutation()
  from public, anon, authenticated, service_role, margincook_rpc_executor;

comment on table public.international_tax_migration_audits is
  'INTL-1C 읽기 전용 이관 판정. 현행 설정·판매/기타매출 합계를 기록하며 모호한 세율을 역산하지 않는다. 승인·백업을 확인한 매장 물리 삭제에서만 함께 제거한다.';
comment on column public.international_tax_migration_audits.source_menu_tax_total is
  '기존 daily_sales_items.unit_tax×채널 수량 합. 구성 항목으로 역산하지 않는 legacy 합계다.';
comment on column public.international_tax_migration_audits.source_etc_tax_total is
  '기존 daily_sales.etc_tax 합. etc_tax÷etc_revenue로 과거 세율을 만들지 않는다.';

-- 기존 열의 의미를 명시한다. 값은 손대지 않고 판본 표지만 추가한다. 새 계산 경로가 생기는
-- INTL-1D에서 국제 판본을 명시적으로 쓰며, 그전까지 기본값은 legacy다.
alter table public.daily_sales_items
  add column unit_tax_calculation_version public.international_tax_calculation_version
  not null default 'legacy_effective_rate_v1';
alter table public.daily_sales
  add column etc_tax_calculation_version public.international_tax_calculation_version
  not null default 'legacy_effective_rate_v1';
comment on column public.daily_sales_items.unit_tax_calculation_version is
  'unit_tax의 계산 판본. INTL-1C 이전 합계는 legacy_effective_rate_v1이며 과거 구성 항목을 역산하지 않는다.';
comment on column public.daily_sales.etc_tax_calculation_version is
  'etc_tax의 계산 판본. INTL-1C 이전 합계는 legacy_effective_rate_v1이며 과거 세율을 역산하지 않는다.';

do $migrate$
declare
  s record;
  v_reasons text[];
  v_effective date;
  v_market uuid;
  v_tax uuid;
  v_component uuid;
  v_recipe_mismatch integer;
  v_daily_count integer;
  v_item_count integer;
  v_menu_tax numeric;
  v_etc_revenue numeric;
  v_etc_tax numeric;
  v_single_item jsonb;
begin
  for s in
    select stores.id store_id, stores.archived_at, st.locale, st.currency, st.money_digits,
           st.tax_mode, coalesce(st.tax_items, '[]'::jsonb) tax_items,
           st.store_id is not null settings_present
      from public.stores
      left join public.settings st on st.store_id = stores.id
     order by stores.id
  loop
    v_reasons := array[]::text[];
    v_single_item := case when jsonb_array_length(s.tax_items) = 1 then s.tax_items->0 end;

    if not s.settings_present then v_reasons := v_reasons || array['settings_missing']; end if;
    if s.archived_at is not null then v_reasons := v_reasons || array['store_archived']; end if;
    if s.locale is distinct from 'ko' then v_reasons := v_reasons || array['locale_not_ko']; end if;
    if s.currency is distinct from 'KRW' or s.money_digits is distinct from 0 then
      v_reasons := v_reasons || array['currency_contract_not_krw'];
    end if;
    if s.tax_mode is distinct from 'included'::public.tax_mode then
      v_reasons := v_reasons || array['price_basis_not_inclusive'];
    end if;
    if jsonb_array_length(s.tax_items) <> 1 then
      v_reasons := v_reasons || array['tax_item_count_not_one'];
    elsif jsonb_typeof(v_single_item) <> 'object' then
      v_reasons := v_reasons || array['standard_vat_not_exact'];
    elsif (select count(*) from jsonb_object_keys(v_single_item)) <> 2
       or not (v_single_item ? 'name' and v_single_item ? 'rate')
       or v_single_item->>'name' <> '부가세' then
      v_reasons := v_reasons || array['standard_vat_not_exact'];
    elsif jsonb_typeof(v_single_item->'rate') <> 'number' then
      v_reasons := v_reasons || array['standard_vat_not_exact'];
    elsif abs((v_single_item->>'rate')::numeric - (100.0 * 10 / 110)) > 0.000001 then
      v_reasons := v_reasons || array['standard_vat_not_exact'];
    end if;

    select count(*) into v_recipe_mismatch
      from public.recipes r
     where r.store_id = s.store_id
       and (r.tax_mode is distinct from s.tax_mode
         or coalesce(r.tax_items, '[]'::jsonb) is distinct from s.tax_items);
    if v_recipe_mismatch > 0 then v_reasons := v_reasons || array['recipe_tax_mismatch']; end if;
    if exists (select 1 from public.store_market_profiles p where p.store_id = s.store_id)
       or exists (select 1 from public.store_tax_profiles p where p.store_id = s.store_id) then
      v_reasons := v_reasons || array['profile_already_exists'];
    end if;

    select count(*), coalesce(sum(d.etc_revenue),0), coalesce(sum(d.etc_tax),0)
      into v_daily_count, v_etc_revenue, v_etc_tax
      from public.daily_sales d where d.store_id = s.store_id;
    select count(*), coalesce(sum(coalesce(i.unit_tax,0) *
      (i.qty_hall + i.qty_delivery + i.qty_takeout)),0)
      into v_item_count, v_menu_tax
      from public.daily_sales_items i where i.store_id = s.store_id;

    if cardinality(v_reasons) = 0 then
      -- 오늘 아직 장부가 없어도 오늘을 선택하지 않는다. 이관 뒤 같은 날 열리는 영업일이
      -- legacy와 국제 계산 구간에 동시에 걸리지 않도록 최소 내일부터 빈 날짜를 찾는다.
      v_effective := public.store_local_date(s.store_id) + 1;
      while exists (
        select 1 from public.business_days d
         where d.store_id = s.store_id and d.business_date = v_effective
      ) loop
        v_effective := v_effective + 1;
      end loop;

      insert into public.store_market_profiles(
        store_id, country_code, region_code, currency_code, business_locale_code,
        price_basis, effective_from, revision, created_by
      ) values (
        s.store_id, 'KR', null, 'KRW', 'ko-KR',
        'tax_inclusive', v_effective, 1, null
      ) returning id into v_market;

      insert into public.store_tax_profiles(
        store_id, market_profile_id, default_treatment,
        effective_from, revision, created_by
      ) values (
        s.store_id, v_market, 'taxable', v_effective, 1, null
      ) returning id into v_tax;

      insert into public.store_tax_components(
        store_id, tax_profile_id, kind, name, rate_pct,
        jurisdiction_level, calculation_basis, applies_to_treatments, sort_order
      ) values (
        s.store_id, v_tax, 'primary', '부가세', 10,
        'national', 'primary_tax_exclusive', array['taxable'::public.tax_treatment], 0
      ) returning id into v_component;

      insert into public.tax_category_catalog(store_id, tax_profile_id, code, name, treatment)
      values
        (s.store_id, v_tax, 'standard', '일반 과세', 'taxable'),
        (s.store_id, v_tax, 'zero_rated', '0% 과세', 'zero_rated'),
        (s.store_id, v_tax, 'exempt', '면세', 'exempt');

      insert into public.channel_tax_remittance(
        store_id, tax_component_id, sales_channel_code, remittance_owner
      ) values
        (s.store_id, v_component, 'hall', 'merchant'),
        (s.store_id, v_component, 'delivery', 'merchant'),
        (s.store_id, v_component, 'takeout', 'merchant');
    else
      v_effective := null;
      v_market := null;
      v_tax := null;
    end if;

    insert into public.international_tax_migration_audits(
      store_id, source_locale, source_currency, source_money_digits,
      source_tax_mode, source_tax_items, source_recipe_mismatch_count,
      source_daily_sales_count, source_sales_item_count, source_menu_tax_total,
      source_etc_revenue_total, source_etc_tax_total, decision, reason_codes,
      future_effective_from, market_profile_id, tax_profile_id
    ) values (
      s.store_id, s.locale, s.currency, s.money_digits,
      s.tax_mode, s.tax_items, v_recipe_mismatch,
      v_daily_count, v_item_count, v_menu_tax,
      v_etc_revenue, v_etc_tax,
      case when cardinality(v_reasons) = 0 then 'auto_profile_created'
           else 'manual_review_required' end,
      v_reasons, v_effective, v_market, v_tax
    );
  end loop;
end
$migrate$;

do $verify$
declare
  v_cap jsonb := public.app_capabilities();
  v_bad integer;
  v_before intl_1c_value_baseline%rowtype;
begin
  select * into v_before from intl_1c_value_baseline;
  if v_before.settings_rows is distinct from
       (select coalesce(jsonb_agg(to_jsonb(s) order by s.store_id), '[]'::jsonb) from public.settings s) then
    raise exception '0180: 현행 settings 값을 바꿨습니다';
  end if;
  if v_before.recipe_rows is distinct from
       (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.recipes r) then
    raise exception '0180: 현행 레시피 세금 값을 바꿨습니다';
  end if;
  if v_before.sales_rows is distinct from
       (select coalesce(jsonb_agg(to_jsonb(d) - 'etc_tax_calculation_version' order by d.id), '[]'::jsonb)
          from public.daily_sales d) then
    raise exception '0180: 기존 기타 매출·세액을 바꿨습니다';
  end if;
  if v_before.item_rows is distinct from
       (select coalesce(jsonb_agg(to_jsonb(i) - 'unit_tax_calculation_version' order by i.id), '[]'::jsonb)
          from public.daily_sales_items i) then
    raise exception '0180: 기존 판매 수량·단가·세액을 바꿨습니다';
  end if;

  select count(*) into v_bad from public.tax_region_catalog
   where (country_code = 'US' and jurisdiction_level = 'state')
      or (country_code = 'CA' and jurisdiction_level = 'province');
  if v_bad <> 64
     or not exists (select 1 from public.tax_region_catalog where country_code='US' and region_code='US-CA')
     or not exists (select 1 from public.tax_region_catalog where country_code='CA' and region_code='CA-ON') then
    raise exception '0180: 미국·캐나다 1차 관할 카탈로그가 64개가 아닙니다 (%)', v_bad;
  end if;

  if (select count(*) from public.international_tax_migration_audits)
       <> (select count(*) from public.stores) then
    raise exception '0180: 매장마다 이관 감사 결과가 하나씩 있지 않습니다';
  end if;
  if exists (
    select 1 from public.international_tax_migration_audits a
     where a.legacy_calculation_version <> 'legacy_effective_rate_v1'
        or (a.decision = 'auto_profile_created' and not exists (
          select 1 from public.store_tax_profile_contract p
           where p.id = a.tax_profile_id and p.market_profile_id = a.market_profile_id
             and p.country_code = 'KR' and p.region_code is null))
  ) then
    raise exception '0180: 이관 감사 판본 또는 파생 프로필 연결이 맞지 않습니다';
  end if;
  if exists (
    select 1 from public.international_tax_migration_audits a
     where a.decision = 'auto_profile_created'
       and (select count(*) from public.store_tax_components c
             where c.tax_profile_id = a.tax_profile_id) <> 1
  ) or exists (
    select 1 from public.international_tax_migration_audits a
    join public.store_tax_components c on c.tax_profile_id = a.tax_profile_id
   where a.decision = 'auto_profile_created'
     and (c.kind <> 'primary' or c.name <> '부가세' or c.rate_pct <> 10)
  ) then
    raise exception '0180: 자동 이관 프로필은 법정 표면 세율 10의 기본세 하나여야 합니다';
  end if;
  if exists (
    select 1 from public.international_tax_migration_audits a
     where a.decision = 'auto_profile_created'
       and (
         (select count(*) from public.store_tax_components c
           where c.tax_profile_id = a.tax_profile_id
             and c.kind = 'primary' and c.name = '부가세' and c.rate_pct = 10
             and c.jurisdiction_level = 'national'
             and c.calculation_basis = 'primary_tax_exclusive'
             and c.applies_to_treatments = array['taxable'::public.tax_treatment]) <> 1
         or (select count(*) from public.tax_category_catalog c
              where c.tax_profile_id = a.tax_profile_id
                and (c.code, c.treatment) in (
                  ('standard', 'taxable'::public.tax_treatment),
                  ('zero_rated', 'zero_rated'::public.tax_treatment),
                  ('exempt', 'exempt'::public.tax_treatment))) <> 3
         or (select count(*) from public.channel_tax_remittance r
              join public.store_tax_components c on c.id = r.tax_component_id
             where c.tax_profile_id = a.tax_profile_id
               and r.remittance_owner = 'merchant'
               and r.sales_channel_code in ('hall','delivery','takeout')) <> 3
       )
  ) then
    raise exception '0180: 자동 이관 프로필의 기본세·과세 분류·채널 납부 계약이 완결되지 않았습니다';
  end if;
  if exists (select 1 from public.daily_sales_item_tax_snapshots)
     or exists (select 1 from public.daily_sales_item_tax_component_snapshots)
     or exists (select 1 from public.sales_tax_events) then
    raise exception '0180: 과거 합계에서 국제 세금 상세나 이벤트를 역산해 만들었습니다';
  end if;
  if exists (select 1 from public.daily_sales_items where unit_tax_calculation_version <> 'legacy_effective_rate_v1')
     or exists (select 1 from public.daily_sales where etc_tax_calculation_version <> 'legacy_effective_rate_v1') then
    raise exception '0180: 기존 합계의 legacy 계산 판본이 빠졌습니다';
  end if;
  if has_table_privilege('authenticated','public.international_tax_migration_audits','SELECT')
     or has_table_privilege('anon','public.international_tax_migration_audits','SELECT')
     or has_table_privilege('service_role','public.international_tax_migration_audits','SELECT') then
    raise exception '0180: 이관 감사 원본이 앱·서비스 롤에 열렸습니다';
  end if;
  if has_table_privilege('authenticated','public.store_tax_profile_contract','SELECT')
     or has_table_privilege('anon','public.store_tax_profile_contract','SELECT')
     or has_table_privilege('service_role','public.store_tax_profile_contract','SELECT') then
    raise exception '0180: 세금 프로필 파생 조회가 앱·서비스 롤에 열렸습니다';
  end if;
  if (v_cap#>>'{international_tax,read_enabled}')::boolean
     or (v_cap#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0180: 감사·이관 단계에서 국제 세금 capability를 켰습니다';
  end if;
end
$verify$;

commit;
