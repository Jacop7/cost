-- 0179 · INTL-1B 국제 시장·세금 프로필과 판매 시점 원장 스키마
--
-- 이 단계는 확장형 저장 자리와 불변식만 만든다.
--   ○ 시장/세금 프로필, 구성 항목, 메뉴 과세, 채널별 납부 주체
--   ○ 영업일×메뉴×채널 판매 세금 스냅샷과 append-only 이벤트
--   ○ 매장 경계·유효기간 겹침·직접 앱 쓰기 차단
--   ✕ 기존 한국 설정 이관(INTL-1C)
--   ✕ 국제 세금 계산·판매 연결(INTL-1D)
--   ✕ capability 활성화(INTL-1E/F)
--
-- 따라서 app_capabilities()의 read/write=false와 0090 tax_of() 결과는 그대로다.

begin;

do $types$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'international_country_code') then
    create type public.international_country_code as enum ('KR', 'US', 'GB', 'AU', 'CA');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'international_currency_code') then
    create type public.international_currency_code as enum ('KRW', 'USD', 'GBP', 'AUD', 'CAD');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'business_locale_code') then
    create type public.business_locale_code as enum ('ko-KR', 'en-US', 'en-GB', 'en-AU', 'en-CA');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_price_basis') then
    create type public.tax_price_basis as enum ('tax_inclusive', 'tax_exclusive');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_treatment') then
    create type public.tax_treatment as enum ('taxable', 'zero_rated', 'exempt');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_component_kind') then
    create type public.tax_component_kind as enum ('primary', 'additional');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_calculation_basis') then
    create type public.tax_calculation_basis as enum ('primary_tax_exclusive', 'primary_tax_inclusive');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_jurisdiction_level') then
    create type public.tax_jurisdiction_level as enum ('national', 'state', 'province', 'county', 'city', 'special', 'custom');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'tax_remittance_owner') then
    create type public.tax_remittance_owner as enum ('merchant', 'marketplace');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'international_sales_channel_code') then
    create type public.international_sales_channel_code as enum ('hall', 'delivery', 'takeout');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'international_tax_calculation_version') then
    create type public.international_tax_calculation_version as enum ('international_tax_v1', 'legacy_effective_rate_v1');
  end if;
end
$types$;

-- 통화 minor unit은 DB 안에서도 한 함수가 소유한다. snapshot guard와 TypeScript parity가
-- 이 값을 함께 읽어 통화가 늘 때 두 벌의 CASE가 갈리지 않게 한다.
create or replace function public.international_currency_minor_unit(
  p_currency public.international_currency_code
)
returns smallint
language sql
immutable
parallel safe
set search_path = public
as $$
  select case p_currency when 'KRW' then 0::smallint else 2::smallint end
$$;

