-- ════════════════════════════════════════════════════════════════
-- 0014 · 매출관리 스키마 (SALES-01~18)
--
-- 배경:
--   매출관리 탭 전체가 화면만 있고 **저장할 테이블이 없었다**. DB 19개 테이블 어디에도
--   일별 판매·채널별 매출·메뉴별 판매량을 담을 곳이 없어, 앱은 demoData 상수만 그리고 있었다.
--
-- 설계 원칙:
--   1) **판매 사실만 저장하고 파생값은 저장하지 않는다.** 매출·원가·순이익은 판매 기록과
--      기준단가·고정지출률에서 계산한다. 파생값을 저장하면 원본이 바뀔 때 조용히 어긋난다.
--      (예외: 확정 스냅샷은 profit_trends/monthly_pl 이 이미 담당한다.)
--   2) **날짜는 항상 명시한다.** `sale_date` 에 기본값을 두지 않는다 —
--      과거 영업일 데이터를 입력해야 매출 분석에 기간 비교가 생긴다.
--      기본값을 두면 "오늘"로 조용히 채워져 과거 등록이 막힌다.
--   3) 채널은 테이블로 둔다. 수수료율이 매장마다 다르고 시간이 지나며 바뀐다.
--
-- ⚠ 폐기 손실은 여기 두지 않는다. 이미 `inventory_events(type='discard')` 가 원장이며,
--   `occurred_at` 으로 기간 집계한다. 같은 사실을 두 곳에 저장하지 않는다.
-- ════════════════════════════════════════════════════════════════

-- ── 판매 채널 (매장 / 배달 / 포장 …) ──────────────────────────
create table if not exists public.sales_channels (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores (id) on delete cascade,
  code        text not null,                                   -- 'hall' | 'delivery' | 'takeout' | 매장 자유 코드
  name        text not null,                                   -- 화면 표기 ('매장')
  fee_rate    numeric(5,2) not null default 0
                check (fee_rate >= 0 and fee_rate < 100),       -- 수수료율(%) — 중개+결제 합산
  fee_note    text,                                            -- '중개 6.8% · 결제 3.0%' 같은 내역 설명
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (store_id, code)
);
create index if not exists sales_channels_store_idx on public.sales_channels (store_id, sort_order);

comment on table public.sales_channels is '판매 채널과 수수료율. 채널별 손익 분해(SALES-18)의 기준.';

-- ── 일별 매출 헤더 ────────────────────────────────────────────
-- 하루치 "장부 한 장". 메뉴별 판매는 아래 items 에 붙는다.
create table if not exists public.daily_sales (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  sale_date     date not null,                                 -- ★ 기본값 없음(과거 등록 허용)
  etc_revenue   numeric not null default 0 check (etc_revenue >= 0),
                -- 레시피 미등록 매출(음료 등). 메뉴별 합산에 잡히지 않는 금액.
  daily_extra   numeric not null default 0 check (daily_extra >= 0),
                -- 그날 한 번 발생한 현금 지출. 고정 지출과 구분된다.
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (store_id, sale_date)                                 -- 하루 한 장
);
create index if not exists daily_sales_store_date_idx on public.daily_sales (store_id, sale_date desc);

comment on table public.daily_sales is
  '일별 매출 장부 한 장. sale_date 는 기본값이 없다 — 과거 영업일도 명시 입력해야 기간 분석이 가능하다.';

-- ── 메뉴별 판매 (채널별 수량) ─────────────────────────────────
create table if not exists public.daily_sales_items (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores (id) on delete cascade,
  daily_sales_id uuid not null references daily_sales (id) on delete cascade,
  recipe_id      uuid references recipes (id) on delete set null,
                 -- 레시피가 지워져도 판매 사실은 남는다(원장은 append-only 성격).
  menu_name      text not null,                                -- 판매 시점 메뉴명 스냅샷
  unit_price     numeric not null check (unit_price >= 0),     -- 판매 시점 판매가 스냅샷
  qty_hall       numeric not null default 0 check (qty_hall >= 0),
  qty_delivery   numeric not null default 0 check (qty_delivery >= 0),
  qty_takeout    numeric not null default 0 check (qty_takeout >= 0),
  created_at     timestamptz not null default now()
);
create index if not exists daily_sales_items_parent_idx on public.daily_sales_items (daily_sales_id);
create index if not exists daily_sales_items_recipe_idx on public.daily_sales_items (recipe_id);

comment on table public.daily_sales_items is
  '메뉴별·채널별 판매 수량. 판매가와 메뉴명은 **판매 시점 스냅샷**이다 — 나중에 레시피 판매가를 바꿔도 과거 매출이 변하면 안 된다.';

comment on column public.daily_sales_items.unit_price is
  '판매 시점 판매가. recipes.price 를 참조하지 않고 복사한다(과거 매출 불변).';

