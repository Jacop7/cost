-- Repeated receipt/cancellation must compensate only the current receipt cycle.
-- run.mjs supplies _prelude.sql and rolls every synthetic fixture back.
do $test$
declare
  s uuid:=pg_temp.store(); i uuid; o uuid; result jsonb; cycle integer;
  original_rows jsonb; n bigint; first_event uuid; last_event uuid;
begin
  i:=save_ingredient(s,'{"name":"반복 입고 취소 회귀","base_unit":"g","per_volume":1000,"purchase_price":4000}');
  o:=e7_place_order(s,i,null,null,1000,4000,1,store_local_date(s));
  for cycle in 1..3 loop
    perform e1_confirm_inbound(o,1,'reversal-cycle-'||cycle);
    perform pg_temp.eq('회차 '||cycle||' 입고는 1000g',stock_total_base(i),1000);
    select jsonb_agg(to_jsonb(e) order by e.seq) into original_rows
      from inventory_events e where e.order_record_id=o and e.type='inbound';
    result:=e11_inbound_reverted(o,'회차 취소');
    perform pg_temp.eq('회차 '||cycle||' 취소량은 이번 입고 1000g',(result->>'reverted_base')::numeric,1000);
    perform pg_temp.eq('회차 '||cycle||' 취소 후 재고는 0g',stock_total_base(i),0);
    perform pg_temp.ok('회차 '||cycle||' 원 입고 행을 수정하지 않음',original_rows=(
      select jsonb_agg(to_jsonb(e) order by e.seq) from inventory_events e where e.order_record_id=o and e.type='inbound'));
    select count(*) into n from inventory_events where ingredient_id=i;
    result:=e11_inbound_reverted(o,'같은 취소 재시도');
    perform pg_temp.ok('회차 '||cycle||' 중복 취소는 무변경',
      (result->>'nothing_to_revert')::boolean and (select count(*)=n from inventory_events where ingredient_id=i));
    perform pg_temp.eq('회차 '||cycle||' 재고와 원장 합계 일치',stock_total_base(i),
      (select sum(count_delta) from inventory_events where ingredient_id=i));
  end loop;
  perform pg_temp.eq('모든 원 입고는 정확히 하나의 반대 원장으로 연결',(
    select count(*) from inventory_events e join inventory_events r on r.reverses_event_id=e.id
    where e.order_record_id=o and e.type='inbound' and r.count_delta=-e.count_delta),3);
  perform pg_temp.ok('최신 입고도 취소 뒤에는 후보로 승격되지 않음',
    not exists(select 1 from stock_revert_candidates(i) where eligible));

  -- A later cycle containing one receipt is independently cancellable from history.
  perform e1_confirm_inbound(o,1,'reversal-history-cycle');
  select id into last_event from inventory_events where order_record_id=o and type='inbound' order by seq desc limit 1;
  select id into first_event from inventory_events where order_record_id=o and type='inbound' order by seq limit 1;
  perform pg_temp.ok('과거 취소 회차는 최신 단일 입고의 취소를 막지 않음',
    exists(select 1 from stock_revert_candidates(i) where event_id=last_event and eligible));
  perform revert_latest_stock_event(last_event);
  perform pg_temp.eq('재고 내역 경유 취소도 현 회차만 되돌림',stock_total_base(i),0);
  select count(*) into n from inventory_events where ingredient_id=i;
  perform revert_latest_stock_event(last_event);
  perform e11_inbound_reverted(o);
  perform pg_temp.eq('두 취소 경로 재시도는 추가 원장 없음',(select count(*) from inventory_events where ingredient_id=i),n);
  perform pg_temp.raises('이전 취소 회차의 입고는 다시 취소 불가',format('select revert_latest_stock_event(%L)',first_event),'22000');
end $test$;