-- 제품이 소유하는 관할 코드. 표시 이름이나 사용자 자유 입력값을 참조키로 쓰지 않는다.
create table public.tax_region_catalog (
  country_code       public.international_country_code not null,
  region_code        text not null check (region_code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  parent_region_code text,
  jurisdiction_level public.tax_jurisdiction_level not null,
  name               text not null check (btrim(name) <> ''),
  active             boolean not null default true,
  primary key (country_code, region_code),
  foreign key (country_code, parent_region_code)
    references public.tax_region_catalog(country_code, region_code)
    deferrable initially deferred,
  check (parent_region_code is null or parent_region_code <> region_code)
);

create table public.store_market_profiles (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores(id) on delete cascade,
  country_code         public.international_country_code not null,
  region_code          text,
  currency_code        public.international_currency_code not null,
  business_locale_code public.business_locale_code not null,
  price_basis          public.tax_price_basis not null,
  effective_from       date not null,
  effective_to         date,
  revision             integer not null default 1 check (revision > 0),
  created_at           timestamptz not null default clock_timestamp(),
  created_by           uuid,
  unique (id, store_id),
  foreign key (country_code, region_code)
    references public.tax_region_catalog(country_code, region_code),
  check (effective_to is null or effective_to >= effective_from),
  check ((country_code = 'KR' and currency_code = 'KRW' and business_locale_code = 'ko-KR') or
         (country_code = 'US' and currency_code = 'USD' and business_locale_code = 'en-US') or
         (country_code = 'GB' and currency_code = 'GBP' and business_locale_code = 'en-GB') or
         (country_code = 'AU' and currency_code = 'AUD' and business_locale_code = 'en-AU') or
         (country_code = 'CA' and currency_code = 'CAD' and business_locale_code = 'en-CA')),
  check (country_code not in ('US', 'CA') or region_code is not null)
);
create unique index store_market_profiles_one_open_idx
  on public.store_market_profiles(store_id) where effective_to is null;
create unique index store_market_profiles_store_from_uniq
  on public.store_market_profiles(store_id, effective_from);
create index store_market_profiles_store_range_idx
  on public.store_market_profiles(store_id, effective_from desc, effective_to);

create table public.store_tax_profiles (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores(id) on delete cascade,
  market_profile_id uuid not null,
  default_treatment public.tax_treatment not null,
  effective_from    date not null,
  effective_to      date,
  revision          integer not null default 1 check (revision > 0),
  created_at        timestamptz not null default clock_timestamp(),
  created_by        uuid,
  unique (id, store_id),
  foreign key (market_profile_id, store_id)
    references public.store_market_profiles(id, store_id)
    on delete no action deferrable initially deferred,
  check (effective_to is null or effective_to >= effective_from)
);
create unique index store_tax_profiles_one_open_idx
  on public.store_tax_profiles(store_id) where effective_to is null;
create unique index store_tax_profiles_store_from_uniq
  on public.store_tax_profiles(store_id, effective_from);
create index store_tax_profiles_store_range_idx
  on public.store_tax_profiles(store_id, effective_from desc, effective_to);

create table public.store_tax_components (
  id                     uuid primary key default gen_random_uuid(),
  store_id               uuid not null references public.stores(id) on delete cascade,
  tax_profile_id         uuid not null,
  kind                   public.tax_component_kind not null,
  name                   text not null check (btrim(name) <> ''),
  rate_pct               numeric not null check (rate_pct >= 0 and rate_pct < 100),
  jurisdiction_level     public.tax_jurisdiction_level not null,
  calculation_basis      public.tax_calculation_basis not null,
  applies_to_treatments  public.tax_treatment[] not null,
  sort_order             integer not null default 0,
  unique (id, store_id),
  foreign key (tax_profile_id, store_id)
    references public.store_tax_profiles(id, store_id)
    on delete cascade,
  check (cardinality(applies_to_treatments) > 0),
  check (array_position(applies_to_treatments, null) is null),
  check (kind <> 'primary' or calculation_basis = 'primary_tax_exclusive'),
  check (kind <> 'primary' or applies_to_treatments = array['taxable'::public.tax_treatment])
);
create unique index store_tax_components_one_primary_idx
  on public.store_tax_components(tax_profile_id) where kind = 'primary';
create index store_tax_components_profile_idx
  on public.store_tax_components(tax_profile_id, sort_order, id);

-- tax_category는 표시 이름이 아니라 프로필이 소유하는 불변 코드다.
create table public.tax_category_catalog (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  tax_profile_id uuid not null,
  code           text not null check (code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name           text not null check (btrim(name) <> ''),
  treatment      public.tax_treatment not null,
  active         boolean not null default true,
  unique (tax_profile_id, code),
  foreign key (tax_profile_id, store_id)
    references public.store_tax_profiles(id, store_id)
    on delete cascade
);

create unique index recipes_id_store_uniq on public.recipes(id, store_id);
create table public.menu_tax_overrides (
  recipe_id      uuid not null,
  store_id       uuid not null references public.stores(id) on delete cascade,
  tax_profile_id uuid not null,
  tax_category   text,
  treatment      public.tax_treatment,
  created_at     timestamptz not null default clock_timestamp(),
  updated_at     timestamptz not null default clock_timestamp(),
  primary key (recipe_id, tax_profile_id),
  foreign key (recipe_id, store_id)
    references public.recipes(id, store_id) on delete cascade,
  foreign key (tax_profile_id, store_id)
    references public.store_tax_profiles(id, store_id) on delete cascade,
  foreign key (tax_profile_id, tax_category)
    references public.tax_category_catalog(tax_profile_id, code),
  check (num_nonnulls(tax_category, treatment) = 1)
);

create table public.channel_tax_remittance (
  store_id          uuid not null references public.stores(id) on delete cascade,
  tax_component_id  uuid not null,
  sales_channel_code public.international_sales_channel_code not null,
  remittance_owner  public.tax_remittance_owner not null,
  primary key (tax_component_id, sales_channel_code),
  foreign key (tax_component_id, store_id)
    references public.store_tax_components(id, store_id) on delete cascade
);

create unique index daily_sales_items_id_store_uniq on public.daily_sales_items(id, store_id);
create table public.daily_sales_item_tax_snapshots (
  id                         uuid primary key default gen_random_uuid(),
  store_id                   uuid not null references public.stores(id) on delete cascade,
  daily_sales_item_id        uuid not null,
  sales_channel_code         public.international_sales_channel_code not null,
  market_profile_id          uuid not null,
  market_profile_revision    integer not null check (market_profile_revision > 0),
  tax_profile_id             uuid not null,
  tax_profile_revision       integer not null check (tax_profile_revision > 0),
  country_code               public.international_country_code not null,
  region_code                text,
  currency_code              public.international_currency_code not null,
  minor_unit                 smallint not null check (minor_unit in (0, 2)),
  price_basis                public.tax_price_basis not null,
  treatment                  public.tax_treatment not null,
  tax_category               text check (tax_category is null or tax_category ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  calculation_version        public.international_tax_calculation_version not null,
  unit_price                 numeric not null check (unit_price >= 0),
  final_quantity             numeric not null check (final_quantity >= 0),
  listed_total               numeric not null check (listed_total >= 0),
  net_sales                  numeric not null check (net_sales >= 0),
  customer_total             numeric not null check (customer_total >= 0),
  tax_total                  numeric not null check (tax_total >= 0),
  merchant_tax_liability     numeric not null check (merchant_tax_liability >= 0),
  marketplace_tax_liability  numeric not null check (marketplace_tax_liability >= 0),
  input_snapshot             jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  amount_snapshot            jsonb not null check (jsonb_typeof(amount_snapshot) = 'object'),
  created_at                 timestamptz not null default clock_timestamp(),
  updated_at                 timestamptz not null default clock_timestamp(),
  unique (id, store_id),
  unique (daily_sales_item_id, sales_channel_code),
  foreign key (daily_sales_item_id, store_id)
    references public.daily_sales_items(id, store_id) on delete cascade,
  foreign key (market_profile_id, store_id)
    references public.store_market_profiles(id, store_id)
    on delete no action deferrable initially deferred,
  foreign key (tax_profile_id, store_id)
    references public.store_tax_profiles(id, store_id)
    on delete no action deferrable initially deferred,
  foreign key (country_code, region_code)
    references public.tax_region_catalog(country_code, region_code),
  check (listed_total = unit_price * final_quantity),
  check (tax_total = merchant_tax_liability + marketplace_tax_liability),
  check ((price_basis = 'tax_inclusive' and customer_total = listed_total and net_sales + tax_total = customer_total)
      or (price_basis = 'tax_exclusive' and net_sales = listed_total and net_sales + tax_total = customer_total))
);
create index daily_sales_item_tax_snapshots_item_idx
  on public.daily_sales_item_tax_snapshots(daily_sales_item_id, sales_channel_code);

create table public.daily_sales_item_tax_component_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  store_id                  uuid not null references public.stores(id) on delete cascade,
  sales_tax_snapshot_id     uuid not null,
  component_id_snapshot     uuid not null,
  kind                      public.tax_component_kind not null,
  name                      text not null check (btrim(name) <> ''),
  rate_pct                  numeric not null check (rate_pct >= 0 and rate_pct < 100),
  jurisdiction_level        public.tax_jurisdiction_level not null,
  calculation_basis         public.tax_calculation_basis not null,
  applies_to_treatments     public.tax_treatment[] not null,
  remittance_owner          public.tax_remittance_owner not null,
  unrounded_amount          numeric not null check (unrounded_amount >= 0),
  rounded_amount            numeric not null check (rounded_amount >= 0),
  unique (sales_tax_snapshot_id, component_id_snapshot),
  foreign key (sales_tax_snapshot_id, store_id)
    references public.daily_sales_item_tax_snapshots(id, store_id) on delete cascade,
  check (cardinality(applies_to_treatments) > 0),
  check (array_position(applies_to_treatments, null) is null),
  check (kind <> 'primary' or calculation_basis = 'primary_tax_exclusive')
);
create index daily_sales_item_tax_components_parent_idx
  on public.daily_sales_item_tax_component_snapshots(sales_tax_snapshot_id);

create table public.sales_tax_events (
  id                       uuid primary key default gen_random_uuid(),
  store_id                 uuid not null references public.stores(id) on delete cascade,
  daily_sales_item_id      uuid not null,
  sales_channel_code       public.international_sales_channel_code not null,
  component_id_snapshot    uuid not null,
  delta_amount             numeric not null check (delta_amount <> 0),
  target_quantity          numeric not null check (target_quantity >= 0),
  calculation_version      public.international_tax_calculation_version not null,
  business_day_revision_no integer not null check (business_day_revision_no >= 0),
  reverses_event_id        uuid references public.sales_tax_events(id)
                              on delete no action deferrable initially deferred,
  created_at               timestamptz not null default clock_timestamp(),
  foreign key (daily_sales_item_id, store_id)
    references public.daily_sales_items(id, store_id) on delete cascade
);
create index sales_tax_events_line_idx
  on public.sales_tax_events(daily_sales_item_id, sales_channel_code, component_id_snapshot, created_at, id);

-- 스냅샷의 중복 필드는 과거 표시를 위한 것이지 서로 다른 값을 허용하는 탈출구가 아니다.
create or replace function public.guard_sales_tax_snapshot_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m public.store_market_profiles%rowtype;
  t public.store_tax_profiles%rowtype;
  i public.daily_sales_items%rowtype;
  d public.daily_sales%rowtype;
  o public.menu_tax_overrides%rowtype;
  v_treatment public.tax_treatment;
  v_minor smallint;
  v_has_override boolean := false;
begin
  select * into m from public.store_market_profiles
   where id = new.market_profile_id and store_id = new.store_id;
  select * into t from public.store_tax_profiles
   where id = new.tax_profile_id and store_id = new.store_id;
  if m.id is null or t.id is null or t.market_profile_id <> m.id then
    raise exception '판매 세금 스냅샷의 프로필 연결이 맞지 않아요'
      using errcode = '23514', detail = 'TAX_SNAPSHOT_PROFILE_MISMATCH';
  end if;
  select * into i from public.daily_sales_items
   where id = new.daily_sales_item_id and store_id = new.store_id;
  if i.id is null then
    raise exception '판매 세금 스냅샷의 판매행을 찾을 수 없어요'
      using errcode = '23514', detail = 'TAX_SNAPSHOT_SALES_ITEM_MISMATCH';
  end if;
  select * into d from public.daily_sales where id = i.daily_sales_id and store_id = new.store_id;
  if d.id is null
     or d.sale_date < m.effective_from
     or (m.effective_to is not null and d.sale_date > m.effective_to)
     or d.sale_date < t.effective_from
     or (t.effective_to is not null and d.sale_date > t.effective_to) then
    raise exception '판매일에 적용되는 시장·세금 프로필이 아니에요'
      using errcode = '23514', detail = 'TAX_SNAPSHOT_OUTSIDE_PROFILE_RANGE';
  end if;
  if new.market_profile_revision <> m.revision
     or new.tax_profile_revision <> t.revision
     or new.country_code <> m.country_code
     or new.region_code is distinct from m.region_code
     or new.currency_code <> m.currency_code
     or new.price_basis <> m.price_basis then
    raise exception '판매 세금 스냅샷의 시장·세금 판본 값이 원본과 달라요'
      using errcode = '23514', detail = 'TAX_SNAPSHOT_SOURCE_MISMATCH';
  end if;
  v_minor := public.international_currency_minor_unit(new.currency_code);
  if new.minor_unit <> v_minor then
    raise exception '판매 세금 스냅샷의 통화 소수 자릿수가 맞지 않아요'
      using errcode = '23514', detail = 'TAX_SNAPSHOT_MINOR_UNIT_MISMATCH';
  end if;
  if tg_op = 'INSERT' then
    if i.recipe_id is not null then
      select * into o from public.menu_tax_overrides
       where recipe_id = i.recipe_id and tax_profile_id = new.tax_profile_id;
      v_has_override := found;
    end if;
    if v_has_override then
      if o.tax_category is not null then
        if new.tax_category is distinct from o.tax_category then
          raise exception '메뉴 과세 카테고리가 판매 스냅샷에 반영되지 않았어요'
            using errcode = '23514', detail = 'TAX_SNAPSHOT_MENU_OVERRIDE_MISMATCH';
        end if;
      elsif new.tax_category is not null or new.treatment is distinct from o.treatment then
        raise exception '메뉴 과세 상태가 판매 스냅샷에 반영되지 않았어요'
          using errcode = '23514', detail = 'TAX_SNAPSHOT_MENU_OVERRIDE_MISMATCH';
      end if;
    elsif new.tax_category is not null or new.treatment is distinct from t.default_treatment then
      raise exception '메뉴 override가 없으면 세금 프로필 기본 과세 상태를 사용해야 해요'
        using errcode = '23514', detail = 'TAX_SNAPSHOT_DEFAULT_TREATMENT_MISMATCH';
    end if;
  end if;
  if new.tax_category is not null then
    select c.treatment into v_treatment from public.tax_category_catalog c
     where c.tax_profile_id = new.tax_profile_id and c.code = new.tax_category and c.active;
    if v_treatment is null or v_treatment <> new.treatment then
      raise exception '판매 세금 스냅샷의 과세 분류와 상태가 맞지 않아요'
        using errcode = '23514', detail = 'TAX_SNAPSHOT_CATEGORY_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
create trigger daily_sales_item_tax_snapshots_10_source_guard
before insert or update on public.daily_sales_item_tax_snapshots
for each row execute function public.guard_sales_tax_snapshot_source();

create or replace function public.guard_sales_tax_component_snapshot_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s public.daily_sales_item_tax_snapshots%rowtype;
  c public.store_tax_components%rowtype;
  v_owner public.tax_remittance_owner;
begin
  select * into s from public.daily_sales_item_tax_snapshots
   where id = new.sales_tax_snapshot_id and store_id = new.store_id;
  select * into c from public.store_tax_components
   where id = new.component_id_snapshot and store_id = new.store_id;
  select r.remittance_owner into v_owner from public.channel_tax_remittance r
   where r.tax_component_id = new.component_id_snapshot
     and r.sales_channel_code = s.sales_channel_code;
  if s.id is null or c.id is null or c.tax_profile_id <> s.tax_profile_id then
    raise exception '판매 세금 구성 스냅샷의 원본 연결이 맞지 않아요'
      using errcode = '23514', detail = 'TAX_COMPONENT_SNAPSHOT_PROFILE_MISMATCH';
  end if;
  if new.kind <> c.kind or new.name <> c.name or new.rate_pct <> c.rate_pct
     or new.jurisdiction_level <> c.jurisdiction_level
     or new.calculation_basis <> c.calculation_basis
     or new.applies_to_treatments <> c.applies_to_treatments then
    raise exception '판매 세금 구성 스냅샷의 원본 값이 달라요'
      using errcode = '23514', detail = 'TAX_COMPONENT_SNAPSHOT_SOURCE_MISMATCH';
  end if;
  if v_owner is null or new.remittance_owner <> v_owner then
    raise exception '판매 세금 구성 스냅샷의 채널 납부 주체가 맞지 않아요'
      using errcode = '23514', detail = 'TAX_COMPONENT_SNAPSHOT_REMITTANCE_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger daily_sales_item_tax_components_10_source_guard
before insert or update on public.daily_sales_item_tax_component_snapshots
for each row execute function public.guard_sales_tax_component_snapshot_source();

create or replace function public.guard_sales_tax_event_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare s public.daily_sales_item_tax_snapshots%rowtype;
begin
  select * into s from public.daily_sales_item_tax_snapshots
   where daily_sales_item_id = new.daily_sales_item_id
     and sales_channel_code = new.sales_channel_code
     and store_id = new.store_id;
  if s.id is null or s.calculation_version <> new.calculation_version
     or not exists (
       select 1 from public.daily_sales_item_tax_component_snapshots c
        where c.sales_tax_snapshot_id = s.id
          and c.component_id_snapshot = new.component_id_snapshot
          and c.store_id = new.store_id
     ) then
    raise exception '판매 세금 이벤트의 스냅샷 원본을 찾을 수 없어요'
      using errcode = '23514', detail = 'SALES_TAX_EVENT_SOURCE_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger sales_tax_events_source_guard
before insert on public.sales_tax_events
for each row execute function public.guard_sales_tax_event_source();

-- ── 같은 매장·날짜에 프로필 두 개가 답하지 못하게 한다 ─────────────────────
create or replace function public.guard_market_profile_range()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('intl-market:' || new.store_id::text, 0));
  if exists (
    select 1 from public.store_market_profiles p
     where p.store_id = new.store_id and p.id <> new.id
       and daterange(p.effective_from, p.effective_to, '[]')
           && daterange(new.effective_from, new.effective_to, '[]')
  ) then
    raise exception '시장 프로필의 적용 기간이 겹쳐요'
      using errcode = '23505', detail = 'MARKET_PROFILE_OVERLAP';
  end if;
  return new;
end;
$$;
create trigger store_market_profiles_10_range_guard
before insert or update on public.store_market_profiles
for each row execute function public.guard_market_profile_range();

create or replace function public.guard_tax_profile_range()
returns trigger
language plpgsql
set search_path = public
as $$
declare m public.store_market_profiles%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('intl-tax:' || new.store_id::text, 0));
  select * into m from public.store_market_profiles
   where id = new.market_profile_id and store_id = new.store_id;
  if not found then
    raise exception '같은 매장의 시장 프로필을 찾을 수 없어요'
      using errcode = '23503', detail = 'MARKET_PROFILE_NOT_FOUND';
  end if;
  if new.effective_from < m.effective_from
     or (m.effective_to is not null and (new.effective_to is null or new.effective_to > m.effective_to)) then
    raise exception '세금 프로필은 시장 프로필의 적용 기간 안에 있어야 해요'
      using errcode = '23514', detail = 'TAX_PROFILE_OUTSIDE_MARKET_RANGE';
  end if;
  if exists (
    select 1 from public.store_tax_profiles p
     where p.store_id = new.store_id and p.id <> new.id
       and daterange(p.effective_from, p.effective_to, '[]')
           && daterange(new.effective_from, new.effective_to, '[]')
  ) then
    raise exception '세금 프로필의 적용 기간이 겹쳐요'
      using errcode = '23505', detail = 'TAX_PROFILE_OVERLAP';
  end if;
  return new;
