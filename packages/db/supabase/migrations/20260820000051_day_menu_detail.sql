-- ════════════════════════════════════════════════════════════════
-- 0051 · 메뉴 손익 세부를 그날 기준으로
--
-- 사장님: "계속 판매가만 생각하고 있는데 세부 항목도 영향 있다니까"
--
-- 매출 → 메뉴 손익 화면이 세부(재료 줄·부자재·고정지출 항목)를
-- **현재 레시피**에서 가져온다. 요약은 스냅샷을 쓰는데 세부만 오늘 값이라
-- 둘이 어긋나고, 레시피를 고치면 지난 날짜의 세부가 따라 움직인다.
--   화면 코드: const recipe = useRecipeDetail(...)  ← 현재 값
--
-- 0048 이 이미 그날 구성을 스냅샷에 담아 뒀다. 여기서 화면이 쓸 모양으로 꺼낸다.
-- 재료는 1인분량과 **그때 단가**를 함께 담았으므로 나중에 단가가 올라도 안 흔들린다.
--
-- ⚠ 고정지출 항목별 배분도 스냅샷의 fixed_items 로 낸다. 지금은 현재 월 설정을
--   비중대로 나눠서, 인건비 한 줄만 고쳐도 지난 장부의 항목별 숫자가 전부 바뀐다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.day_menu_detail(p_store uuid, p_date date, p_recipe uuid)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  b        business_days;
  v_snap   jsonb;
  v_item   daily_sales_items;
  v_qty    numeric;
  v_price  numeric;
  v_mat    numeric;
  v_extra  numeric;
  v_rate   numeric;
  v_fixed  numeric;
  v_tax    numeric;
  v_sum    numeric;
begin
  b := business_day_of(p_store, p_date);
  v_snap := b.snapshot #> array['recipes', p_recipe::text];

  select * into v_item
    from daily_sales_items it join daily_sales ds on ds.id = it.daily_sales_id
   where ds.store_id = p_store and ds.sale_date = p_date and it.recipe_id = p_recipe;

  -- 판 적이 없으면 화면이 "판매 없음"을 그리게 null 을 돌려준다.
  if v_item.id is null then
    return jsonb_build_object('date', p_date, 'recipe_id', p_recipe, 'sold', false,
                              'snapshot', v_snap);
  end if;

  v_qty   := v_item.qty_hall + v_item.qty_delivery + v_item.qty_takeout;
  -- ⚠ 금액은 매출 줄 스냅샷이 권위다. 스냅샷이 없는 과거 데이터도 여기서 살아난다.
  v_price := v_item.unit_price;
  v_mat   := v_item.unit_material_cost;
  v_extra := coalesce(v_item.unit_extra_cost, 0);
  v_rate  := coalesce((b.snapshot->>'fixed_rate')::numeric,
                      coalesce(fixed_cost_rate(p_store, to_char(p_date,'YYYY-MM')), 0));
  v_fixed := v_rate * v_price;
  v_tax   := case when coalesce(v_item.tax_mode,'included') = 'included'
                  then v_price * 10 / 110 else 0 end;

  -- 고정지출 항목별 배분 — 그날 항목 구성과 금액으로 나눈다.
  v_sum := (select coalesce(sum((i->>'total')::numeric), 0)
              from jsonb_array_elements(coalesce(b.snapshot->'fixed_items','[]'::jsonb)) i);

  return jsonb_build_object(
    'date', p_date,
    'recipe_id', p_recipe,
    'sold', true,
    'name', coalesce(v_snap->>'name', v_item.menu_name),
    'qty', v_qty,
    'qty_waste', coalesce(v_item.qty_waste, 0),
    'qty_hall', v_item.qty_hall,
    'qty_delivery', v_item.qty_delivery,
    'qty_takeout', v_item.qty_takeout,
    'base_servings', coalesce((v_snap->>'base_servings')::int, 1),
    'tax_mode', coalesce(v_item.tax_mode, 'included'),
    -- 1개 기준 금액. 전부 그날 값이다.
    'price', v_price,
    'material_cost', v_mat,
    'extra_cost', v_extra,
    'fixed_rate', v_rate,
    'fixed_cost', v_fixed,
    'tax', v_tax,
    'profit', v_price - v_mat - v_extra - v_fixed - v_tax,
    -- ── 세부: 재료 줄 (그날 구성 · 그날 단가) ────────────────
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ingredient_id', l->>'ingredient_id',
               'name', l->>'name',
               'base_unit', l->>'base_unit',
               'per_serving', (l->>'per_serving')::numeric,
               'unit_price', (l->>'unit_price')::numeric,
               'amount', (l->>'per_serving')::numeric * coalesce((l->>'unit_price')::numeric, 0)))
        from jsonb_array_elements(coalesce(v_snap->'lines','[]'::jsonb)) l), '[]'::jsonb),
    -- ── 세부: 부자재 (그날 항목 · 그날 금액) ─────────────────
    'extras', coalesce(v_snap->'extras', '[]'::jsonb),
    -- ── 세부: 고정지출 항목별 (그날 구성 · 그날 비중) ────────
    'fixed_items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', i->>'key',
               'amount', case when v_sum > 0 then v_fixed * (i->>'total')::numeric / v_sum else 0 end,
               'rate',   case when v_sum > 0 then v_rate  * (i->>'total')::numeric / v_sum else 0 end))
        from jsonb_array_elements(coalesce(b.snapshot->'fixed_items','[]'::jsonb)) i), '[]'::jsonb));
end;
$fn$;

comment on function public.day_menu_detail(uuid, date, uuid) is
  '그날 기준 메뉴 손익 세부 — 재료 줄·부자재·고정지출 항목까지 영업 시작 시점 값이다(0051).';

select public.assert_no_rpc_overloads();
