-- Follow-up to 0237: owner-scoped archive reads and monetary usage independent of stock events.
begin;
alter policy material_retirement_archive_owner_read on public.material_retirement_archive
 using(store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));

-- Frozen recipe quantities and prices are the source for sold material cost.
-- Inventory events include cooking waste and intentionally omit stock_tracking=false.
CREATE OR REPLACE FUNCTION public.range_menu_detail(p_store uuid, p_from date, p_to date, p_recipe uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_qty      numeric := 0;
  v_waste    numeric := 0;
  v_hall     numeric := 0;
  v_delivery numeric := 0;
  v_takeout  numeric := 0;
  v_revenue  numeric := 0;
  v_net      numeric := 0;
  v_material numeric := 0;
  v_waste_mat numeric := 0;   -- 조리 폐기분 재료비 (팔지 못했어도 재료는 나갔다)
  v_extra    numeric := 0;
  v_tax      numeric := 0;
  v_fixed    numeric := 0;
  v_name     text;
  v_days     int := 0;
begin
  perform assert_my_store(p_store);

  -- ── 매출 줄에 굳은 값들 — 그대로 더한다 ─────────────────────
  select
    coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0),
    coalesce(sum(coalesce(it.qty_waste, 0)), 0),
    coalesce(sum(it.qty_hall), 0),
    coalesce(sum(it.qty_delivery), 0),
    coalesce(sum(it.qty_takeout), 0),
    coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    -- ⚠ 판매분과 조리 폐기분을 **가른다**. 섞으면 개당 재료비가 그날 화면과 어긋난다
    --   (실측: 2,847.67 vs 2,806.40). 손익 계산에는 둘 다 들어간다.
    coalesce(sum(it.unit_material_cost
                 * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(coalesce(it.unit_waste_cost,it.unit_material_cost) * coalesce(it.qty_waste, 0)), 0),
    coalesce(sum(coalesce(it.unit_extra_cost, 0)
                 * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(coalesce(it.unit_tax,
                   case when coalesce(it.tax_mode,'included') = 'included'
                        then it.unit_price * 10 / 110 else 0 end)
                 * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    max(it.menu_name),
    count(distinct ds.sale_date)
  into v_qty, v_waste, v_hall, v_delivery, v_takeout,
       v_revenue, v_material, v_waste_mat, v_extra, v_tax, v_name, v_days
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to
    and it.recipe_id = p_recipe;

  select coalesce(sum((public.sales_item_accounting_totals(it.id)->>'net_sales')::numeric),0)
    into v_net from daily_sales ds join daily_sales_items it on it.daily_sales_id=ds.id
   where ds.store_id=p_store and ds.sale_date between p_from and p_to and it.recipe_id=p_recipe;

  if v_name is null then
    return jsonb_build_object('from', p_from, 'to', p_to, 'recipe_id', p_recipe, 'sold', false);
  end if;

  -- ── 고정 지출 — 날짜별 그날 률 × 그날 이 메뉴 매출 ──────────
  select coalesce(sum(d.rev * coalesce(day_fixed_rate(p_store, d.sale_date), 0)), 0)
    into v_fixed
  from (
    select ds.sale_date,
           sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)) as rev
      from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
       and it.recipe_id = p_recipe
     group by ds.sale_date) d;

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'recipe_id', p_recipe,
    'sold', true,
    'name', v_name,
    'days', v_days,
    'qty', v_qty, 'qty_waste', v_waste,
    'qty_hall', v_hall, 'qty_delivery', v_delivery, 'qty_takeout', v_takeout,

    -- ── 기간 합계. 이게 실제로 들어간 돈이다 ──────────────────
    'revenue', v_revenue,
    'material_cost', v_material,
    -- 조리 폐기 손실 — 매출도 세금도 없고 재료비만 나간 몫이다(0041).
    'waste_menu', v_waste_mat,
    'extra_cost', v_extra,
    'fixed_cost', v_fixed,
    'tax', v_tax,
    'profit', v_net - v_material - v_waste_mat - v_extra - v_fixed,

    -- ── 개당 = 합 ÷ 수량. 화면은 '기간 평균'이라 부른다 ───────
    'unit_price',         case when v_qty > 0 then v_revenue  / v_qty else 0 end,
    'unit_material_cost', case when v_qty > 0 then v_material / v_qty else 0 end,
    'unit_extra_cost',    case when v_qty > 0 then v_extra    / v_qty else 0 end,
    'unit_fixed_cost',    case when v_qty > 0 then v_fixed    / v_qty else 0 end,
    'unit_tax',           case when v_qty > 0 then v_tax      / v_qty else 0 end,
    -- ⚠ 개당 순이익에서 조리 폐기는 뺀다. 그날 화면(day_menu_detail)과 같은 정의여야
    --   두 화면이 같은 숫자를 말한다. 폐기 손실은 위 waste_menu 로 따로 보인다.
    'unit_profit',        case when v_qty > 0
                               then (v_net - v_material - v_extra - v_fixed) / v_qty
                               else 0 end,

    -- ── 판매가가 몇 가지였나 ──────────────────────────────────
    -- 9,300 / 9,800 / 12,000 을 평균 하나로 뭉개면 사장님이 확인할 방법이 없다.
    'price_points', coalesce((
      select jsonb_agg(jsonb_build_object(
               'price', p.unit_price, 'qty', p.qty, 'days', p.days,
               'from', p.first_day, 'to', p.last_day)
             order by p.unit_price desc)
      from (select it.unit_price,
                   sum(it.qty_hall + it.qty_delivery + it.qty_takeout) as qty,
                   count(distinct ds.sale_date) as days,
                   min(ds.sale_date) as first_day,
                   max(ds.sale_date) as last_day
              from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
             where ds.store_id = p_store and ds.sale_date between p_from and p_to
               and it.recipe_id = p_recipe
             group by it.unit_price) p), '[]'::jsonb),

    -- ── 재료 — 실제 소비량 × 그날 단가의 합 ───────────────────
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ingredient_id', x.ingredient_id,
               'name', i.name,
               'base_unit', i.base_unit,
               'qty', x.qty,
               'per_serving', case when v_qty > 0 then x.qty / v_qty else 0 end,
               -- 기간 중 단가가 바뀌었으면 실제 지출 ÷ 수량이 답이다.
               'unit_price', case when x.qty > 0 then x.amount / x.qty else null end,
               'amount', x.amount)
             order by x.amount desc)
      from (
        select (l->>'ingredient_id')::uuid as ingredient_id,
               sum((l->>'per_serving')::numeric * (it.qty_hall+it.qty_delivery+it.qty_takeout)) as qty,
               sum((l->>'per_serving')::numeric * (it.qty_hall+it.qty_delivery+it.qty_takeout)
                   * coalesce((l->>'unit_price')::numeric,
                       day_unit_price(p_store,ds.sale_date,(l->>'ingredient_id')::uuid),0)) as amount
          from daily_sales ds join daily_sales_items it on it.daily_sales_id=ds.id
          cross join lateral jsonb_array_elements(coalesce(
            day_snapshot(p_store,ds.sale_date)#>array['recipes',p_recipe::text,'lines'],'[]'::jsonb)) l
         where ds.store_id=p_store and it.recipe_id=p_recipe
           and ds.sale_date between p_from and p_to
         group by l->>'ingredient_id'
        having sum((l->>'per_serving')::numeric * (it.qty_hall+it.qty_delivery+it.qty_takeout)) > 0) x
      join ingredients i on i.id = x.ingredient_id), '[]'::jsonb),

    -- ── 부자재 — 그날 구성 × 그날 판매량의 합 ─────────────────
    -- 기간 중 지운 항목도 그날 몫만큼 남는다. 그날 실제로 들어간 원가라서다.
    'extras', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'qty', x.qty, 'amount', x.amount)
             order by x.amount desc)
      from (
        select e->>'name' as name,
               sum(d.qty) as qty,
               sum(coalesce((e->>'amount')::numeric, 0) * d.qty) as amount
          from (select ds.sale_date,
                       sum(it.qty_hall + it.qty_delivery + it.qty_takeout) as qty
                  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
                 where ds.store_id = p_store and ds.sale_date between p_from and p_to
                   and it.recipe_id = p_recipe
                 group by ds.sale_date) d
          cross join lateral jsonb_array_elements(
            coalesce(day_snapshot(p_store, d.sale_date) #> array['recipes', p_recipe::text, 'extras'],
                     (select coalesce(jsonb_agg(jsonb_build_object(
                               'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving)), '[]'::jsonb)
                        from public.archived_recipe_extra_costs ec where ec.recipe_id = p_recipe))) e
         group by e->>'name') x), '[]'::jsonb),

    -- ── 고정 지출 항목별 — 날짜별 그날 구성·비중으로 배분해 합산 ─
    'fixed_items', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'amount', x.amount)
             order by x.amount desc)
      from (
        select i->>'key' as key,
               sum(d.rev * coalesce(day_fixed_rate(p_store, d.sale_date), 0)
                   * case when day_fixed_total(p_store, d.sale_date) > 0
                          then (i->>'total')::numeric / day_fixed_total(p_store, d.sale_date)
                          else 0 end) as amount
          from (select ds.sale_date,
                       sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)) as rev
                  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
                 where ds.store_id = p_store and ds.sale_date between p_from and p_to
                   and it.recipe_id = p_recipe
                 group by ds.sale_date) d
          cross join lateral jsonb_array_elements(day_fixed_items(p_store, d.sale_date)) i
         group by i->>'key') x), '[]'::jsonb));
