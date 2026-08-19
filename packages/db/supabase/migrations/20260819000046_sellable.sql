-- ════════════════════════════════════════════════════════════════
-- 0046 · 팔 수 없는 메뉴는 팔리지 않게 한다
--
-- 사장님: "판매 중지된 레시피는 판매 불가 처리 해야됨"
--         "재료 소진 해당 메뉴 매출페이지에서 판매 안되게 하고 재료 부족 뱃지"
--         "판매 막는게 맞지 ... 로직이 붕괴되"
--
-- ── 왜 막아야 하나 (실측) ────────────────────────────────────
-- 대파 재고 0 에서 제육볶음 5개를 팔면:
--   대파 필요 125g · 재고 0g → 차감 0g · **원장 이벤트 0건**
--   매출과 재료비는 정상 계상
-- 원장이 "이 재료가 어디로 갔는지" 설명을 포기한다. 다음 입고 때 재고가
-- 실제보다 125g 많아지고 그 오차가 영영 안 지워진다. 발주 후보도 그만큼 늦다.
-- 부족분 알림은 "틀어졌다"고 알릴 뿐 고쳐주지 않는다.
--
-- 재고가 0 인데 팔렸다는 건 **장부가 이미 틀렸다**는 뜻이다. 그럴 땐 매출을
-- 적기 전에 재고를 맞추는 게 순서다. 막으면 그 순서를 강제하게 된다.
--
-- ⚠ 화면만 막으면 다른 경로로 들어올 때 뚫린다. 서버에서 막는다.
-- ════════════════════════════════════════════════════════════════

-- ── 메뉴가 지금 만들 수 있는지 ────────────────────────────────
-- 반환: null = 만들 수 있음 / 재료명 = 그게 없어서 못 만듦
create or replace function public.recipe_blocked_by(p_recipe uuid)
returns text language sql stable security invoker as $fn$
  select i.name
    from recipe_ingredient_needs(p_recipe, 1) n
    join ingredients i on i.id = n.ingredient_id
   where n.amount > 0 and stock_total_base(n.ingredient_id) <= 0
   order by i.name
   limit 1;
$fn$;

comment on function public.recipe_blocked_by(uuid) is
  '이 메뉴를 못 만들게 하는 재료 이름(없으면 null) — 재고 0 인 재료를 찾는다(0046).';

-- ── 목록에 판매 가능 여부를 실어 준다 ─────────────────────────
-- 반환 컬럼이 늘어나므로 create or replace 로는 못 바꾼다.
drop function if exists public.recipe_list(uuid);

create or replace function public.recipe_list(p_store uuid)
returns table (
  id uuid, name text, price numeric, tax_mode tax_mode, base_servings int,
  target_profit_rate numeric, avg_monthly_sales numeric, active boolean,
  category_id uuid, category_name text,
  material_cost numeric, extra_cost numeric, tax numeric, fixed_cost numeric,
  profit numeric, profit_rate numeric, material_rate numeric,
  unknown_cost_lines int,
  -- 재고가 0 인 재료 이름. null 이면 만들 수 있다.
  blocked_by text
) language sql stable security invoker as $fn$
  with base as (
    select r.*,
           c.name as cat_name,
           recipe_material_cost(r.id) as mat,
           coalesce((select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = r.id), 0) as ext,
           case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end as tx,
           coalesce(fixed_cost_rate(r.store_id, business_month()), 0) as rate,
           (select count(*)::int from recipe_lines l
             where l.recipe_id = r.id
               and l.ingredient_id is not null
               and base_unit_price(l.ingredient_id) is null) as unknown_lines,
           recipe_blocked_by(r.id) as blocked
      from recipes r
      left join categories c on c.id = r.category_id
     where r.store_id = p_store
  )
  select b.id, b.name, b.price, b.tax_mode, b.base_servings,
         b.target_profit_rate, b.avg_monthly_sales, coalesce(b.active, true),
         b.category_id, b.cat_name,
         b.mat, b.ext, b.tx, b.rate * b.price,
         b.price - b.tx - b.mat - b.ext - (b.rate * b.price),
         case when b.price > 0 then (b.price - b.tx - b.mat - b.ext - (b.rate * b.price)) / b.price else 0 end,
         case when b.price > 0 then b.mat / b.price else 0 end,
         b.unknown_lines,
         b.blocked
    from base b
   order by coalesce(b.active, true) desc, b.name;