end;
$$;
create trigger store_tax_profiles_10_range_guard
before insert or update on public.store_tax_profiles
for each row execute function public.guard_tax_profile_range();

-- profile_id + revision이 가리키는 계산 내용은 불변이다. 적용 구간은 열린 행을 한 번
-- 닫는 방향(null -> date)으로만 바꿀 수 있고, 닫힌 구간을 다시 열거나 옮기지 않는다.
-- 새 내용은 새 profile 행과 revision으로 만든다.
create or replace function public.guard_profile_version_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'effective_to') is distinct from
     (to_jsonb(old) - 'effective_to') then
    raise exception '프로필 내용은 기존 판본에서 바꿀 수 없어요'
      using errcode = '23514', detail = 'PROFILE_VERSION_IMMUTABLE';
  end if;
  if old.effective_to is not null
     and new.effective_to is distinct from old.effective_to then
    raise exception '이미 닫힌 프로필의 적용 종료일은 다시 열거나 옮길 수 없어요'
      using errcode = '23514', detail = 'PROFILE_RANGE_IMMUTABLE_AFTER_CLOSE';
  end if;
  return new;
end;
$$;
create trigger store_market_profiles_90_version_guard
before update on public.store_market_profiles
for each row execute function public.guard_profile_version_immutable();
create trigger store_tax_profiles_90_version_guard
before update on public.store_tax_profiles
for each row execute function public.guard_profile_version_immutable();

