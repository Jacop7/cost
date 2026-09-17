-- 고정 지출 화면의 채널 설정을 제거한다.
-- 매출관리 채널별 손익은 날짜별 확정 고정 지출을 실제 채널 매출 비중으로 자동 배분한다.
-- 과거 items[].weights 값은 호환을 위해 보존하지만 이 계산에서는 사용하지 않는다.
begin;

create or replace function public.sales_channel_fixed(
  p_store uuid,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
stable
security invoker
as $fn$
declare
  v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from > p_to then
    raise exception '조회 기간이 올바르지 않아요' using errcode = '22000';
  end if;

  with days as (
    select distinct ds.sale_date
      from public.daily_sales ds
     where ds.store_id = p_store
       and ds.sale_date between p_from and p_to
  ), daily as (
    select d.sale_date,
           public.sales_range(p_store, d.sale_date, d.sale_date) as range_data,
           public.sales_etc_by_channel(p_store, d.sale_date, d.sale_date) as etc_data,
           public.day_snapshot(p_store, d.sale_date) as snapshot
      from days d
  ), channel_revenue as (
    select d.sale_date,
           ch.code::text as code,
           coalesce((
             select (entry->>'amount')::numeric
               from jsonb_array_elements(coalesce(d.range_data->'channels', '[]'::jsonb)) entry
              where entry->>'code' = ch.code::text
              limit 1
           ), 0)
           + coalesce((d.etc_data #>> array['by_channel', ch.code::text, 'amount'])::numeric, 0)
             as channel_revenue,
           coalesce((d.range_data #>> '{summary,revenue}')::numeric, 0) as total_revenue,
           coalesce((d.range_data #>> '{summary,fixed_cost}')::numeric, 0) as total_fixed
      from daily d
      cross join public.sales_channels ch
     where ch.store_id = p_store
  ), per_channel as (
    select code,
           sum(case
                 when total_revenue > 0
                   then total_fixed * channel_revenue / total_revenue
                 else 0
               end) as amount
      from channel_revenue
     group by code
  ), totals as (
    select coalesce(sum((d.range_data #>> '{summary,fixed_cost}')::numeric), 0) as total,
           coalesce(bool_or(d.snapshot is null), false) as provisional
      from daily d
  )
  select jsonb_build_object(
           'month', to_char(p_from, 'YYYY-MM'),
           'total', t.total,
           'provisional', t.provisional,
           'channels', coalesce(
             (select jsonb_object_agg(p.code, p.amount) from per_channel p),
             '{}'::jsonb
           ),
           'unallocated', greatest(
             t.total - coalesce((select sum(p.amount) from per_channel p), 0),
             0
           ),
           'items', '[]'::jsonb
         )
    into v_result
    from totals t;

  return v_result;
end;
$fn$;

comment on function public.sales_channel_fixed(uuid, date, date) is
  '날짜별 확정 고정 지출을 실제 채널 귀속 매출 비중으로 자동 배분한다. 미지정 기타 매출 몫은 unallocated로 반환한다(0104).';

select public.assert_no_rpc_overloads();
commit;
