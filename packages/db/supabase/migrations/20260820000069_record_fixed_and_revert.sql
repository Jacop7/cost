-- ═════════════════════════════════════════════════════════════
-- 0069 · 남은 자동 전파도 내역에 남긴다
--
-- 0066 은 입고 확정만 남겼다. 사장님이 직접 고치지 않았는데 숫자가
-- 움직이는 경우가 둘 더 있다.
--
--   ① 고정지출 저장 → 고정지출률 → **전 메뉴**의 순이익이 바뀐다
--   ② 입고 취소   → 기준단가가 되돌아가고 → 연결 메뉴 원가가 다시 바뀐다
--
-- ⚠ 고정지출은 식재료도 레시피도 아니라 원장에 담을 엔터티가 없다.
--   영향을 받은 **메뉴 쪽에** 남기고 correlation_id 로 한 묶음으로 묶는다.
--
-- ⚠ 입고 취소도 전값을 **되돌리기 전에** 잡아야 한다. 발주 상태가 바뀌는 순간
--   base_unit_price 가 그 건을 빼고 다시 계산된다 — 0066 에서 같은 것을 놓치고
--   이벤트가 아예 안 생긴 적이 있다.
--
-- ⚠ 재고 수정·폐기는 여기 넣지 않는다(기획 §5). 단가를 바꾸지 않고
--   재고 원장이 이미 단일 출처다 — 두 곳에 적으면 어느 쪽이 맞는지 몰라진다.
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.e4_fixed_cost_saved(p_store uuid, p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_rate numeric;
  v_rev  numeric;
  v_fix  numeric;
  v_mat  numeric;
  v_day  date;
  rec    record;
  -- 수정 내역용(0063) — 한 번의 고정지출 저장을 하나의 묶음으로
  v_corr  uuid := gen_random_uuid();
  v_rate0 numeric;
  v_ext   numeric;
begin
  -- ⚠ 이 함수는 이미 저장된 뒤에 불린다. **직전 률**은 지금 열린 영업일의
  --   기준값에서 읽는다 — 그게 사장님이 마지막으로 보던 값이다.
  v_rate0 := coalesce((current_business_day(p_store)).snapshot->>'fixed_rate', null)::numeric;

  v_rate := fixed_cost_rate(p_store, p_month);

  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;

  -- **그 달의 마지막 날**(오늘을 넘지 않게)에 점을 찍는다.
  -- 과거 월을 수정했는데 오늘 날짜로 점을 찍으면 그 달의 추이가 아니라 오늘 추이가 된다.
  v_day := least((to_date(p_month, 'YYYY-MM') + interval '1 month - 1 day')::date, business_day());

  for rec in select id from recipes where store_id = p_store and coalesce(active, true) loop
    perform recompute_recipe(rec.id, 'fixed', v_day);

    -- ── 수정 내역(0063) ──────────────────────────────────────
    -- 고정지출은 식재료도 레시피도 아니라 원장에 담을 엔터티가 없다.
    -- 영향을 받은 **메뉴 쪽에** 남기고 correlation_id 로 한 묶음으로 묶는다.
    -- ⚠ 률이 실제로 달라졌을 때만이다. 항목 이름만 고친 저장은 기록하지 않는다.
    if v_rate0 is not null and round(v_rate0, 6) is distinct from round(coalesce(v_rate, 0), 6) then
      v_ext := coalesce((select sum(ec.amount_per_serving)
                           from recipe_extra_costs ec where ec.recipe_id = rec.id), 0);
      perform record_entity_change(
        p_store, 'recipe', rec.id, 'fixed_cost', '고정 지출 자동 반영',
        (select
           change_line('fixed_rate', '고정지출률',
                       round(v_rate0 * 100, 2), round(coalesce(v_rate, 0) * 100, 2), '%')
           || change_line('fixed_cost', '고정 지출',
                       round(v_rate0 * r.price, 2), round(coalesce(v_rate, 0) * r.price, 2), '원')
           || change_line('profit', '순이익',
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items) - v_rate0 * r.price, 2),
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items)
                             - coalesce(v_rate, 0) * r.price, 2), '원')
           from recipes r where r.id = rec.id),
        true, null, v_corr);
    end if;
  end loop;

  select coalesce(sum(material_cost),0) into v_mat
    from monthly_pl where store_id = p_store and month = p_month;

  insert into monthly_pl (store_id, month, revenue, fixed_cost, material_cost)
       values (p_store, p_month, coalesce(v_rev,0), coalesce(v_fix,0), coalesce(v_mat,0))
  on conflict (store_id, month) do update
       set revenue = excluded.revenue,
           fixed_cost = excluded.fixed_cost;

  return jsonb_build_object('month', p_month, 'rate', v_rate, 'revenue', v_rev, 'fixed', v_fix);
end;
$function$;

