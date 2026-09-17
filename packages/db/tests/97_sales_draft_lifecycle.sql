-- 피드 → 서버 초안 → 명시적 완료 → 불변 판본의 핵심 수명주기를 고정한다.
do $test$
declare
  s uuid:=pg_temp.store();
  target_date date:=pg_temp.today()-1;
  draft_id uuid:='97000000-0000-4000-8000-000000000001';
  missing_draft_id uuid:='97000000-0000-4000-8000-000000000003';
  missing_request_id uuid:='97000000-0000-4000-8000-000000000004';
  request_id uuid:='97000000-0000-4000-8000-000000000002';
  noop_draft_id uuid:='97000000-0000-4000-8000-000000000005';
  noop_request_id uuid:='97000000-0000-4000-8000-000000000006';
  opened jsonb; reopened jsonb; saved jsonb; finalized jsonb; missing_finalized jsonb; duplicate_result jsonb;
  noop_opened jsonb; noop_result jsonb; before_summary jsonb; after_summary jsonb; discard_result jsonb;
  items jsonb; payload_hash text; versions_before bigint; versions_after bigint;
  ledger_before integer; ledger_after integer; daily_before integer; daily_after integer;
  ingredient_id uuid; stock_before numeric; waste_delta numeric; profit_delta numeric;
