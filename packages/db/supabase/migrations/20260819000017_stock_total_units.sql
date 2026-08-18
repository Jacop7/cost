-- ════════════════════════════════════════════════════════════════
-- 0017 · 재고 총량 단일 출처 + E8 단위 버그 수정 (P0, 절대원칙 1 위반)
--
-- 발견 (E8 실행 중 실증):
--   대파 재고 `sealed_count = 2`(2봉지), 제육볶음 5개 판매에 필요한 양 `125g`.
--   E8 이 `sealed_count - 125` 를 계산해 "재고 2, 부족 123" 이라고 보고했다.
--   **개수에서 그램을 뺀 것이다.** 실제 잔량은 2봉지 × 1,000g = 2,000g 이므로 충분했다.
--
-- 뿌리 원인:
--   `inventory_states` 는 재고를 **미개봉 개수(sealed_count) + 개봉분 잔량(opened_remain, 기준단위)**
--   두 가지 단위로 나눠 들고 있는데, 이를 하나의 총량으로 환산하는 **공통 함수가 없었다.**
--   그래서 소비하는 쪽마다 제각기 해석했다:
--     · E8(판매 소진)  — sealed_count 를 기준단위로 오해 (이번에 발견)
--     · 앱 화면들       — safety_stock/min_order_qty 를 g 로 입력받고 상세는 '개'로 표기
--   절대원칙 1("DB 저장은 최소단위 g/ml/개")이 재고에서 지켜지지 않고 있었다.
--
-- 해결:
--   총량 환산을 **함수 하나**로 고정하고(`stock_total_base`), 차감도 함수 하나로 고정한다
--   (`consume_stock`). 개봉분을 먼저 쓰고 모자라면 미개봉을 헐어 쓰는 실제 주방 순서를 따른다.
--
--   재고 총량(기준단위) = 미개봉 개수 × 개당 용량 + 개봉분 잔량
-- ════════════════════════════════════════════════════════════════

-- ── 총량 환산 (읽기 단일 출처) ────────────────────────────────
create or replace function public.stock_total_base(p_ingredient uuid)
returns numeric language sql stable security invoker as $$
  select coalesce(s.sealed_count, 0) * coalesce(i.per_volume, 0)
       + coalesce(s.opened_remain, 0)
    from ingredients i
    left join inventory_states s on s.ingredient_id = i.id
   where i.id = p_ingredient;
$$;

comment on function public.stock_total_base(uuid) is
  '재고 총량(기준단위 g/ml/개) = 미개봉 개수 × 개당 용량 + 개봉분 잔량. 재고를 읽는 모든 곳이 이 함수를 쓴다.';

-- ── 차감 (쓰기 단일 출처) ─────────────────────────────────────
-- 개봉분을 먼저 소진하고, 모자라면 미개봉을 하나씩 헐어 쓴다(실제 주방 순서).
-- 반환: 실제로 차감된 양(기준단위). 재고가 모자라면 있는 만큼만 차감한다(음수 금지, 불변식 6).
create or replace function public.consume_stock(p_ingredient uuid, p_amount numeric)
returns numeric language plpgsql security invoker as $$
declare
  v_per      numeric;
  v_sealed   numeric;
  v_opened   smallint;
  v_remain   numeric;
  v_total    numeric;
  v_take     numeric;
  v_need     numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  select i.per_volume, coalesce(s.sealed_count,0), coalesce(s.opened_count,0), coalesce(s.opened_remain,0)
    into v_per, v_sealed, v_opened, v_remain
    from ingredients i left join inventory_states s on s.ingredient_id = i.id
   where i.id = p_ingredient;

  if v_per is null or v_per <= 0 then return 0; end if;

  v_total := v_sealed * v_per + v_remain;
  v_take  := least(p_amount, v_total);   -- 있는 만큼만
  v_need  := v_take;

  -- 1) 개봉분 먼저
  if v_remain > 0 then
    if v_remain >= v_need then
      v_remain := v_remain - v_need;
      v_need := 0;
    else
      v_need := v_need - v_remain;
      v_remain := 0;
      v_opened := 0;
    end if;
  end if;

  -- 2) 모자라면 미개봉을 헐어 쓴다
  while v_need > 0 and v_sealed > 0 loop
    v_sealed := v_sealed - 1;
    if v_per >= v_need then
      v_remain := v_per - v_need;
      v_opened := case when v_remain > 0 then 1 else 0 end;
      v_need := 0;
    else
      v_need := v_need - v_per;
    end if;
  end loop;

  update inventory_states
     set sealed_count  = v_sealed,
         opened_count  = v_opened,
         opened_remain = v_remain
   where ingredient_id = p_ingredient;

  return v_take;