end;
$function$

;
create or replace function public.ingredient_legacy_material_history(p_store uuid,p_ingredient uuid,p_cursor text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_material uuid; v_cursor bigint; v_last bigint; v_items jsonb; v_count bigint;
begin
  perform public.assert_my_store(p_store);
  select a.id into v_material from public.material_retirement_archive a
   where a.store_id=p_store and a.ingredient_id=p_ingredient and a.disposition='migrated';
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{1,19}$' then raise exception '잘못된 커서' using errcode='22000'; end if;
    v_cursor:=p_cursor::bigint;
  end if;
  select count(*) into v_count from public.store_configuration_changes c where c.store_id=p_store and c.kind='material'
    and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=v_material::text;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_id desc),'[]'),min(x.sort_id) into v_items,v_last from (
    select c.id as sort_id,c.id::text as id,c.source,c.occurred_at,c.before_value,c.after_value
      from public.store_configuration_changes c where c.store_id=p_store and c.kind='material'
       and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=v_material::text
       and (v_cursor is null or c.id<v_cursor) order by c.id desc limit 20
  ) x;
  return jsonb_build_object('items',v_items,'count',v_count,'next_cursor',case when exists(
    select 1 from public.store_configuration_changes c where c.store_id=p_store and c.kind='material'
      and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=v_material::text and c.id<v_last
  ) then v_last::text else null end);