begin
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  perform public.publish_sales_basis_version(s,public.sales_editable_from(s));
  reopened:=public.open_sales_draft(s,(date_trunc('month',target_date)-interval '1 month')::date,missing_draft_id);
  perform pg_temp.eq_t('과거 미작성일도 최초 작성 초안',reopened->>'kind','initial');
  missing_finalized:=public.finalize_sales_draft(s,missing_draft_id,0,missing_request_id,reopened->>'payload_hash','과거 최초 완료');
  perform pg_temp.eq_t('과거 미작성일을 영업 시작 없이 완료',missing_finalized->>'status','finalized');
  opened:=public.open_sales_draft(s,target_date,draft_id);
  reopened:=public.open_sales_draft(s,target_date,gen_random_uuid());
  perform pg_temp.eq_t('같은 날짜 재진입은 서버 초안을 이어서 엶',reopened->>'draft_id',draft_id::text);
  perform pg_temp.eq_t('종료된 날짜는 정정 초안으로 분류',opened->>'kind','amendment');
  perform pg_temp.ok('초안 메뉴는 영업일 기준 판매가를 제공',not exists(
    select 1 from jsonb_array_elements(opened->'payload'->'items') item
    where not(item ? 'price') or (item->>'price')::numeric<0));
  perform pg_temp.ok('초안은 서버 계산 손익 미리보기를 제공',
    opened->'payload'->'summary' ?& array['revenue','expense','profit','expense_rate','profit_rate']);
  perform pg_temp.ok('초안 손익 미리보기는 매출에서 지출을 뺀 값',abs(
    (opened->'payload'->'summary'->>'profit')::numeric
    -((opened->'payload'->'summary'->>'revenue')::numeric
      -(opened->'payload'->'summary'->>'expense')::numeric))<0.0001);

  items:=opened->'payload'->'items';
  perform pg_temp.raises('메뉴 일부만 보내는 초안 저장은 거부',format(
    'select public.save_sales_draft(%L,%L,0,''[]''::jsonb,''[]''::jsonb,''[]''::jsonb)',
    s,draft_id),'45043');

  saved:=public.save_sales_draft(s,draft_id,0,items,
    opened->'payload'->'etc_items',opened->'payload'->'extra_items');
  perform pg_temp.eq('초안 저장은 CAS 판본을 증가',(saved->>'revision')::numeric,1);
  perform pg_temp.raises('오래된 초안 판본의 저장은 거부',format(
    'select public.save_sales_draft(%L,%L,0,%L::jsonb,''[]''::jsonb,''[]''::jsonb)',
    s,draft_id,items),'45009');

  payload_hash:=saved->>'payload_hash';
  finalized:=public.finalize_sales_draft(s,draft_id,1,request_id,payload_hash,'회귀 검증');
  duplicate_result:=public.finalize_sales_draft(s,draft_id,1,request_id,payload_hash,'회귀 검증');
  perform pg_temp.eq_t('작성 완료 상태',finalized->>'status','finalized');
  perform pg_temp.ok('첫 완료는 중복 아님',(finalized->>'duplicate')::boolean=false);
  perform pg_temp.ok('같은 요청 완료 재시도는 영수증 반환',(duplicate_result->>'duplicate')::boolean=true);
  perform pg_temp.ok('완료 영수증은 같은 payload hash에서만 복구',
    public.get_sales_command_receipt(s,'finalize_sales_draft',request_id,payload_hash)->'result'->>'status'='finalized');
  perform pg_temp.eq('완료 판본은 한 건만 생성',(
    select count(*) from public.sales_day_versions where source_draft_id=draft_id),1);
  perform pg_temp.eq_t('날짜 읽기는 완료 상태',public.sales_day_read(s,target_date)->>'status','completed');

  select count(*) into versions_before from public.sales_day_versions
   where store_id=s and business_date=target_date;
  select ledger_revision into ledger_before from public.sales_day_heads
   where store_id=s and business_date=target_date;
  select revision into daily_before from public.daily_sales where store_id=s and sale_date=target_date;
  noop_opened:=public.open_sales_draft(s,target_date,noop_draft_id);
  noop_result:=public.finalize_sales_draft(s,noop_draft_id,0,noop_request_id,
    noop_opened->>'payload_hash','값이 같은 수정');
  select count(*) into versions_after from public.sales_day_versions
   where store_id=s and business_date=target_date;
  select ledger_revision into ledger_after from public.sales_day_heads
   where store_id=s and business_date=target_date;
  select revision into daily_after from public.daily_sales where store_id=s and sale_date=target_date;
  perform pg_temp.ok('값이 같은 수정은 무변경 완료로 닫힘',(noop_result->>'no_change')::boolean);
  perform pg_temp.eq('무변경 수정은 완료 판본을 늘리지 않음',versions_after,versions_before);
  perform pg_temp.eq('무변경 수정은 head 판본을 올리지 않음',ledger_after,ledger_before);
  perform pg_temp.eq('무변경 수정은 판매 원장 판본을 올리지 않음',daily_after,daily_before);

  select i.id,public.stock_total_base(i.id) into ingredient_id,stock_before
  from public.ingredients i where i.store_id=s and i.active
    and public.stock_total_base(i.id)>1 and public.base_unit_price(i.id)>0
  order by i.id limit 1;
  before_summary:=public.sales_effective_day_summary(s,target_date);
  discard_result:=public.e2_discard(ingredient_id,stock_before-1,target_date);
  after_summary:=public.sales_effective_day_summary(s,target_date);
  waste_delta:=(after_summary->>'waste_loss')::numeric-(before_summary->>'waste_loss')::numeric;
  profit_delta:=(before_summary->>'profit')::numeric-(after_summary->>'profit')::numeric;
  perform pg_temp.ok('완료 뒤 식재료 폐기는 해당 날짜 손실에 즉시 반영',waste_delta>0);
  perform pg_temp.ok('완료 뒤 폐기 손실만큼 순이익이 감소',abs(profit_delta-waste_delta)<0.0001);
  perform pg_temp.ok('완료 뒤 폐기에도 순이익률을 다시 계산',
    (after_summary->>'profit_rate')::numeric<>(before_summary->>'profit_rate')::numeric);
end $test$;

-- 편집 기간을 벗어난 초안만 원자 만료하고 대기 중 재고 해소 기록을 감사 상태로 남긴다.
do $test$
declare
  s uuid:=pg_temp.store(); basis uuid; ing uuid;
  editing_id uuid:='97000000-0000-4000-8000-000000000020';
  pending_id uuid:='97000000-0000-4000-8000-000000000021';
  discarded_id uuid:='97000000-0000-4000-8000-000000000022';
  expired_count integer; old_date date:=public.sales_editable_from(pg_temp.store())-1;