-- 시장 프로필을 닫을 때 그 안의 세금 프로필을 밖에 남기지 않는다. 세금 프로필을 먼저
-- 같은 날짜 이하로 닫은 뒤 시장 프로필을 닫아야 한다.
create or replace function public.guard_market_profile_children_in_range()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.effective_to is not null and exists (
    select 1 from public.store_tax_profiles t
     where t.market_profile_id = new.id
       and (t.effective_from < new.effective_from
         or t.effective_to is null
         or t.effective_to > new.effective_to)
  ) then
    raise exception '시장 프로필의 적용 기간 밖에 세금 프로필을 남길 수 없어요'
      using errcode = '23514', detail = 'TAX_PROFILE_OUTSIDE_MARKET_RANGE';
  end if;
  if new.effective_to is not null and exists (
    select 1
      from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id = s.daily_sales_item_id
      join public.daily_sales d on d.id = i.daily_sales_id
     where s.market_profile_id = new.id
       and d.sale_date > new.effective_to
  ) then
    raise exception '판매에 사용한 날짜보다 앞에서 시장 프로필을 닫을 수 없어요'
      using errcode = '23514', detail = 'MARKET_PROFILE_SALES_OUTSIDE_RANGE';
  end if;
  return new;
end;
$$;
create trigger store_market_profiles_20_children_guard
before update of effective_to on public.store_market_profiles
for each row execute function public.guard_market_profile_children_in_range();

