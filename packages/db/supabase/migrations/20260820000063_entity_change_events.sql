-- ════════════════════════════════════════════════════════════════
-- 0063 · 수정 내역 원장
--
-- 사장님이 상세 화면에서 세 가지를 바로 알아야 한다.
--   ① 마지막으로 언제 바뀌었나
--   ② 내가 고친 건가, 다른 데서 자동으로 반영된 건가
--   ③ 그 값이 지금 영업의 매출 계산에 들어갔나
--
-- ⚠ 기존 추이 테이블로는 못 한다(확인함).
--   price_trends  재료·날짜·단가·주문ID — **전후값도 출처도 없다**
--   profit_trends 레시피·날짜·순이익률·재료비율 — **금액도 전후값도 없다**
--   둘 다 그래프용 점이라 "무엇이 얼마에서 얼마로, 왜"를 말할 수 없다.
--   역할을 가른다: trends = 그래프 · entity_change_events = 사람이 읽는 내역.
--   같은 트랜잭션에서 함께 쓰므로 둘이 어긋나면 안 된다.
--
-- ── 반영 여부는 **저장하지 않는다** ──────────────────────────
-- 시간이 지나면 달라지는 값이라 boolean 으로 굳히면 거짓말이 된다.
-- 읽을 때 계산하되, **값 비교로 판정하지 않는다**:
--   판매가를 12,000 → 20,000 → 다시 12,000 으로 되돌리면 현재 값과 스냅샷이
--   같아져서 "반영됨"으로 보인다. 실제로는 둘 다 오늘 매출에 안 들어갔다.
-- 판정 기준은 **언제 기록됐는가**다:
--   미반영 = 그 영업일에 기록됐고 && 기준 확정 시각보다 나중이다
-- ════════════════════════════════════════════════════════════════

-- ── 레시피 메모 ───────────────────────────────────────────────
-- 식재료에는 있는데(ingredients.memo) 레시피에는 없었다. 화면이 같은 자리에
-- 같은 모양으로 보여야 하므로 맞춘다.
alter table recipes add column if not exists memo text;
comment on column recipes.memo is '메뉴 메모. 매출 계산과 무관하다(0063).';

-- ── 변경 출처 ─────────────────────────────────────────────────
do $mig$
begin
  if not exists (select 1 from pg_type where typname = 'change_source') then
    create type change_source as enum (
      'direct',      -- 사장님이 직접 고침
      'inbound',     -- 입고 확정·취소로 기준단가가 바뀜
      'ingredient',  -- 식재료 변경이 레시피로 전파됨
      'fixed_cost'   -- 고정지출 변경이 레시피로 전파됨
    );
  end if;
end $mig$;

create table if not exists entity_change_events (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores(id) on delete cascade,
  entity_type    text not null check (entity_type in ('ingredient', 'recipe')),
  entity_id      uuid not null,
  source_type    change_source not null,
  -- 자동 전파의 원본(식재료 id 등). 직접 수정이면 null.
  source_entity_id uuid,
  -- ⚠ 한 번의 저장·입고·전파를 묶는다. source_entity_id 만으로는 같은 재료를
  --   하루에 두 번 입고했을 때 두 묶음을 구분할 수 없다.
  correlation_id uuid not null default gen_random_uuid(),
  title          text not null,
  -- [{ key, label, before, after, unit }] — 필드마다 카드를 나누지 않는다.
  changes        jsonb not null default '[]'::jsonb,
  -- 매출 금액을 바꾸는 종류의 변경인가. 메모·카테고리는 false.
  -- (지금 반영됐는지와는 다른 물음이다 — 그건 읽을 때 계산한다.)
  affects_sales  boolean not null default false,
  -- 변경 시점에 열려 있던 영업일. 영업 전이면 null.
  business_day_id uuid references business_days(id) on delete set null,
  actor_id       uuid,
  occurred_at    timestamptz not null default now()
);

comment on table entity_change_events is
  '식재료·레시피 수정 내역 원장(0063). append-only — 고치지도 지우지도 않는다.';