begin
  select id into basis from public.sales_basis_versions where store_id=s order by created_at limit 1;
  select id into ing from public.ingredients where store_id=s and active order by id limit 1;
  insert into public.sales_day_drafts(id,store_id,business_date,draft_kind,status,basis_version_id,
    payload_hash,expires_at,discarded_at)
  values
    (editing_id,s,old_date,'initial','editing',basis,repeat('1',64),clock_timestamp()-interval '1 day',null),
    (pending_id,s,old_date-1,'initial','pending_inventory_resolution',basis,repeat('2',64),clock_timestamp()-interval '1 day',null),
    (discarded_id,s,old_date-2,'initial','discarded',basis,repeat('3',64),clock_timestamp()-interval '1 day',clock_timestamp());
  insert into public.pending_sales_inventory_resolution(
    store_id,draft_id,line_id,ingredient_id,base_revision,basis_version_id,target_hash,delta,reported_at)
  values (s,pending_id,'97000000-0000-4000-8000-000000000023',ing,0,basis,
    repeat('4',64),1,clock_timestamp());

  expired_count:=public.expire_sales_drafts(s);
  perform pg_temp.eq('편집 중·재고 해소 대기 초안만 만료',expired_count,2);
  perform pg_temp.ok('조건부 갱신은 기존 terminal 초안을 유지',(
    select status='discarded' and discarded_at is not null from public.sales_day_drafts where id=discarded_id));
  perform pg_temp.eq_t('만료된 재고 해소 기록은 삭제 대신 abandoned로 보존',(
    select status from public.pending_sales_inventory_resolution where draft_id=pending_id),'abandoned');
end $test$;

do $test$
declare s uuid:=pg_temp.store(); state jsonb; rev integer;
  unresolved date:=pg_temp.today()+25;
  legacy_day date; legacy_recipe uuid;
begin
  update public.sales_lifecycle_cutover_state set phase='legacy_active',revision=0,
    freeze_receipt_id=null,inventory_reference_sales_date=unresolved,blocked_reason=null where store_id=s;
  delete from public.sales_calendar_days where store_id=s and business_date=unresolved;
  perform pg_temp.raises('해소되지 않은 추천일은 draining 진입 전에 차단',format(
    'select public.set_sales_lifecycle_phase(%L,0,''draining'',null)',s),'45047');
  perform pg_temp.eq_t('draining 사전 점검 실패는 legacy_active를 유지',(
    select phase::text from public.sales_lifecycle_cutover_state where store_id=s),'legacy_active');
  insert into public.sales_calendar_days(store_id,business_date,day_kind,source,timezone_id)
  values(s,unresolved,'closed','manual_closed',public.store_timezone(s));
  state:=public.set_sales_lifecycle_phase(s,0,'draining',null);
  select business_date into legacy_day from public.business_days
   where store_id=s and status in ('open','break') order by business_date desc limit 1;
  select id into legacy_recipe from public.recipes where store_id=s and active order by id limit 1;
  perform pg_temp.ok('draining 회귀 전제: 정상 종료할 legacy 영업일이 열려 있음',legacy_day is not null);
  perform public.e10_sale_recorded(s,legacy_day,legacy_recipe,1,0,0,0,false);
  perform public.transition_business_state(s,'end');
  insert into public.inventory_count_sessions(id,store_id,status,observation_started_at,expires_at,
    cutoff_business_date,target_ingredient_ids,stock_state,store_write_revision,
    event_sequence_high_watermark,cancelled_at)
  select gen_random_uuid(),s,'cancelled',clock_timestamp(),clock_timestamp()+interval '15 minutes',
    legacy_day,'{}'::uuid[],'{}'::jsonb,w.revision,
    coalesce((select max(seq) from public.inventory_events where store_id=s),0),clock_timestamp()
  from public.inventory_store_write_state w where w.store_id=s;
  rev:=(state->>'revision')::integer;
  state:=public.set_sales_lifecycle_phase(s,rev,'legacy_active',null);
  perform pg_temp.eq_t('draining 중 정상 legacy 판매·마감과 취소 실사는 컷오버 연기 복귀를 막지 않음',
    state->>'phase','legacy_active');
  rev:=(state->>'revision')::integer;
  state:=public.set_sales_lifecycle_phase(s,rev,'draining',null);
  rev:=(state->>'revision')::integer;
  state:=public.set_sales_lifecycle_phase(s,rev,'blocked','전환 전 점검 실패');
  rev:=(state->>'revision')::integer;
  state:=public.set_sales_lifecycle_phase(s,rev,'draining',null);
  perform pg_temp.eq_t('freeze 영수증 전 blocked는 draining으로 복구해 열린 영업일을 정리',
    state->>'phase','draining');