$fn$;

-- ── 매출 등록에서 막는다 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.e10_sale_recorded(p_store uuid, p_date date, p_recipe uuid, p_qty_hall numeric DEFAULT 0, p_qty_delivery numeric DEFAULT 0, p_qty_takeout numeric DEFAULT 0, p_qty_waste numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_ds      uuid;
  v_item    uuid;
  r         recipes%rowtype;
  v_mat     numeric;
  v_extra   numeric;
  v_consume jsonb;
  v_total   numeric;
begin
  if p_date > business_day() then
    raise exception '미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)', p_date, business_day()
      using errcode = '22000';
  end if;
  if coalesce(p_qty_hall,0) < 0 or coalesce(p_qty_delivery,0) < 0
     or coalesce(p_qty_takeout,0) < 0 or coalesce(p_qty_waste,0) < 0 then
    raise exception '판매 수량은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  select * into r from recipes where id = p_recipe;
  if not found then raise exception 'recipe % not found', p_recipe; end if;

  -- ── 팔 수 없는 메뉴는 막는다(0046) ─────────────────────────
  -- ⚠ 수량이 0 이면 막지 않는다. 이미 적어 둔 판매를 **지우는** 것도 저장이라,
  --   막았다가는 재고가 바닥난 메뉴의 오입력을 영영 못 지운다.
  if coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
     + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0) > 0 then
    -- 사장님이 직접 끈 메뉴다. 다시 켜면 바로 풀린다.
    if not coalesce(r.active, true) then
      raise exception '%은(는) 판매 중지된 메뉴예요. 레시피에서 판매를 다시 켜 주세요', r.name
        using errcode = '22000';
    end if;
    -- 재고가 0 인 재료가 있으면 만들 수 없다.
    -- 그대로 두면 원장이 소진을 기록하지 못해(실측: 대파 125g 필요·차감 0g·이벤트 0건)
    -- 재고 오차가 영영 안 지워진다. 어디를 고쳐야 하는지 함께 알린다.
    declare v_blocked text := recipe_blocked_by(p_recipe);
    begin
      if v_blocked is not null then
        raise exception '%이(가) 없어서 %을(를) 만들 수 없어요. 식재료에서 재고를 먼저 맞춰 주세요',
          v_blocked, r.name using errcode = '22000';
      end if;
    end;
  end if;

  insert into daily_sales (store_id, sale_date) values (p_store, p_date)
  on conflict (store_id, sale_date) do update set updated_at = now()
  returning id into v_ds;

  v_mat := coalesce(recipe_material_cost(p_recipe), 0);
  select coalesce(sum(amount_per_serving), 0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);

  select id into v_item
    from daily_sales_items
   where daily_sales_id = v_ds and recipe_id = p_recipe
   for update;

  if v_item is null then
    if v_total = 0 then
      return jsonb_build_object('daily_sales_id', v_ds, 'sales_item_id', null, 'skipped', true);
    end if;
    insert into daily_sales_items
      (store_id, daily_sales_id, recipe_id, menu_name, unit_price,
       qty_hall, qty_delivery, qty_takeout, qty_waste,
       unit_material_cost, unit_extra_cost, tax_mode)
    values
      (p_store, v_ds, p_recipe, r.name, r.price,
       p_qty_hall, p_qty_delivery, p_qty_takeout, p_qty_waste,
       v_mat, v_extra, r.tax_mode)
    returning id into v_item;
  else
    update daily_sales_items set
      qty_hall = p_qty_hall, qty_delivery = p_qty_delivery,
      qty_takeout = p_qty_takeout, qty_waste = p_qty_waste,
      unit_price = r.price, unit_material_cost = v_mat, unit_extra_cost = v_extra,
      menu_name = r.name, tax_mode = r.tax_mode
    where id = v_item;
  end if;

  v_consume := reconcile_sales_consumption(v_item, false);

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$function$;

select public.assert_no_rpc_overloads();
