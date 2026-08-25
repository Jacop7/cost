-- ════════════════════════════════════════════════════════════════
-- 0107 · 부족 판정을 목적별로 가른다
--
-- 0101 은 한 가지 판정만 했다 — `재고 <= 0`. 그래서 이게 안 잡혔다.
--
--     소고기 현재 재고   100g
--     소불고기 1개 필요량 150g      → 못 만드는데 부족 목록에 없다
--
-- 목적이 둘인데 판정이 하나였던 게 원인이다. 갈라 놓는다.
--
--   ① 영업 시작  `현재 재고 < 1개 필요량`
--      메뉴를 하나도 못 만드는 레시피만. 안전재고 미달이지만 1개는 만들 수
--      있는 건 여기 안 넣는다 — 빨간 경고가 매일 떠 있으면 아무도 안 읽는다.
--      그건 `전체 부족 재고`(소진 임박)의 몫이다.
--
--   ② 판매      `현재 재고 < 추가 필요량`
--      ⚠ 전체 판매량이 아니라 **증가분**이다. 10개를 7개로 고치는데
--        부족 경고가 뜨면 안 된다 — 오히려 재고가 3개분 돌아온다.
--
-- ⚠ ②는 `reconcile_sales_consumption` 과 **같은 식**이어야 한다. 미리보기가
--   실제 차감과 다르면 그 경고는 두 번 다시 못 믿는다. 그래서 베끼지 않고
--   같은 재료를 쓴다 — 필요량은 `day_ingredient_needs`(그날 스냅샷),
--   이미 반영된 몫은 `inventory_events.sales_item_id` 합계.
--   지금 레시피로 다시 계산하지 않는다(영업 중 레시피를 고쳐도 이미 판 몫은 그대로).
--
-- ⚠ 둘 다 **읽기 전용**이다. 재고도 원장도 건드리지 않는다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 영업 시작 — 1개도 못 만드는 레시피 ──────────────────────
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
       -- ⚠ `<= 0` 이 아니라 `< 1개 필요량` 이다(0107). 100g 남았는데 150g 이
       --   필요하면 그 메뉴는 못 만든다 — 재고가 0 이 아니어도 부족이다.
       and n.amount > 0 and stock_total_base(i.id) < n.amount
  )
  select jsonb_build_object(
    'mode', 'start',
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
                       -- 영업 시작 화면은 `안전재고 · 현재 재고` 를 보여 준다.
                       'need', s.need_per_serving,
                       'stock', s.stock) order by s.ingredient_name)) as x
            from short s group by s.recipe_id, s.recipe_name) t), '[]'::jsonb)
  );
$fn$;

comment on function public.recipe_shortages(uuid) is
  '지금 재고로 **1개도 못 만드는** 레시피와 그 재료들(0107). 영업 시작 전 확인과 '
  '매출 상단 `식재료 부족 N개` 가 쓰는 판정이다. 안전재고 미달은 여기 안 들어간다 — '
  '그건 소진 임박이고 `전체 부족 재고` 의 몫이다. 읽기 전용.';


-- ── ② 판매 — 이번에 더 빠질 몫이 모자란가 ─────────────────────
-- p_items 는 `save_sale` 이 받는 것과 **같은 모양**이다. 화면이 저장 직전에
-- 보낼 것을 그대로 보내고, 서버가 같은 식으로 재어 본다.
create or replace function public.sale_shortages(p_store uuid, p_date date, p_items jsonb)
returns jsonb language sql stable as $fn$
  with want as (
    select (x->>'recipe_id')::uuid as recipe_id,
           coalesce((x->>'qty_hall')::numeric, 0)
         + coalesce((x->>'qty_delivery')::numeric, 0)
         + coalesce((x->>'qty_takeout')::numeric, 0) as sold,
           coalesce((x->>'qty_waste')::numeric, 0)   as waste
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
     where nullif(x->>'recipe_id', '') is not null
  ),
  -- 이미 저장돼 있는 판매 줄. 없으면 sales_item_id 가 null 이고 taken 은 0 이다.
  item as (
    select w.recipe_id, w.sold, w.waste, it.id as sales_item_id
      from want w
      left join daily_sales ds
        on ds.store_id = p_store and ds.sale_date = p_date
      left join daily_sales_items it
        on it.daily_sales_id = ds.id and it.recipe_id = w.recipe_id
  ),
  -- 목표치 — 판매분과 조리 폐기분은 축이 다르다(reconcile 과 같다).
  target as (
    select i.recipe_id, n.ingredient_id, false as waste, sum(n.amount) as need
      from item i
      cross join lateral day_ingredient_needs(p_store, p_date, i.recipe_id, i.sold) n
     group by 1, 2
    union all
    select i.recipe_id, n.ingredient_id, true, sum(n.amount)
      from item i
      cross join lateral day_ingredient_needs(p_store, p_date, i.recipe_id, i.waste) n
     group by 1, 2
  ),
  applied as (
    select i.recipe_id, ev.ingredient_id, ev.waste, -sum(ev.count_delta) as taken
      from item i
      join inventory_events ev on ev.sales_item_id = i.sales_item_id
     group by 1, 2, 3
  ),
  -- 이번에 더 빠질 몫. 음수면 되돌아오는 것이므로 부족일 수 없다.
  delta as (
    select t.recipe_id, t.ingredient_id,
           sum(t.need - coalesce(a.taken, 0)) as add_need
      from target t
      left join applied a
        on a.recipe_id = t.recipe_id and a.ingredient_id = t.ingredient_id and a.waste = t.waste
     group by 1, 2
  ),
  -- ⚠ 부족 여부는 **재료별 합계**로 판정한다. 대파를 두 메뉴가 나눠 쓰면
  --   각각은 되지만 합치면 모자랄 수 있다. 화면에 적는 필요 수량은 메뉴별이다.
  per_ing as (
    select ingredient_id, sum(add_need) as total_need from delta group by 1
  ),
  short as (
    select d.recipe_id, r.name as recipe_name,
           i.id as ingredient_id, i.name as ingredient_name,
           i.base_unit, i.safety_stock, i.safety_stock_is_base, i.per_volume,
           d.add_need as need,
           stock_total_base(i.id) as stock
      from delta d
      join per_ing p on p.ingredient_id = d.ingredient_id
      join ingredients i on i.id = d.ingredient_id
      join recipes r on r.id = d.recipe_id
     where d.add_need > 0 and p.total_need > stock_total_base(i.id)
  )
  select jsonb_build_object(
    'mode', 'sale',
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
                       -- 판매 화면은 `필요 수량 · 현재 재고` 를 보여 준다.
                       'need', s.need,
                       'stock', s.stock) order by s.ingredient_name)) as x
            from short s group by s.recipe_id, s.recipe_name) t), '[]'::jsonb)
  );
$fn$;

comment on function public.sale_shortages(uuid, date, jsonb) is
  '이 판매를 저장하면 **더 빠질 몫**이 모자란지 미리 잰다(0107). p_items 는 save_sale 과 '
  '같은 모양이다. 필요량은 그날 스냅샷, 이미 반영된 몫은 원장 — reconcile_sales_consumption '
  '과 같은 식이라 미리보기와 실제 차감이 어긋나지 않는다. 수량을 줄이는 저장은 부족이 아니다. 읽기 전용.';

select public.assert_no_rpc_overloads();