-- ── RLS — 다른 테이블과 동일한 store_id 격리 ──────────────────
do $$
declare t text;
begin
  foreach t in array array['sales_channels','daily_sales','daily_sales_items'] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy %1$s_select on %1$I for select
                     using (store_id in (select public.my_store_ids()));$f$, t);
    execute format($f$create policy %1$s_insert on %1$I for insert
                     with check (store_id in (select public.my_store_ids()));$f$, t);
    execute format($f$create policy %1$s_update on %1$I for update
                     using (store_id in (select public.my_store_ids()))
                     with check (store_id in (select public.my_store_ids()));$f$, t);
    execute format($f$create policy %1$s_delete on %1$I for delete
                     using (store_id in (select public.my_store_ids()));$f$, t);
  end loop;
end $$;

-- ── updated_at 갱신 트리거 (0001 의 touch_updated_at 재사용) ──
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'touch_updated_at') then
    execute 'create trigger daily_sales_touch before update on public.daily_sales
             for each row execute function public.touch_updated_at()';
  end if;
end $$;

-- ── 기간 손익 집계 함수 ───────────────────────────────────────
-- 화면(SALES-02 매출 분석)이 기간을 골라 호출한다. 파생값을 저장하지 않고 매번 계산한다.
--
-- 계산 규칙 (앱 표시와 일치해야 한다):
--   매출     = Σ(단가 × 총수량) + 기타매출
--   재료원가 = Σ(1인분 재료원가 × 수량)      ← 레시피 라인 × base_unit_price
--   수수료   = Σ(채널 매출 × 채널 수수료율)
--   폐기손실 = inventory_events(discard) 의 폐기량 × 기준단가
--   고정지출 = 월 고정지출률 × 기간 매출
--   세금     = 부가세 포함 메뉴의 판매가 × 10/110
create or replace function public.sales_summary(
  p_store uuid,
  p_from  date,
  p_to    date
) returns jsonb language plpgsql stable security invoker as $$
declare
  v_revenue   numeric := 0;
  v_etc       numeric := 0;
  v_material  numeric := 0;
  v_fee       numeric := 0;
  v_tax       numeric := 0;
  v_waste     numeric := 0;
  v_extra     numeric := 0;
  v_fixed     numeric := 0;
  v_qty       numeric := 0;
  v_days      int     := 0;
  v_rate      numeric;
begin
  -- 메뉴 판매 기반 집계
  select
    coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0)
  into v_revenue, v_qty
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)
    into v_etc, v_extra, v_days
  from daily_sales where store_id = p_store and sale_date between p_from and p_to;

  v_revenue := v_revenue + v_etc;

  -- 재료 원가 = Σ(메뉴 1인분 재료원가 × 판매 수량)
  select coalesce(sum(
           (it.qty_hall + it.qty_delivery + it.qty_takeout) *
           coalesce((select sum((rl.input_qty / r.base_servings) * coalesce(base_unit_price(rl.ingredient_id), 0))
                       from recipe_lines rl where rl.recipe_id = r.id), 0)
         ), 0)
    into v_material
  from daily_sales ds
  join daily_sales_items it on it.daily_sales_id = ds.id
  join recipes r on r.id = it.recipe_id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 채널 수수료 = Σ(채널별 매출 × 수수료율)
  select coalesce(sum(
           it.unit_price * (
             it.qty_hall     * coalesce((select fee_rate from sales_channels where store_id=p_store and code='hall'), 0) +
             it.qty_delivery * coalesce((select fee_rate from sales_channels where store_id=p_store and code='delivery'), 0) +
             it.qty_takeout  * coalesce((select fee_rate from sales_channels where store_id=p_store and code='takeout'), 0)
           ) / 100.0
         ), 0)
    into v_fee
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 세금 — 부가세 포함 메뉴만 판매가 × 10/110
  select coalesce(sum(
           case when r.tax_mode = 'included'
                then it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout) * 10 / 110
                else 0 end), 0)
    into v_tax
  from daily_sales ds
  join daily_sales_items it on it.daily_sales_id = ds.id
  join recipes r on r.id = it.recipe_id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 폐기 손실 — 재고 원장에서 집계(같은 사실을 매출 테이블에 복제하지 않는다)
  select coalesce(sum(coalesce(ev.volume_delta, 0) * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
    into v_waste
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard'
    and (ev.occurred_at at time zone business_tz())::date between p_from and p_to;

  -- 고정 지출 — 기간 시작 월의 고정지출률 × 기간 매출.
  -- (기간이 여러 달에 걸치면 월별 안분이 필요하다 → 2차 과제로 남긴다.)
  v_rate := fixed_cost_rate(p_store, to_char(p_from, 'YYYY-MM'));
  v_fixed := coalesce(v_rate, 0) * v_revenue;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'revenue', v_revenue, 'etc_revenue', v_etc, 'qty', v_qty,
    'material_cost', v_material, 'channel_fee', v_fee, 'tax', v_tax,
    'waste_loss', v_waste, 'daily_extra', v_extra, 'fixed_cost', v_fixed,
    -- 고정지출률이 없으면(해당 월 미입력) 잠정임을 알린다 — 0% 로 확정하지 않는다(가이드 P0-5).
    'fixed_rate_provisional', (v_rate is null),
    'profit', v_revenue - v_material - v_fee - v_tax - v_waste - v_extra - v_fixed
  );
end;
$$;

comment on function public.sales_summary(uuid, date, date) is
  '기간 손익 집계. 파생값을 저장하지 않고 판매 기록·기준단가·고정지출률에서 매번 계산한다.';
