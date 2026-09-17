-- 전체 재고 실사는 완전한 대상 집합과 요청 영수증을 요구한다.
do $test$
declare
  s uuid:=pg_temp.store();
  session_id uuid:='98000000-0000-4000-8000-000000000001';
  request_id uuid:='98000000-0000-4000-8000-000000000002';
  started jsonb; recovered jsonb; counts jsonb; committed jsonb; duplicate_result jsonb; discarded jsonb;
  discard_ingredient uuid; stock_before numeric; stock_after_count numeric;
  missing_date date; missing_draft uuid:='98000000-0000-4000-8000-000000000090'; missing_opened jsonb;
  day_row record; classified jsonb;
begin
  -- 실사는 추천 영업일의 매출이 완료된 뒤 시작한다.
  if exists(select 1 from public.business_days where store_id=s and status in ('open','break')) then
    perform public.transition_business_state(s,'end');
  end if;
  perform public.ensure_sales_calendar_range(s,public.sales_editable_from(s),public.sales_recommended_date(s));
  for day_row in select c.business_date,c.revision from public.sales_calendar_days c
   where c.store_id=s and c.business_date between public.sales_editable_from(s) and public.sales_recommended_date(s)
     and not exists(select 1 from public.sales_day_heads h
       where h.store_id=s and h.business_date=c.business_date)
     and not exists(select 1 from public.business_days b
       where b.store_id=s and b.business_date=c.business_date)
  loop
    classified:=public.set_sales_calendar_day(s,day_row.business_date,'closed',day_row.revision,'회귀 검증 휴무');
  end loop;
  perform pg_temp.ok('제품 휴무 분류 명령으로 실사 전제 날짜를 모두 해소',not exists(
    select 1 from public.sales_calendar_days c where c.store_id=s
      and c.business_date between public.sales_editable_from(s) and public.sales_recommended_date(s)
      and c.day_kind<>'closed'
      and not exists(select 1 from public.sales_day_heads h
        where h.store_id=s and h.business_date=c.business_date)
      and not exists(select 1 from public.business_days b
        where b.store_id=s and b.business_date=c.business_date and b.status='closed')));
  perform pg_temp.ok('휴무 확정은 사유·실행자·시각과 전후 상태를 감사 원장에 보존',exists(
    select 1 from public.sales_calendar_day_revisions r
     where r.store_id=s and r.after_kind='closed' and r.after_source='manual_closed'
       and r.reason='회귀 검증 휴무' and r.after_revision=r.before_revision+1
       and r.changed_at is not null));
  perform public.publish_sales_basis_version(s,public.sales_editable_from(s));
  select i.id,public.stock_total_base(i.id) into discard_ingredient,stock_before
    from public.ingredients i where i.store_id=s and i.active and public.stock_total_base(i.id)>1
    order by i.id limit 1;
  discarded:=public.e2_discard(discard_ingredient,stock_before-1,pg_temp.today());
  started:=public.begin_inventory_count(s,session_id);
  perform pg_temp.eq_t('실사 세션 시작',started->>'status','active');
  recovered:=public.begin_inventory_count(s,'98000000-0000-4000-8000-000000000099');
  perform pg_temp.eq_t('재진입은 새 세션 대신 서버의 활성 실사를 복구',recovered->>'session_id',session_id::text);
  select c.business_date,c.revision into day_row from public.sales_calendar_days c
   where c.store_id=s and c.business_date between public.sales_editable_from(s) and public.sales_recommended_date(s)
   order by c.business_date desc limit 1;
  perform pg_temp.raises('활성 실사 중 영업일 분류 변경 차단',format(
    'select public.set_sales_calendar_day(%L,%L,%L,%L,%L)',s,day_row.business_date,
    'expected',day_row.revision,'실사 중 변경 시도'),'45027');
  perform pg_temp.eq('실사 입력 대상은 고정된 ID 집합과 같은 개수',
    jsonb_array_length(started->'targets'),jsonb_array_length(started->'target_ingredient_ids'));
  perform pg_temp.ok('실사 화면에 식재료명·기준단위·시작 재고를 함께 제공',not exists(
    select 1 from jsonb_array_elements(started->'targets') target
     where nullif(target->>'ingredient_id','') is null
        or nullif(target->>'name','') is null
        or nullif(target->>'base_unit','') is null
        or target->'stock_total' is null));
  perform pg_temp.raises('일부 식재료만 보낸 실사는 거부',format(
    'select public.commit_inventory_count_batch(%L,%L,''[]''::jsonb,%L)',s,session_id,request_id),'45031');

  select jsonb_agg(jsonb_build_object(
    'ingredient_id',ingredient_id,
    'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts
    from unnest((select target_ingredient_ids from public.inventory_count_sessions where id=session_id)) ingredient_id;
  committed:=public.commit_inventory_count_batch(s,session_id,counts,request_id);
  duplicate_result:=public.commit_inventory_count_batch(s,session_id,counts,request_id);
  perform pg_temp.ok('첫 실사 완료는 중복 아님',(committed->>'duplicate')::boolean=false);
  perform pg_temp.ok('같은 요청의 실사 재시도는 영수증 반환',(duplicate_result->>'duplicate')::boolean=true);
  perform pg_temp.eq_t('실사 세션 완료',(
    select status::text from public.inventory_count_sessions where id=session_id),'completed');
  perform pg_temp.eq('실사 대상마다 원장 한 건',(
    select count(*) from public.inventory_count_lines where batch_id=(committed->>'batch_id')::uuid),
    jsonb_array_length(started->'target_ingredient_ids'));
  perform pg_temp.ok('전체 실사 사건은 취소 후보가 아님',not coalesce((
    select eligible from public.stock_revert_candidates((select ingredient_id from public.inventory_count_lines
      where batch_id=(committed->>'batch_id')::uuid limit 1))
    where event_id=(select event_id from public.inventory_count_lines
      where batch_id=(committed->>'batch_id')::uuid limit 1)),false));
  stock_after_count:=public.stock_total_base(discard_ingredient);
  perform pg_temp.raises('실사에 포함된 폐기 원장은 직접 되돌릴 수 없음',format(
    'select public.e2_discard_reverted(%L,%L)',discarded->>'event_id','실사 후 취소'),'45035');
  perform pg_temp.eq('거부된 폐기 취소는 재고를 바꾸지 않음',
    public.stock_total_base(discard_ingredient),stock_after_count);

  select c.business_date into missing_date from public.sales_calendar_days c
   where c.store_id=s and c.business_date<=(select inventory_cutoff_business_date from public.stores where id=s)
     and not exists(select 1 from public.daily_sales ds where ds.store_id=s and ds.sale_date=c.business_date)
     and not exists(select 1 from public.business_days b where b.store_id=s and b.business_date=c.business_date)
   order by c.business_date limit 1;
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  missing_opened:=public.open_sales_draft(s,missing_date,missing_draft);
  perform pg_temp.eq_t('실사 이전 미작성일은 최초 초안으로 열림',missing_opened->>'kind','initial');
  perform pg_temp.raises('실사 컷오프 이전 최초 완료는 재고 재차감 방지를 위해 거부',format(
    'select public.finalize_sales_draft(%L,%L,0,%L,%L,%L)',s,missing_draft,
    '98000000-0000-4000-8000-000000000091',missing_opened->>'payload_hash','컷오프 이전 최초 완료'),'45052');
  perform public.discard_sales_draft(s,missing_draft,0);
end $test$;

-- 실사 전 발생분은 흡수하고 관측 중 사건은 재실사로 해소한다.
do $test$
declare
  s uuid:=pg_temp.store();
  ing uuid; batch public.inventory_count_batches; stock0 numeric; stock1 numeric;
  inbound_order uuid; inbound_ing uuid; inbound_stock0 numeric; inbound_result jsonb;
  absorbed jsonb; ambiguous jsonb; normal_event jsonb; quick_result jsonb; delayed_quick jsonb; absorbed_event uuid;
  correction jsonb; correction_retry jsonb; correction_second jsonb; delayed_retry jsonb;
  recount_session uuid:='98000000-0000-4000-8000-000000000020';
  recount_request uuid:='98000000-0000-4000-8000-000000000021';
  correction_request uuid:='98000000-0000-4000-8000-000000000022';
  absorbed_request uuid:='98000000-0000-4000-8000-000000000023';
  ambiguous_request uuid:='98000000-0000-4000-8000-000000000024';
  normal_request uuid:='98000000-0000-4000-8000-000000000026';
  started jsonb; counts jsonb; committed jsonb;
begin
  select b.* into batch from public.inventory_count_batches b
   where b.store_id=s order by b.counted_at desc limit 1;
  select l.ingredient_id into ing from public.inventory_count_lines l
   where l.batch_id=batch.id order by l.ingredient_id limit 1;
  stock0:=public.stock_total_base(ing);

  select o.id,o.ingredient_id into inbound_order,inbound_ing from public.order_records o
   join public.inventory_count_lines l on l.batch_id=batch.id and l.ingredient_id=o.ingredient_id
   where o.store_id=s and o.status='ordered' and o.qty>o.received_qty
   order by o.ordered_at desc limit 1;
  inbound_stock0:=public.stock_total_base(inbound_ing);
  inbound_result:=public.record_delayed_inbound(inbound_order,1,'지연 입고 회귀',
    batch.observation_started_at-interval '2 minutes');
  perform pg_temp.eq('실사 전 발생·실사 후 기록된 입고는 현재고를 이중 증가시키지 않음',
    public.stock_total_base(inbound_ing),inbound_stock0);
  perform pg_temp.ok('지연 입고의 경제 기록은 보존하고 재고 효과만 실사에 흡수',exists(
    select 1 from public.inventory_events e where e.order_record_id=inbound_order
      and e.inventory_resolution_kind='absorbed_before_count'
      and e.reported_count_delta>0 and e.count_delta=0
      and e.absorbed_by_count_batch_id=batch.id));

  absorbed:=public.record_delayed_stock_adjustment(ing,-1,false,'실사 전 조정 누락',
    batch.observation_started_at-interval '1 minute',absorbed_request);
  stock1:=public.stock_total_base(ing);
  select id into absorbed_event from public.inventory_events
   where store_id=s and ingredient_id=ing and inventory_resolution_kind='absorbed_before_count'
   order by seq desc limit 1;
  perform pg_temp.ok('실사 전 지연 조정은 흡수 사건으로 분류',absorbed_event is not null);
  perform pg_temp.eq('실사 전 발생·실사 후 기록된 조정은 현재고를 다시 바꾸지 않음',stock1,stock0);
  perform pg_temp.ok('흡수 사건은 최초 후속 실사 batch에 연결',exists(
    select 1 from public.inventory_events where id=absorbed_event
      and absorbed_by_count_batch_id=batch.id and count_delta=0));

  correction:=public.correct_absorbed_inventory_event(s,absorbed_event,0,-2,null,
    '실제 조정량 정정',correction_request);
  correction_retry:=public.correct_absorbed_inventory_event(s,absorbed_event,0,-2,null,
    '실제 조정량 정정',correction_request);
  perform pg_temp.ok('흡수 경제 정정은 append-only 판본을 생성',(correction->>'revision')::integer=1);
  perform pg_temp.ok('경제 정정 요청 재시도는 같은 영수증을 반환',(correction_retry->>'duplicate')::boolean);
  perform pg_temp.raises('흡수 경제 정정은 이전 판본으로 덮어쓸 수 없음',format(
    'select public.correct_absorbed_inventory_event(%L,%L,0,-3,null,%L,%L)',
    s,absorbed_event,'오래된 판본 덮어쓰기','98000000-0000-4000-8000-000000000025'),'45009');
  correction_second:=public.correct_absorbed_inventory_event(s,absorbed_event,1,-3,null,
    '두 번째 실제 조정량 정정','98000000-0000-4000-8000-000000000027');
  perform pg_temp.eq('연속 경제 정정은 최초 원본이 아니라 직전 목표와의 차이만 기록',(
    select sum(coalesce(e.reported_count_delta,0)) from public.inventory_events e
     where e.id=absorbed_event or e.id in (select c.correction_event_id
       from public.inventory_event_economic_corrections c where c.source_event_id=absorbed_event)),-3);
  perform pg_temp.eq('경제 정정도 현재고를 바꾸지 않음',public.stock_total_base(ing),stock0);

  ambiguous:=public.record_delayed_stock_adjustment(ing,-1,false,'실사 관측 중 조정 누락',
    batch.observation_started_at+(batch.counted_at-batch.observation_started_at)/2,ambiguous_request);
  perform pg_temp.eq('관측 중 지연 조정은 현재고를 보류',public.stock_total_base(ing),stock0);
  perform pg_temp.ok('관측 중 사건은 재실사 대상과 매장 격리를 만든다',
    (select inventory_recount_required from public.stores where id=s)
    and exists(select 1 from public.inventory_recount_targets
      where store_id=s and ingredient_id=ing and status='pending'));

  started:=public.begin_inventory_count(s,recount_session);
  perform pg_temp.ok('모호 사건 식재료는 후속 전체 실사 대상에 포함',
    exists(select 1 from public.inventory_count_sessions session_row,
      lateral unnest(session_row.target_ingredient_ids) target_id
      where session_row.id=recount_session and target_id=ing));
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
      'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts from unnest((select target_ingredient_ids from public.inventory_count_sessions
      where id=recount_session)) ingredient_id;
  committed:=public.commit_inventory_count_batch(s,recount_session,counts,recount_request);
  perform pg_temp.ok('후속 전체 실사가 모호 사건과 격리를 해소',
    not (select inventory_recount_required from public.stores where id=s)
    and not exists(select 1 from public.inventory_recount_targets
      where store_id=s and status='pending'));

  normal_event:=public.record_delayed_stock_adjustment(ing,-1,false,'실사 완료 후 조정',
    clock_timestamp(),normal_request);
  perform pg_temp.eq('실사 완료 뒤 발생한 정상 조정은 현재고에 반영',public.stock_total_base(ing),stock0-1);
  delayed_retry:=public.record_delayed_stock_adjustment(ing,-1,false,'실사 완료 후 조정',
    (select occurred_at from public.inventory_events where id=(normal_event->>'event_id')::uuid),normal_request);
  perform pg_temp.ok('지연 조정 같은 요청 재시도는 원장을 늘리지 않음',(delayed_retry->>'duplicate')::boolean);
  perform pg_temp.raises('실사 이후 날짜만 있는 구형 재고 조정은 정확시각 없이는 거부',format(
    'select public.e5_stock_adjusted(%L,%L,false,%L,%L)',ing,stock0-2,'구형 날짜-only 조정',pg_temp.today()),'45055');
  delayed_quick:=public.record_delayed_quick_inbound(s,ing,1,1,1,null,
    '실사 전 빠른 입고 회귀',batch.observation_started_at-interval '3 minutes');
  perform pg_temp.eq('실사 전 빠른 입고도 실측 재고를 다시 늘리지 않음',
    public.stock_total_base(ing),stock0-1);
  perform pg_temp.ok('실사 전 빠른 입고는 구매 경제 기록을 보존하고 재고 효과만 흡수',exists(
    select 1 from public.inventory_events e where e.order_record_id=(delayed_quick->>'order_id')::uuid
      and e.inventory_resolution_kind='absorbed_before_count' and e.reported_count_delta=1
      and e.count_delta=0 and e.absorbed_by_count_batch_id=batch.id));
  quick_result:=public.record_delayed_quick_inbound(s,ing,1,1,1,null,
    '실사 전 빠른 입고 회귀',batch.observation_started_at-interval '3 minutes');
  perform pg_temp.ok('실사 전 빠른 입고 재시도는 같은 구매를 중복 생성하지 않음',
    (quick_result->>'duplicate')::boolean);
  quick_result:=public.record_current_quick_inbound(s,ing,1,1,1,null,'실사 후 빠른 입고');
  perform pg_temp.eq('실사 이후 빠른 입고는 서버 현재시각 경로로 정상 반영',
    public.stock_total_base(ing),stock0);
  perform public.record_current_stock_adjustment(ing,stock0-2,false,'서버 현재시각 조정');
  perform pg_temp.eq('서버 현재시각 경로는 실사 뒤 정상 재고 조정을 허용',public.stock_total_base(ing),stock0-2);
