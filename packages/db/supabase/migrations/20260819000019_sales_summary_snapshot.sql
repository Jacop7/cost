-- ════════════════════════════════════════════════════════════════
-- 0019 · 기간 손익을 판매 시점 스냅샷으로 계산 (P0, 과거 매출 소급 변경)
--
-- 실증된 문제:
--   ① 레시피를 삭제하면 `daily_sales_items.recipe_id` 가 끊겨 재료원가·세금 join 이 사라지고
--      **과거 순이익이 19,240 → 38,868 (+102%)** 로 부풀었다.
--   ② 레시피 판매가·사용량을 나중에 수정하면 `sales_summary` 가 **현재 레시피로 재계산**해
--      과거 매출의 원가가 소급 변경됐다.
--   ③ 부자재(`recipe_extra_costs`)가 profit 식에서 통째로 빠져 있었다.
--      앱 화면(`ProfitBlocks`·`SalesExtraScreen`)은 '(−) 부자재' 행을 그리는데 서버는 빼지 않아
--      **같은 메뉴 순이익을 두 곳이 다르게** 계산했다.
--
-- 원칙:
--   기간 손익은 **판매 시점에 확정된 값**으로 계산한다. 지난 장부는 나중 일로 흔들리면 안 된다.
--   (0018 이 `unit_material_cost` · `tax_mode` 스냅샷 컬럼을 추가했다.)
-- ════════════════════════════════════════════════════════════════

-- 부자재도 판매 시점 정액을 스냅샷으로 남긴다(레시피 부자재가 나중에 바뀌어도 과거 불변).
alter table public.daily_sales_items
  add column if not exists unit_extra_cost numeric;

comment on column public.daily_sales_items.unit_extra_cost is
  '판매 시점 1인분 부자재 정액 스냅샷(recipe_extra_costs 합계).';

update public.daily_sales_items it
   set unit_extra_cost = coalesce(
         (select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = it.recipe_id), 0)
 where it.unit_extra_cost is null;

create or replace function public.sales_summary(
  p_store uuid,
  p_from  date,
  p_to    date
) returns jsonb language plpgsql stable security invoker as $$
declare
  v_revenue   numeric := 0;
  v_etc       numeric := 0;
  v_material  numeric := 0;
  v_extra_mat numeric := 0;   -- 부자재(메뉴에 딸린 포장용기 등)
  v_fee       numeric := 0;
  v_tax       numeric := 0;
  v_waste     numeric := 0;
  v_extra     numeric := 0;   -- 당일 일회성 지출
  v_fixed     numeric := 0;
  v_qty       numeric := 0;
  v_days      int     := 0;
  v_rate      numeric;
