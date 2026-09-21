begin;

-- 재고 내역의 입고 설명은 포장 개수가 아니라 구매처다.
-- 원장 note는 감사 기록으로 그대로 보존하고, 읽기 RPC에서 연결된 구매처명만 별도로 제공한다.
drop function if exists public.stock_history(uuid, date, date);

create function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type public.inventory_event_type,
  count_delta numeric, volume_delta numeric, note text,
  balance numeric, reverted boolean, waste boolean, vendor_name text
) language sql stable security invoker as $fn$
  select e.id, e.occurred_on, e.type, e.count_delta, e.volume_delta, e.note,
         e.balance, e.reverted, e.waste, e.vendor_name
    from (
      select ev.id,
             (ev.occurred_at at time zone public.store_timezone(ev.store_id))::date as occurred_on,
             ev.type, ev.count_delta, ev.volume_delta, ev.note, ev.seq, ev.waste,
             (exists (select 1 from public.inventory_events r where r.reverses_event_id = ev.id)
               or exists (select 1 from public.stock_event_reversal_receipts receipt where receipt.event_id = ev.id)) as reverted,
             sum(ev.count_delta) over (order by ev.seq
                                       rows between unbounded preceding and current row) as balance,
             v.name as vendor_name
        from public.inventory_events ev
        left join public.order_records o on o.id = ev.order_record_id
        left join public.vendors v on v.id = o.vendor_id
       where ev.ingredient_id = p_ingredient
    ) e
   where (p_from is null or e.occurred_on >= p_from)
     and (p_to   is null or e.occurred_on <= p_to)
   order by e.seq desc;
$fn$;

revoke all on function public.stock_history(uuid,date,date) from public,anon;
grant execute on function public.stock_history(uuid,date,date) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
