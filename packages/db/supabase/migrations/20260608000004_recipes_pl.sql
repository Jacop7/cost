-- ════════════════════════════════════════════════════════════════
-- 0004 · 레시피·손익 + 월 경영 + 설정
-- ⑤ 2.1 레시피·손익 / 월 경영 / 설정 그룹.
-- ════════════════════════════════════════════════════════════════

create table recipes (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references stores (id) on delete cascade,
  name                text not null,
  price               numeric not null default 0,        -- 판매가
  tax_mode            tax_mode not null default 'included',
  tax_items           text[] not null default '{}',      -- 별도/면세 세금 항목
  base_servings       int  not null default 1 check (base_servings > 0), -- 기준 인분 N
  target_profit_rate  numeric(5,2) not null default 0,   -- 목표 순이익률 (%)
  avg_monthly_sales   numeric,                           -- 월 평균 판매량 (배분용)
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index recipes_store_idx on recipes (store_id, active);
create trigger recipes_touch before update on recipes
  for each row execute function public.touch_updated_at();

create table recipe_lines (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  recipe_id     uuid not null references recipes (id) on delete cascade,
  ingredient_id uuid references ingredients (id) on delete restrict,  -- 사용중 삭제 보호
  sub_recipe_id uuid references recipes (id) on delete restrict,      -- 반제품(2차)
  input_qty     numeric not null check (input_qty >= 0),              -- N인분 기준 입력량(기준단위)
  check (num_nonnulls(ingredient_id, sub_recipe_id) = 1)              -- 둘 중 하나만 참조
);
create index recipe_lines_recipe_idx on recipe_lines (recipe_id);
create index recipe_lines_ingredient_idx on recipe_lines (ingredient_id);

create table recipe_extra_costs (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores (id) on delete cascade,
  recipe_id          uuid not null references recipes (id) on delete cascade,
  name               text not null,
  amount_per_serving numeric not null default 0           -- 1인분 정액(원)
);
create index recipe_extra_costs_recipe_idx on recipe_extra_costs (recipe_id);

-- 순이익 추이 스냅샷 (파생, ② 3.8) — E1~E4 변경에서 점 생성
create table profit_trends (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  recipe_id     uuid not null references recipes (id) on delete cascade,
  trend_date    date not null,
  profit_rate   numeric(5,2) not null,                   -- 순이익률 (%)
  material_rate numeric(5,2) not null,                   -- 재료 원가율 (%)
  cause         trend_cause not null,                    -- 원인 색 점
  created_at    timestamptz not null default now()
);
create index profit_trends_recipe_idx on profit_trends (recipe_id, trend_date);

-- 고정 지출(월) (② 2.4 · ④ 2)
create table fixed_costs_monthly (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'
  total_revenue numeric not null default 0,              -- 총매출
  items         jsonb not null default '[]',             -- [{key,mode,total,lines[]}]
  updated_at    timestamptz not null default now(),
  unique (store_id, month)
);
create trigger fixed_costs_touch before update on fixed_costs_monthly
  for each row execute function public.touch_updated_at();

-- 월 손익 (파생, ④ 3) — 매출 − 고정 − 재료비(해당 월 입고 확정 합계)
create table monthly_pl (
  store_id       uuid not null references stores (id) on delete cascade,
  month          text not null check (month ~ '^\d{4}-\d{2}$'),
  revenue        numeric not null default 0,
  fixed_cost     numeric not null default 0,
  material_cost  numeric not null default 0,             -- 해당 월 입고 확정 합계
  profit         numeric not null default 0,
  profit_rate    numeric(5,2) not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (store_id, month)
);

-- 설정 (④) — 매장당 1행
create table settings (
  store_id                   uuid primary key references stores (id) on delete cascade,
  unit_system                text not null default 'metric',  -- 1차 metric 고정
  cup_volume                 numeric not null default 200,     -- 조리컵 ml
  default_target_profit_rate numeric(5,2) not null default 40, -- 목표 순이익률 기본값
  alert_morning_summary      boolean not null default true,
  alert_inbound_delay        boolean not null default true,
  alert_price_spike          boolean not null default true,
  alert_target_miss          boolean not null default true,
  updated_at                 timestamptz not null default now()
);
create trigger settings_touch before update on settings
  for each row execute function public.touch_updated_at();
