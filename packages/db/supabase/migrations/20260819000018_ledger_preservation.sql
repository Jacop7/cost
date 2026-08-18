-- ════════════════════════════════════════════════════════════════
-- 0018 · 원장 보존 — 삭제로 과거 기록이 사라지지 않게 (P0, 절대원칙 4)
--
-- 실증된 데이터 손실 (로컬 DB):
--   ① 레시피 1건 삭제 → profit_trends 1→0건.
--      같은 기간 sales_summary 재료원가 14,172→0 · 세금 5,454→0 · **순이익 19,240→38,868 (+102% 과대)**
--      원인: daily_sales_items.recipe_id 가 SET NULL 이라 원가·세금 join 이 끊긴다.
--   ② 식재료 1건 삭제 → price_trends 1→0 · inventory_events 9→6 · order_records 4→3 통째 소멸.
--      그런데 monthly_pl.material_cost 4,000원은 남아 **영구 재현 불가 불일치**가 된다.
--   ③ 판매행 DELETE → consume 이벤트의 sales_item_id 가 전부 NULL → e9 되돌리기 0건 → **재고 영구 손실**.
--
-- 원칙:
--   원장(무엇이 언제 얼마에 오갔는가)은 **지우지 않는다.** 마스터는 비활성으로 은퇴시킨다.
--   과거 기록을 지우면 그 시점의 손익을 다시 만들 수 없고, 이미 계산된 집계와 영구히 어긋난다.
--
-- 조치:
--   1) 원장이 참조하는 마스터 삭제를 **RESTRICT** 로 막는다. 마스터는 `active=false` 로 은퇴시킨다.
--   2) 판매행이 참조하는 레시피/판매행 자체는 **스냅샷으로 자립**하게 한다
--      (판매 시점 원가·세금모드를 복사해 두면 레시피가 없어도 과거 매출이 흔들리지 않는다).
--   3) RLS 에서 원장의 UPDATE/DELETE 를 **차단**한다. append-only 를 DB 가 강제하게 한다.
-- ════════════════════════════════════════════════════════════════

-- ── 1) 마스터 은퇴 플래그 보강 ────────────────────────────────
alter table public.recipes         add column if not exists active boolean not null default true;
alter table public.sales_channels  add column if not exists retired_at date;

comment on column public.recipes.active is
  '판매 중지가 아니라 **은퇴**. 원장이 참조하므로 삭제 대신 이 플래그를 내린다.';

-- ── 2) 판매행이 레시피 없이도 자립하게 (과거 매출 불변) ───────
-- 판매 시점의 재료원가·세금모드를 스냅샷으로 복사한다. 레시피가 은퇴/변경돼도 과거 매출은 흔들리지 않는다.
alter table public.daily_sales_items
  add column if not exists unit_material_cost numeric,   -- 판매 시점 1인분 재료원가
  add column if not exists tax_mode tax_mode;            -- 판매 시점 세금 모드

comment on column public.daily_sales_items.unit_material_cost is
  '판매 시점 1인분 재료원가 스냅샷. recipes 를 join 해 재계산하면 과거 매출 원가가 소급 변경된다.';
comment on column public.daily_sales_items.tax_mode is
  '판매 시점 세금 모드 스냅샷. 같은 이유로 복사한다.';

-- 기존 행 백필 — 지금 레시피 기준으로 한 번 채운다(이후로는 등록 시점에 채워진다).
update public.daily_sales_items it
   set unit_material_cost = coalesce((
         select sum((rl.input_qty / nullif(r.base_servings,0)) * coalesce(base_unit_price(rl.ingredient_id),0))
           from recipe_lines rl join recipes r on r.id = rl.recipe_id
          where rl.recipe_id = it.recipe_id and rl.ingredient_id is not null), 0),
       tax_mode = coalesce((select r2.tax_mode from recipes r2 where r2.id = it.recipe_id), 'included')
 where it.unit_material_cost is null;

-- ── 3) 원장 → 마스터 FK 를 RESTRICT 로 (삭제 차단) ────────────
do $$
declare
  r record;
  -- (테이블, 컬럼, 참조테이블, 새 동작)
  fixes text[][] := array[
    array['order_records',     'ingredient_id', 'ingredients',       'restrict'],
    array['inventory_events',  'ingredient_id', 'ingredients',       'restrict'],
    array['price_trends',      'ingredient_id', 'ingredients',       'restrict'],
    array['purchase_options',  'ingredient_id', 'ingredients',       'cascade'],   -- 구매 옵션은 원장이 아니라 설정
    array['profit_trends',     'recipe_id',     'recipes',           'restrict'],
    array['daily_sales_items', 'recipe_id',     'recipes',           'restrict'],
    array['inventory_events',  'sales_item_id', 'daily_sales_items', 'restrict']
  ];
  tbl text; col text; ref text; act text; cname text;
begin
  for i in 1 .. array_length(fixes, 1) loop
    tbl := fixes[i][1]; col := fixes[i][2]; ref := fixes[i][3]; act := fixes[i][4];

    -- 기존 제약 이름을 찾아 지운다
    select c.conname into cname
      from pg_constraint c
      join unnest(c.conkey) k(attnum) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f' and c.conrelid = tbl::regclass
       and a.attname = col and c.confrelid = ref::regclass
     limit 1;

    if cname is not null then
      execute format('alter table public.%I drop constraint %I', tbl, cname);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete %s',
      tbl, tbl || '_' || col || '_fk', col, ref, act);
  end loop;
end $$;

-- ── 4) RLS — 원장은 append-only. UPDATE/DELETE 정책을 없앤다 ──
-- 정책이 없으면 RLS 가 켜진 테이블에서 그 동작은 **전부 거부**된다.
-- (service_role 은 RLS 를 우회하므로 관리자 정정 경로는 남는다.)
do $$
declare
  t text;
  ledgers text[] := array['inventory_events','price_trends','profit_trends','order_records'];
begin
  foreach t in array ledgers loop
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;
end $$;

-- order_records 는 상태 전이(발주됨→부분입고→입고완료→취소)가 필요하므로 UPDATE 를 되살린다.
-- 다만 **RPC 를 통해서만** 바뀌어야 하므로, 앱이 임의 컬럼을 바꾸지 못하도록
-- 별도 RPC(E1/E10/E11)를 쓰게 하고 여기서는 정책만 복원한다.
create policy order_records_update on public.order_records for update
  using (store_id in (select public.my_store_ids()))
  with check (store_id in (select public.my_store_ids()));

comment on table public.inventory_events is
  '재고 변동 원장. **append-only** — RLS 에 UPDATE/DELETE 정책이 없어 수정·삭제가 거부된다. 정정은 반대 부호 보정 이벤트를 쌓아서 한다.';
comment on table public.price_trends is
  '단가 추이 원장. append-only. 과거 점을 고치지 않고 새 점을 쌓는다.';
comment on table public.profit_trends is
  '순이익률 추이 원장. append-only.';
