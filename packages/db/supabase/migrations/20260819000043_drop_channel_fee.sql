-- ════════════════════════════════════════════════════════════════
-- 0043 · 채널 수수료를 걷어낸다 — 같은 돈을 두 번 빼고 있었다
--
-- 사장님: "배달앱이 수수료가 왜 나와. 그 부분은 고정지출에서 관리하는데"
--         "판매 채널에서는 수수료 빼고 그 부분은 고정지출 안에서 진행하는 게 나을 것 같은데"
--
-- ── 무엇이 잘못됐나 ────────────────────────────────────────────
-- 플랫폼 수수료가 두 곳에서 차감되고 있었다.
--   ① 고정지출의 'commission' 항목 → 고정지출률에 녹아 v_fixed 로 차감
--   ② sales_channels.fee_rate      → v_fee 로 또 차감
-- sales_summary 의 순이익 식이 `- v_fee ... - v_fixed` 라 둘 다 빠졌다.
--
-- 실측(2026-08-01~19): 고정비 차감 3,928,776(그중 수수료 몫 630,738) +
-- 채널 수수료 503,397. 19일간 순이익이 **503,397원 과소 계상**됐다.
--
-- ── 왜 고정지출을 남기나 ──────────────────────────────────────
-- 원본 설계가 플랫폼 수수료를 고정 지출의 한 항목으로 못 박았다.
--   레시피_상세로직_v3 §262 "인건비·플랫폼 수수료·포장비·배달/배송·광고/홍보"
--   §161 "배분 고정비 = 월 고정 지출 합계 × 이 메뉴 판매 비중"
-- 채널별 fee_rate 를 손익에서 빼라는 근거는 문서 어디에도 없다.
--
-- ── 채널별 손익은 어떻게 보나 ─────────────────────────────────
-- sales_channel_fixed(0037) 가 고정비를 채널 가중치로 배분한다. 그게 설계가
-- 정한 방식이고, 수수료가 배달에만 걸린다는 사실도 weights 로 이미 표현된다
-- (시드: commission → delivery 100%).
--
-- ⚠ fee_rate 를 되살려 손익에 물리지 말 것. 고정지출에 같은 항목이 있는 한
--   반드시 이중 차감이 된다.
-- ════════════════════════════════════════════════════════════════

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
    coalesce(sum(
      case when coalesce(it.tax_mode, 'included') = 'included'
           then it.unit_price * (it.qty_hall + it.qty_delivery + it.qty_takeout) * 10 / 110
           else 0 end), 0)
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
               coalesce(sum(case when coalesce(it.tax_mode,'included') <> 'included' then 0
                 else (case ch.code
                   when 'hall'     then it.unit_price * it.qty_hall
                   when 'delivery' then it.unit_price * it.qty_delivery
                   when 'takeout'  then it.unit_price * it.qty_takeout
                   else 0 end) * 10 / 110 end), 0) as tax
          from sales_channels ch
          left join daily_sales ds on ds.store_id = p_store and ds.sale_date between p_from and p_to
          left join daily_sales_items it on it.daily_sales_id = ds.id
         where ch.store_id = p_store
         group by ch.code, ch.name) c)
  );
$function$;

-- ── save_channel ─────────────────────────────
-- 채널은 매장·배달·포장 **세 개로 스키마에 고정**돼 있다.
-- daily_sales_items 가 qty_hall / qty_delivery / qty_takeout 세 컬럼이라
-- 네 번째 채널을 만들어도 수량을 넣을 곳이 없다. 그래서 **추가를 막는다** —
-- 만들 수 있는 것처럼 보이면 사장님이 만들고, 아무 데도 안 쓰이는 행이 남는다.
create or replace function public.save_channel(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare
  v_id   uuid := nullif(p_payload->>'id','')::uuid;
  v_name text := btrim(p_payload->>'name');
  v_code text := btrim(coalesce(p_payload->>'code', ''));
begin
  perform assert_my_store(p_store);

  if v_name is null or v_name = '' then
    raise exception '채널 이름을 입력해 주세요' using errcode = '22000';
  end if;

  -- 신규 생성은 **정해진 세 코드**만 허용한다. 최초 매장 셋업이 이 경로를 쓴다.
  -- 그 밖의 이름으로는 만들 수 없다 — 수량을 넣을 컬럼이 없기 때문이다.
  if v_id is null then
    if v_code not in ('hall', 'delivery', 'takeout') then
      raise exception '판매 채널은 매장·배달·포장 세 가지로 정해져 있어요' using errcode = '22000';
    end if;
    if exists (select 1 from sales_channels where store_id = p_store and code = v_code) then
      raise exception '이미 등록된 채널이에요' using errcode = '23505';
    end if;
    insert into sales_channels (store_id, code, name, sort_order, active)
    values (p_store, v_code, v_name,
            coalesce((p_payload->>'sort_order')::int,
                     (select coalesce(max(sort_order), 0) + 1 from sales_channels where store_id = p_store)),
            true)
    returning id into v_id;
    return v_id;
  end if;

  update sales_channels
     set name   = v_name,
         active = coalesce((p_payload->>'active')::boolean, active)
   where id = v_id and store_id = p_store;

  if not found then
    raise exception '채널을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  return v_id;
end;
$fn$;

-- ── settings_lists ─────────────────────────────
CREATE OR REPLACE FUNCTION public.settings_lists(p_store uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from ingredients i where i.category_id = c.id and i.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'ingredient'),
    'recipe_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from recipes r where r.category_id = c.id and r.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'recipe'),
    'material_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'used_count', (select count(*) from materials m where m.category_id = c.id and m.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'material'),
    'materials', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'category_id', m.category_id,
               'category_name', mc.name, 'unit_cost', m.unit_cost, 'unit_label', m.unit_label,
               'memo', m.memo,
               'used_count', (select count(*) from recipe_extra_costs ec where ec.material_id = m.id))
             order by m.name), '[]'::jsonb)
      from materials m left join categories mc on mc.id = m.category_id
      where m.store_id = p_store and m.active),
    'vendors', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name,
               'used_count', (select count(*) from order_records o where o.vendor_id = v.id))
             order by v.name), '[]'::jsonb)
      from vendors v where v.store_id = p_store and not v.hidden),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ch.id, 'code', ch.code, 'name', ch.name,
               'active', ch.active)
             order by ch.sort_order), '[]'::jsonb)
      from sales_channels ch where ch.store_id = p_store)
  );
$function$;

-- ── 컬럼 제거 ────────────────────────────────────────────────
-- 남겨 두면 "화면에 없는데 DB 에는 있는 값"이 되어 다음 사람이 되살린다.
-- 되살리는 순간 고정지출의 플랫폼 수수료와 다시 이중 차감이 된다.
alter table sales_channels drop column if exists fee_rate;
alter table sales_channels drop column if exists fee_note;

select public.assert_no_rpc_overloads();
