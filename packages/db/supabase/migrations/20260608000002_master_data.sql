-- ════════════════════════════════════════════════════════════════
-- 0002 · 기준정보 (카테고리 · 식재료 · 구매처 · 브랜드 · 구매옵션)
-- ⑤ 2.1 기준정보 그룹. 식재료가 모든 흐름의 허브.
-- ════════════════════════════════════════════════════════════════

create table categories (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references stores (id) on delete cascade,
  name              text not null,
  sort_order        int  not null default 0,
  default_loss_rate numeric(5,2) not null default 0,   -- 분류별 로스율 기본값 (%)
  created_at        timestamptz not null default now()
);
create index categories_store_idx on categories (store_id, sort_order);

create table vendors (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores (id) on delete cascade,
  name      text not null,
  hidden    boolean not null default false
);
create index vendors_store_idx on vendors (store_id);

create table brands (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references stores (id) on delete cascade,
  name      text not null,
  hidden    boolean not null default false
);
create index brands_store_idx on brands (store_id);

create table ingredients (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references stores (id) on delete cascade,
  name                 text not null,
  category_id          uuid references categories (id) on delete set null,
  base_unit            base_unit not null,                 -- g/ml/ea
  per_volume           numeric not null check (per_volume > 0), -- 개당 용량(기준단위). ea면 포장당 개수
  purchase_unit_label  text,                                -- 통/단/박스 (표시용)
  loss_rate            numeric(5,2) not null default 0,     -- 추정 로스율 (%)
  safety_stock         numeric not null default 0,          -- 안전재고 (개수)
  min_order_qty        numeric not null default 1,          -- 최소 발주 (개수)
  default_vendor_id    uuid references vendors (id) on delete set null,
  memo                 text,
  active               boolean not null default true,       -- 사용중 삭제는 비활성 전환 (B-08)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index ingredients_store_idx on ingredients (store_id);
create index ingredients_category_idx on ingredients (category_id);
create trigger ingredients_touch before update on ingredients
  for each row execute function public.touch_updated_at();

create table purchase_options (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  purchase_name text not null,                              -- 구매식재료명
  vendor_id     uuid references vendors (id) on delete set null,
  brand_id      uuid references brands (id) on delete set null,
  volume        numeric not null check (volume > 0),        -- 용량(기준단위)
  amount        numeric not null check (amount >= 0),       -- 금액(원)
  url           text,
  hidden        boolean not null default false,             -- 단종/품절 보관
  created_at    timestamptz not null default now()
);
create index purchase_options_ingredient_idx on purchase_options (ingredient_id);
