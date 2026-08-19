-- ════════════════════════════════════════════════════════════════
-- 0044 · 폐기 내역·구매 이력 전체 보기
--
-- 사장님: "식재료 상세에서 구매 이력 상세페이지 삭제했네?
--          로스율도 구매이력처럼 나오는데
--          탭 구성 전체 / 조리전 폐기 / 조리후 폐기 이렇게 하는 게 나을까"
--
-- ── 이름을 바꾼다 ────────────────────────────────────────────
-- 보관 폐기 → **조리 전 폐기**,  조리 폐기 → **조리 후 폐기**
-- 원인('보관')이 아니라 시점('조리 전/후')으로 부른다. 시점 기준이 읽는 즉시
-- 이해되고 둘이 대칭이라 짝으로 기억된다.
--
-- ── 왜 전체 보기가 필요한가 ──────────────────────────────────
-- ingredient_detail 은 화면 요약용이라 구매 이력을 20건으로 자른다. 단가가
-- 언제부터 올랐는지 보려면 잘리지 않은 목록이 필요하다. 재고 변동 내역에는
-- 이미 '자세히 보기'가 있는데 구매 이력에만 없어 짝이 맞지 않았다.
-- ════════════════════════════════════════════════════════════════

-- ── 구매 이력 전체 ────────────────────────────────────────────
create or replace function public.purchase_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, ordered_at date, expected_at date, status order_status,
  vendor_name text, volume numeric, amount numeric,
  qty numeric, received_qty numeric, unit_price numeric
) language sql stable security invoker as $fn$
  select o.id, o.ordered_at, o.expected_at, o.status,
         v.name,
         o.volume, o.amount, o.qty, o.received_qty,
         -- 이 건의 단가. 기준단가(가중평균)와 달리 **그날 그 값**이다.
         o.amount / nullif(o.volume, 0)
    from order_records o
    left join vendors v on v.id = o.vendor_id
   where o.ingredient_id = p_ingredient
     and (p_from is null or o.ordered_at >= p_from)
     and (p_to   is null or o.ordered_at <= p_to)
   order by o.ordered_at desc, o.created_at desc;
$fn$;

comment on function public.purchase_history(uuid, date, date) is
  '구매 이력 전체 — ingredient_detail 의 20건 제한 없이(0044).';

-- ── 원장 문구를 새 이름으로 ───────────────────────────────────
-- 앞으로 기록되는 것부터 바뀐다. 과거 행은 덮어쓰지 않는다(절대원칙 4) —
-- 화면 라벨은 waste 플래그로 그리므로 과거 행도 '조리 후 폐기'로 보인다.
create or replace function public.reconcile_sales_consumption(
  p_sales_item uuid, p_zero boolean default false
) returns jsonb language plpgsql as $fn$
declare
  it       daily_sales_items%rowtype;
  ds       daily_sales%rowtype;
  v_sold   numeric;
  v_waste  numeric;
  v_day    date;
  rec      record;
  v_delta  numeric;
  v_before numeric;
  v_taken  numeric;
  v_short  jsonb := '[]'::jsonb;
  v_lines  int := 0;
begin
  select * into it from daily_sales_items where id = p_sales_item for update;
  if not found then raise exception 'sales item % not found', p_sales_item; end if;

  select * into ds from daily_sales where id = it.daily_sales_id;
  v_day := ds.sale_date;

  -- 팔린 몫과 버린 몫을 따로 센다. 합계는 같지만 원장에서는 다른 사건이다.
  if p_zero or it.recipe_id is null then
    v_sold := 0; v_waste := 0;
  else
    v_sold  := it.qty_hall + it.qty_delivery + it.qty_takeout;
    v_waste := coalesce(it.qty_waste, 0);
  end if;

  for rec in
    with target as (
      select n.ingredient_id, false as waste, sum(n.amount) as need
        from recipe_ingredient_needs(it.recipe_id, v_sold) n group by 1
      union all
      select n.ingredient_id, true, sum(n.amount)
        from recipe_ingredient_needs(it.recipe_id, v_waste) n group by 1
    ),
    applied as (
      select ev.ingredient_id, ev.waste, -sum(ev.count_delta) as taken
        from inventory_events ev
       where ev.sales_item_id = p_sales_item
       group by 1, 2
    )
    select coalesce(t.ingredient_id, a.ingredient_id) as ingredient_id,
           coalesce(t.waste, a.waste)                 as waste,
           coalesce(t.need, 0)                        as need,
           coalesce(a.taken, 0)                       as taken,
           i.name
      from target t
      full join applied a
        on a.ingredient_id = t.ingredient_id and a.waste = t.waste
      join ingredients i on i.id = coalesce(t.ingredient_id, a.ingredient_id)
  loop
    -- 목표치 대조: 지금 있어야 할 양과 이미 반영된 양의 **차이만** 낸다.
    -- 되돌렸다 다시 적용하지 않는다 — RLS 아래에서 원장 삭제는 조용히 0행이다.
    v_delta := rec.need - rec.taken;
    if abs(v_delta) < 1e-9 then continue; end if;

    if v_delta > 0 then
      v_before := stock_total_base(rec.ingredient_id);
      v_taken  := consume_stock(rec.ingredient_id, v_delta);

      if v_delta > v_before then
        v_short := v_short || jsonb_build_object(
          'ingredient_id', rec.ingredient_id, 'name', rec.name,
          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before);
      end if;

      -- 재고가 바닥나 한 톨도 못 가져갔으면 이벤트를 만들지 않는다.
      -- 나간 게 없는데 원장에 줄이 생기면 "왜 이만큼 남았는지"의 설명이 흐려진다.
      if v_taken > 0 then
      -- ⚠ discard 는 volume_delta 에 **버린 양**을 담아야 한다(check 제약).
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, volume_delta,
         sales_item_id, waste, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id,
         (case when rec.waste then 'discard' else 'consume' end)::inventory_event_type,
         -v_taken,
         case when rec.waste then v_taken end,
         p_sales_item, rec.waste,
         it.menu_name || ' ' ||
         case when rec.waste then v_waste || '개 조리 후 폐기' else v_sold || '개 판매 소진' end,
         (v_day::timestamp at time zone business_tz()));
      end if;
    else
      perform restore_stock(rec.ingredient_id, -v_delta);
      insert into inventory_events
        (store_id, ingredient_id, type, count_delta, sales_item_id, waste, note, occurred_at)
      values
        (it.store_id, rec.ingredient_id, 'adjust', -v_delta, p_sales_item, rec.waste,
         case when rec.waste then
                case when v_waste = 0 then it.menu_name || ' 조리 후 폐기 취소'
                     else it.menu_name || ' 조리 후 폐기 수량 조정 (' || v_waste || '개)' end
              else
                case when v_sold = 0 then it.menu_name || ' 판매 취소 보정'
                     else it.menu_name || ' 판매 수량 조정 (' || v_sold || '개)' end
         end,
         (v_day::timestamp at time zone business_tz()));
    end if;

    perform refresh_order_candidate(rec.ingredient_id);
    v_lines := v_lines + 1;
  end loop;

  return jsonb_build_object(
    'sales_item_id', p_sales_item, 'lines', v_lines,
    'sold_qty', v_sold, 'waste_qty', v_waste, 'shortages', v_short);
end;
$fn$;

select public.assert_no_rpc_overloads();