end $test$;

-- 구형 부분 E5가 있는 매장은 동결 진입 때 보수적으로 격리하고 전체 실사 전 활성화를 막는다.
do $test$
declare
  s uuid:=pg_temp.store(); ing uuid; reference_date date:=public.sales_recommended_date(pg_temp.store());
  state jsonb; rev integer; session_id uuid:='97000000-0000-4000-8000-000000000030';
  request_id uuid:='97000000-0000-4000-8000-000000000031'; counts jsonb;
begin
  select id into ing from public.ingredients where store_id=s and active order by id limit 1;
  update public.sales_lifecycle_cutover_state set phase='legacy_active',revision=0,
    freeze_receipt_id=null,inventory_reference_sales_date=null,blocked_reason=null where store_id=s;
  perform set_config('costkeep.sales_finalize','on',true);
  update public.business_days set status='closed',closed_at=coalesce(closed_at,clock_timestamp()),
    close_method=coalesce(close_method,'manual')
    where store_id=s and status in ('open','break');
  update public.sales_day_drafts set status='discarded',discarded_at=clock_timestamp()
    where store_id=s and status in ('editing','pending_inventory_resolution');
  perform set_config('costkeep.sales_finalize','',true);
  update public.inventory_count_sessions set status='cancelled',cancelled_at=clock_timestamp()
    where store_id=s and status='active';
  insert into public.sales_calendar_days(store_id,business_date,day_kind,source,timezone_id)
    values(s,reference_date,'closed','manual_closed',public.store_timezone(s))
    on conflict(store_id,business_date) do update set day_kind='closed',source='manual_closed';
  -- 전체 실사 batch에 연결되지 않은 구형 부분 stocktake 신호.
  insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
    note,occurred_at,unit_normalized)
  values(s,ing,'stocktake',0,0,'구형 부분 실사',clock_timestamp()-interval '1 day',true);

  state:=public.set_sales_lifecycle_phase(s,0,'draining',null);
  rev:=(state->>'revision')::integer;
  state:=public.set_sales_lifecycle_phase(s,rev,'freezing',null);
  rev:=(state->>'revision')::integer;
  perform pg_temp.eq_t('구형 부분 E5는 동결 기준일까지 보수 cutoff를 설정',(
    select legacy_inventory_cutoff_business_date::text from public.stores where id=s),reference_date::text);
  perform pg_temp.ok('구형 부분 E5는 전체 재실사를 요구',(
    select inventory_recount_required from public.stores where id=s));
  perform pg_temp.ok('매출 피드는 필요한 실사 진입 상태를 조회 가능',(
    public.sales_inventory_count_requirement(s)->>'required')::boolean);
  perform pg_temp.raises('구형 부분 E5 매장은 전체 실사 전 활성화 차단',format(
    'select public.set_sales_lifecycle_phase(%L,%s,''active'',null)',s,rev),'45047');

  -- 동결 중에도 재고를 바꾸는 일반 쓰기는 막고, 전체 실사만 복구 경로로 허용한다.
  perform public.ensure_sales_calendar_range(s,public.sales_editable_from(s),reference_date);
  update public.sales_calendar_days c set day_kind='closed',source='manual_closed',revision=revision+1
    where c.store_id=s and c.business_date between public.sales_editable_from(s) and reference_date
      and c.day_kind<>'closed'
      and not exists(select 1 from public.sales_day_heads h
        where h.store_id=s and h.business_date=c.business_date)
      and not exists(select 1 from public.business_days b
        where b.store_id=s and b.business_date=c.business_date and b.status='closed');
  perform public.begin_inventory_count(s,session_id);
  select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,
      'counted_quantity',public.stock_total_base(ingredient_id)) order by ingredient_id)
    into counts from unnest((select target_ingredient_ids from public.inventory_count_sessions
      where id=session_id)) ingredient_id;
  perform public.commit_inventory_count_batch(s,session_id,counts,request_id);
  state:=public.set_sales_lifecycle_phase(s,rev,'active',null);
  perform pg_temp.eq_t('동결 뒤 전체 실사를 마치면 새 수명주기 활성화',state->>'phase','active');