create or replace function public.guard_tax_profile_sales_in_range()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.effective_to is not null and exists (
    select 1
      from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id = s.daily_sales_item_id
      join public.daily_sales d on d.id = i.daily_sales_id
     where s.tax_profile_id = new.id
       and d.sale_date > new.effective_to
  ) then
    raise exception '판매에 사용한 날짜보다 앞에서 세금 프로필을 닫을 수 없어요'
      using errcode = '23514', detail = 'TAX_PROFILE_SALES_OUTSIDE_RANGE';
  end if;
  return new;
end;
$$;
create trigger store_tax_profiles_20_sales_guard
before update of effective_to on public.store_tax_profiles
for each row execute function public.guard_tax_profile_sales_in_range();

create or replace function public.guard_tax_component_version_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'sort_order') is distinct from
     (to_jsonb(old) - 'sort_order') then
    raise exception '세금 구성 항목은 새 세금 프로필 판본에서 바꿔야 해요'
      using errcode = '23514', detail = 'TAX_COMPONENT_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger store_tax_components_version_guard
before update on public.store_tax_components
for each row execute function public.guard_tax_component_version_immutable();

create or replace function public.guard_tax_category_version_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.store_id <> old.store_id
     or new.tax_profile_id <> old.tax_profile_id or new.code <> old.code
     or new.treatment <> old.treatment or new.active <> old.active then
    raise exception '과세 카테고리의 계산 의미는 기존 세금 프로필 판본에서 바꿀 수 없어요'
      using errcode = '23514', detail = 'TAX_CATEGORY_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger tax_category_catalog_version_guard
before update on public.tax_category_catalog
for each row execute function public.guard_tax_category_version_immutable();

