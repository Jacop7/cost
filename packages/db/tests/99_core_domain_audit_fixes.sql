-- 핵심 도메인 교차 검수에서 확인한 원장·권한·원자성 회귀를 고정한다.
do $test$
declare s uuid:=pg_temp.store(); i uuid; taken numeric;
begin
  i:=public.save_ingredient(s,'{"name":"입고 전 음수 재고 검산","base_unit":"ea","per_volume":1,"purchase_price":100}');
  perform pg_temp.eq('신규 재료는 입고 전 재고 행이 없음',
    (select count(*) from public.inventory_states where ingredient_id=i),0);
  taken:=public.consume_stock(i,3,true);
  perform pg_temp.eq('입고 전 판매도 필요량 전량 차감',taken,3);
  perform pg_temp.eq('입고 전 판매는 음수 재고를 생성',public.stock_total_base(i),-3);
  perform public.restore_stock(i,3);
  perform pg_temp.eq('판매 취소는 생성된 음수 재고를 정확히 복원',public.stock_total_base(i),0);
end $test$;

do $test$
declare
  s uuid:=pg_temp.store(); d date; detail jsonb; summary jsonb;
  fixed_total numeric; fixed_allocated numeric; waste_total numeric; daily_total numeric;
  waste_allocated numeric; daily_allocated numeric;
begin
  select max(sale_date) into d from public.daily_sales
   where store_id=s
     and jsonb_typeof(public.sales_effective_day_summary(s,sale_date)->'fixed_cost')='number';
  summary:=public.sales_effective_day_summary(s,d);
  detail:=public.sales_authoritative_channel_profit(s,d,d);
  fixed_total:=(summary->>'fixed_cost')::numeric;
  waste_total:=coalesce((summary->>'waste_loss')::numeric,0);
  daily_total:=coalesce((summary->>'daily_extra')::numeric,0);
  select coalesce(sum((x->>'fixed_cost')::numeric),0),coalesce(sum((x->>'waste_loss')::numeric),0),
    coalesce(sum((x->>'daily_extra')::numeric),0)
    into fixed_allocated,waste_allocated,daily_allocated
    from jsonb_array_elements(detail->'channels') x;
  fixed_allocated:=fixed_allocated+coalesce((detail->>'unallocated_fixed_cost')::numeric,0);
  perform pg_temp.eq('전환 전 완료 매출도 채널 고정 지출 합계가 서버 권위 총액과 일치',
    fixed_allocated,fixed_total,0.01);
  perform pg_temp.eq('폐기 손실은 채널에 배분하지 않음',waste_allocated,0,0.01);
  perform pg_temp.eq('추가 지출은 채널에 배분하지 않음',daily_allocated,0,0.01);
  perform pg_temp.eq('미지정 폐기 손실은 서버 권위 총액과 일치',
    (detail->>'unallocated_waste_loss')::numeric,waste_total,0.01);
  perform pg_temp.eq('미지정 추가 지출은 서버 권위 총액과 일치',
    (detail->>'unallocated_daily_extra')::numeric,daily_total,0.01);
  perform pg_temp.ok('고정 지출이 있는 완료일의 채널 순이익은 미산출이 아님',not exists (
    select 1 from jsonb_array_elements(detail->'channels') x where x->'profit'='null'::jsonb));
end $test$;

do $test$
declare other_owner uuid:=pg_temp.new_owner(); other_store uuid;
begin
  set local role postgres;
  insert into public.stores(owner_id,name) values(other_owner,'기간 상세 권한 검산 매장') returning id into other_store;
  set local role costkeep_rpc_executor;
  perform pg_temp.raises('기간 상세는 다른 사장님의 매장을 읽지 못함',format(
    'select public.sales_authoritative_range_detail(%L,%L,%L)',other_store,pg_temp.today(),pg_temp.today()),'42501');
end $test$;

do $test$
declare
  s uuid:=pg_temp.store(); d date; draft_id uuid:=gen_random_uuid(); opened jsonb; feed jsonb;
  calendar_revision integer; result jsonb;
begin
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  perform public.publish_sales_basis_version(s,public.sales_editable_from(s));
  select x.business_date::date into d
    from jsonb_to_recordset(public.sales_feed(s,pg_temp.today()-40,pg_temp.today(),null,100)->'items')
      as x(business_date text,status text)
   where x.status='missing'
     and x.business_date::date between public.sales_editable_from(s) and public.sales_recommended_date(s)
   order by x.business_date desc limit 1;
  perform pg_temp.ok('원자 휴무 시험용 미작성일이 있음',d is not null);
  opened:=public.open_sales_draft(s,d,draft_id);
  select (x.calendar_revision)::integer into calendar_revision
    from jsonb_to_recordset(public.sales_feed(s,d,d,null,5)->'items')
      as x(calendar_revision integer);
  perform pg_temp.raises('휴무 CAS 실패 시 초안 폐기도 함께 롤백',format(
    'select public.close_sales_draft_as_holiday(%L,%L,0,%s,null)',s,draft_id,calendar_revision+1),'45009');
  perform pg_temp.eq_t('실패 뒤 초안은 작성 중 유지',
    (select status::text from public.sales_day_drafts where id=draft_id),'editing');
  result:=public.close_sales_draft_as_holiday(s,draft_id,0,calendar_revision,null);
  perform pg_temp.eq_t('성공 시 초안 폐기',(select status::text from public.sales_day_drafts where id=draft_id),'discarded');
  perform pg_temp.eq_t('성공 시 같은 트랜잭션에서 휴무 확정',result->>'day_kind','closed');
end $test$;

do $test$
declare
  s uuid:=pg_temp.store(); d date; draft_id uuid:=gen_random_uuid(); opened jsonb; items jsonb; recipe_id uuid;
begin
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  perform public.publish_sales_basis_version(s,public.sales_editable_from(s));
  select x.business_date::date into d
    from jsonb_to_recordset(public.sales_feed(s,pg_temp.today()-40,pg_temp.today(),null,100)->'items')
      as x(business_date text,status text)
   where x.status='missing'
     and x.business_date::date between public.sales_editable_from(s) and public.sales_recommended_date(s)
   order by x.business_date desc limit 1;
  opened:=public.open_sales_draft(s,d,draft_id);
  items:=opened->'payload'->'items';
  select (x->>'recipe_id')::uuid into recipe_id from jsonb_array_elements(items) x limit 1;
  items:=(select jsonb_agg(case when (x->>'recipe_id')::uuid=recipe_id
    then jsonb_set(x,'{channels,0,quantity}','1'::jsonb) else x end) from jsonb_array_elements(items) x);
  update public.recipes set active=false where id=recipe_id;
  perform pg_temp.raises('초안을 연 뒤 판매 중지된 메뉴는 저장 단계에서 거부',format(
    'select public.save_sales_draft(%L,%L,0,%L::jsonb,%L::jsonb,%L::jsonb)',
    s,draft_id,items,opened->'payload'->'etc_items',opened->'payload'->'extra_items'),'22000');
end $test$;
