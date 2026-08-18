-- ════════════════════════════════════════════════════════════════
-- 0016 · E8 · 판매 등록 → 재고 소진 전파
--
-- 배경:
--   `inventory_event_type` enum 에 'consume' 값이 처음부터 있었지만 **이를 기록하는 코드가
--   어디에도 없었다.** 즉 메뉴를 아무리 팔아도 재료 재고가 줄지 않는다.
--   재고가 줄지 않으면 발주 후보도 안 생기고, 사장님은 재료가 떨어질 때까지 모른다.
--   "식재료 → 레시피 → 판매 → 재고 차감 → 발주" 사이클이 판매 지점에서 끊겨 있었다.
--
-- 설계 판단
--   1) **소모량은 판매 시점에 확정해 이벤트로 남긴다.**
--      레시피는 나중에 바뀔 수 있다(사용량 조정). 판매 기록에서 매번 현재 레시피로 역산하면
--      **과거 판매의 소모량이 소급 변경**된다. 그래서 판매 시점의 1인분 소요량으로 계산해
--      `inventory_events` 에 확정 기록한다(원장은 append-only).
--   2) **재고가 모자라도 판매는 막지 않는다.**
--      이미 팔린 사실을 앱이 거부하면 장부가 현실과 어긋난다. 재고는 0 에서 멈추고(음수 금지,
--      불변식 6), 부족분을 응답에 실어 화면이 "재고가 모자랍니다" 를 안내하게 한다.
--   3) **멱등**: 같은 판매 건을 두 번 등록해도 재고가 두 번 줄지 않는다.
--      `daily_sales_items.id` 를 멱등 키로 쓴다 — 판매 1행당 소모 1회.
--   4) 판매 취소·수정은 이 함수를 되돌리는 별도 경로가 필요하다(E9). 여기서는 다루지 않는다.
--
-- 절대원칙 2 와의 관계:
--   "재고 변경은 E1·E2·E5 에서만"이라는 원칙은 **입고·폐기·실사**를 염두에 둔 것이다.
--   판매 소진은 원본 문서(① 재고 이벤트 유형에 'consume' 존재)가 처음부터 상정한 경로이며,
--   여기서 새 이벤트 번호 E8 을 부여해 **명시적 단일 출처**로 만든다.
--   단가는 건드리지 않는다 — 소진은 수량만 줄이고 기준단가에 영향이 없다.
-- ════════════════════════════════════════════════════════════════

-- 판매 1행이 어떤 재고 소모를 만들었는지 되짚을 수 있어야 취소(E9)가 가능하다.
alter table public.inventory_events
  add column if not exists sales_item_id uuid references daily_sales_items (id) on delete set null;

create index if not exists inventory_events_sales_item_idx
  on public.inventory_events (sales_item_id) where sales_item_id is not null;

comment on column public.inventory_events.sales_item_id is
  '이 소모를 유발한 판매 행. 판매 취소 시 되돌릴 대상을 찾는 데 쓴다.';

