-- ════════════════════════════════════════════════════════════════
-- 0053 · 세금 계산을 tax_of() 한 곳으로
--
-- 다섯 함수가 각자 `10 / 110` 을 하고 있었다. 세금 항목(0052)이 생기면
-- 다섯 곳을 다 고쳐야 하고, 하나만 빠뜨려도 조용히 어긋난다.
--
-- 그리고 **그날 세금은 매출 줄에 굳은 unit_tax** 를 쓴다. 지금까지는 판매가와
-- 모드로 되계산해서 맞았지만, 항목이 생기면 항목을 고치는 순간 지난 장부의
-- 세금이 움직인다. 재료·부자재·고정지출과 같은 규칙으로 맞춘다.
--
-- ⚠ 항목이 비면 부가세만 남아 기존 값과 같다 — 검산 3종이 그대로다.
-- ════════════════════════════════════════════════════════════════

-- ── recipe_list ─────────────────────────────
drop function if exists public.recipe_list(uuid);

CREATE OR REPLACE FUNCTION public.recipe_list(p_store uuid)
 RETURNS TABLE(id uuid, name text, price numeric, tax_mode tax_mode, base_servings integer, target_profit_rate numeric, avg_monthly_sales numeric, active boolean, category_id uuid, category_name text, material_cost numeric, extra_cost numeric, tax numeric, fixed_cost numeric, profit numeric, profit_rate numeric, material_rate numeric, unknown_cost_lines integer, blocked_by text)
 LANGUAGE sql
 STABLE
