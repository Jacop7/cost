-- ════════════════════════════════════════════════════════════════
-- 0024 · 목록 조회 함수 (N+1 방지)
--
-- 재고 총량(`stock_total_base`)과 기준단가(`base_unit_price`)는 **서버 함수**라
-- 일반 select 로는 가져올 수 없다. 앱이 한 건씩 RPC 를 부르면 목록 1회에 N+1 왕복이 되고,
-- 앱이 직접 계산하면 총량 정의가 두 벌이 되어 절대원칙 3 을 깬다.
--
-- 그래서 목록에 필요한 파생값을 **한 번의 질의**로 내려주는 함수를 둔다.
-- security invoker 라 RLS 가 그대로 적용된다 — 남의 매장 데이터는 보이지 않는다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.ingredient_list(p_store uuid)
returns table (
  id               uuid,
  name             text,
  category_name    text,
  base_unit        base_unit,
  per_volume       numeric,
  loss_rate        numeric,
  safety_stock     numeric,
  vendor_name      text,
  memo             text,
  stock_total      numeric,
  base_price       numeric,
  soon_out         boolean,
  last_inbound_at  date
) language sql stable security invoker as $$
  select
    i.id,
    i.name,
    c.name                              as category_name,
    i.base_unit,
    i.per_volume,
    i.loss_rate,
    i.safety_stock,
    v.name                              as vendor_name,
    i.memo,
    coalesce(stock_total_base(i.id), 0) as stock_total,
    base_unit_price(i.id)               as base_price,   -- null 을 0 으로 바꾸지 않는다(산출 불가 ≠ 0원)
    coalesce(s.soon_out, false)         as soon_out,
    s.last_inbound_at
  from ingredients i
  left join categories c on c.id = i.category_id
  left join vendors    v on v.id = i.default_vendor_id
  left join inventory_states s on s.ingredient_id = i.id
  where i.store_id = p_store and coalesce(i.active, true)
  order by i.name;
$$;

comment on function public.ingredient_list(uuid) is
  '식재료 목록 + 파생값(재고 총량·기준단가)을 한 번에. 앱이 총량을 다시 계산하지 않게 한다(절대원칙 3).';

select public.assert_no_rpc_overloads();