end $$;
grant create on schema public to margincook_rpc_executor;
alter function public.ingredient_legacy_material_history(uuid,uuid,text) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.ingredient_legacy_material_history(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.ingredient_legacy_material_history(uuid,uuid,text) to authenticated;

-- Preserve source records; last-change metadata can point to the dedicated legacy reader.
do $patch$ declare d text; begin
 d:=pg_get_functiondef('public.last_entity_change(uuid,text,uuid)'::regprocedure);
 if position('v_legacy_at timestamptz' in d)=0 then
  d:=replace(d,'v_ev entity_change_events;','v_ev entity_change_events; v_legacy_at timestamptz;');
  d:=replace(d,'  if v_ev.id is not null then', $anchor$
  if p_entity_type='ingredient' then
    select max(c.occurred_at) into v_legacy_at from public.material_retirement_archive a
      join public.store_configuration_changes c on c.store_id=a.store_id and c.kind='material'
       and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=a.id::text
      where a.store_id=p_store and a.ingredient_id=p_entity_id and a.disposition='migrated';
    if v_legacy_at is not null and (v_ev.id is null or v_legacy_at>v_ev.occurred_at) then
      return jsonb_build_object('occurred_at',v_legacy_at,'event_id',null,'display_state',null,
        'has_history',true,'has_legacy_history',true,'has_pending_change',v_pending,'pending_occurred_at',v_pending_at);
    end if;
  end if;
  if v_ev.id is not null then$anchor$);
  execute d;
 end if;
end $patch$;

commit;