end $test$;

-- 흡수된 입고 정정은 현재 식재료 기본 용량이 아니라 원 발주의 포장 용량을 사용한다.
do $test$
declare
  s uuid:=pg_temp.store();
  ing uuid; order_id uuid; source_event uuid;
  count_session_id uuid:='98000000-0000-4000-8000-000000000030';
  count_request uuid:='98000000-0000-4000-8000-000000000031';
  correction_request uuid:='98000000-0000-4000-8000-000000000032';
  reverse_request uuid:='98000000-0000-4000-8000-000000000033';
  started jsonb; counts jsonb; batch public.inventory_count_batches; corrected jsonb;
  stock_after_count numeric; material_before numeric; material_after_inbound numeric;
  month_key text;
begin
  ing:=public.save_ingredient(s,jsonb_build_object('name','원 발주 용량 정정 시험',
    'base_unit','g','per_volume',1000,'purchase_price',2000,'safety_stock',0,'min_order_qty',1));
  order_id:=public.e7_place_order(s,ing,null,null,500,1000,4,pg_temp.today(),'manual');
  started:=public.begin_inventory_count(s,count_session_id);
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
      'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts from unnest((select target_ingredient_ids from public.inventory_count_sessions
      where id=count_session_id)) ingredient_id;
  perform public.commit_inventory_count_batch(s,count_session_id,counts,count_request);
  select * into batch from public.inventory_count_batches b where b.session_id=count_session_id;
  stock_after_count:=public.stock_total_base(ing);
  month_key:=to_char(public.store_local_date(s,batch.observation_started_at-interval '1 minute'),'YYYY-MM');
  select coalesce(material_cost,0) into material_before from public.monthly_pl
    where store_id=s and month=month_key;

  perform public.record_delayed_inbound(order_id,1,'원 발주 용량 지연 입고',
    batch.observation_started_at-interval '1 minute');
  select coalesce(material_cost,0) into material_after_inbound from public.monthly_pl
    where store_id=s and month=month_key;
  perform pg_temp.eq('팩당 1,000원 1팩 지연 입고는 월 재료비 1,000원 증가',
    material_after_inbound-material_before,1000);
  select id into source_event from public.inventory_events
    where order_record_id=order_id and inventory_resolution_kind='absorbed_before_count'
    order by seq desc limit 1;
  perform pg_temp.eq('500g 원 발주 1팩 입고는 기준단위 500g으로 보존',(
    select reported_count_delta from public.inventory_events where id=source_event),500);
  corrected:=public.correct_absorbed_inventory_event(s,source_event,0,1000,null,
    '실제 2팩 입고 정정',correction_request);
  perform pg_temp.eq('원 발주 500g 기준 +500g 정정은 수령 수량을 정확히 1팩 증가',(
    select received_qty from public.order_records where id=order_id),2);
  perform pg_temp.eq('입고 경제 정정은 실사로 확정한 물리 재고를 바꾸지 않음',
    public.stock_total_base(ing),stock_after_count);
  perform pg_temp.eq('원 발주 용량 기준 단가는 정정 뒤에도 2원/g',
    public.base_unit_price(ing),2);
  perform pg_temp.eq('흡수 입고 +1팩 경제 정정은 월 재료비 1,000원 증가',(
    select material_cost-material_after_inbound from public.monthly_pl
      where store_id=s and month=month_key),1000);

  corrected:=public.correct_absorbed_inventory_event(s,source_event,1,500,null,
    '실제 1팩으로 되돌림',reverse_request);
  perform pg_temp.eq('흡수 입고 -1팩 경제 정정은 월 재료비 1,000원 감소',(
    select material_cost-material_after_inbound from public.monthly_pl
      where store_id=s and month=month_key),0);
  perform pg_temp.eq('경제 정정 되감기는 수령 수량도 1팩으로 복원',(
    select received_qty from public.order_records where id=order_id),1);
  corrected:=public.correct_absorbed_inventory_event(s,source_event,1,500,null,
    '실제 1팩으로 되돌림',reverse_request);
  perform pg_temp.eq('같은 경제 정정 요청 재시도는 월 재료비를 다시 바꾸지 않음',(
    select material_cost-material_after_inbound from public.monthly_pl
      where store_id=s and month=month_key),0);