-- 조회는 언제나 "이 엔터티의 최신순"이다. 커서는 (occurred_at, id) 복합이어야
-- 같은 시각에 기록된 이벤트가 페이지 경계에서 새지 않는다.
create index if not exists entity_change_events_entity_ix
  on entity_change_events (entity_type, entity_id, occurred_at desc, id desc);
create index if not exists entity_change_events_corr_ix
  on entity_change_events (correlation_id);
create index if not exists entity_change_events_store_ix
  on entity_change_events (store_id, occurred_at desc);

alter table entity_change_events enable row level security;

drop policy if exists entity_change_events_select on entity_change_events;
create policy entity_change_events_select on entity_change_events
  for select using (store_id in (select my_store_ids()));

-- 쓰기는 RPC 안에서만 일어난다. 사람이 원장을 직접 고칠 수는 없다.
drop policy if exists entity_change_events_insert on entity_change_events;
create policy entity_change_events_insert on entity_change_events
  for insert with check (store_id in (select my_store_ids()));

-- ── 기준 확정 시각을 스냅샷 항목에 심는다 ─────────────────────
-- ⚠ 0062 이후 항목마다 확정 시각이 다르다. 영업 시작 때 담긴 것과, 나중에
--   첫 판매로 더해진 것(껐다 켠 메뉴·영업 중 신메뉴)이 섞인다.
--   14:00 수정 → 15:00 첫 판매로 합류했다면 그 수정은 **반영된 것**이다.
--   시각이 없으면 이걸 못 가린다.
create or replace function public.recipe_snapshot_entry(p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'basis_at', now(),
    'name', r.name,
    'price', r.price,
    'tax_mode', r.tax_mode,
    'tax_items', coalesce(r.tax_items, '[]'::jsonb),
    'tax', tax_of(r.price, r.tax_mode, r.tax_items),
    'base_servings', r.base_servings,
    'material_cost', recipe_material_cost(r.id),
    'extra_cost', coalesce((select sum(ec.amount_per_serving)
                              from recipe_extra_costs ec where ec.recipe_id = r.id), 0),
    'extras', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving))
                          from recipe_extra_costs ec where ec.recipe_id = r.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                          'ingredient_id', l.ingredient_id,
                          'name', i.name,
                          'base_unit', i.base_unit,
                          'per_serving', l.input_qty / nullif(r.base_servings, 0),
                          'unit_price', base_unit_price(l.ingredient_id)))
                          from recipe_lines l
                          join ingredients i on i.id = l.ingredient_id
                         where l.recipe_id = r.id and l.ingredient_id is not null), '[]'::jsonb))
    from recipes r where r.id = p_recipe;
$fn$;

-- ── 반영 상태 판정 — **여기 한 곳뿐이다** ─────────────────────
-- 세금 계산이 다섯 곳에 흩어져 조용히 어긋난 적이 있다. 같은 실수를 되풀이하지
-- 않도록 day_menu_basis 도 이 함수를 쓴다.
--
-- 돌려주는 값
--   irrelevant     매출 금액을 바꾸지 않는 수정(메모·카테고리 등)
--   reflected      지금 영업 기준에 들어가 있다
--   not_reflected  영업 시작 뒤 기준이 확정된 다음에 바뀌었다 → 다음 영업일부터
create or replace function public.recipe_change_state(
  p_store uuid, p_recipe uuid, p_occurred_at timestamptz, p_business_day uuid, p_affects boolean
) returns text language plpgsql stable security invoker as $fn$
declare
  v_day   business_days;
  v_basis timestamptz;
