-- ════════════════════════════════════════════════════════════════
-- 0098 · 재료 원가는 **판 것의 원가**다 — 되짚기를 그날 기준값으로
--
-- 사장님: "똑같아야 하는것 아니야? 금액은?"
--
-- 같은 날 같은 이름의 숫자가 둘이었다(실측 2026-08-24).
--     일 손익 · (−) 재료 원가        159,472원   판 것의 원가
--     재료 원가 자세히 · 합계        139,853원   실제로 나간 재고
--     차이                            19,619원
--
-- 뿌리는 `consume_stock` 의 `least(p_amount, 재고)` 다. 재고가 모자라면
-- **이벤트 자체를 잘라서** 기록한다 — 소고기 불고기감 1,500g 이 필요했는데
-- 750g 만 원장에 남았다(750g × 29.90원/g = 22,425원, 조리 폐기 2,806원과 상쇄돼 19,619원).
-- 그래서 원장을 세던 `sales_material_usage` 만 손익과 갈라졌다.
--
-- ⚠ **부자재는 이미 그날 기준값을 쓴다**(`sales_extra_usage`). 재료만 원장을 세고 있었다.
--   둘을 맞추는 게 이 마이그레이션이다.
--
-- 역할을 못 박는다 —
--     "판 메뉴의 재료 원가는 얼마인가"  → 그날 기준값(day_basis). 이 함수.
--     "재고가 얼마나 줄었나"            → 재고 원장. 식재료 > 재고 내역.
--   한 화면이 두 역할을 겸하면 이번처럼 숫자가 갈라진다.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 스냅샷 lines 의 반제품 구멍부터 막는다 ──────────────────
-- 지금 `recipe_snapshot_entry` 는 `l.ingredient_id is not null` 인 줄만 담는다.
-- 반제품(`sub_recipe_id`) 줄은 통째로 빠지는데, `unit_material_cost` 는 전개해서 낸다.
-- 그 상태로 lines 를 곱하면 합계가 손익보다 **적게** 나온다.
-- 지금 데이터에 반제품이 0건이라 안 터졌을 뿐, 하나만 생기면 바로 어긋난다.
-- `recipe_ingredient_needs` 가 이미 전개해 주므로 그것으로 만든다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_snapshot_entry';

  if v_def is null then
    raise exception '0098: recipe_snapshot_entry 가 없습니다' using errcode = '45003';
  end if;
  if position('recipe_ingredient_needs' in v_def) > 0 then return; end if;

  -- ⚠ 함수를 통째로 다시 쓰지 않는다. `basis_at`·`tax` 처럼 여기서 안 보이는 필드를
  --   흘릴 수 있다. `lines` 블록만 정규식으로 도려낸다.
  v_new := regexp_replace(v_def,
    $re$'lines', coalesce\(\(select jsonb_agg[\s\S]*?'\[\]'::jsonb\)\)$re$,
    $new$'lines', coalesce((select jsonb_agg(jsonb_build_object(
                          'ingredient_id', n.ingredient_id,
                          'name', i.name,
                          'base_unit', i.base_unit,
                          'per_serving', n.amount,
                          'unit_price', base_unit_price(n.ingredient_id)))
                          from recipe_ingredient_needs(r.id, 1) n
                          join ingredients i on i.id = n.ingredient_id), '[]'::jsonb))$new$);

  if v_new = v_def then
    raise exception '0098: recipe_snapshot_entry 의 lines 블록을 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;

  -- 흘린 필드가 없는지 되짚는다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_snapshot_entry';
  if position('basis_at' in v_def) = 0 or position('tax_items' in v_def) = 0
     or position('recipe_ingredient_needs' in v_def) = 0 then
    raise exception '0098: 스냅샷 칸이 바뀌었습니다 — 필드가 빠졌습니다' using errcode = '45003';
  end if;
end
$mig$;