-- ── E8 · 판매 소진 ────────────────────────────────────────────
create or replace function public.e8_sales_consumed(
  p_sales_item uuid
) returns jsonb language plpgsql security invoker as $$
declare
  it        daily_sales_items%rowtype;
  ds        daily_sales%rowtype;
  v_qty     numeric;
  v_day     date;
  rec       record;
  v_used    numeric;
  v_before  numeric;
  v_after   numeric;
  v_short   jsonb := '[]'::jsonb;
  v_lines   int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;
  v_qty := it.qty_hall + it.qty_delivery + it.qty_takeout;

  -- 멱등: 이 판매 행의 소모가 이미 기록됐으면 아무것도 하지 않는다.
  if exists (select 1 from inventory_events where sales_item_id = p_sales_item) then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', true, 'lines', 0);
  end if;

  if v_qty <= 0 or it.recipe_id is null then
    -- 레시피가 연결되지 않은 판매(기타 매출 등)는 소모할 재료가 없다.
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', false, 'lines', 0);
  end if;

  -- 레시피 재료마다: 1인분 소요량 × 판매 수량 만큼 차감
  for rec in
    select rl.ingredient_id,
           (rl.input_qty / nullif(r.base_servings, 0)) as per_serving,
           i.name
      from recipe_lines rl
      join recipes r on r.id = rl.recipe_id
      join ingredients i on i.id = rl.ingredient_id
     where rl.recipe_id = it.recipe_id and rl.ingredient_id is not null
  loop
    if rec.per_serving is null then continue; end if;
    v_used := rec.per_serving * v_qty;

    select coalesce(sealed_count, 0) into v_before
      from inventory_states where ingredient_id = rec.ingredient_id;
    v_before := coalesce(v_before, 0);

    -- 재고는 0 아래로 내려가지 않는다(불변식 6). 부족분은 응답으로 알린다.
    v_after := greatest(v_before - v_used, 0);

    if v_used > v_before then
      v_short := v_short || jsonb_build_object(
        'ingredient_id', rec.ingredient_id, 'name', rec.name,
        'needed', v_used, 'available', v_before, 'shortage', v_used - v_before);
    end if;

    update inventory_states
       set sealed_count = v_after
     where ingredient_id = rec.ingredient_id;

    -- 소모 이벤트 — 판매 시점 소요량으로 **확정 기록**한다.
    -- 나중에 레시피 사용량을 바꿔도 이 값은 변하지 않는다(원장 append-only).
    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, order_record_id, sales_item_id, note, occurred_at)
    values
      (it.store_id, rec.ingredient_id, 'consume', -(v_before - v_after), null, p_sales_item,
       it.menu_name || ' ' || v_qty || '개 판매',
       (v_day::timestamp at time zone business_tz()));

    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'duplicate', false,
    'lines', v_lines, 'sold_qty', v_qty, 'shortages', v_short);
end;
$$;

comment on function public.e8_sales_consumed(uuid) is
  'E8 판매 소진. 판매 1행의 레시피 재료를 판매 시점 소요량으로 차감하고 consume 이벤트를 남긴다. 멱등.';

-- ── E9 · 판매 취소 → 소진 되돌리기 ────────────────────────────
-- 원장은 지우지 않는다(절대원칙 4). 반대 부호의 보정 이벤트를 새로 쌓아 되돌린다.
create or replace function public.e9_sales_reverted(
  p_sales_item uuid
) returns jsonb language plpgsql security invoker as $$
declare
  rec     record;
  v_lines int := 0;
begin
  for rec in
    select ev.id, ev.ingredient_id, ev.store_id, ev.count_delta, ev.occurred_at
      from inventory_events ev
     where ev.sales_item_id = p_sales_item and ev.type = 'consume'
       -- 이미 되돌린 건은 제외한다(보정 이벤트에는 note 표식을 남긴다).
       and not exists (
         select 1 from inventory_events r
          where r.sales_item_id = p_sales_item and r.type = 'adjust'
            and r.ingredient_id = ev.ingredient_id)
  loop
    -- 차감했던 만큼 되돌린다. count_delta 는 음수였으므로 부호를 뒤집어 더한다.
    update inventory_states
       set sealed_count = coalesce(sealed_count, 0) + (-rec.count_delta)
     where ingredient_id = rec.ingredient_id;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
    values
      (rec.store_id, rec.ingredient_id, 'adjust', -rec.count_delta, p_sales_item,
       '판매 취소 보정', now());

    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object('sales_item_id', p_sales_item, 'reverted_lines', v_lines);
end;
$$;

comment on function public.e9_sales_reverted(uuid) is
  'E9 판매 취소. consume 을 삭제하지 않고 반대 부호 보정 이벤트를 쌓아 재고를 되돌린다(원장 append-only).';