begin
  if not p_affects then return 'irrelevant'; end if;

  v_day := current_business_day(p_store);
  -- 지금 열린 영업일이 없다(영업 전·종료 뒤) → 다음 시작 때 새 기준이 만들어진다.
  if v_day.id is null then return 'reflected'; end if;
  -- 다른 영업일에 기록된 변경 → 그 뒤에 시작한 영업일이 이미 담았다.
  if p_business_day is distinct from v_day.id then return 'reflected'; end if;

  -- 오늘 기준에 아직 없는 메뉴 → 첫 판매 때 지금 값으로 더해진다(0062). 반영이다.
  v_basis := (v_day.snapshot #>> array['recipes', p_recipe::text, 'basis_at'])::timestamptz;
  if (v_day.snapshot #> array['recipes', p_recipe::text]) is null then return 'reflected'; end if;

  -- basis_at 이 없는 옛 스냅샷은 영업 시작 시각을 기준으로 본다.
  v_basis := coalesce(v_basis, (v_day.snapshot->>'taken_at')::timestamptz, v_day.opened_at);

  return case when p_occurred_at > v_basis then 'not_reflected' else 'reflected' end;
end;
$fn$;

/**
 * 이벤트 한 건의 반영 상태.
 * 식재료 이벤트는 같은 correlation_id 로 묶인 레시피 이벤트들의 상태를 모은다 —
 * 하나의 단가 변경이 여러 메뉴에 퍼지므로 섞일 수 있다.
 */
create or replace function public.entity_change_state(p_event entity_change_events)
returns text language plpgsql stable security invoker as $fn$
declare
  v_total int;
  v_not   int;
begin
  if not p_event.affects_sales then return 'irrelevant'; end if;

  if p_event.entity_type = 'recipe' then
    return recipe_change_state(p_event.store_id, p_event.entity_id,
                               p_event.occurred_at, p_event.business_day_id, true);
  end if;

  -- 식재료 — 같이 기록된 레시피 이벤트들을 본다.
  select count(*),
         count(*) filter (where recipe_change_state(e.store_id, e.entity_id,
                                                    e.occurred_at, e.business_day_id, true)
                                = 'not_reflected')
    into v_total, v_not
    from entity_change_events e
   where e.correlation_id = p_event.correlation_id and e.entity_type = 'recipe';

  if v_total = 0 then return 'reflected'; end if;      -- 연결된 메뉴가 없다
  if v_not = 0 then return 'reflected'; end if;
  if v_not = v_total then return 'not_reflected'; end if;
  return 'partial';                                     -- 일부 메뉴 미반영
end;
$fn$;

-- ── 기록 ──────────────────────────────────────────────────────
-- ⚠ 실제로 값이 달라지지 않았으면 기록하지 않는다. 같은 값 저장·재계산·새로고침이
--   내역을 더럽히면 사장님이 진짜 변경을 못 찾는다.
create or replace function public.record_entity_change(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_source change_source, p_title text, p_changes jsonb,
  p_affects boolean default false,
  p_source_entity uuid default null,
  p_correlation uuid default null
) returns uuid language plpgsql security invoker as $fn$
declare
  v_day business_days;
  v_id  uuid;
begin
  if coalesce(jsonb_array_length(p_changes), 0) = 0 then
    return null;
  end if;

  v_day := current_business_day(p_store);

  insert into entity_change_events
    (store_id, entity_type, entity_id, source_type, source_entity_id, correlation_id,
     title, changes, affects_sales, business_day_id, actor_id)
  values
    (p_store, p_entity_type, p_entity_id, p_source, p_source_entity,
     coalesce(p_correlation, gen_random_uuid()),
     p_title, p_changes, p_affects, v_day.id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$fn$;

/** 전후값이 실제로 다른 필드만 남긴다. 같으면 배열에서 빠지고, 다 같으면 빈 배열이다. */
create or replace function public.change_line(
  p_key text, p_label text, p_before anyelement, p_after anyelement, p_unit text default null
) returns jsonb language sql immutable as $fn$
  select case
    when p_before is not distinct from p_after then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'key', p_key, 'label', p_label,
      'before', p_before, 'after', p_after, 'unit', p_unit))
  end;
$fn$;

comment on function public.change_line(text, text, anyelement, anyelement, text) is
  '전후가 다를 때만 한 줄을 만든다 — 같은 값 저장이 내역을 더럽히지 않게(0063).';

select public.assert_no_rpc_overloads();