end $test$;

-- 과거 as-of 판본과 현재 publisher 상태는 서로 다른 계약이다.
do $test$
declare s uuid:=pg_temp.store(); recipe_id uuid; past_date date:=public.sales_editable_from(pg_temp.store());
  future_date date:=public.sales_recommended_date(pg_temp.store())+10;
  past_basis uuid; future_before uuid; future_after uuid; current_basis uuid;
begin
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  select id into recipe_id from public.recipes where store_id=s and active order by id limit 1;
  select id into past_basis from public.publish_sales_basis_version(s,past_date);
  select id into future_before from public.publish_sales_basis_version(s,future_date);
  perform pg_temp.eq_t('추천일 이후 새 기준 판본은 현재 master의 정확한 기준',(
    select basis_quality::text from public.sales_basis_versions where id=future_before),'exact');
  update public.recipes set price=price+3 where id=recipe_id;
  perform public.assert_sales_basis_version(s,past_basis,past_date,true);
  perform pg_temp.ok('현재 master가 바뀌어도 과거 날짜의 정상 as-of 판본은 유효',true);
  select id into future_after from public.sales_basis_versions
   where store_id=s and effective_from_business_date=future_date
   order by revision desc limit 1;
  perform pg_temp.ok('현재 기준 변경은 이미 예약된 미래 적용 경계를 다시 합성',future_after<>future_before);

  select id into current_basis from public.resolve_sales_basis_version(s,public.sales_recommended_date(s));
  update public.sales_basis_authority_clock set current_revision=current_revision+1 where store_id=s;
  perform pg_temp.raises('publisher가 현재 권위 revision을 처리하지 못하면 첫 저장을 닫음',format(
    'select public.assert_sales_basis_version(%L,%L,%L,true)',
    s,current_basis,public.sales_recommended_date(s)),'45009');
end $test$;

-- 레거시 장부도 피드에서는 새 작성 상태로 투영한다.
do $test$
declare s uuid:=pg_temp.store(); today date:=pg_temp.today(); feed jsonb; lifecycle_clock jsonb;
  month_start_before_open timestamptz;
  recipe_id uuid; effective_date date; basis_one uuid; basis_two uuid;
  basis_day date:=pg_temp.today()+40; next_basis_day date; basis_open timestamptz;