create or replace function public.guard_menu_tax_override_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tax_category is not null and not exists (
    select 1 from public.tax_category_catalog c
     where c.tax_profile_id = new.tax_profile_id
       and c.code = new.tax_category
       and c.active
  ) then
    raise exception '활성 과세 카테고리만 메뉴 override에 연결할 수 있어요'
      using errcode = '23514', detail = 'MENU_TAX_CATEGORY_INACTIVE';
  end if;
  return new;
end;
$$;
create trigger menu_tax_overrides_10_source_guard
before insert or update on public.menu_tax_overrides
for each row execute function public.guard_menu_tax_override_source();

create or replace function public.guard_menu_tax_override_version_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from
     (to_jsonb(old) - 'updated_at') then
    raise exception '메뉴 과세 override는 새 세금 프로필 판본에서 바꿔야 해요'
      using errcode = '23514', detail = 'MENU_TAX_OVERRIDE_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger menu_tax_overrides_90_version_guard
before update on public.menu_tax_overrides
for each row execute function public.guard_menu_tax_override_version_immutable();

create or replace function public.guard_tax_remittance_version_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new is distinct from old then
    raise exception '채널 납부 주체는 새 세금 프로필 판본에서 바꿔야 해요'
      using errcode = '23514', detail = 'TAX_REMITTANCE_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger channel_tax_remittance_version_guard
before update on public.channel_tax_remittance
for each row execute function public.guard_tax_remittance_version_immutable();

-- 프로필 하위행은 프로필을 조립하는 동안에는 INSERT/DELETE할 수 있다. 판매 스냅샷이
-- 한 건이라도 생기면 같은 profile_id + revision의 계산 의미를 바꾸지 못하도록 봉인한다.
-- 승인된 매장 물리 삭제는 아래 append-only 원장과 같은 감사 경계로만 통과한다.
create or replace function public.guard_tax_profile_child_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile uuid;
  v_store uuid;
begin
  if tg_table_name = 'store_tax_components' then
    v_profile := case when tg_op = 'DELETE' then old.tax_profile_id else new.tax_profile_id end;
    v_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  elsif tg_table_name = 'tax_category_catalog' then
    v_profile := case when tg_op = 'DELETE' then old.tax_profile_id else new.tax_profile_id end;
    v_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  elsif tg_table_name = 'menu_tax_overrides' then
    v_profile := case when tg_op = 'DELETE' then old.tax_profile_id else new.tax_profile_id end;
    v_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
  elsif tg_table_name = 'channel_tax_remittance' then
    v_store := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
    select c.tax_profile_id into v_profile
      from public.store_tax_components c
     where c.id = case when tg_op = 'DELETE' then old.tax_component_id else new.tax_component_id end
       and c.store_id = v_store;
  else
    raise exception '알 수 없는 세금 프로필 하위 표예요'
      using errcode = '23514', detail = 'UNKNOWN_TAX_PROFILE_CHILD_TABLE';
  end if;

  if tg_op = 'DELETE'
     and current_setting('margincook.store_purge_id', true) = v_store::text then
    if exists (
      select 1 from public.store_lifecycle_events e
       where e.store_id = v_store
         and e.event_type = 'physical_purge'
         and coalesce(btrim(e.approval_reference), '') <> ''
         and coalesce(btrim(e.backup_reference), '') <> ''
    ) then
      return old;
    end if;
    raise exception '승인·백업 감사 없는 매장 물리 삭제는 세금 프로필 봉인을 풀 수 없어요'
      using errcode = '42501', detail = 'STORE_PURGE_AUDIT_REQUIRED';
  end if;

  if exists (
    select 1 from public.daily_sales_item_tax_snapshots s
     where s.tax_profile_id = v_profile
  ) then
    raise exception '판매에 사용한 세금 프로필의 하위 계산값은 새 판본에서 바꿔야 해요'
      using errcode = '23514', detail = 'TAX_PROFILE_CHILDREN_SEALED';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger store_tax_components_membership_guard
before insert or delete on public.store_tax_components
for each row execute function public.guard_tax_profile_child_membership();
create trigger tax_category_catalog_membership_guard
before insert or delete on public.tax_category_catalog
for each row execute function public.guard_tax_profile_child_membership();
create trigger menu_tax_overrides_membership_guard
before insert or delete on public.menu_tax_overrides
for each row execute function public.guard_tax_profile_child_membership();
create trigger channel_tax_remittance_membership_guard
before insert or delete on public.channel_tax_remittance
for each row execute function public.guard_tax_profile_child_membership();