begin
  -- 매출·수량 — 판매 시점 단가 스냅샷 사용
  select
    coalesce(sum(it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
    coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout), 0)
  into v_revenue, v_qty
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)
    into v_etc, v_extra, v_days
  from daily_sales where store_id = p_store and sale_date between p_from and p_to;

  v_revenue := v_revenue + v_etc;

  -- 재료원가·부자재 — **스냅샷**을 쓴다. recipes 를 join 하지 않으므로
  -- 레시피가 은퇴하거나 사용량이 바뀌어도 과거 매출이 흔들리지 않는다.
  select coalesce(sum(it.unit_material_cost * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0),
         coalesce(sum(coalesce(it.unit_extra_cost,0) * (it.qty_hall + it.qty_delivery + it.qty_takeout)), 0)
    into v_material, v_extra_mat
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 채널 수수료 — 채널이 삭제·은퇴해도 과거 수수료가 0 이 되지 않도록 기본 0 으로만 폴백한다.
  select coalesce(sum(
           it.unit_price * (
             it.qty_hall     * coalesce((select fee_rate from sales_channels where store_id=p_store and code='hall'), 0) +
             it.qty_delivery * coalesce((select fee_rate from sales_channels where store_id=p_store and code='delivery'), 0) +
             it.qty_takeout  * coalesce((select fee_rate from sales_channels where store_id=p_store and code='takeout'), 0)
           ) / 100.0
         ), 0)
    into v_fee
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 세금 — 판매 시점 세금모드 스냅샷
  select coalesce(sum(
           case when coalesce(it.tax_mode, 'included') = 'included'
                then it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout) * 10 / 110
                else 0 end), 0)
    into v_tax
  from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
  where ds.store_id = p_store and ds.sale_date between p_from and p_to;

  -- 폐기 손실 — 재고 원장에서 집계
  select coalesce(sum(coalesce(ev.volume_delta, 0) * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
    into v_waste
  from inventory_events ev
  where ev.store_id = p_store and ev.type = 'discard'
    and (ev.occurred_at at time zone business_tz())::date between p_from and p_to;

  -- 고정 지출 — 해당 월 률. 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  -- 0% 로 확정하면 순이익률이 부풀려진다(실증: 33.49% → 64.79%).
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
    'channel_fee', v_fee, 'tax', v_tax,
    'waste_loss', v_waste, 'daily_extra', v_extra, 'fixed_cost', v_fixed,
    'fixed_rate', v_rate,
    'fixed_rate_provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'profit', v_revenue - v_material - v_extra_mat - v_fee - v_tax - v_waste - v_extra - v_fixed);
end;
$$;

-- ── 판매 등록 RPC — 스냅샷을 채우고 E8 까지 한 번에 ───────────
-- 앱이 daily_sales_items 에 직접 INSERT 하면 스냅샷이 비고 재고도 안 줄어든다.
-- 판매 등록은 반드시 이 함수를 거치게 한다.
create or replace function public.e10_sale_recorded(
  p_store uuid,
  p_date date,
  p_recipe uuid,
  p_qty_hall numeric default 0,
  p_qty_delivery numeric default 0,
  p_qty_takeout numeric default 0
) returns jsonb language plpgsql security invoker as $$
declare
  v_ds     uuid;
  v_item   uuid;
  r        recipes%rowtype;
  v_mat    numeric;
  v_extra  numeric;
  v_consume jsonb;
begin
  if p_date > business_day() then
    raise exception '미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)', p_date, business_day();
  end if;

  select * into r from recipes where id = p_recipe;
  if not found then raise exception 'recipe % not found', p_recipe; end if;

  -- 하루 장부 한 장 확보
  insert into daily_sales (store_id, sale_date) values (p_store, p_date)
  on conflict (store_id, sale_date) do update set updated_at = now()
  returning id into v_ds;

  -- 판매 시점 스냅샷 — 나중에 레시피가 바뀌어도 이 값은 그대로다.
  select coalesce(sum((rl.input_qty / nullif(r.base_servings,0)) * coalesce(base_unit_price(rl.ingredient_id),0)), 0)
    into v_mat from recipe_lines rl where rl.recipe_id = p_recipe and rl.ingredient_id is not null;
  select coalesce(sum(amount_per_serving), 0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  insert into daily_sales_items
    (store_id, daily_sales_id, recipe_id, menu_name, unit_price,
     qty_hall, qty_delivery, qty_takeout, unit_material_cost, unit_extra_cost, tax_mode)
  values
    (p_store, v_ds, p_recipe, r.name, r.price,
     p_qty_hall, p_qty_delivery, p_qty_takeout, v_mat, v_extra, r.tax_mode)
  returning id into v_item;

  -- 재고 소진 전파 — 판매와 소진은 한 트랜잭션이어야 한다.
  v_consume := e8_sales_consumed(v_item);

  return jsonb_build_object(
    'daily_sales_id', v_ds, 'sales_item_id', v_item,
    'unit_material_cost', v_mat, 'unit_extra_cost', v_extra,
    'consume', v_consume);
end;
$$;

comment on function public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric) is
  'E10 판매 등록. 판매 시점 원가·세금모드를 스냅샷으로 남기고 E8(재고 소진)까지 한 트랜잭션으로 처리한다.';