do $test$
declare s uuid:=pg_temp.store(); i uuid; o uuid; result jsonb; last_event uuid;
begin
  i:=save_ingredient(s,'{"name":"부분 입고 다회 취소","base_unit":"ml","per_volume":250,"purchase_price":1500}');
  o:=e7_place_order(s,i,null,null,250,1500,4,store_local_date(s));
  perform e1_confirm_inbound(o,0.5,'partial-cycle-1a');
  perform e1_confirm_inbound(o,1.5,'partial-cycle-1b');
  perform pg_temp.eq('부분 입고 합계 500ml',stock_total_base(i),500);
  select id into last_event from inventory_events where order_record_id=o and type='inbound' order by seq desc limit 1;
  perform pg_temp.raises('여러 부분 입고를 단일 내역 취소로 감추지 않음',format('select revert_latest_stock_event(%L)',last_event),'22000');
  result:=e11_inbound_reverted(o);
  perform pg_temp.eq('첫 부분 입고 회차 취소량',(result->>'reverted_base')::numeric,500);
  perform e1_confirm_inbound(o,1,'partial-cycle-2a');
  perform e1_confirm_inbound(o,2,'partial-cycle-2b');
  result:=e11_inbound_reverted(o);
  perform pg_temp.eq('다음 부분 입고 회차는 750ml만 취소',(result->>'reverted_base')::numeric,750);
  perform pg_temp.eq('부분 입고 반복 취소 후 0ml',stock_total_base(i),0);
  perform pg_temp.eq('부분 입고 원본 네 건 각각 반전 연결',(
    select count(*) from inventory_events e join inventory_events r on r.reverses_event_id=e.id
    where e.order_record_id=o and e.type='inbound' and r.count_delta=-e.count_delta),4);
  perform pg_temp.ok('취소 후 발주는 재입고 가능한 상태',
    (select received_qty=0 and status='ordered' from order_records where id=o));
end $test$;

-- Legacy E11 compensation has no reverses_event_id. Preserve it byte-for-byte;
-- the later receipt cycle must not include original rows before that compensation.
do $test$
declare s uuid:=pg_temp.store(); i uuid; o uuid; old_rows jsonb; result jsonb;
begin
  i:=save_ingredient(s,'{"name":"기존 무연결 취소 후 입고","base_unit":"ea","per_volume":30,"purchase_price":6000}');
  o:=e7_place_order(s,i,null,null,30,6000,2,store_local_date(s));
  perform e1_confirm_inbound(o,2,'legacy-cycle-original');
  perform consume_stock(i,60,true);
  insert into inventory_events(store_id,ingredient_id,type,count_delta,order_record_id,note,unit_normalized)
    values(s,i,'adjust',-60,o,'이전 버전의 입고 취소',true);
  update order_records set received_qty=0,status='ordered' where id=o;
  select jsonb_agg(to_jsonb(e) order by e.seq) into old_rows from inventory_events e where e.order_record_id=o;
  perform e1_confirm_inbound(o,1,'legacy-cycle-new');
  result:=e11_inbound_reverted(o);
  perform pg_temp.eq('기존 무연결 취소 이후 입고는 30개만 취소',(result->>'reverted_base')::numeric,30);
  perform pg_temp.eq('기존 무연결 취소와 재취소 후 재고0',stock_total_base(i),0);
  perform pg_temp.ok('기존 원장 행은 연결정보를 소급 수정하지 않음',not exists(
    select 1 from jsonb_array_elements(old_rows) old_row
    left join inventory_events e on e.id=(old_row->>'id')::uuid where to_jsonb(e) is distinct from old_row));
  perform pg_temp.eq('기존 원장 포함 재고 합계',(select sum(count_delta) from inventory_events where ingredient_id=i),0);
end $test$;