comment on function public.recipe_snapshot_entry(uuid) is
  '영업일 스냅샷의 레시피 한 칸. lines 는 **반제품을 전개한 1인분 사용량**이다(0098) — '
  '직접 재료만 담으면 unit_material_cost 와 합이 안 맞는다.';


-- ── 2. 되짚기를 그날 기준값으로 ───────────────────────────────
create or replace function public.sales_material_usage(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with used as (
    -- ⚠ 조리 폐기(qty_waste)는 **뺀다.** 만들어 놓고 못 판 몫은 재료 원가가 아니라
    --   폐기 손실이다(0041). 여기 넣으면 같은 돈이 손익에서 두 번 빠진다.
    select (l->>'ingredient_id')::uuid as ingredient_id,
           it.menu_name,
           ds.sale_date,
           (l->>'per_serving')::numeric
             * (it.qty_hall + it.qty_delivery + it.qty_takeout) as qty,
           -- ⚠ 단가도 **그 줄에 굳어 있는 값**을 쓴다. `day_unit_price` 를 다시 부르면
           --   영업 중에 재료값이 오른 날 합계가 손익보다 커진다(테스트에서 853.65원 어긋났다).
           --   `unit_material_cost` 가 바로 이 단가로 계산된 값이라 정의상 맞물린다.
           (l->>'unit_price')::numeric as unit_price
      from daily_sales ds
      join daily_sales_items it on it.daily_sales_id = ds.id
      cross join lateral jsonb_array_elements(
        coalesce(day_snapshot(p_store, ds.sale_date)
                 #> array['recipes', it.recipe_id::text, 'lines'], '[]'::jsonb)) l
     where ds.store_id = p_store
       and ds.sale_date between p_from and p_to
       and it.recipe_id is not null
       and it.qty_hall + it.qty_delivery + it.qty_takeout > 0
  ),
  -- 금액은 그날 단가로 낸다(0058). 현재 단가를 곱하면 재료값이 오를 때마다
  -- 지난 날짜의 재료비 내역이 통째로 올라간다.
  -- 스냅샷에 단가가 없는 옛 행만 `day_unit_price` 로 메운다.
  priced as (
    select u.ingredient_id, u.menu_name, u.sale_date, u.qty,
           u.qty * coalesce(u.unit_price,
                            day_unit_price(p_store, u.sale_date, u.ingredient_id), 0) as amount
      from used u
  ),
  per_ing as (
    select p.ingredient_id, sum(p.qty) as qty, sum(p.amount) as amount
      from priced p group by p.ingredient_id
     having sum(p.qty) > 0
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(p.amount), 0) from per_ing p),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ingredient_id', p.ingredient_id,
               'name', i.name,
               'base_unit', i.base_unit,
               'qty', p.qty,
               -- 기간 중 단가가 바뀌었으면 한 값으로 말할 수 없다 — 실제 지출 나누기 수량이 답이다.
               'unit_price', case when p.qty > 0 then p.amount / p.qty else null end,
               'amount', p.amount,
               'menus', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'menu_name', m.menu_name,
                          'qty', m.qty,
                          'amount', m.amount) order by m.amount desc), '[]'::jsonb)
                   from (select pr.menu_name, sum(pr.qty) as qty, sum(pr.amount) as amount
                           from priced pr
                          where pr.ingredient_id = p.ingredient_id
                          group by pr.menu_name) m))
             order by p.amount desc), '[]'::jsonb)
      from per_ing p join ingredients i on i.id = p.ingredient_id)
  );
$fn$;

comment on function public.sales_material_usage(uuid, date, date) is
  '재료 원가를 식재료별로 쪼갠다(0098). **그날 기준값 × 판매 수량 × 그날 단가**이며 '
  '합계는 sales_summary 의 material_cost 와 항상 같아야 한다. '
  '⚠ 조리 폐기는 뺀다 — 그건 폐기 손실이다. '
  '⚠ 재고가 얼마나 줄었는지는 이 함수가 답하지 않는다. 그건 재고 내역이다.';

select public.assert_no_rpc_overloads();