-- 판매 세금 스냅샷은 목표 수량·금액만 갱신한다. 프로필·통화·과세 상태·계산 판본과
-- 구성 항목의 의미는 판매 시점 사실이며, 직접 삭제는 승인된 매장 물리 삭제만 허용한다.
create or replace function public.guard_sales_tax_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_store uuid := case when tg_op = 'DELETE' then old.store_id else new.store_id end;
begin
  if tg_op = 'DELETE' then
    if current_setting('margincook.store_purge_id', true) = v_store::text then
      if exists (
        select 1 from public.store_lifecycle_events e
         where e.store_id = v_store
           and e.event_type = 'physical_purge'
           and coalesce(btrim(e.approval_reference), '') <> ''
           and coalesce(btrim(e.backup_reference), '') <> ''
      ) then
        return old;
      end if;
      raise exception '승인·백업 감사 없는 매장 물리 삭제는 세금 스냅샷을 지울 수 없어요'
        using errcode = '42501', detail = 'STORE_PURGE_AUDIT_REQUIRED';
    end if;
    raise exception '판매 세금 스냅샷은 직접 지울 수 없어요'
      using errcode = '42501', detail = 'SALES_TAX_SNAPSHOT_DELETE_FORBIDDEN';
  end if;

  if tg_table_name = 'daily_sales_item_tax_snapshots' then
    if (to_jsonb(new) - array[
          'final_quantity', 'listed_total', 'net_sales', 'customer_total', 'tax_total',
          'merchant_tax_liability', 'marketplace_tax_liability',
          'input_snapshot', 'amount_snapshot', 'updated_at'
        ]::text[]) is distinct from
       (to_jsonb(old) - array[
          'final_quantity', 'listed_total', 'net_sales', 'customer_total', 'tax_total',
          'merchant_tax_liability', 'marketplace_tax_liability',
          'input_snapshot', 'amount_snapshot', 'updated_at'
        ]::text[]) then
      raise exception '판매 세금 스냅샷의 프로필·통화·과세 판본은 바꿀 수 없어요'
        using errcode = '23514', detail = 'SALES_TAX_SNAPSHOT_IDENTITY_IMMUTABLE';
    end if;
  elsif tg_table_name = 'daily_sales_item_tax_component_snapshots' then
    if (to_jsonb(new) - array['unrounded_amount', 'rounded_amount']::text[]) is distinct from
       (to_jsonb(old) - array['unrounded_amount', 'rounded_amount']::text[]) then
      raise exception '판매 세금 구성 스냅샷의 항목 의미는 바꿀 수 없어요'
        using errcode = '23514', detail = 'SALES_TAX_COMPONENT_IDENTITY_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;
create trigger daily_sales_item_tax_snapshots_90_identity_guard
before update or delete on public.daily_sales_item_tax_snapshots
for each row execute function public.guard_sales_tax_snapshot_mutation();
create trigger daily_sales_item_tax_components_90_identity_guard
before update or delete on public.daily_sales_item_tax_component_snapshots
for each row execute function public.guard_sales_tax_snapshot_mutation();

create or replace function public.reject_sales_tax_snapshot_truncate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '판매 세금 스냅샷은 비울 수 없어요'
    using errcode = '42501', detail = 'SALES_TAX_SNAPSHOT_TRUNCATE_FORBIDDEN';
end;
$$;
create trigger daily_sales_item_tax_snapshots_immutable_truncate
before truncate on public.daily_sales_item_tax_snapshots
for each statement execute function public.reject_sales_tax_snapshot_truncate();
create trigger daily_sales_item_tax_components_immutable_truncate
before truncate on public.daily_sales_item_tax_component_snapshots
for each statement execute function public.reject_sales_tax_snapshot_truncate();

create or replace function public.reject_sales_tax_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception '판매 세금 이벤트 원장은 비울 수 없어요'
      using errcode = '42501', detail = 'SALES_TAX_EVENTS_APPEND_ONLY';
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
    raise exception '승인·백업 감사 없는 매장 물리 삭제는 세금 원장을 지울 수 없어요'
      using errcode = '42501', detail = 'STORE_PURGE_AUDIT_REQUIRED';
  end if;
  raise exception '판매 세금 이벤트 원장은 바꾸거나 지울 수 없어요'
    using errcode = '42501', detail = 'SALES_TAX_EVENTS_APPEND_ONLY';
end;
$$;
create trigger sales_tax_events_immutable_row
before update or delete on public.sales_tax_events
for each row execute function public.reject_sales_tax_event_mutation();
create trigger sales_tax_events_immutable_truncate
before truncate on public.sales_tax_events
for each statement execute function public.reject_sales_tax_event_mutation();

comment on function public.reject_sales_tax_event_mutation() is
  '판매 세금 이벤트는 append-only다. 보존 종료·승인·백업을 확인한 purge_archived_store가 같은 매장을 물리 삭제할 때만 cascade DELETE를 허용한다.';

-- ── 앱은 표를 직접 읽거나 쓰지 않는다. 뒤 단계의 RPC executor만 접근한다 ──────────
do $rls$
declare t text;
begin
  foreach t in array array[
    'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
    'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
    'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
    'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('revoke all on table public.%I from service_role', t);
  end loop;
end
$rls$;

create policy tax_region_catalog_rpc on public.tax_region_catalog
  for select to margincook_rpc_executor using (true);
grant select on public.tax_region_catalog to margincook_rpc_executor;

do $store_policies$
declare t text;
begin
  foreach t in array array[
    'store_market_profiles', 'store_tax_profiles', 'store_tax_components',
    'tax_category_catalog', 'menu_tax_overrides', 'channel_tax_remittance',
    'daily_sales_item_tax_snapshots', 'daily_sales_item_tax_component_snapshots'
  ] loop
    execute format(
      'create policy %1$I_rpc on public.%1$I for all to margincook_rpc_executor ' ||
      'using (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null)) ' ||
      'with check (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null))', t);
    execute format('grant select, insert, update, delete on public.%I to margincook_rpc_executor', t);
  end loop;
end
$store_policies$;

create policy sales_tax_events_rpc_read on public.sales_tax_events
  for select to margincook_rpc_executor
  using (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null));
create policy sales_tax_events_rpc_insert on public.sales_tax_events
  for insert to margincook_rpc_executor
  with check (store_id in (select id from public.stores where owner_id = auth.uid() and archived_at is null));
grant select, insert on public.sales_tax_events to margincook_rpc_executor;
revoke update, delete, truncate on public.sales_tax_events
  from margincook_rpc_executor, service_role;
revoke delete, truncate on public.daily_sales_item_tax_snapshots,
  public.daily_sales_item_tax_component_snapshots from margincook_rpc_executor, service_role;