AS $function$
  with base as (
    select r.*,
           c.name as cat_name,
           recipe_material_cost(r.id) as mat,
           coalesce((select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = r.id), 0) as ext,
           tax_of(r.price, r.tax_mode, r.tax_items) as tx,
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
$function$;

-- ── recompute_recipe ─────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_recipe(p_recipe uuid, p_cause trend_cause, p_occurred_at date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  r          recipes%rowtype;
  v_day      date := coalesce(p_occurred_at, business_day());
  v_month    text;
  v_tax      numeric;
  v_material numeric := 0;
  v_extra    numeric := 0;
  v_fixed    numeric;
  v_rate     numeric;
  v_profit   numeric;
  v_pr       numeric;
  v_mr       numeric;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 기록할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day();
  end if;
  v_month := to_char(v_day, 'YYYY-MM');

  select * into r from recipes where id = p_recipe;
  if not found then return; end if;

  -- 반제품 포함 (A 수정)
  v_material := recipe_material_cost(p_recipe);

  select coalesce(sum(amount_per_serving),0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_tax  := tax_of(r.price, r.tax_mode, r.tax_items);

  -- 해당 월 률이 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  -- 0% 로 확정하면 순이익률이 부풀려진다(실증: 33.49% → 64.79%).
  v_rate := fixed_cost_rate(r.store_id, v_month);
  if v_rate is null then
    select fixed_cost_rate(r.store_id, month) into v_rate
      from fixed_costs_monthly
     where store_id = r.store_id and month <= v_month
       and fixed_cost_rate(r.store_id, month) is not null
     order by month desc limit 1;
  end if;
  v_fixed := coalesce(v_rate, 0) * r.price;

  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;
  v_pr := case when r.price > 0 then round(v_profit / r.price * 100, 2) else 0 end;
  v_mr := case when r.price > 0 then round(v_material / r.price * 100, 2) else 0 end;

  insert into profit_trends (store_id, recipe_id, trend_date, profit_rate, material_rate, cause)
  values (r.store_id, p_recipe, v_day, v_pr, v_mr, p_cause);
end;
$function$;

-- ── sales_summary ─────────────────────────────
CREATE OR REPLACE FUNCTION public.sales_summary(p_store uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_revenue    numeric := 0;
  v_etc        numeric := 0;
  v_material   numeric := 0;
  v_extra_mat  numeric := 0;
  v_tax        numeric := 0;
  v_waste_ing  numeric := 0;   -- 식재료 폐기(E2)
  v_waste_menu numeric := 0;   -- 조리 폐기(만들어 놓고 못 판 음식)
  v_extra      numeric := 0;
  v_fixed      numeric := 0;
  v_qty        numeric := 0;
  v_days       int     := 0;
  v_rate       numeric;
begin
  select
    coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0),
    coalesce(sum(it.unit_material_cost * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(coalesce(it.unit_extra_cost,0) * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    -- 조리 폐기는 매출도 부가세도 없다. 재료비만 손실로 잡힌다.
    coalesce(sum(it.unit_material_cost * coalesce(it.qty_waste, 0)), 0),
    -- ⚠ 판매 시점에 굳은 unit_tax 를 쓴다. 세금 항목을 나중에 고쳐도
    --   지난 장부가 안 움직인다(0052). 과거 행은 마이그레이션이 채웠다.
    coalesce(sum(
      coalesce(it.unit_tax,
               case when coalesce(it.tax_mode, 'included') = 'included'
                    then it.unit_price * 10 / 110 else 0 end)
      * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0)
  into v_revenue, v_qty, v_material, v_extra_mat, v_waste_menu, v_tax
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)
    into v_etc, v_extra, v_days
  from daily_sales where store_id = p_store and sale_date between p_from and p_to;

  v_revenue := v_revenue + v_etc;

  -- 식재료 폐기 손실 — 재고 원장에서 집계
  -- ⚠ sales_item_id 가 있는 폐기는 **조리 폐기**다(0041). 그쪽은 daily_sales_items.qty_waste
  --   에서 이미 v_waste_menu 로 잡히므로 여기서 또 더하면 이중 집계가 된다.
  select coalesce(sum(coalesce(ev.volume_delta, 0) * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
    into v_waste_ing
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard' and ev.sales_item_id is null
    -- ⚠ 되돌린 폐기는 빼야 한다. 0038 이 real_loss_rate 에서만 고치고 여기는 놓쳐서,
    --   폐기를 취소해도 월 손익의 폐기 손실은 그대로 남아 있었다(실측 7,760원).
    and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)
    and (ev.occurred_at at time zone business_tz())::date between p_from and p_to;

  -- 고정 지출 — 해당 월 률. 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  v_rate := fixed_cost_rate(p_store, to_char(p_from, 'YYYY-MM'));
  if v_rate is null then
    select fixed_cost_rate(p_store, month) into v_rate
      from fixed_costs_monthly
     where store_id = p_store and month <= to_char(p_from, 'YYYY-MM')
       and fixed_cost_rate(p_store, month) is not null
     order by month desc limit 1;
  end if;
  v_fixed := coalesce(v_rate, 0) * v_revenue;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'revenue', v_revenue, 'etc_revenue', v_etc, 'qty', v_qty,
    'material_cost', v_material,
    'extra_material_cost', v_extra_mat,
 'tax', v_tax,
    'waste_loss', v_waste_ing + v_waste_menu,
    'waste_ingredient', v_waste_ing,
    'waste_menu', v_waste_menu,
    'daily_extra', v_extra, 'fixed_cost', v_fixed,
    'fixed_rate', v_rate,
    'fixed_rate_provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'profit', v_revenue - v_material - v_extra_mat - v_tax
              - v_waste_ing - v_waste_menu - v_extra - v_fixed);
end;
$function$;

-- ── sales_range ─────────────────────────────
drop function if exists public.sales_range(uuid, date, date);

CREATE OR REPLACE FUNCTION public.sales_range(p_store uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'summary', sales_summary(p_store, p_from, p_to),
    'daily', (
      select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'date', ds.sale_date,
                 'revenue', coalesce(sum(it.unit_price * (it.qty_hall+it.qty_delivery+it.qty_takeout)), 0)
                            + max(coalesce(ds.etc_revenue,0)),
                 'qty', coalesce(sum(it.qty_hall+it.qty_delivery+it.qty_takeout), 0),
                 'material', coalesce(sum(it.unit_material_cost * (it.qty_hall+it.qty_delivery+it.qty_takeout)), 0),
                 'profit', (sales_summary(p_store, ds.sale_date, ds.sale_date)->>'profit')::numeric) as x
          from daily_sales ds left join daily_sales_items it on it.daily_sales_id = ds.id
         where ds.store_id = p_store and ds.sale_date between p_from and p_to
         group by ds.id, ds.sale_date) t),
    'menu', (
      select coalesce(jsonb_agg(x order by (x->>'qty')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'recipe_id', it.recipe_id,
                 'menu_name', it.menu_name,
                 'qty',      sum(it.qty_hall+it.qty_delivery+it.qty_takeout),
                 'qty_hall', sum(it.qty_hall),
                 'qty_delivery', sum(it.qty_delivery),
                 'qty_takeout',  sum(it.qty_takeout),
                 'qty_waste',    sum(coalesce(it.qty_waste,0)),
                 'revenue',  sum(it.unit_price * (it.qty_hall+it.qty_delivery+it.qty_takeout)),
                 'unit_price', max(it.unit_price),
                 'unit_material_cost', max(it.unit_material_cost),
                 'material', sum(it.unit_material_cost * (it.qty_hall+it.qty_delivery+it.qty_takeout))) as x
          from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
         where ds.store_id = p_store and ds.sale_date between p_from and p_to
           and it.qty_hall+it.qty_delivery+it.qty_takeout > 0
         group by it.recipe_id, it.menu_name) t),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', c.code, 'name', c.name,
               'amount', c.amount, 'qty', c.qty, 'material', c.material,
               'tax', c.tax)
             order by c.amount desc), '[]'::jsonb)
      from (
        select ch.code, ch.name,
               coalesce(sum(case ch.code
                 when 'hall'     then it.unit_price * it.qty_hall
                 when 'delivery' then it.unit_price * it.qty_delivery
                 when 'takeout'  then it.unit_price * it.qty_takeout
                 else 0 end), 0) as amount,
               coalesce(sum(case ch.code
                 when 'hall'     then it.qty_hall
                 when 'delivery' then it.qty_delivery
                 when 'takeout'  then it.qty_takeout
                 else 0 end), 0) as qty,
               -- 재료비는 채널별 수량이 있으므로 배분이 아니라 **정확히** 나뉜다.
               coalesce(sum(case ch.code
                 when 'hall'     then it.unit_material_cost * it.qty_hall
                 when 'delivery' then it.unit_material_cost * it.qty_delivery
                 when 'takeout'  then it.unit_material_cost * it.qty_takeout
                 else 0 end), 0) as material,
               coalesce(sum(
                 coalesce(it.unit_tax,
                          case when coalesce(it.tax_mode,'included') = 'included'
                               then it.unit_price * 10 / 110 else 0 end)
                 * (case ch.code when 'hall' then it.qty_hall
                                 when 'delivery' then it.qty_delivery
                                 else it.qty_takeout end)), 0) as tax
          from sales_channels ch
          left join daily_sales ds on ds.store_id = p_store and ds.sale_date between p_from and p_to
          left join daily_sales_items it on it.daily_sales_id = ds.id
         where ch.store_id = p_store
         group by ch.code, ch.name) c)
  );
$function$;

-- ── day_menu_detail ─────────────────────────────
CREATE OR REPLACE FUNCTION public.day_menu_detail(p_store uuid, p_date date, p_recipe uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  -- 판매 시점에 굳은 값. 세금 항목을 나중에 고쳐도 그날은 그대로다(0052).
  v_tax   := coalesce(v_item.unit_tax,
                      case when coalesce(v_item.tax_mode,'included') = 'included'
                           then v_price * 10 / 110 else 0 end);

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
    -- 세금 세부 — 그날 항목 구성으로 그린다. 부가세는 기본 항목이다.
    'tax_items', tax_breakdown(v_price, coalesce(v_item.tax_mode,'included'),
                               coalesce(v_snap->'tax_items', '[]'::jsonb)),
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
$function$;

select public.assert_no_rpc_overloads();
