-- ════════════════════════════════════════════════════════════════
-- 0101 · 재고 확인 — 레시피별로 어느 재료가 모자란지
--
-- 사장님: "이거 클릭하면 재고부족 리스트 나오고 재료추가 하는 프로세스 생략했다"
--
-- 매출 상단의 `식재료 부족 N개` 를 눌렀을 때 갈 곳이 없었다. 식재료 목록으로 보내면
-- **어느 메뉴가 왜 막혔는지**가 사라진다 — 사장님이 알아야 할 건 그것이다.
--
-- `recipe_blocked_by` 는 막는 재료를 **하나만** 준다(`limit 1`). 목록을 그리려면
-- 레시피마다 전부 필요하다. 같은 판정을 두 벌로 쓰지 않도록 조건은 그대로 옮긴다 —
--     `n.amount > 0 and stock_total_base(n.ingredient_id) <= 0`
--
-- ⚠ 읽기 전용이다. 재고도 판정 기준도 바꾸지 않는다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.recipe_shortages(p_store uuid)
returns jsonb language sql stable as $fn$
  with short as (
    select r.id as recipe_id, r.name as recipe_name,
           i.id as ingredient_id, i.name as ingredient_name,
           i.base_unit, i.safety_stock, i.safety_stock_is_base, i.per_volume,
           n.amount as need_per_serving,
           stock_total_base(i.id) as stock
      from recipes r
      cross join lateral recipe_ingredient_needs(r.id, 1) n
      join ingredients i on i.id = n.ingredient_id
     where r.store_id = p_store and r.active
       and n.amount > 0 and stock_total_base(i.id) <= 0
  )
  select jsonb_build_object(
    -- 같은 재료가 여러 메뉴를 막아도 **하나로** 센다. 상단 안내가 쓰는 숫자다.
    'ingredient_count', (select count(distinct ingredient_id) from short),
    'recipe_count', (select count(distinct recipe_id) from short),
    'recipes', coalesce((
      select jsonb_agg(x order by x->>'name')
        from (
          select jsonb_build_object(
                   'recipe_id', s.recipe_id,
                   'name', s.recipe_name,
                   'count', count(*),
                   'ingredients', jsonb_agg(jsonb_build_object(
                       'ingredient_id', s.ingredient_id,
                       'name', s.ingredient_name,
                       'base_unit', s.base_unit,
                       'safety_stock', s.safety_stock,
                       'safety_stock_is_base', s.safety_stock_is_base,
                       'per_volume', s.per_volume,
                       'need_per_serving', s.need_per_serving,
                       'stock', s.stock) order by s.ingredient_name)) as x
            from short s group by s.recipe_id, s.recipe_name) t), '[]'::jsonb)
  );
$fn$;

comment on function public.recipe_shortages(uuid) is
  '재고가 바닥나 못 만드는 레시피와 그 재료들(0101). 판정은 recipe_blocked_by 와 같다 — '
  '`필요량 > 0 이고 재고 <= 0`. 읽기 전용이며 재고를 건드리지 않는다.';

select public.assert_no_rpc_overloads();