end $test$;

-- 실사에 흡수된 과거 판매 증분은 재실사 뒤 확정하고, 이후 금액만 고쳐도 다시 차감하지 않는다.
do $test$
declare
  s uuid:=pg_temp.store(); target_date date:=pg_temp.today()-1;
  draft_id uuid:='98000000-0000-4000-8000-000000000010';
  session_id uuid:='98000000-0000-4000-8000-000000000011';
  count_request uuid:='98000000-0000-4000-8000-000000000012';
  finalize_request uuid:='98000000-0000-4000-8000-000000000013';
  expense_draft_id uuid:='98000000-0000-4000-8000-000000000014';
  expense_request uuid:='98000000-0000-4000-8000-000000000015';
  decrease_draft_id uuid:='98000000-0000-4000-8000-000000000023';
  decrease_request uuid:='98000000-0000-4000-8000-000000000024';
  opened jsonb; saved jsonb; pending jsonb; started jsonb; counts jsonb; committed jsonb;
  finalized jsonb; expense_opened jsonb; expense_saved jsonb; expense_finalized jsonb;
  decrease_opened jsonb; decrease_saved jsonb; decrease_finalized jsonb;
  changed_items jsonb; changed_extra jsonb; decrease_items jsonb;
  swap_draft_id uuid:='98000000-0000-4000-8000-000000000016';
  swap_request uuid:='98000000-0000-4000-8000-000000000017';
  swap_opened jsonb; swap_saved jsonb; swap_pending jsonb; swap_items jsonb;
  abandoned_session uuid:='98000000-0000-4000-8000-000000000018';
  abandoned_request uuid:='98000000-0000-4000-8000-000000000019';
  abandoned_ing uuid; abandoned_started jsonb; abandoned_counts jsonb; abandoned_committed jsonb;
  stock_before numeric; stock_after numeric; events_before bigint; events_after bigint;
