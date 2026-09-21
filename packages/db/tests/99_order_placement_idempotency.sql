-- ORD-002-04: E7 묶음 원자성, 응답 유실 재시도, 요청 키 충돌을 고정한다.
do $test$
declare
  s uuid := pg_temp.store();
  i1 uuid;
  i2 uuid;
  v uuid;
  key_ok uuid := gen_random_uuid();
  key_fail uuid := gen_random_uuid();
  payload jsonb;
  result1 jsonb;
  result2 jsonb;
  before_orders bigint;
  before_events bigint;
  before_trends bigint;
begin
  i1 := public.save_ingredient(s, '{"name":"원자 발주 재료 A","base_unit":"g","per_volume":1000,"purchase_price":4000}'::jsonb);
  i2 := public.save_ingredient(s, '{"name":"원자 발주 재료 B","base_unit":"ml","per_volume":500,"purchase_price":2500}'::jsonb);
  v := public.save_vendor(s, '{"name":"원자 발주 구매처"}'::jsonb);
  payload := jsonb_build_array(
    jsonb_build_object('ingredient_id',i1,'vendor_id',v,'volume',1000,'amount',4000,'qty',2,'expected_at',public.store_local_date(s)+1),
    jsonb_build_object('ingredient_id',i2,'vendor_id',v,'volume',500,'amount',2500,'qty',3,'expected_at',public.store_local_date(s)+2)
  );
  select count(*) into before_orders from public.order_records where store_id=s;
  select count(*) into before_events from public.inventory_events where store_id=s;
  select count(*) into before_trends from public.price_trends where store_id=s;

  result1 := public.place_orders(s,payload,key_ok);
  perform pg_temp.eq('발주 묶음은 두 건 모두 저장',
    (select count(*) from public.order_records where id in
      (select value::uuid from jsonb_array_elements_text(result1->'order_ids'))),2,0);
  perform pg_temp.eq('E7 묶음도 재고 원장을 만들지 않음',
    (select count(*) from public.inventory_events where store_id=s),before_events,0);
  perform pg_temp.eq('E7 묶음도 단가 추이를 만들지 않음',
    (select count(*) from public.price_trends where store_id=s),before_trends,0);

  result2 := public.place_orders(s,payload,key_ok);
  perform pg_temp.ok('응답 유실 재호출은 같은 ID와 duplicate=true',
    result2->'order_ids'=result1->'order_ids' and (result2->>'duplicate')::boolean);
  perform pg_temp.ok('응답 유실 조회는 recorded와 같은 ID를 반환',
    (public.resolve_order_placement(s,key_ok)->>'status')='recorded'
    and public.resolve_order_placement(s,key_ok)->'order_ids'=result1->'order_ids');
  perform pg_temp.eq('응답 유실 재호출은 발주를 중복 생성하지 않음',
    (select count(*) from public.order_records where store_id=s),before_orders+2,0);

  perform pg_temp.raises('같은 키의 다른 payload는 거부',
    format('select public.place_orders(%L,%L::jsonb,%L)',s,
      jsonb_set(payload,'{0,qty}','9'::jsonb),key_ok),'22000');

  perform pg_temp.raises('두 번째 항목 실패 시 첫 번째도 남기지 않음',
    format('select public.place_orders(%L,%L::jsonb,%L)',s,
      payload || jsonb_build_array(jsonb_build_object('ingredient_id',i2,'volume',0,'amount',1,'qty',1,
        'expected_at',public.store_local_date(s)+1)),key_fail),'22000');
  perform pg_temp.eq('부분 실패 뒤 발주 행 수 불변',
    (select count(*) from public.order_records where store_id=s),before_orders+2,0);
  perform pg_temp.eq_t('실패한 요청 조회는 not_recorded',
    public.resolve_order_placement(s,key_fail)->>'status','not_recorded');
end
$test$;

set local role postgres;
select pg_temp.ok('발주 영수증은 앱 역할에 직접 공개하지 않음',
  not has_table_privilege('authenticated','public.order_placement_receipts','SELECT')
  and not has_table_privilege('authenticated','public.order_placement_receipts','INSERT'));
select pg_temp.ok('발주 묶음과 결과 확인 RPC만 authenticated에 공개',
  has_function_privilege('authenticated','public.place_orders(uuid,jsonb,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.resolve_order_placement(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.place_orders(uuid,jsonb,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.resolve_order_placement(uuid,uuid)','EXECUTE'));

do $test$
declare
  owner1 uuid := pg_temp.owner();
  owner2 uuid := gen_random_uuid();
  s1 uuid := pg_temp.store();
  s2 uuid;
  foreign_ingredient uuid;
  before_orders bigint;
begin
  set local role postgres;
  insert into auth.users(id) values(owner2);
  perform pg_temp.as_owner(owner2);
  s2 := (public.create_store('발주 격리 매장','Asia/Seoul')->>'store_id')::uuid;
  foreign_ingredient := public.save_ingredient(s2,
    '{"name":"다른 매장 재료","base_unit":"ea","per_volume":1,"purchase_price":100}'::jsonb);
  perform pg_temp.as_owner(owner1);
  select count(*) into before_orders from public.order_records where store_id=s1;
  perform pg_temp.raises('다른 매장 식재료 발주는 거부',
    format('select public.place_orders(%L,%L::jsonb,%L)',s1,
      jsonb_build_array(jsonb_build_object('ingredient_id',foreign_ingredient,'volume',1,'amount',100,'qty',1,
        'expected_at',public.store_local_date(s1)+1)),gen_random_uuid()),'P0002');
  perform pg_temp.eq('다른 매장 거부 뒤 발주 행 수 불변',
    (select count(*) from public.order_records where store_id=s1),before_orders,0);
end
$test$;
