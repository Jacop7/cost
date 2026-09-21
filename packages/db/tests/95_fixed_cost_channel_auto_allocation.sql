-- 고정 지출 채널 설정을 제거해도 매출관리의 채널별 손익 합계가 보존되는지 검증한다.
do $t$
declare
  s uuid := pg_temp.store();
  d date := pg_temp.open_today();
  r jsonb;
  range_data jsonb;
  total numeric;
  hall numeric;
  delivery numeric;
  takeout numeric;
  unallocated numeric;
  total_revenue numeric;
  hall_revenue numeric;
  delivery_revenue numeric;
  takeout_revenue numeric;
begin
  -- 시험 날짜의 공식 고정 지출률을 20%로 고정한다.
  set local role postgres;
  update public.business_days
     set snapshot = coalesce(snapshot, '{}'::jsonb) || jsonb_build_object('fixed_rate', 0.2)
   where store_id = s and business_date = d;
  set local role costkeep_rpc_executor;

  perform pg_temp.e10(s, d, pg_temp.rcp('제육볶음'), 1, 2, 1, 0);
  range_data := public.sales_range(s, d, d);
  r := public.sales_channel_fixed(s, d, d);
  total := (r->>'total')::numeric;
  hall := coalesce((r#>>'{channels,hall}')::numeric, 0);
  delivery := coalesce((r#>>'{channels,delivery}')::numeric, 0);
  takeout := coalesce((r#>>'{channels,takeout}')::numeric, 0);
  unallocated := coalesce((r->>'unallocated')::numeric, 0);
  total_revenue := (range_data#>>'{summary,revenue}')::numeric;
  select coalesce((entry->>'amount')::numeric, 0)
    into hall_revenue
    from jsonb_array_elements(range_data->'channels') entry
   where entry->>'code' = 'hall';
  select coalesce((entry->>'amount')::numeric, 0)
    into delivery_revenue
    from jsonb_array_elements(range_data->'channels') entry
   where entry->>'code' = 'delivery';
  select coalesce((entry->>'amount')::numeric, 0)
    into takeout_revenue
    from jsonb_array_elements(range_data->'channels') entry
   where entry->>'code' = 'takeout';

  perform pg_temp.ok('채널 자동 배분 시험은 0원이 아니다', total > 0);
  perform pg_temp.eq('채널 배분과 미지정 몫의 합은 공식 고정 지출 합계',
    hall + delivery + takeout + unallocated, total, 0.000001);
  perform pg_temp.eq('매장 실제 매출 비중 배분', hall / total, hall_revenue / total_revenue, 0.000001);
  perform pg_temp.eq('배달 실제 매출 비중 배분', delivery / total, delivery_revenue / total_revenue, 0.000001);
  perform pg_temp.eq('포장 실제 매출 비중 배분', takeout / total, takeout_revenue / total_revenue, 0.000001);
end $t$;