revoke all on function public.international_currency_minor_unit(public.international_currency_code)
  from public, anon, authenticated;
grant execute on function public.international_currency_minor_unit(public.international_currency_code)
  to margincook_rpc_executor, service_role;

comment on table public.store_market_profiles is
  'INTL-1B 매장 시장 프로필. 국가·통화·업무 로케일·가격 포함 여부를 유효기간별로 고정한다.';
comment on table public.store_tax_profiles is
  'INTL-1B 세금 프로필. 시장 프로필 안에서 다음 미개장 영업일부터 적용할 판본 단위다.';
comment on table public.store_tax_components is
  '법정 표면 세율의 기본세·추가세 구성. 포함가의 유효 세율을 입력하지 않으며 sort_order는 계산 순서가 아닌 표시 전용이다.';
comment on table public.menu_tax_overrides is
  '메뉴 과세 상태. 프로필 tax_category 또는 명시적 treatment 중 정확히 하나를 저장한다.';
comment on table public.channel_tax_remittance is
  '세금 구성 항목×판매 채널의 납부 주체. 판매 1회성 override는 두지 않는다.';
comment on table public.daily_sales_item_tax_snapshots is
  '영업일×메뉴×판매 채널의 국제 세금 입력·합계 스냅샷. INTL-1D 계산 몸통이 채운다.';
comment on table public.daily_sales_item_tax_component_snapshots is
  '판매 시점 세금 구성 항목의 이름·세율·기준·납부 주체·금액 스냅샷.';
comment on table public.sales_tax_events is
  '판매 세금 목표 금액 변화 append-only 원장. 취소·정정은 반대 부호 또는 목표 차이 이벤트로 남기고, 승인된 매장 물리 삭제에서만 함께 제거한다.';

-- ── 사후조건: 빈 확장 스키마일 뿐 현재 계산·capability는 바뀌지 않는다 ─────────
do $verify$
declare
  v_bad integer;
  v_cap jsonb := public.app_capabilities();
begin
  select count(*) into v_bad
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name)
   where to_regclass('public.' || t.name) is null;
  if v_bad <> 0 then
    raise exception '0179: 국제 세금 테이블 %개가 없습니다', v_bad;
  end if;

  select count(*) into v_bad
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name), unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) p(privilege_name)
   where has_table_privilege('authenticated', 'public.' || t.name, p.privilege_name)
      or has_table_privilege('anon', 'public.' || t.name, p.privilege_name);
  if v_bad <> 0 then
    raise exception '0179: 앱 롤에 국제 세금 표 권한이 %개 열렸습니다', v_bad;
  end if;

  if position('margincook.store_purge_id' in
       pg_get_functiondef('public.reject_sales_tax_event_mutation()'::regprocedure)) = 0 then
    raise exception '0179: 판매 세금 이벤트의 승인된 매장 purge 경계가 없습니다';
  end if;
  if has_table_privilege('margincook_rpc_executor', 'public.sales_tax_events', 'DELETE')
     or has_table_privilege('service_role', 'public.sales_tax_events', 'DELETE') then
    raise exception '0179: 판매 세금 이벤트 DELETE 권한이 실행 역할에 열려 있습니다';
  end if;
  if has_table_privilege('margincook_rpc_executor', 'public.tax_region_catalog', 'INSERT')
     or has_table_privilege('margincook_rpc_executor', 'public.tax_region_catalog', 'UPDATE')
     or has_table_privilege('margincook_rpc_executor', 'public.tax_region_catalog', 'DELETE') then
    raise exception '0179: 제품 소유 관할 카탈로그가 RPC 실행 역할에 쓰기로 열려 있습니다';
  end if;
  if exists (
    select 1
      from pg_trigger tr
     where tr.tgrelid in ('public.store_market_profiles'::regclass,
                          'public.store_tax_profiles'::regclass)
       and not tr.tgisinternal
       and tr.tgname like '%_00_version_guard'
  ) or (select max(tr.tgname) from pg_trigger tr
         where tr.tgrelid = 'public.store_market_profiles'::regclass
           and not tr.tgisinternal
           and (tr.tgtype & 2) = 2)
       <> 'store_market_profiles_90_version_guard'
     or (select max(tr.tgname) from pg_trigger tr
         where tr.tgrelid = 'public.store_tax_profiles'::regclass
           and not tr.tgisinternal
           and (tr.tgtype & 2) = 2)
       <> 'store_tax_profiles_90_version_guard'
  then
    raise exception '0179: 프로필 판본 가드의 마지막 실행 순서가 보장되지 않습니다';
  end if;
  select count(*) into v_bad
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name), unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) p(privilege_name)
   where has_table_privilege('service_role', 'public.' || t.name, p.privilege_name);
  if v_bad <> 0 then
    raise exception '0179: service_role에 국제 세금 표 직접 쓰기 권한이 %개 열렸습니다', v_bad;
  end if;
  if exists (
    select 1 from unnest(enum_range(null::public.international_currency_code)) c
     where public.international_currency_minor_unit(c) is distinct from
       case c when 'KRW' then 0::smallint else 2::smallint end
  ) then
    raise exception '0179: 통화 minor unit 함수가 출시 계약과 다릅니다';
  end if;

  if (v_cap#>>'{international_tax,read_enabled}')::boolean
     or (v_cap#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0179: schema 단계에서 국제 세금 capability를 켰습니다';
  end if;
  if abs(public.tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909}]'::jsonb)
         - 12000 * 10 / 110.0) > 0.01 then
    raise exception '0179: 현행 0090 세금 계산이 바뀌었습니다';
  end if;
end
$verify$;

commit;
