begin;

-- 폐기 손실과 일 추가 지출에는 판매 채널 원장이 없다. 매출 비율로 나누면
-- 실제 귀속값처럼 보이므로 채널 손익에서 제외하고 미지정 공통 비용으로 반환한다.
-- 고정 지출은 제품 계약에 따라 날짜별 채널 매출 비중 배분을 유지한다.
create or replace function public.sales_authoritative_channel_profit(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_detail jsonb;
  v_channels jsonb;
  v_unallocated_fixed numeric;
  v_unallocated_waste numeric:=0;
  v_unallocated_daily_extra numeric:=0;
begin
  perform public.assert_my_store(p_store);
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);

  with menu_daily as (
    select ds.sale_date,q.sales_channel_id,sum(q.customer_total) amount
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      cross join lateral public.sales_item_channel_accounting_rows(it.id) q
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
    group by ds.sale_date,q.sales_channel_id
  ), etc_rows as (
    select ds.sale_date,e.sales_channel_id,
      sum(coalesce((e.tax_snapshot->>'customer_total')::numeric,e.unit_price*e.quantity)) amount
    from public.daily_sales ds join public.daily_sales_etc_lines e on e.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to and ds.channel_storage_version=2
      and e.sales_channel_id is not null group by ds.sale_date,e.sales_channel_id
    union all
    select ds.sale_date,c.id,
      sum(coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1))
    from public.daily_sales ds cross join lateral jsonb_array_elements(coalesce(ds.etc_items,'[]'::jsonb)) x
      join public.sales_channels c on c.store_id=ds.store_id and c.code=x->>'channel'
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and ds.channel_storage_version=1 and ds.etc_tax_snapshot is null group by ds.sale_date,c.id
    union all
    select ds.sale_date,c.id,sum(coalesce((x->'quote'->>'customer_total')::numeric,0))
    from public.daily_sales ds cross join lateral jsonb_array_elements(coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb)) x
      join public.sales_channels c on c.store_id=ds.store_id and c.code=x->>'channel'
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and ds.channel_storage_version=1 and ds.etc_tax_snapshot is not null group by ds.sale_date,c.id
  ), etc_daily as (
    select sale_date,sales_channel_id,sum(amount) amount from etc_rows group by sale_date,sales_channel_id
  ), channel_daily as (
    select coalesce(m.sale_date,e.sale_date) sale_date,
      coalesce(m.sales_channel_id,e.sales_channel_id) sales_channel_id,
      coalesce(m.amount,0)+coalesce(e.amount,0) amount
    from menu_daily m full join etc_daily e
      on e.sale_date=m.sale_date and e.sales_channel_id=m.sales_channel_id
  ), allocations as (
    -- 메뉴 부자재비는 현재 원장에 채널별 금액 스냅샷이 없어 기존 날짜별 배분을 유지한다.
    -- 폐기와 추가 지출은 여기서 배분하지 않는다.
    select d.sales_channel_id,
      sum(case when coalesce((s->>'revenue')::numeric,0)>0
        then coalesce((s->>'extra_material_cost')::numeric,0)*d.amount/(s->>'revenue')::numeric else 0 end) extra_material
    from channel_daily d cross join lateral public.sales_effective_day_summary(p_store,d.sale_date) s
    group by d.sales_channel_id
  ), rows as (
    select ord,c,coalesce(a.extra_material,0) extra_material
    from jsonb_array_elements(coalesce(v_detail->'channels','[]'::jsonb))
      with ordinality x(c,ord)
    left join allocations a on a.sales_channel_id=(c->>'sales_channel_id')::uuid
  )
  select coalesce(jsonb_agg(c||jsonb_build_object(
      'extra_material_cost',extra_material,
      'waste_loss',0,
      'daily_extra',0,
      'profit',case when jsonb_typeof(c->'fixed_cost')='number'
        then (c->>'net_sales')::numeric-coalesce((c->>'material')::numeric,0)-extra_material
          -(c->>'fixed_cost')::numeric else null end)
      order by ord),'[]'::jsonb)
    into v_channels from rows;

  select
    coalesce(sum(coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'waste_loss')::numeric,0)),0),
    coalesce(sum(coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'daily_extra')::numeric,0)),0)
    into v_unallocated_waste,v_unallocated_daily_extra
  from (select distinct ds.sale_date from public.daily_sales ds
        where ds.store_id=p_store and ds.sale_date between p_from and p_to) d;

  v_unallocated_fixed:=(v_detail->>'fixed_cost_unallocated')::numeric;
  return jsonb_build_object(
    'channels',v_channels,
    'unassigned_revenue',coalesce((v_detail->>'unassigned_revenue')::numeric,0),
    'fixed_cost_total',v_detail->'fixed_cost_total',
    'fixed_rate_provisional',jsonb_typeof(v_detail->'fixed_cost_total') is distinct from 'number',
    'unallocated_fixed_cost',v_unallocated_fixed,
    'unallocated_waste_loss',v_unallocated_waste,
    'unallocated_daily_extra',v_unallocated_daily_extra);
end $fn$;

alter function public.sales_authoritative_channel_profit(uuid,date,date) owner to costkeep_rpc_executor;
revoke all on function public.sales_authoritative_channel_profit(uuid,date,date) from public,anon,service_role;
grant execute on function public.sales_authoritative_channel_profit(uuid,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
