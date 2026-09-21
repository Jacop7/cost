begin;

-- 채널 손익은 새 sales_day_heads가 없는 전환 전 완료 매출도 계산해야 한다.
-- 날짜 집합을 daily_sales에서 만들고, 각 날짜의 서버 권위 손익을 매출 비중으로 배분한다.
create or replace function public.sales_authoritative_channel_profit(
  p_store uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_detail jsonb;
  v_channels jsonb;
  v_unassigned numeric:=0;
  v_total_fixed numeric:=0;
  v_allocated_fixed numeric:=0;
  v_missing_fixed boolean:=false;
  v_unallocated_fixed numeric;
begin
  perform public.assert_my_store(p_store);
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);

  with menu_daily as (
    select ds.sale_date,ch.code,
      coalesce(sum(coalesce(ts.customer_total,it.unit_price*case ch.code
        when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) amount
    from public.daily_sales ds cross join public.sales_channels ch
    left join public.daily_sales_items it on it.daily_sales_id=ds.id
    left join public.daily_sales_item_tax_snapshots ts on ts.daily_sales_item_id=it.id
      and ts.sales_channel_code::text=ch.code
    where ds.store_id=p_store and ds.sale_date between p_from and p_to and ch.store_id=p_store
    group by ds.sale_date,ch.code
  ), etc_lines as (
    select ds.sale_date,nullif(x->>'channel','') code,
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'customer_total')::numeric,0) end amount
    from public.daily_sales ds cross join lateral jsonb_array_elements(
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_items,'[]'::jsonb)
           else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), etc_daily as (
    select sale_date,code,sum(amount) amount from etc_lines where code is not null group by sale_date,code
  ), etc_total as (
    select code,sum(amount) amount from etc_lines where code is not null group by code
  ), channel_daily as (
    select m.sale_date,m.code,m.amount+coalesce(e.amount,0) amount
    from menu_daily m left join etc_daily e using(sale_date,code)
  ), version_days as (
    select business_date,summary from (
      select distinct ds.sale_date business_date,
        public.sales_effective_day_summary(p_store,ds.sale_date) summary
      from public.daily_sales ds
      where ds.store_id=p_store and ds.sale_date between p_from and p_to
    ) completed where summary is not null
  ), allocations as (
    select c.code,
      coalesce(sum(case when coalesce((v.summary->>'revenue')::numeric,0)>0
        then coalesce((v.summary->>'extra_material_cost')::numeric,0)*c.amount/(v.summary->>'revenue')::numeric else 0 end),0) extra_material,
      coalesce(sum(case when coalesce((v.summary->>'revenue')::numeric,0)>0
        then coalesce((v.summary->>'waste_loss')::numeric,0)*c.amount/(v.summary->>'revenue')::numeric else 0 end),0) waste,
      coalesce(sum(case when coalesce((v.summary->>'revenue')::numeric,0)>0
        then coalesce((v.summary->>'daily_extra')::numeric,0)*c.amount/(v.summary->>'revenue')::numeric else 0 end),0) daily_extra,
      case when bool_or(jsonb_typeof(v.summary->'fixed_cost') is distinct from 'number') then null
        else sum(case when coalesce((v.summary->>'revenue')::numeric,0)>0
          then (v.summary->>'fixed_cost')::numeric*c.amount/(v.summary->>'revenue')::numeric else 0 end) end fixed_cost
    from channel_daily c join version_days v on v.business_date=c.sale_date group by c.code
  ), rows as (
    select ord,c,
      coalesce((select amount from etc_total e where e.code=c->>'code'),0) etc_revenue,
      coalesce(a.extra_material,0) extra_material,coalesce(a.waste,0) waste,
      coalesce(a.daily_extra,0) daily_extra,a.fixed_cost
    from jsonb_array_elements(coalesce(v_detail->'channels','[]'::jsonb)) with ordinality x(c,ord)
    left join allocations a on a.code=c->>'code'
  )
  select coalesce(jsonb_agg((c-'fixed_cost')||jsonb_build_object(
      'fixed_cost',fixed_cost,
      'etc_revenue',etc_revenue,'extra_material_cost',extra_material,
      'waste_loss',waste,'daily_extra',daily_extra,
      'profit',case when fixed_cost is not null and jsonb_typeof(c->'net_sales')='number'
        then (c->>'net_sales')::numeric-coalesce((c->>'material')::numeric,0)-extra_material-waste
          -fixed_cost-daily_extra else null end)
      order by ord),'[]'::jsonb)
    into v_channels from rows;

  select coalesce(sum(case when nullif(x->>'channel','') is null then
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'customer_total')::numeric,0) end else 0 end),0)
    into v_unassigned
    from public.daily_sales ds cross join lateral jsonb_array_elements(
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_items,'[]'::jsonb)
           else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
   where ds.store_id=p_store and ds.sale_date between p_from and p_to;

  select coalesce(sum(case when jsonb_typeof(summary->'fixed_cost')='number'
          then (summary->>'fixed_cost')::numeric else 0 end),0),
         coalesce(bool_or(jsonb_typeof(summary->'fixed_cost') is distinct from 'number'),false)
    into v_total_fixed,v_missing_fixed
    from (
      select summary from (
        select distinct ds.sale_date,
          public.sales_effective_day_summary(p_store,ds.sale_date) summary
        from public.daily_sales ds
        where ds.store_id=p_store and ds.sale_date between p_from and p_to
      ) completed where summary is not null
    ) days;
  select coalesce(sum((x->>'fixed_cost')::numeric),0) into v_allocated_fixed
    from jsonb_array_elements(v_channels) x
   where jsonb_typeof(x->'fixed_cost')='number';
  v_unallocated_fixed:=case when v_missing_fixed then null
    else greatest(v_total_fixed-v_allocated_fixed,0) end;

  return jsonb_build_object('channels',v_channels,'unassigned_revenue',v_unassigned,
    'unallocated_fixed_cost',v_unallocated_fixed);
end $fn$;

alter function public.sales_authoritative_channel_profit(uuid,date,date) owner to costkeep_rpc_executor;
revoke all on function public.sales_authoritative_channel_profit(uuid,date,date) from public,anon,service_role;
grant execute on function public.sales_authoritative_channel_profit(uuid,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
