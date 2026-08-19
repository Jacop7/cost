-- ════════════════════════════════════════════════════════════════
-- 0061 · 판매 입력 카드도 그날 기준으로
--
-- 매출 화면의 돈 숫자는 전부 그날 기준으로 고정했는데(0051·0058·0059),
-- **판매를 입력하는 카드 하나만** 현재 레시피를 보고 있었다.
--
--   카드에 보이는 판매가   20,000원   (recipe_list = 지금 값)
--   실제로 팔면 기록되는 값 12,000원   (스냅샷 = 영업 시작 시점)
--
-- 사장님이 12,000 → 20,000 으로 고친 뒤 그 카드를 눌러 팔면, 화면은 20,000 이라
-- 했는데 장부에는 12,000 이 박힌다. 스냅샷 모델은 맞지만 **화면이 거짓말을 했다.**
--
-- 오늘 팔면 얼마로 잡히는지를 그대로 보여 주고, 고친 값은 "내일부터"라고 밝힌다.
--
-- ⚠ 팔 수 있느냐(판매 중지·재료 부족)는 **지금** 상태로 본다. 재고는 지금 것이고
--   판매 중지도 지금 결정이다 — e10 이 판매를 막을 때 쓰는 기준과 같아야 한다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.day_menu_basis(p_store uuid, p_date date default null)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_date date := coalesce(p_date, business_day());
  v_snap jsonb;
  v_rate numeric;
begin
  perform assert_my_store(p_store);

  v_snap := day_snapshot(p_store, v_date);
  v_rate := coalesce(day_fixed_rate(p_store, v_date), 0);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'recipe_id', r.id,
      'name', r.name,
      'category_id', r.category_id,

      -- ── 오늘 기준. 영업 전이면 스냅샷이 없고, 그때는 지금 값이 곧 오늘 값이 된다 ──
      'price',         b.price,
      'material_cost', b.material_cost,
      'extra_cost',    b.extra_cost,
      'tax',           b.tax,
      'fixed_cost',    v_rate * b.price,
      'profit',        b.price - b.material_cost - b.extra_cost - b.tax - v_rate * b.price,

      -- ── 지금 값 — 달라졌으면 화면이 "내일부터"라고 알린다 ──
      'current_price',         r.price,
      'current_material_cost', cur.material_cost,
      'current_profit',        r.price - cur.material_cost - cur.extra_cost - cur.tax - v_rate * r.price,

      -- ⚠ 스냅샷에 없는 필드(옛 기록)는 "같다"로 본다 — coalesce 로 현재값을 넣어
      --   비교식이 NULL 로 새지 않게 한다. NULL 이 섞이면 or 가 통째로 NULL 이 된다.
      'changed', coalesce(
        v_snap is not null and s.price is not null and (
             r.price is distinct from b.price
          or abs(cur.material_cost - b.material_cost) > 0.005
          or abs(cur.extra_cost    - b.extra_cost)    > 0.005
          or abs(cur.tax           - b.tax)           > 0.005), false),

      -- ⚠ 오늘 기준에 없는 메뉴는 오늘 팔 수 없다(e10 이 막는다). 오늘 만든 메뉴가 그렇다.
      'in_basis', (v_snap is null or s.price is not null),

      -- ── 팔 수 있느냐는 지금 상태 ──
      'active', r.active,
      'blocked_by', recipe_blocked_by(r.id))
    order by r.name)
    from recipes r
    -- 현재값은 한 번만 계산한다. recipe_material_cost 는 레시피를 훑으므로 반복하면 비싸다.
    left join lateral (
      select recipe_material_cost(r.id) as material_cost,
             coalesce((select sum(x.amount_per_serving)
                         from recipe_extra_costs x where x.recipe_id = r.id), 0) as extra_cost,
             tax_of(r.price, r.tax_mode, r.tax_items) as tax
    ) cur on true
    left join lateral (
      select (v_snap #>> array['recipes', r.id::text, 'price'])::numeric         as price,
             (v_snap #>> array['recipes', r.id::text, 'material_cost'])::numeric as material_cost,
             (v_snap #>> array['recipes', r.id::text, 'extra_cost'])::numeric    as extra_cost,
             (v_snap #>> array['recipes', r.id::text, 'tax'])::numeric           as tax
    ) s on true
    left join lateral (
      select coalesce(s.price, r.price)                 as price,
             coalesce(s.material_cost, cur.material_cost) as material_cost,
             coalesce(s.extra_cost, cur.extra_cost)     as extra_cost,
             coalesce(s.tax, cur.tax)                   as tax
    ) b on true
   where r.store_id = p_store), '[]'::jsonb);
end;
$fn$;

comment on function public.day_menu_basis(uuid, date) is
  '판매 입력 카드가 쓰는 그날 기준 메뉴 목록 — 오늘 팔면 잡히는 값 + 지금 값이 달라졌는지(0061).';

select public.assert_no_rpc_overloads();