begin
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  opened:=public.open_sales_draft(s,target_date,draft_id);
  select jsonb_agg(case when ord=1 then jsonb_set(item,'{qty_hall}',
      to_jsonb(coalesce((item->>'qty_hall')::numeric,0)+1),false) else item end order by ord)
    into changed_items
  from jsonb_array_elements(opened->'payload'->'items') with ordinality source(item,ord);
  saved:=public.save_sales_draft(s,draft_id,0,changed_items,
    opened->'payload'->'etc_items',opened->'payload'->'extra_items');
  perform pg_temp.eq('판매 수량 증가 목표가 초안에 저장',
    (saved#>>'{payload,items,0,qty_hall}')::numeric,
    (opened#>>'{payload,items,0,qty_hall}')::numeric+1);
  perform pg_temp.ok('판매 수량 증가는 식재료 재고 delta를 만듦',
    exists(select 1 from public.sales_draft_inventory_deltas(draft_id)));
  perform pg_temp.ok('수정 대상 날짜는 완료한 실사 컷오프 안쪽',
    target_date<=(select inventory_cutoff_business_date from public.stores where id=s));
  pending:=public.finalize_sales_draft(s,draft_id,1,finalize_request,saved->>'payload_hash','과거 판매 증가');
  perform pg_temp.eq_t('실사 컷오프 이전 판매 증가는 재실사를 요구',
    pending->>'status','pending_inventory_resolution');

  started:=public.begin_inventory_count(s,session_id);
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
      'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts
  from unnest((select target_ingredient_ids from public.inventory_count_sessions where id=session_id)) ingredient_id;
  select coalesce(sum(public.stock_total_base(i.id)),0) into stock_before
    from public.ingredients i where i.store_id=s and i.active;
  committed:=public.commit_inventory_count_batch(s,session_id,counts,count_request);
  finalized:=public.finalize_sales_draft(s,draft_id,1,finalize_request,saved->>'payload_hash','과거 판매 증가');
  select coalesce(sum(public.stock_total_base(i.id)),0) into stock_after
    from public.ingredients i where i.store_id=s and i.active;
  perform pg_temp.eq_t('재실사로 해소한 판매 수정은 완료',finalized->>'status','finalized');
  perform pg_temp.eq('재실사가 흡수한 판매 증분은 현재 재고를 다시 차감하지 않음',stock_after,stock_before);

  expense_opened:=public.open_sales_draft(s,target_date,expense_draft_id);
  changed_extra:=coalesce(expense_opened->'payload'->'extra_items','[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','회귀 검증 지출',
      'amount',123,'memo','재고 무관'));
  expense_saved:=public.save_sales_draft(s,expense_draft_id,0,
    expense_opened->'payload'->'items',expense_opened->'payload'->'etc_items',changed_extra);
  select count(*) into events_before from public.inventory_events where store_id=s;
  expense_finalized:=public.finalize_sales_draft(s,expense_draft_id,1,expense_request,
    expense_saved->>'payload_hash','지출만 수정');
  select count(*) into events_after from public.inventory_events where store_id=s;
  perform pg_temp.eq_t('지출만 바꾼 후속 수정은 바로 완료',expense_finalized->>'status','finalized');
  perform pg_temp.eq('지출만 바꾼 후속 수정은 판매 재고 원장을 다시 만들지 않음',events_after,events_before);

  decrease_opened:=public.open_sales_draft(s,target_date,decrease_draft_id);
  select jsonb_agg(case when ord=1 then
      case when (item->>'qty_hall')::numeric>0 then
        jsonb_set(item,'{qty_hall}',to_jsonb((item->>'qty_hall')::numeric-1),false)
      when (item->>'qty_delivery')::numeric>0 then
        jsonb_set(item,'{qty_delivery}',to_jsonb((item->>'qty_delivery')::numeric-1),false)
      else jsonb_set(item,'{qty_takeout}',to_jsonb((item->>'qty_takeout')::numeric-1),false) end
      else item end order by ord)
    into decrease_items from jsonb_array_elements(decrease_opened->'payload'->'items')
      with ordinality source(item,ord);
  decrease_saved:=public.save_sales_draft(s,decrease_draft_id,0,decrease_items,
    decrease_opened->'payload'->'etc_items',decrease_opened->'payload'->'extra_items');
  decrease_finalized:=public.finalize_sales_draft(s,decrease_draft_id,1,decrease_request,
    decrease_saved->>'payload_hash','판매 수량 감소');
  perform pg_temp.eq_t('실사 컷오프 안쪽의 순수 판매 감소는 즉시 완료',
    decrease_finalized->>'status','finalized');
  perform pg_temp.ok('판매 감소는 보류 재고 행을 만들지 않음',not exists(
    select 1 from public.pending_sales_inventory_resolution p
     where p.draft_id=decrease_draft_id and p.status='pending'));

  swap_opened:=public.open_sales_draft(s,target_date,swap_draft_id);
  select jsonb_agg(case when ord=1 then
      jsonb_set(
        case when (item->>'qty_hall')::numeric>0 then
          jsonb_set(item,'{qty_hall}',to_jsonb((item->>'qty_hall')::numeric-1),false)
        when (item->>'qty_delivery')::numeric>0 then
          jsonb_set(item,'{qty_delivery}',to_jsonb((item->>'qty_delivery')::numeric-1),false)
        else jsonb_set(item,'{qty_takeout}',to_jsonb((item->>'qty_takeout')::numeric-1),false) end,
        '{qty_waste}',to_jsonb((item->>'qty_waste')::numeric+1),false)
      else item end order by ord)
    into swap_items from jsonb_array_elements(swap_opened->'payload'->'items')
      with ordinality source(item,ord);
  swap_saved:=public.save_sales_draft(s,swap_draft_id,0,swap_items,
    swap_opened->'payload'->'etc_items',swap_opened->'payload'->'extra_items');
  swap_pending:=public.finalize_sales_draft(s,swap_draft_id,1,swap_request,
    swap_saved->>'payload_hash','판매와 조리폐기 교환');
  perform pg_temp.eq_t('총소비가 같아도 판매·조리폐기 교환은 재실사를 요구',
    swap_pending->>'status','pending_inventory_resolution');
  perform pg_temp.eq('교환 보류는 증가하는 조리폐기 component만 보존',(
    select count(distinct p.waste) from public.pending_sales_inventory_resolution p
     where p.draft_id=swap_draft_id and p.status='pending'),1);

  select p.ingredient_id into abandoned_ing from public.pending_sales_inventory_resolution p
   where p.draft_id=swap_draft_id and p.status='pending' order by p.ingredient_id limit 1;
  perform public.discard_sales_draft(s,swap_draft_id,1);
  update public.ingredients set active=false where id=abandoned_ing;
  abandoned_started:=public.begin_inventory_count(s,abandoned_session);
  perform pg_temp.ok('폐기 초안의 비활성 미해소 재료도 다음 전체 실사 대상에 유지',
    exists(select 1 from public.inventory_count_sessions cs,
      lateral unnest(cs.target_ingredient_ids) target_id
      where cs.id=abandoned_session and target_id=abandoned_ing));
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
      'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into abandoned_counts
  from unnest((select target_ingredient_ids from public.inventory_count_sessions where id=abandoned_session)) ingredient_id;
  abandoned_committed:=public.commit_inventory_count_batch(s,abandoned_session,abandoned_counts,abandoned_request);
  perform pg_temp.ok('폐기 감사 상태는 유지하면서 실측 해소 batch를 연결',not exists(
    select 1 from public.pending_sales_inventory_resolution p
     where p.draft_id=swap_draft_id and p.status='abandoned' and p.resolved_by_count_batch_id is null));
end $test$;

-- 실사 도중 활성 식재료 집합이 바뀌면 전체 세션을 무효화한다.
do $test$
declare s uuid:=pg_temp.store(); session_id uuid:='98000000-0000-4000-8000-000000000003';
  started jsonb; counts jsonb; result jsonb; changed uuid;
begin
  started:=public.begin_inventory_count(s,session_id);
  perform pg_temp.raises('실사 관측 중 새 매출 초안은 열 수 없음',format(
    'select public.open_sales_draft(%L,%L,%L)',s,pg_temp.today(),
    '98000000-0000-4000-8000-000000000092'),'45027');
  select id into changed from public.ingredients where store_id=s and active order by id limit 1;
  update public.ingredients set active=false where id=changed;
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
    'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts from unnest((select target_ingredient_ids from public.inventory_count_sessions where id=session_id)) ingredient_id;
  result:=public.commit_inventory_count_batch(s,session_id,counts,'98000000-0000-4000-8000-000000000004');
  perform pg_temp.eq_t('대상 식재료 집합 변경은 세션 무효화',result->>'status','invalidated');
end $test$;
