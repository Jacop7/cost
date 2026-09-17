-- 채널별 손익도 확정 순매출을 사용한다. 세금 별도 판매에서 세금을 두 번 빼지 않는다.
-- 원장과 과거 과세 판본은 변경하지 않고 조회 응답에 순매출만 추가한다.
begin;
do $patch$
declare d text; n text;
begin
  d := pg_get_functiondef('public.sales_range(uuid,date,date)'::regprocedure);
  n := replace(d, $old$'tax', c.tax)$old$, $new$'tax', c.tax,
               'net_sales', (select coalesce(sum(coalesce(ts.net_sales,
                 (it.unit_price-coalesce(it.unit_tax,case when coalesce(it.tax_mode,'included')='included'
                   then it.unit_price*10/110 else 0 end)) *
                 case c.code when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0)
                 from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
                 left join public.daily_sales_item_tax_snapshots ts
                   on ts.daily_sales_item_id=it.id and ts.sales_channel_code::text=c.code
                 where ds.store_id=p_store and ds.sale_date between p_from and p_to))$new$);
  if n = d then raise exception '채널 순매출 응답 위치를 찾지 못했습니다'; end if;
  execute n;
end $patch$;

create or replace function public.sales_etc_by_channel(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  with days as (
    select * from public.daily_sales
     where store_id=p_store and sale_date between p_from and p_to
  ), items as (
    -- 기존 기타 매출은 회계 합계 계약(0191)대로 당시 금액 전체가 순매출이다.
    select nullif(i->>'channel','') as code,
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1) amount,
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1) net_sales,
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1)*coalesce(d.etc_tax,0)
        / nullif((select sum(coalesce((j->>'price')::numeric,0)*coalesce((j->>'qty')::numeric,1))
          from jsonb_array_elements(d.etc_items) j),0) tax
    from days d cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.etc_items)='array' then d.etc_items else '[]'::jsonb end) i
    where d.etc_tax_snapshot is null
    union all
    -- 국제 과세는 항목마다 포함/별도·반올림이 확정된 quote를 그대로 합산한다.
    select nullif(i->>'channel',''), (i->>'price')::numeric*(i->>'quantity')::numeric,
      (i->'quote'->>'net_sales')::numeric, (i->'quote'->>'tax_total')::numeric
    from days d cross join lateral jsonb_array_elements(d.etc_tax_snapshot->'lines') i
    where d.etc_tax_snapshot is not null
  ), split as (
    select code,sum(amount) amount,sum(net_sales) net_sales,coalesce(sum(tax),0) tax
    from items group by code
  )
  select jsonb_build_object('from',p_from,'to',p_to,
    'total',(select coalesce(sum(amount),0) from split),
    'by_channel',(select coalesce(jsonb_object_agg(code,jsonb_build_object(
      'amount',amount,'net_sales',net_sales,'tax',tax)),'{}'::jsonb) from split where code is not null),
    'unassigned',(select coalesce(sum(amount),0) from split where code is null),
    'unassigned_tax',(select coalesce(sum(tax),0) from split where code is null),
    'unassigned_net_sales',(select coalesce(sum(net_sales),0) from split where code is null));
$fn$;
select public.assert_no_rpc_overloads();
commit;
