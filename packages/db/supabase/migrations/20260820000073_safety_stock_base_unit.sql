-- ═════════════════════════════════════════════════════════════
-- 0073 · 안전재고도 기준단위로
--
-- 재고는 0056 에서 기준단위 총량으로 통일했는데 **안전재고만 개수**로
-- 남아 있었다(절대원칙 1: 저장은 항상 최소단위). 비교할 때마다
-- `safety_stock × per_volume` 로 환산했는데, 0072 이후 per_volume 은
-- **기본값**일 뿐이라 그 환산이 서 있을 자리가 없다.
--
-- 실측된 피해:
--   고추장 안전재고 1개 · 팩 3,000g → 기준 3,000g
--   사장님이 "우린 5kg 짜리 산다"며 **팩 용량만** 고침
--   → 안전재고 기준이 소리 없이 5,000g 으로 바뀜. 안전재고는 건드리지도 않았다.
--
-- ⚠ 최소 발주량은 **개수 그대로** 둔다. 발주는 팩 단위로 하므로 개수가 맞는 단위다.
--   추천 발주량을 낼 때 per_volume 으로 나누는 것도 그대로다 — "몇 팩 사세요"의 기본값이다.
-- ═════════════════════════════════════════════════════════════

-- 기존 값을 기준단위로 옮긴다. 한 번만 돌아야 하므로 표식을 남긴다.
alter table ingredients add column if not exists safety_stock_is_base boolean not null default false;

update ingredients
   set safety_stock = safety_stock * coalesce(per_volume, 1),
       safety_stock_is_base = true
 where not safety_stock_is_base;

comment on column ingredients.safety_stock is
  '안전재고 — **기준단위**(g/ml/개). 팩 개수가 아니다(0073).';

CREATE OR REPLACE FUNCTION public.refresh_order_candidate(p_ingredient uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  ing        ingredients%rowtype;
  v_total    numeric;
  v_safe     numeric;
  v_soon     boolean;
  v_reasons  candidate_reason[] := '{}';
  v_rec_qty  numeric;
  v_ordered  boolean;
begin
  select * into ing from ingredients where id = p_ingredient;
  if not found then return; end if;

  -- 재고는 **총량(기준단위)** 으로 본다. 안전재고는 개수 기준이므로 개당 용량을 곱해 맞춘다.
  v_total := stock_total_base(p_ingredient);
  -- ⚠ 안전재고는 이제 **기준단위**다(0073). per_volume 을 곱하지 않는다.
  --   곱하던 시절에는 사장님이 팩 용량만 고쳐도 안전재고 기준이 따라 움직였다
  --   (실측: 3,000 → 5,000g. 안전재고는 건드리지도 않았는데).
  v_safe  := coalesce(ing.safety_stock, 0);
  select coalesce(soon_out, false) into v_soon from inventory_states where ingredient_id = p_ingredient;

  if v_total < v_safe then
    v_reasons := array_append(v_reasons, 'safety_stock'::candidate_reason);
  end if;
  if coalesce(v_soon, false) then
    v_reasons := array_append(v_reasons, 'soon_out'::candidate_reason);
  end if;

  -- 이미 도착하지 않은 발주가 있으면 '주문함' 상태다. 별도 컬럼에 저장하지 않고 **파생**시킨다
  -- (저장하면 발주가 취소·완료돼도 상태가 남아 어긋난다).
  select exists (
    select 1 from order_records
     where ingredient_id = p_ingredient and status in ('ordered','partial')
  ) into v_ordered;

  if array_length(v_reasons, 1) is null then
    -- 사유가 하나도 없으면 후보가 아니다. 재고를 채웠으면 후보는 사라져야 한다.
    delete from order_candidates where ingredient_id = p_ingredient;
    return;
  end if;

  -- 권장 발주량 = 안전재고까지 채우는 데 필요한 구매단위 개수(최소 발주량 이상)
  v_rec_qty := greatest(
    ceil((v_safe - v_total) / nullif(ing.per_volume, 0)),
    coalesce(ing.min_order_qty, 1));

  insert into order_candidates (store_id, ingredient_id, reasons, recommended_qty, status)
       values (ing.store_id, p_ingredient, v_reasons, v_rec_qty,
               (case when v_ordered then 'ordered' else 'pending' end)::candidate_status)
  on conflict (store_id, ingredient_id) do update
       -- 사유·권장량은 **현재 상태로 덮어쓴다.** 예전엔 누적되기만 해서 해소돼도 남았다.
       set reasons = excluded.reasons,
           recommended_qty = excluded.recommended_qty,
           status = excluded.status,
           updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.order_board(p_store uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ingredient_id', c.ingredient_id, 'name', i.name,
               'reasons', c.reasons, 'recommended_qty', c.recommended_qty, 'status', c.status,
               'stock_total', stock_total_base(i.id),
               'safety_total', i.safety_stock,   -- 이미 기준단위다(0073)
               'base_unit', i.base_unit, 'per_volume', i.per_volume) order by i.name), '[]'::jsonb)
      from order_candidates c join ingredients i on i.id = c.ingredient_id
      where c.store_id = p_store),
    'waiting', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ingredient_id', o.ingredient_id, 'name', i.name,
               'vendor_name', v.name, 'volume', o.volume, 'amount', o.amount,
               'qty', o.qty, 'received_qty', o.received_qty, 'status', o.status,
               'ordered_at', o.ordered_at, 'expected_at', o.expected_at,
               'unit_price', o.amount / nullif(o.volume, 0)) order by o.expected_at nulls last), '[]'::jsonb)
      from order_records o join ingredients i on i.id = o.ingredient_id
      left join vendors v on v.id = o.vendor_id
      where o.store_id = p_store and o.status in ('ordered','partial')),
    'received', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'ingredient_id', o.ingredient_id, 'name', i.name,
               'vendor_name', v.name, 'volume', o.volume, 'amount', o.amount,
               'qty', o.qty, 'received_qty', o.received_qty,
               'ordered_at', o.ordered_at,
               'unit_price', o.amount / nullif(o.volume, 0)) order by o.ordered_at desc), '[]'::jsonb)
      from order_records o join ingredients i on i.id = o.ingredient_id
      left join vendors v on v.id = o.vendor_id
      where o.store_id = p_store and o.status = 'received')
  );
$function$;

select public.assert_no_rpc_overloads();
