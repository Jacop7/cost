-- ════════════════════════════════════════════════════════════════
-- 0048 · 영업일 — 영업 시작 / 브레이크 / 영업 종료
--
-- 사장님 명세:
--   영업 시작  → business_day 행 생성 + 오늘 적용할 스냅샷 생성
--                두 작업이 **모두 성공해야** 영업 중 전환
--   영업 중    → 매출·입고·폐기·재고 이벤트에 business_day_id 저장
--                예정 종료를 지나도 영업 중이면 같은 영업일 유지
--   브레이크   → 상태만 변경. 같은 business_day_id·스냅샷 유지
--   영업 종료  → 실제 종료 시각 저장, 당일 장부 집계·잠금
--
-- ── 왜 스냅샷인가 ────────────────────────────────────────────
-- 지금은 매출 화면이 지난 장부를 보여주면서 값은 **오늘 것**을 쓴다.
--   인건비 20만원 수정 → 지난 7일 순이익 77,617원 움직임 (실측)
--   요약 재료비 142,400 vs 세부 합계 142,631 (230원 차이)
--   부자재 항목 삭제   → 8/19 상세에서도 사라짐
--   매출 재저장        → 원장이 새 레시피로 덮임 (대파 250g → 500g)
-- 영업 시작 시점 값을 얼려 두면 하루에 값이 하나뿐이라 이 넷이 함께 사라진다.
--
-- ⚠ 스냅샷은 영업 중에 갱신하지 않는다. 사장님이 영업 중에 레시피를 고쳐도
--   오늘 매출에는 반영되지 않고 **다음 영업일부터** 적용된다. 이게 이번 설계의 뼈대다.
-- ════════════════════════════════════════════════════════════════

do $e$
begin
  create type business_day_status as enum ('open', 'break', 'closed');
exception when duplicate_object then null;
end $e$;

do $e$
begin
  create type business_close_method as enum ('manual', 'auto');
exception when duplicate_object then null;
end $e$;

create table if not exists business_days (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores (id) on delete cascade,
  business_date    date not null,
  status           business_day_status not null default 'open',
  opened_at        timestamptz not null default now(),
  -- 설정의 종료 시각으로 계산한 예정 시각. 알림·자동 종료의 기준이다.
  planned_close_at timestamptz not null,
  closed_at        timestamptz,
  close_method     business_close_method,
  -- 예정 종료 뒤에도 판매·재고 처리가 있으면 자동 종료를 미룬다.
  -- 늦게까지 장사한 날의 매출이 잘리면 안 된다.
  last_activity_at timestamptz not null default now(),
  -- 그날 적용할 값 전부. 레시피별 판매가·재료 구성·부자재·세금 + 고정지출률.
  snapshot         jsonb not null,
  created_at       timestamptz not null default now(),
  unique (store_id, business_date)
);

comment on table business_days is
  '영업일 한 장. 시작할 때 그날 쓸 값을 스냅샷으로 얼리고, 종료할 때 장부를 잠근다(0048).';
comment on column business_days.snapshot is
  '영업 시작 시점의 레시피·단가·부자재·고정지출률. 영업 중에는 갱신하지 않는다.';
comment on column business_days.last_activity_at is
  '마지막 판매·재고 활동. 자동 종료를 이 시각 + 1시간으로 미룬다.';

create index if not exists business_days_store_date_ix on business_days (store_id, business_date desc);
create index if not exists business_days_open_ix on business_days (store_id) where status <> 'closed';

alter table business_days enable row level security;

do $p$
begin
  create policy business_days_rw on business_days
    for all using (store_id in (select my_store_ids()))
    with check (store_id in (select my_store_ids()));
exception when duplicate_object then null;
end $p$;

-- ── 이벤트에 영업일을 단다 ────────────────────────────────────
-- 날짜(business_date)만으로는 "어느 영업 세션에서 나온 것"인지 모른다.
-- 종료 후 들어온 기록과 영업 중 기록을 가려야 잠금이 뜻을 갖는다.
alter table daily_sales      add column if not exists business_day_id uuid references business_days (id);
alter table inventory_events add column if not exists business_day_id uuid references business_days (id);
alter table order_records    add column if not exists business_day_id uuid references business_days (id);

create index if not exists daily_sales_bday_ix      on daily_sales (business_day_id)      where business_day_id is not null;
create index if not exists inventory_events_bday_ix on inventory_events (business_day_id) where business_day_id is not null;
create index if not exists order_records_bday_ix    on order_records (business_day_id)    where business_day_id is not null;

-- ── 그날 쓸 값 한 덩어리 ──────────────────────────────────────
-- 레시피마다 판매가·재료 구성·부자재·세금을 그 시점 값으로 굳힌다.
-- 재료는 **1인분량과 단가**를 함께 담는다 — 나중에 단가가 올라도 그날 원가는 그대로다.
create or replace function public.build_day_snapshot(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'taken_at', now(),
    'fixed_rate', coalesce(fixed_cost_rate(p_store, business_month()), 0),
    'fixed_items', coalesce(
      (select f.items from fixed_costs_monthly f
        where f.store_id = p_store and f.month = business_month()), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_object_agg(r.id::text, jsonb_build_object(
        'name', r.name,
        'price', r.price,
        'tax_mode', r.tax_mode,
        'base_servings', r.base_servings,
        'material_cost', recipe_material_cost(r.id),
        'extra_cost', coalesce((select sum(ec.amount_per_serving)
                                  from recipe_extra_costs ec where ec.recipe_id = r.id), 0),
        -- 세부 내역까지 담아야 나중에 부자재를 지워도 그날 상세에 남는다.
        'extras', coalesce((select jsonb_agg(jsonb_build_object(
                              'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving))
                              from recipe_extra_costs ec where ec.recipe_id = r.id), '[]'::jsonb),
        -- 1인분 기준 재료 구성. 반제품은 1차에서 안 쓰므로 식재료 줄만 담는다.
        'lines', coalesce((select jsonb_agg(jsonb_build_object(
                              'ingredient_id', l.ingredient_id,
                              'name', i.name,
                              'base_unit', i.base_unit,
                              'per_serving', l.input_qty / nullif(r.base_servings, 0),
                              'unit_price', base_unit_price(l.ingredient_id)))
                              from recipe_lines l
                              join ingredients i on i.id = l.ingredient_id
                             where l.recipe_id = r.id and l.ingredient_id is not null), '[]'::jsonb)))
        from recipes r where r.store_id = p_store and r.active), '{}'::jsonb));
$fn$;

comment on function public.build_day_snapshot(uuid) is
  '영업 시작 시점의 그날 기준값. 레시피별 판매가·재료 구성(1인분량+단가)·부자재 내역·고정지출률(0048).';

-- ── 예정 종료 시각 ────────────────────────────────────────────
-- 설정의 종료 시각을 그 영업일에 얹는다. 자정을 넘으면 다음 날짜다.
create or replace function public.planned_close(p_store uuid, p_date date)
returns timestamptz language sql stable security invoker as $fn$
  select ((p_date + case when s.close_time < s.open_time then 1 else 0 end)::timestamp
          + s.close_time) at time zone business_tz()
    from settings s where s.store_id = p_store;
$fn$;

select public.assert_no_rpc_overloads();
