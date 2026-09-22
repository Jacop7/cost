-- 재고 상태와 발주 후보의 최소재고 경계를 동일하게 유지한다.
-- 최소재고와 정확히 같을 때도 '소진 임박'이며 발주 후보에 포함한다.
begin;

do $patch$
declare
  d text;
  anchor text := 'if v_total < v_safe then';
begin
  d := pg_get_functiondef('public.refresh_order_candidate(uuid)'::regprocedure);
  if position(anchor in d) = 0 then
    raise exception 'order candidate safety boundary contract drift';
  end if;
  execute replace(d, anchor, 'if v_total <= v_safe then');
end $patch$;

-- 기존에 경계값에서 누락된 후보도 원장 변경 없이 다시 계산한다.
do $backfill$
declare
  r record;
begin
  for r in
    select i.id
    from public.ingredients i
    where i.active and i.stock_tracking
      and exists (select 1 from public.inventory_states s where s.ingredient_id = i.id)
      and public.stock_total_base(i.id) = i.safety_stock
  loop
    perform public.refresh_order_candidate(r.id);
  end loop;
end $backfill$;

select public.assert_no_rpc_overloads();
commit;