CREATE OR REPLACE FUNCTION public.e11_inbound_reverted(p_order uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  o        order_records%rowtype;
  v_recv   numeric;   -- 되돌릴 **구매단위 개수**
  v_base   numeric := 0;  -- 되돌릴 **기준단위 총량**
  v_taken  numeric;
  v_short  numeric := 0;  -- 재고가 모자라 되돌리지 못한 몫
  v_unit   numeric;
  v_month  text;
  v_day    date := business_day();
  rec      record;
  ev       record;
  -- 수정 내역용(0063)
  v_corr     uuid := gen_random_uuid();
  v_prev     numeric;
  v_unit0    text;
  v_mat_before jsonb;
  v_mat0     numeric;
  v_rate0    numeric;
  v_price0   numeric;
  v_tax0     numeric;
begin
  select * into o from order_records where id = p_order for update;
  if not found then raise exception 'order % not found', p_order; end if;

  if o.received_qty <= 0 then
    return jsonb_build_object('order_id', p_order, 'nothing_to_revert', true, 'reverted_qty', 0);
  end if;

  v_recv := o.received_qty;

  -- 1) 이 발주로 늘어난 재고를 되돌린다.
  --    ⚠ inventory_events.count_delta 는 0034 이후 **기준단위(g)** 다. sealed_count 는 **개수**다.
  --      예전 구현은 개수에서 그램을 빼고 greatest(...,0) 로 잘라 재고를 통째로 날렸다
  --      (2개=2,000g 입고를 취소하면 개수 2 에서 2000 을 빼 0).
  --      consume_stock 은 기준단위를 받아 미개봉/개봉을 알아서 쪼개므로 그대로 쓴다.
  for ev in
    select ingredient_id, sum(count_delta) as delta
      from inventory_events
     where order_record_id = p_order and type = 'inbound'
       and not exists (select 1 from inventory_events r where r.reverses_event_id = inventory_events.id)
     group by ingredient_id
  loop
    v_base  := v_base + ev.delta;
    v_taken := consume_stock(ev.ingredient_id, ev.delta);

    -- 이미 팔려나가 뺄 수 없는 몫. 조용히 0 으로 자르면 사장님은 재고가 왜 안 줄었는지 모른다.
    if v_taken < ev.delta then
      v_short := v_short + (ev.delta - v_taken);
    end if;

    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, order_record_id, note, occurred_at, unit_normalized)
    values
      (o.store_id, ev.ingredient_id, 'adjust', -v_taken, p_order,
       coalesce(p_reason, '입고 취소 보정')
         || case when v_taken < ev.delta
                 then ' (재고 부족 ' || round(ev.delta - v_taken, 1) || ' 미반영)' else '' end,
       now(), true);
  end loop;

  -- ⚠ 되돌리기 **전** 값을 먼저 잡는다(0063). 아래에서 발주 상태가 바뀌는 순간
  --   base_unit_price 가 이 건을 빼고 다시 계산되므로, 뒤에 재면 전후가 같아진다.
  v_prev := base_unit_price(o.ingredient_id);
  select base_unit::text into v_unit0 from ingredients where id = o.ingredient_id;
  select coalesce(jsonb_object_agg(x.recipe_id::text, recipe_material_cost(x.recipe_id)), '{}'::jsonb)
    into v_mat_before
    from (select distinct recipe_id from recipe_lines
           where ingredient_id = o.ingredient_id and store_id = o.store_id) x;

  -- 2) 발주 상태를 되돌린다. 이 시점부터 base_unit_price 가 이 건을 제외하고 재계산된다.
  update order_records
     set received_qty = 0,
         status = 'ordered'::order_status
   where id = p_order;

  -- 3) 단가가 되돌아간 사실을 추이에 남긴다(과거 점은 그대로 둔다).
  v_unit := base_unit_price(o.ingredient_id);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price, order_record_id)
         values (o.store_id, o.ingredient_id, v_day, v_unit, p_order);
  end if;

  -- 4) 월 재료비 차감.
  --    ⚠ 여기도 단위다. 개당 금액 × **개수** 여야 한다. 예전엔 기준단위 총량을 곱해
  --      per_volume 배만큼 과다 차감했다(2개 취소인데 2,000개 값을 뺐다).
  v_month := to_char(coalesce(o.ordered_at, v_day), 'YYYY-MM');
  update monthly_pl
     set material_cost = greatest(coalesce(material_cost,0) - (o.amount * v_recv), 0)
   where store_id = o.store_id and month = v_month;

  -- ── 수정 내역(0063) — 취소도 값이 움직인 사건이다 ─────────
  if round(coalesce(v_prev, 0), 4) is distinct from round(coalesce(v_unit, 0), 4) then
    perform record_entity_change(
      o.store_id, 'ingredient', o.ingredient_id, 'inbound', '입고 취소로 기준 단가 변경',
      change_line('unit_price', '기준 단가',
                  round(v_prev, 4), round(v_unit, 4), '원/' || v_unit0),
      true, null, v_corr);
  end if;

  v_rate0 := coalesce(fixed_cost_rate(o.store_id, business_month()), 0);

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = o.ingredient_id and store_id = o.store_id
  loop
    v_mat0 := coalesce((v_mat_before->>rec.recipe_id::text)::numeric,
                       recipe_material_cost(rec.recipe_id));
    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;

    perform recompute_recipe(rec.recipe_id, 'material', v_day);

    perform record_entity_change(
      o.store_id, 'recipe', rec.recipe_id, 'ingredient',
      (select name from ingredients where id = o.ingredient_id) || ' 기준 단가 자동 반영',
      change_line('material_cost', '재료비',
                  round(v_mat0, 2), round(recipe_material_cost(rec.recipe_id), 2), '원')
      || change_line('profit', '순이익',
                  round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2),
                  round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0
                        - coalesce((select sum(ec.amount_per_serving) from recipe_extra_costs ec
                                     where ec.recipe_id = rec.recipe_id), 0), 2), '원'),
      true, o.ingredient_id, v_corr);
  end loop;

  perform refresh_order_candidate(o.ingredient_id);

  return jsonb_build_object(
    'order_id', p_order, 'nothing_to_revert', false,
    'reverted_qty', v_recv, 'reverted_base', v_base,
    'shortfall', v_short,
    'unit_price', v_unit, 'status', 'ordered');
end;
$function$;

select public.assert_no_rpc_overloads();
