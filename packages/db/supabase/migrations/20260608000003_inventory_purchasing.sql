-- ════════════════════════════════════════════════════════════════
-- 0003 · 재고·구매 (재고상태 · 재고이벤트 · 발주레코드 · 후보 · 계산실행 · 단가추이)
-- ⑤ 2.1 재고·구매 그룹. 재고·단가·이력은 E1·E2·E5 에서만 변동.
-- ════════════════════════════════════════════════════════════════

-- 식재료 1:1 현재 재고 상태 (① 4.7)
create table inventory_states (
  ingredient_id   uuid primary key references ingredients (id) on delete cascade,
  store_id        uuid not null references stores (id) on delete cascade,
  sealed_count    numeric not null default 0,            -- 미개봉 수
  opened_count    smallint not null default 0 check (opened_count in (0,1)), -- 개봉 0/1
  opened_remain   numeric,                               -- 개봉분 남은 양(기준단위, 선택)
  soon_out        boolean not null default false,        -- 곧소진 플래그
  last_inbound_at date,
  updated_at      timestamptz not null default now()
);
create index inventory_states_store_idx on inventory_states (store_id);
create trigger inventory_states_touch before update on inventory_states
  for each row execute function public.touch_updated_at();

-- 재고 이벤트 원장 (입고/소진/폐기/실사/조정). 폐기 누적 → 실측 로스율
create table inventory_events (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores (id) on delete cascade,
  ingredient_id   uuid not null references ingredients (id) on delete cascade,
  type            inventory_event_type not null,
  count_delta     numeric,                               -- 개수 변동
  volume_delta    numeric,                               -- 양 변동(폐기 남은 양 등)
  order_record_id uuid,                                  -- 입고면 발주 레코드 참조 (아래 FK)
  note            text,
  occurred_at     timestamptz not null default now()
);
create index inventory_events_ingredient_idx on inventory_events (ingredient_id, occurred_at desc);
create index inventory_events_type_idx on inventory_events (store_id, type);

-- 발주 레코드 (③ 8.3)
create table order_records (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  vendor_id     uuid references vendors (id) on delete set null,
  brand_id      uuid references brands (id) on delete set null,
  volume        numeric not null check (volume > 0),     -- 구매단위 1개 용량(기준단위)
  amount        numeric not null check (amount >= 0),    -- 금액(원)
  qty           numeric not null check (qty > 0),        -- 수량(구매단위 개수)
  received_qty  numeric not null default 0,              -- 부분입고 누적
  ordered_at    date not null default current_date,      -- 발주일
  expected_at   date,                                    -- 예정입고일
  status        order_status not null default 'ordered',
  source        order_source not null default 'manual',
  created_at    timestamptz not null default now()
);
create index order_records_store_status_idx on order_records (store_id, status, expected_at);
create index order_records_ingredient_idx on order_records (ingredient_id);

-- 재고이벤트 → 발주레코드 FK (순환 회피 위해 여기서 추가)
alter table inventory_events
  add constraint inventory_events_order_fk
  foreign key (order_record_id) references order_records (id) on delete set null;

-- 발주 후보 (③ 2.2). 복수 사유는 배열로 병기
create table order_candidates (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores (id) on delete cascade,
  ingredient_id   uuid not null references ingredients (id) on delete cascade,
  reasons         candidate_reason[] not null default '{}',
  recommended_qty numeric not null default 0,            -- 권장 수량(개수)
  status          candidate_status not null default 'pending',
  updated_at      timestamptz not null default now(),
  unique (store_id, ingredient_id)                        -- 식재료당 후보 1건(합산)
);
create index order_candidates_store_idx on order_candidates (store_id, status);
create trigger order_candidates_touch before update on order_candidates
  for each row execute function public.touch_updated_at();

-- 레시피 계산 실행 (③ 2.3) — E6 후보 산출 근거
create table recipe_calc_runs (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores (id) on delete cascade,
  period_from date not null,
  period_to   date not null,
  items       jsonb not null,                            -- [{recipe_id, servings}]
  result      jsonb not null,                            -- [{ingredient_id, required, shortage}]
  ran_at      timestamptz not null default now()
);
create index recipe_calc_runs_store_idx on recipe_calc_runs (store_id, ran_at desc);

-- 단가 추이 스냅샷 (파생, ① 3.4) — E1 입고 확정에서 점 생성. 그래프는 2차여도 적재는 1차부터
create table price_trends (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores (id) on delete cascade,
  ingredient_id   uuid not null references ingredients (id) on delete cascade,
  trend_date      date not null,
  unit_price      numeric not null,                      -- 환산 단가(원/기준단위, 로스 반영)
  order_record_id uuid references order_records (id) on delete set null, -- 점 → 근거 입고
  created_at      timestamptz not null default now()
);
create index price_trends_ingredient_idx on price_trends (ingredient_id, trend_date);
