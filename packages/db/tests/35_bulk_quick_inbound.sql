-- ING-12: 여러 직접 입고를 한 트랜잭션·한 요청 영수증으로 확정한다.
do $test$
declare
  s uuid := pg_temp.store();
  i1 uuid;
  i2 uuid;
  vendor uuid;
  vendor2 uuid;
  request_key uuid := '12121212-1212-4121-8121-121212121212';
  c1 uuid := '11111111-1111-4111-8111-111111111111';
  c2 uuid := '22222222-2222-4222-8222-222222222222';
  payload jsonb;
  preview jsonb;
  preview_same jsonb;
  result1 jsonb;
  result2 jsonb;
  same_payload jsonb;
  same_preview jsonb;
  same_result jsonb;
  stock1 numeric;
  stock2 numeric;
  price_before numeric;
  expected_price numeric;
  orders0 bigint;
  events0 bigint;
begin
  i1 := public.save_ingredient(s,'{"name":"일괄 입고 재료 A","base_unit":"g","per_volume":1000,"purchase_price":4000}'::jsonb);
  i2 := public.save_ingredient(s,'{"name":"일괄 입고 재료 B","base_unit":"ml","per_volume":500,"purchase_price":2500}'::jsonb);
  vendor := public.save_vendor(s,'{"name":"일괄 입고 구매처"}'::jsonb);
  vendor2 := public.save_vendor(s,'{"name":"일괄 입고 구매처 2"}'::jsonb);
  stock1 := public.stock_total_base(i1);
  stock2 := public.stock_total_base(i2);
  select count(*) into orders0 from public.order_records where store_id=s;
  select count(*) into events0 from public.inventory_events where store_id=s;
  payload := jsonb_build_array(
    jsonb_build_object('client_item_id',c1,'ingredient_id',i1,'vendor_id',vendor,
      'received_quantity',1000,'paid_amount',4000),
    jsonb_build_object('client_item_id',c2,'ingredient_id',i2,'vendor_id',null,
      'received_quantity',500,'paid_amount',3000)
  );

  preview := public.quick_inbound_batch_preview(s,payload);
  perform pg_temp.eq('미리보기 첫 재료 재고 후',
    (preview#>>'{items,0,stock_after}')::numeric,stock1+1000,0.001);
  perform pg_temp.eq('미리보기 둘째 재료 입고 단가',
    (preview#>>'{items,1,inbound_unit_price}')::numeric,6,0.000001);
  perform pg_temp.eq('미리보기는 발주를 만들지 않음',
    (select count(*) from public.order_records where store_id=s),orders0,0);
  preview_same := public.quick_inbound_batch_preview(s,jsonb_build_array(
    jsonb_build_object('client_item_id','91919191-9191-4191-8191-919191919191','ingredient_id',i1,
      'vendor_id',null,'received_quantity',10,'paid_amount',20),
    jsonb_build_object('client_item_id','92929292-9292-4292-8292-929292929292','ingredient_id',i1,
      'vendor_id',null,'received_quantity',20,'paid_amount',60)
  ));
  perform pg_temp.eq('같은 재료 둘째 카드는 첫 카드 입고 후 재고에서 시작',
    (preview_same#>>'{items,1,stock_before}')::numeric,stock1+10,0.001);

  result1 := public.record_current_quick_inbound_batch(s,payload,request_key);
  perform pg_temp.eq('일괄 입고는 카드 수만큼 E7 생성',
    (select count(*) from public.order_records where store_id=s),orders0+2,0);
  perform pg_temp.eq('일괄 입고는 카드 수만큼 E1 생성',
    (select count(*) from public.inventory_events where store_id=s),events0+2,0);
  perform pg_temp.eq('첫 재료 현재고 확정',public.stock_total_base(i1),stock1+1000,0.001);
  perform pg_temp.eq('둘째 재료 현재고 확정',public.stock_total_base(i2),stock2+500,0.001);
  perform pg_temp.eq('응답에 카드별 결과 두 건',jsonb_array_length(result1->'items'),2,0);
  perform pg_temp.ok('응답에 카드별 ID·재고·단가·영향 메뉴를 모두 제공',not exists(
    select 1 from jsonb_array_elements(result1->'items') item
     where nullif(item->>'ingredient_id','') is null
        or nullif(item->>'order_id','') is null
        or nullif(item->>'inventory_event_id','') is null
        or item->'stock_before' is null
        or item->'stock_after' is null
        or item->'base_price_after' is null
        or item->'affected_recipes' is null));

  result2 := public.record_current_quick_inbound_batch(s,payload,request_key);
  perform pg_temp.ok('같은 배치 재호출은 영수증 반환',(result2->>'duplicate')::boolean);
  perform pg_temp.eq('같은 배치 재호출은 발주를 늘리지 않음',
    (select count(*) from public.order_records where store_id=s),orders0+2,0);
  perform pg_temp.eq_t('기록된 배치는 조회로 복구',
    public.resolve_quick_inbound_batch(s,request_key)->>'status','recorded');
  perform pg_temp.raises('같은 키의 다른 금액은 거부',format(
    'select public.record_current_quick_inbound_batch(%L,%L::jsonb,%L)',s,
    jsonb_set(payload,'{0,paid_amount}','5000'::jsonb),request_key),'45021');

  stock1 := public.stock_total_base(i1);
  price_before := public.base_unit_price(i1);
  same_payload := jsonb_build_array(
    jsonb_build_object('client_item_id','93939393-9393-4393-8393-939393939393','ingredient_id',i1,
      'vendor_id',vendor,'received_quantity',10,'paid_amount',20),
    jsonb_build_object('client_item_id','94949494-9494-4494-8494-949494949494','ingredient_id',i1,
      'vendor_id',vendor2,'received_quantity',20,'paid_amount',60)
  );
  same_preview := public.quick_inbound_batch_preview(s,same_payload);
  same_result := public.record_current_quick_inbound_batch(
    s,same_payload,'95959595-9595-4595-8595-959595959595');
  expected_price := ((price_before*stock1)+80)/(stock1+30);
  perform pg_temp.eq('같은 재료 두 구매처의 최종 기준단가는 전체 금액·입고량 가중 결과',
    public.base_unit_price(i1),expected_price,0.000001);
  perform pg_temp.eq('무경합 미리보기와 확정의 마지막 카드 단가 일치',
    (same_preview#>>'{items,1,base_price_after}')::numeric,
    (same_result#>>'{items,1,base_price_after}')::numeric,0.000001);
  perform pg_temp.eq('같은 재료 두 카드에 서로 다른 구매처 기록 보존',(
    select count(distinct o.vendor_id)
      from public.order_records o
     where o.id in (
       (same_result#>>'{items,0,order_id}')::uuid,
       (same_result#>>'{items,1,order_id}')::uuid
     )),2,0);
end
$test$;

-- 두 번째 카드에서 충돌해도 첫 카드의 E7/E1/추이는 모두 롤백한다.
do $test$
declare
  s uuid := pg_temp.store();
  i1 uuid := pg_temp.ing('일괄 입고 재료 A');
  i2 uuid := pg_temp.ing('일괄 입고 재료 B');
  v_request_key uuid := '34343434-3434-4343-8343-343434343434';
  c1 uuid := '33333333-3333-4333-8333-333333333333';
  c2 uuid := '44444444-4444-4444-8444-444444444444';
  collision_key text;
  payload jsonb;
  stock1 numeric;
  orders1 bigint;
  events1 bigint;
  trends1 bigint;
begin
  collision_key := v_request_key::text || ':' || c2::text;
  perform public.record_current_quick_inbound(s,i2,10,20,1,null,collision_key);
  stock1 := public.stock_total_base(i1);
  select count(*) into orders1 from public.order_records where store_id=s and ingredient_id=i1;
  select count(*) into events1 from public.inventory_events where store_id=s and ingredient_id=i1;
  select count(*) into trends1 from public.price_trends where store_id=s and ingredient_id=i1;
  payload := jsonb_build_array(
    jsonb_build_object('client_item_id',c1,'ingredient_id',i1,'vendor_id',null,'received_quantity',10,'paid_amount',30),
    jsonb_build_object('client_item_id',c2,'ingredient_id',i2,'vendor_id',null,'received_quantity',10,'paid_amount',20)
  );
  perform pg_temp.raises('둘째 카드 키 충돌은 전체 배치 거부',format(
    'select public.record_current_quick_inbound_batch(%L,%L::jsonb,%L)',s,payload,v_request_key),'45021');
  perform pg_temp.eq('실패한 첫 카드 발주 롤백',
    (select count(*) from public.order_records where store_id=s and ingredient_id=i1),orders1,0);
  perform pg_temp.eq('실패한 첫 카드 원장 롤백',
    (select count(*) from public.inventory_events where store_id=s and ingredient_id=i1),events1,0);
  perform pg_temp.eq('실패한 첫 카드 단가 추이 롤백',
    (select count(*) from public.price_trends where store_id=s and ingredient_id=i1),trends1,0);
  perform pg_temp.eq('실패한 첫 카드 현재고 롤백',public.stock_total_base(i1),stock1,0.001);
  perform pg_temp.ok('실패한 배치 영수증 없음',not exists(
    select 1 from public.quick_inbound_batch_receipts r where r.store_id=s and r.request_key=v_request_key));
end
$test$;

-- not_recorded 확인은 요청 키를 닫아 늦은 재전송을 차단한다.
do $test$
declare
  s uuid := pg_temp.store();
  i uuid := pg_temp.ing('일괄 입고 재료 A');
  request_key uuid := '56565656-5656-4565-8565-565656565656';
  payload jsonb := jsonb_build_array(jsonb_build_object(
    'client_item_id','55555555-5555-4555-8555-555555555555','ingredient_id',i,
    'vendor_id',null,'received_quantity',1,'paid_amount',1));
begin
  perform pg_temp.eq_t('기록되지 않은 배치는 not_recorded',
    public.resolve_quick_inbound_batch(s,request_key)->>'status','not_recorded');
  perform pg_temp.raises('확인 뒤 늦은 배치 저장 차단',format(
    'select public.record_current_quick_inbound_batch(%L,%L::jsonb,%L)',s,payload,request_key),'45010');
end
$test$;

-- 다른 매장·다른 실행자의 재료와 요청 상태를 읽거나 쓸 수 없다.
do $test$
declare
  owner1 uuid := pg_temp.owner();
  owner2 uuid := gen_random_uuid();
  s1 uuid := pg_temp.store();
  s2 uuid;
  foreign_ingredient uuid;
  payload jsonb;
begin
  set local role postgres;
  insert into auth.users(id) values(owner2);
  perform pg_temp.as_owner(owner2);
  s2 := (public.create_store('일괄 입고 격리 매장','Asia/Seoul')->>'store_id')::uuid;
  foreign_ingredient := public.save_ingredient(s2,
    '{"name":"다른 매장 일괄 재료","base_unit":"g","per_volume":1,"purchase_price":1}'::jsonb);
  perform pg_temp.as_owner(owner1);
  payload := jsonb_build_array(jsonb_build_object(
    'client_item_id','73737373-7373-4373-8373-737373737373','ingredient_id',foreign_ingredient,
    'vendor_id',null,'received_quantity',1,'paid_amount',1));
  perform pg_temp.raises('다른 매장 재료 일괄 입고 거부',format(
    'select public.record_current_quick_inbound_batch(%L,%L::jsonb,%L)',s1,payload,gen_random_uuid()),'P0002');
  perform pg_temp.raises('다른 매장 배치 결과 확인 거부',format(
    'select public.resolve_quick_inbound_batch(%L,%L)',s2,gen_random_uuid()),null);
end
$test$;

-- 활성 전체 실사와 겹치면 첫 카드조차 남기지 않는다.
do $test$
declare
  s uuid := pg_temp.store();
  owner_id uuid := pg_temp.owner();
  i uuid := pg_temp.ing('일괄 입고 재료 A');
  session_id uuid := '78787878-7878-4787-8787-787878787878';
  request_key uuid := '67676767-6767-4676-8676-676767676767';
  payload jsonb := jsonb_build_array(jsonb_build_object(
    'client_item_id','66666666-6666-4666-8666-666666666666','ingredient_id',i,
    'vendor_id',null,'received_quantity',1,'paid_amount',1));
  orders0 bigint;
  events0 bigint;
begin
  select count(*) into orders0 from public.order_records where store_id=s;
  select count(*) into events0 from public.inventory_events where store_id=s;
  set local role postgres;
  insert into public.inventory_count_sessions(
    id,store_id,status,observation_started_at,expires_at,cutoff_business_date,
    target_ingredient_ids,stock_state,store_write_revision,event_sequence_high_watermark,created_by)
  select session_id,s,'active',clock_timestamp(),clock_timestamp()+interval '15 minutes',
    public.store_local_date(s),array[i],jsonb_build_object(i::text,public.stock_total_base(i)),
    state.revision,coalesce((select max(seq) from public.inventory_events where store_id=s),0),owner_id
  from public.inventory_store_write_state state where state.store_id=s;
  perform pg_temp.as_owner(owner_id);
  perform pg_temp.raises('활성 실사 중 일괄 입고 전체 거부',format(
    'select public.record_current_quick_inbound_batch(%L,%L::jsonb,%L)',s,payload,request_key),'45027');
  perform pg_temp.eq('실사 충돌 뒤 발주 행 수 불변',
    (select count(*) from public.order_records where store_id=s),orders0,0);
  perform pg_temp.eq('실사 충돌 뒤 재고 원장 수 불변',
    (select count(*) from public.inventory_events where store_id=s),events0,0);
end
$test$;

set local role postgres;
select pg_temp.ok('일괄 입고 영수증은 앱 역할에 직접 공개하지 않음',
  not has_table_privilege('authenticated','public.quick_inbound_batch_receipts','SELECT')
  and not has_table_privilege('authenticated','public.quick_inbound_batch_receipts','INSERT')
  and not has_table_privilege('authenticated','public.quick_inbound_batch_closed_requests','SELECT')
  and not has_table_privilege('authenticated','public.quick_inbound_batch_closed_requests','INSERT'));
select pg_temp.ok('실행 역할도 영수증 갱신·삭제 권한 없음',
  has_table_privilege('costkeep_rpc_executor','public.quick_inbound_batch_receipts','SELECT')
  and has_table_privilege('costkeep_rpc_executor','public.quick_inbound_batch_receipts','INSERT')
  and not has_table_privilege('costkeep_rpc_executor','public.quick_inbound_batch_receipts','UPDATE')
  and not has_table_privilege('costkeep_rpc_executor','public.quick_inbound_batch_receipts','DELETE'));
select pg_temp.ok('배치 RPC만 로그인 역할에 공개',
  has_function_privilege('authenticated','public.quick_inbound_batch_preview(uuid,jsonb)','EXECUTE')
  and has_function_privilege('authenticated','public.record_current_quick_inbound_batch(uuid,jsonb,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.resolve_quick_inbound_batch(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.record_current_quick_inbound_batch(uuid,jsonb,uuid)','EXECUTE'));