set local role postgres;
do $test$
declare stage text; u uuid; s uuid; i uuid; r uuid; o uuid; result jsonb; bd uuid;
  d date; snapshot_before jsonb; prior_snapshot jsonb; prior_day uuid; original_rows jsonb; n bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(create_store('입고 취소 영업 기준 '||stage,'Asia/Seoul')->>'store_id')::uuid;
    d:=store_local_date(s);
    i:=save_ingredient(s,'{"name":"연결 재료","base_unit":"g","per_volume":1000,"purchase_price":4000}');
    perform quick_inbound(s,i,1000,4000,1,null,d,gen_random_uuid()::text);
    r:=save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','연결 메뉴','price',12000,'base_servings',1,'target_profit_rate',30,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100)),'extras','[]'::jsonb));
    set local role postgres;
    insert into business_days(store_id,business_date,status,planned_close_at,snapshot)
      values(s,d-1,'open',clock_timestamp()+interval '1 hour',build_day_snapshot(s,d-1)) returning id into prior_day;
    perform close_business_day_row(prior_day,'manual');
    select snapshot into prior_snapshot from business_days where id=prior_day;
    bd:=null;
    if stage<>'before_open' then
      insert into business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',build_day_snapshot(s,d)) returning id,snapshot into bd,snapshot_before;
      if stage='break' then update business_days set status='break' where id=bd; end if;
      if stage='closed' then perform close_business_day_row(bd,'manual'); select snapshot into snapshot_before from business_days where id=bd; end if;
    end if;
    perform pg_temp.as_owner(u);
    o:=e7_place_order(s,i,null,null,1000,12000,2,d);
    perform e1_confirm_inbound(o,1,gen_random_uuid()::text,d);
    perform e11_inbound_reverted(o);
    perform e1_confirm_inbound(o,0.5,gen_random_uuid()::text,d);
    perform e1_confirm_inbound(o,0.5,gen_random_uuid()::text,d);
    perform pg_temp.eq(stage||': 재입고 현재 재료 단가8',current_ingredient_unit_price(i),8);
    perform pg_temp.eq(stage||': 영업 상태별 메뉴 원가',
      coalesce(recipe_detail(r)#>>'{effective,material_cost}',recipe_detail(r)->>'material_cost')::numeric,
      case when stage in ('open','break') then 400 else 800 end);
    select jsonb_agg(to_jsonb(e) order by e.seq) into original_rows from inventory_events e where e.order_record_id=o and e.type='inbound';
    if stage='open' then
      perform pg_temp.e10(s,d,r,15);
      perform pg_temp.eq('중간 판매 1500g 소진',stock_total_base(i),500);
    end if;
    result:=e11_inbound_reverted(o);
    perform pg_temp.eq(stage||': 현 회차 취소량1000',(result->>'reverted_base')::numeric,1000);
    perform pg_temp.eq(stage||': 판매 후 음수도 전량 취소',stock_total_base(i),case when stage='open' then -500 else 1000 end);
    perform pg_temp.eq(stage||': 남은 실입고 단가4',current_ingredient_unit_price(i),4);
    perform pg_temp.eq(stage||': 연결 메뉴 현재 재료비400',recipe_material_cost(r),400);
    perform pg_temp.ok(stage||': 원 입고 행 보존',original_rows=(
      select jsonb_agg(to_jsonb(e) order by e.seq) from inventory_events e where e.order_record_id=o and e.type='inbound'));
    perform pg_temp.ok(stage||': 이전 종료 영업일 스냅샷 보존',
      (select snapshot=prior_snapshot and status='closed' from business_days where id=prior_day));
    if bd is not null then
      perform pg_temp.ok(stage||': 시작/종료 스냅샷 보존',(select snapshot=snapshot_before from business_days where id=bd));
    end if;
    if stage='open' then
      select count(*) into n from inventory_events where ingredient_id=i;
      perform pg_temp.e10(s,d,r,15);
      perform pg_temp.eq('입고 취소 후 같은 판매 저장은 원장 추가 없음',(select count(*) from inventory_events where ingredient_id=i),n);
      perform pg_temp.e10(s,d,r,0);
      perform pg_temp.eq('판매 취소는 원 판매 소진량만 복원',stock_total_base(i),1000);
    end if;
    perform pg_temp.eq(stage||': 재고와 원장 합계 일치',stock_total_base(i),(select sum(count_delta) from inventory_events where ingredient_id=i));
    set local role postgres;
  end loop;
end $test$;