end;
$$;

comment on function public.consume_stock(uuid, numeric) is
  '재고를 기준단위로 차감한다. 개봉분 → 미개봉 순서. 있는 만큼만 빼고 음수로 내려가지 않는다. 반환은 실제 차감량.';

-- ── E8 재정의 — 총량 기준으로 판정하고 consume_stock 으로 차감 ─
create or replace function public.e8_sales_consumed(
  p_sales_item uuid
) returns jsonb language plpgsql security invoker as $$
declare
  it        daily_sales_items%rowtype;
  ds        daily_sales%rowtype;
  v_qty     numeric;
  v_day     date;
  rec       record;
  v_need    numeric;
  v_before  numeric;
  v_taken   numeric;
  v_short   jsonb := '[]'::jsonb;
  v_lines   int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;
  v_qty := it.qty_hall + it.qty_delivery + it.qty_takeout;

  if exists (select 1 from inventory_events where sales_item_id = p_sales_item) then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', true, 'lines', 0);
  end if;

  if v_qty <= 0 or it.recipe_id is null then
    return jsonb_build_object('sales_item_id', p_sales_item, 'duplicate', false, 'lines', 0);
  end if;

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
    v_need := rec.per_serving * v_qty;

    -- **총량**으로 비교한다. 개수와 그램을 섞지 않는다.
    v_before := stock_total_base(rec.ingredient_id);
    v_taken  := consume_stock(rec.ingredient_id, v_need);

    if v_need > v_before then
      v_short := v_short || jsonb_build_object(
        'ingredient_id', rec.ingredient_id, 'name', rec.name,
        'needed', v_need, 'available', v_before, 'shortage', v_need - v_before);
    end if;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, sales_item_id, note, occurred_at)
    values
      (it.store_id, rec.ingredient_id, 'consume', -v_taken, p_sales_item,
       it.menu_name || ' ' || v_qty || '개 판매',
       (v_day::timestamp at time zone business_tz()));

    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'duplicate', false,
    'lines', v_lines, 'sold_qty', v_qty, 'shortages', v_short);
end;
$$;

-- ── E9 재정의 — 되돌릴 때도 총량 규칙을 따른다 ────────────────
-- 되돌리는 양은 "미개봉 몇 개 + 개봉 잔량" 으로 되돌리기 어렵다(어느 봉지에서 뺐는지 모른다).
-- 개봉분에 그대로 얹는다 — 총량이 정확히 복구되고, 다음 소진 때 개봉분부터 쓰이므로 일관된다.
create or replace function public.e9_sales_reverted(
  p_sales_item uuid
) returns jsonb language plpgsql security invoker as $$
declare
  rec     record;
  v_lines int := 0;
begin
  for rec in
    select ev.id, ev.ingredient_id, ev.store_id, ev.count_delta
      from inventory_events ev
     where ev.sales_item_id = p_sales_item and ev.type = 'consume'
       and not exists (
         select 1 from inventory_events r
          where r.sales_item_id = p_sales_item and r.type = 'adjust'
            and r.ingredient_id = ev.ingredient_id)
  loop
    update inventory_states
       set opened_remain = coalesce(opened_remain, 0) + (-rec.count_delta),
           opened_count  = case when coalesce(opened_remain, 0) + (-rec.count_delta) > 0 then 1 else opened_count end
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