begin
  feed:=public.sales_feed(s,today-4,today,null,31);
  perform pg_temp.ok('피드가 기간 상태 집계를 제공',feed ? 'counts' and feed->'counts' ? 'editing' and feed->'counts' ? 'completed');
  perform pg_temp.ok('피드가 날짜별 작성 상태를 제공',jsonb_array_length(feed->'items')=5
    and not exists(select 1 from jsonb_array_elements(feed->'items') x where x->>'status' not in ('missing','editing','completed','closed')));
  perform pg_temp.ok('피드 날짜 행은 휴무 분류용 CAS 판본과 가능 여부를 제공',not exists(
    select 1 from jsonb_array_elements(feed->'items') x
     where not (x ? 'calendar_revision') or not (x ? 'can_classify')));
  perform pg_temp.ok('편집 기간의 미작성 영업일은 휴무로 확정 가능',not exists(
    select 1 from jsonb_array_elements(feed->'items') x
     where x->>'status'='missing' and not (x->>'can_classify')::boolean));
  lifecycle_clock:=public.sales_lifecycle_clock(s);
  perform pg_temp.ok('전역 서버 시계가 추천일과 basis 현재·발행 판본을 함께 제공',
    lifecycle_clock ? 'recommended_sales_date'
    and lifecycle_clock ? 'basis_current_revision'
    and lifecycle_clock ? 'basis_published_revision');

  if exists(select 1 from public.business_days where store_id=s and status in ('open','break')) then
    perform set_config('costkeep.sales_finalize','on',true);
    perform public.transition_business_state(s,'end');
    perform set_config('costkeep.sales_finalize','',true);
  end if;
  month_start_before_open:=make_timestamptz(2026,10,1,0,30,0,public.store_timezone(s));
  perform pg_temp.eq_t('월초 영업 시작 전 추천 매출일은 전월 말일',
    public.sales_recommended_date(s,month_start_before_open)::text,'2026-09-30');
  perform pg_temp.eq_t('편집 가능 시작일은 기기 월이 아닌 추천 매출일을 기준으로 계산',
    public.sales_editable_from(s,month_start_before_open)::text,'2026-08-01');

  while coalesce((public.store_hours_on(s,basis_day)->>'closed')::boolean,false) loop
    basis_day:=basis_day+1;
  end loop;
  basis_open:=public.scheduled_open_at(s,basis_day);
  next_basis_day:=basis_day+1;
  while coalesce((public.store_hours_on(s,next_basis_day)->>'closed')::boolean,false) loop
    next_basis_day:=next_basis_day+1;
  end loop;
  perform pg_temp.eq_t('예정 영업일의 영업 시작 전 기준 변경은 당일부터 적용',
    public.sales_basis_effective_date(s,basis_open-interval '1 minute')::text,basis_day::text);
  perform pg_temp.eq_t('예정 영업 시작 뒤 기준 변경은 다음 예정 영업일부터 적용',
    public.sales_basis_effective_date(s,basis_open+interval '1 minute')::text,next_basis_day::text);
  perform pg_temp.ok('기존 세금 설정 쓰기도 새 기준 적용일 resolver를 공유',
    position('sales_basis_effective_date' in pg_get_functiondef(
      'public.next_unopened_business_date(uuid)'::regprocedure))>0
    and position('next_unopened_business_date' in pg_get_functiondef(
      'public.save_store_tax_profile(uuid,jsonb,uuid,integer)'::regprocedure))>0
    and position('next_unopened_business_date' in pg_get_functiondef(
      'public.save_store_market_profile(uuid,jsonb,uuid,integer)'::regprocedure))>0
    and position('next_unopened_business_date' in pg_get_functiondef(
      'public.save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer)'::regprocedure))>0);

  update public.sales_lifecycle_cutover_state set phase='freezing' where store_id=s;
  perform pg_temp.raises('전환 동결 중 메뉴 기준 변경은 차단',format(
    'update public.recipes set name=name||%L where id=(select id from public.recipes where store_id=%L and active limit 1)',
    ' ',s),'45044');
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;

  select id into recipe_id from public.recipes where store_id=s and active order by id limit 1;
  update public.recipes set price=price+1 where id=recipe_id;
  effective_date:=public.sales_basis_effective_date(s);
  perform pg_temp.ok('메뉴 기준 변경은 source 판본 처리 상태를 남김',exists(
    select 1 from public.sales_basis_publisher_state where store_id=s
      and source_kind='recipes' and source_id=recipe_id::text));
  select id into basis_one from public.publish_sales_basis_version(s,effective_date);
  select id into basis_two from public.publish_sales_basis_version(s,effective_date);
  perform pg_temp.eq_t('같은 계산 입력의 기준 재발행은 같은 판본을 반환',basis_two::text,basis_one::text);
  perform pg_temp.ok('새 기준 판본은 처리한 source revision 목록을 봉인',exists(
    select 1 from public.sales_basis_versions b,
      lateral jsonb_array_elements(coalesce(b.manifest->'_source_state','[]'::jsonb)) source
    where b.id=basis_one and source->>'kind'='recipes' and source->>'id'=recipe_id::text));
  update public.recipes set price=price+1 where id=recipe_id;
  perform pg_temp.raises('작성 중 계산 기준보다 새 판본이 발행되면 이전 기준은 거부',format(
    'select public.assert_sales_basis_version(%L,%L,%L,true)',s,basis_one,effective_date),'45009');
end $test$;
